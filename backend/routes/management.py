"""
routes/management.py — HWID ban/whitelist per project
"""
import time, uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google.cloud import firestore

from firebase_db import get_db
from auth import current_user

router = APIRouter(prefix="/projects", tags=["management"])


async def _assert_project_owner(project_id: str, user: dict, db: firestore.AsyncClient):
    doc = await db.collection("projects").document(project_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")
    return doc


class HwidBody(BaseModel):
    hwid: str
    note: str = ""


# ── Blacklist ─────────────────────────────────────────────────────────────────

@router.get("/{project_id}/banned")
async def list_banned(project_id: str, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    await _assert_project_owner(project_id, user, db)
    docs = await db.collection("hwid_bans").where("project_id", "==", project_id).get()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.post("/{project_id}/banned")
async def ban_hwid(project_id: str, body: HwidBody, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    await _assert_project_owner(project_id, user, db)
    hwid = body.hwid.strip()
    if not hwid:
        raise HTTPException(400, "HWID required")

    # Check duplicate
    existing = await db.collection("hwid_bans") \
        .where("project_id", "==", project_id) \
        .where("hwid", "==", hwid).limit(1).get()
    if existing:
        raise HTTPException(409, "HWID already banned")

    bid = str(uuid.uuid4())
    await db.collection("hwid_bans").document(bid).set({
        "project_id": project_id,
        "hwid":       hwid,
        "note":       body.note.strip(),
        "created_at": int(time.time()),
    })
    return {"id": bid, "hwid": hwid, "note": body.note}


@router.delete("/{project_id}/banned/{ban_id}")
async def unban_hwid(project_id: str, ban_id: str, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    await _assert_project_owner(project_id, user, db)
    doc = await db.collection("hwid_bans").document(ban_id).get()
    if not doc.exists or doc.to_dict().get("project_id") != project_id:
        raise HTTPException(404, "Ban record not found")
    await doc.reference.delete()
    return {"ok": True}


# ── Whitelist ─────────────────────────────────────────────────────────────────

@router.get("/{project_id}/whitelist")
async def list_whitelist(project_id: str, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    await _assert_project_owner(project_id, user, db)
    docs = await db.collection("hwid_whitelist").where("project_id", "==", project_id).get()
    return [{"id": d.id, **d.to_dict()} for d in docs]


@router.post("/{project_id}/whitelist")
async def add_whitelist(project_id: str, body: HwidBody, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    await _assert_project_owner(project_id, user, db)
    hwid = body.hwid.strip()
    if not hwid:
        raise HTTPException(400, "HWID required")

    existing = await db.collection("hwid_whitelist") \
        .where("project_id", "==", project_id) \
        .where("hwid", "==", hwid).limit(1).get()
    if existing:
        raise HTTPException(409, "HWID already whitelisted")

    wid = str(uuid.uuid4())
    await db.collection("hwid_whitelist").document(wid).set({
        "project_id": project_id,
        "hwid":       hwid,
        "note":       body.note.strip(),
        "created_at": int(time.time()),
    })
    return {"id": wid, "hwid": hwid, "note": body.note}


@router.delete("/{project_id}/whitelist/{wl_id}")
async def remove_whitelist(project_id: str, wl_id: str, user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    await _assert_project_owner(project_id, user, db)
    doc = await db.collection("hwid_whitelist").document(wl_id).get()
    if not doc.exists or doc.to_dict().get("project_id") != project_id:
        raise HTTPException(404, "Whitelist record not found")
    await doc.reference.delete()
    return {"ok": True}
