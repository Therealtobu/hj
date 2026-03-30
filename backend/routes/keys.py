"""
routes/keys.py — Key system: create, list, delete, verify keys + loader config
"""
import time, uuid, secrets, string
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from google.cloud import firestore

from firebase_db import get_db
from auth import current_user

router = APIRouter(tags=["keys"])

ALPHABET = string.ascii_uppercase + string.digits


def _gen_key(tier: str) -> str:
    parts = ["EXE", tier.upper()]
    for _ in range(3):
        parts.append("".join(secrets.choice(ALPHABET) for _ in range(6)))
    return "-".join(parts)


# ── Loader config (per project) ───────────────────────────────────────────────

class LoaderConfigBody(BaseModel):
    role_management: bool = False
    free_script_id:  Optional[str] = None
    paid_script_id:  Optional[str] = None
    force_getkey:    bool = False   # Free users must complete getkey flow


@router.get("/projects/{project_id}/loader-config")
async def get_loader_config(project_id: str, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    doc = await db.collection("projects").document(project_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")
    cfg = doc.to_dict().get("loader_config", {})
    return {
        "role_management": cfg.get("role_management", False),
        "free_script_id":  cfg.get("free_script_id"),
        "paid_script_id":  cfg.get("paid_script_id"),
        "force_getkey":    cfg.get("force_getkey", False),
    }


@router.put("/projects/{project_id}/loader-config")
async def save_loader_config(project_id: str, body: LoaderConfigBody, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    doc = await db.collection("projects").document(project_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")

    await db.collection("projects").document(project_id).update({
        "loader_config": {
            "role_management": body.role_management,
            "free_script_id":  body.free_script_id,
            "paid_script_id":  body.paid_script_id,
            "force_getkey":    body.force_getkey,
        }
    })
    return {"ok": True}


# ── Key CRUD ──────────────────────────────────────────────────────────────────

class KeyBody(BaseModel):
    tier:       str = "free"   # "free" | "paid"
    note:       str = ""
    expires_at: Optional[int] = None   # Unix timestamp, None = never


@router.get("/projects/{project_id}/keys")
async def list_keys(project_id: str, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    doc = await db.collection("projects").document(project_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")
    docs = await db.collection("keys").where("project_id", "==", project_id).get()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.post("/projects/{project_id}/keys")
async def create_key(project_id: str, body: KeyBody, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    doc = await db.collection("projects").document(project_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")

    tier = body.tier.lower()
    if tier not in ("free", "paid"):
        raise HTTPException(400, "Tier must be 'free' or 'paid'")

    key_str = _gen_key(tier)
    kid     = str(uuid.uuid4())
    await db.collection("keys").document(kid).set({
        "project_id": project_id,
        "key":        key_str,
        "tier":       tier,
        "note":       body.note.strip(),
        "hwid":       None,      # Locked to HWID on first use
        "uses":       0,
        "active":     True,
        "expires_at": body.expires_at,
        "created_at": int(time.time()),
    })
    return {"id": kid, "key": key_str, "tier": tier, "note": body.note}


@router.delete("/projects/{project_id}/keys/{key_id}")
async def delete_key(project_id: str, key_id: str, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    proj = await db.collection("projects").document(project_id).get()
    if not proj.exists or proj.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")
    doc = await db.collection("keys").document(key_id).get()
    if not doc.exists or doc.to_dict().get("project_id") != project_id:
        raise HTTPException(404, "Key not found")
    await doc.reference.delete()
    return {"ok": True}


@router.patch("/projects/{project_id}/keys/{key_id}/reset-hwid")
async def reset_key_hwid(project_id: str, key_id: str, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    """Clear the HWID lock so the key can be used on a new device."""
    proj = await db.collection("projects").document(project_id).get()
    if not proj.exists or proj.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")
    doc = await db.collection("keys").document(key_id).get()
    if not doc.exists or doc.to_dict().get("project_id") != project_id:
        raise HTTPException(404, "Key not found")
    await db.collection("keys").document(key_id).update({"hwid": None})
    return {"ok": True}


# ── Public verify endpoint (called by loader) ─────────────────────────────────

class VerifyBody(BaseModel):
    key:        str
    hwid:       str
    project_id: str


@router.post("/keys/verify")
async def verify_key(body: VerifyBody, request: Request, db: firestore.AsyncClient = Depends(get_db)):
    """
    Verifies a key for loader use.
    - Checks key exists, is active, not expired
    - Locks HWID on first use
    - Returns tier + target script_id based on project loader_config
    """
    key_str = body.key.strip()
    hwid    = body.hwid.strip()
    if not key_str or not hwid:
        raise HTTPException(400, "key and hwid required")

    # Find key
    docs = await db.collection("keys") \
        .where("project_id", "==", body.project_id) \
        .where("key", "==", key_str).limit(1).get()
    if not docs:
        raise HTTPException(401, "Invalid key")

    kdoc = docs[0]
    k    = {**kdoc.to_dict()}

    if not k.get("active"):
        raise HTTPException(401, "Key is disabled")

    if k.get("expires_at") and k["expires_at"] < int(time.time()):
        raise HTTPException(401, "Key has expired")

    # HWID lock
    if k.get("hwid") and k["hwid"] != hwid:
        raise HTTPException(401, "Key is locked to a different device")

    if not k.get("hwid"):
        # First use — lock to this HWID
        await kdoc.reference.update({"hwid": hwid, "uses": k.get("uses", 0) + 1})
    else:
        await kdoc.reference.update({"uses": k.get("uses", 0) + 1})

    # Check HWID ban
    bans = await db.collection("hwid_bans") \
        .where("project_id", "==", body.project_id) \
        .where("hwid", "==", hwid).limit(1).get()
    if bans:
        raise HTTPException(403, "Device is banned")

    # Get loader config
    proj = await db.collection("projects").document(body.project_id).get()
    if not proj.exists:
        raise HTTPException(404, "Project not found")

    cfg   = proj.to_dict().get("loader_config", {})
    tier  = k.get("tier", "free")
    field = "paid_script_id" if tier == "paid" else "free_script_id"
    sid   = cfg.get(field)

    return {
        "valid":     True,
        "tier":      tier,
        "script_id": sid,
    }
