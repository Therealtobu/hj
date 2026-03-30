import uuid, time
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from google.cloud import firestore

from firebase_db import get_db
from auth import current_user
from crypto import encrypt, decrypt
from config import MASTER_KEY, PUBLIC_BASE_URL
from obfuscator import generate_loader
from payload_obfuscator import obfuscate_source

router = APIRouter(prefix="/scripts", tags=["scripts"])

MAX_SOURCE_SIZE = 10 * 1024 * 1024
MAX_FILE_SIZE   = 10 * 1024 * 1024


class ScriptBody(BaseModel):
    name: str
    description: str = ""
    source: str
    project_id: str
    obf_level: int = 1


class ScriptUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = None
    active: Optional[bool] = None
    obf_level: Optional[int] = None


async def _own_script(script_id: str, user: dict, db: firestore.AsyncClient) -> dict:
    doc = await db.collection("scripts").document(script_id).get()
    if not doc.exists:
        raise HTTPException(404, "Script not found")
    s = {"id": doc.id, **doc.to_dict()}
    # Verify project ownership
    proj = await db.collection("projects").document(s["project_id"]).get()
    if not proj.exists or proj.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Script not found")
    return s


def _process_source(source: str, obf_level: int) -> str:
    if len(source.encode()) > MAX_SOURCE_SIZE:
        raise HTTPException(400, "Source too large (max 10MB)")
    try:
        return obfuscate_source(source, level=obf_level)
    except ValueError as e:
        raise HTTPException(400, f"Source error: {e}")


# ── Create via paste ──────────────────────────────────────────────────────────

@router.post("")
async def create_script(
    body: ScriptBody,
    user=Depends(current_user),
    db: firestore.AsyncClient = Depends(get_db),
):
    proj = await db.collection("projects").document(body.project_id).get()
    if not proj.exists or proj.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")

    level      = max(1, min(2, body.obf_level))
    obfuscated = _process_source(body.source, level)
    enc        = encrypt(obfuscated.encode(), MASTER_KEY)
    sid        = str(uuid.uuid4())
    now        = int(time.time())

    await db.collection("scripts").document(sid).set({
        "project_id":  body.project_id,
        "name":        body.name.strip(),
        "description": body.description.strip(),
        "active":      True,
        "obf_level":   level,
        "payload_enc": enc,
        "created_at":  now,
        "updated_at":  now,
    })
    return {"id": sid, "name": body.name, "active": True, "obf_level": level}


# ── Create via .py file upload ────────────────────────────────────────────────

@router.post("/upload")
async def upload_script(
    project_id:  str = Form(...),
    name:        str = Form(...),
    description: str = Form(""),
    obf_level:   int = Form(1),
    file: UploadFile = File(...),
    user=Depends(current_user),
    db: firestore.AsyncClient = Depends(get_db),
):
    if not file.filename or not file.filename.endswith(".py"):
        raise HTTPException(400, "Only .py files accepted")

    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(400, "File too large (max 10MB)")
    try:
        source = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(400, "File must be UTF-8 encoded")

    proj = await db.collection("projects").document(project_id).get()
    if not proj.exists or proj.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")

    level      = max(1, min(2, obf_level))
    obfuscated = _process_source(source, level)
    enc        = encrypt(obfuscated.encode(), MASTER_KEY)
    sid        = str(uuid.uuid4())
    now        = int(time.time())

    await db.collection("scripts").document(sid).set({
        "project_id":  project_id,
        "name":        name.strip(),
        "description": description.strip(),
        "active":      True,
        "obf_level":   level,
        "payload_enc": enc,
        "created_at":  now,
        "updated_at":  now,
    })
    return {"id": sid, "name": name, "active": True, "obf_level": level,
            "filename": file.filename, "size_bytes": len(raw)}


# ── Update ────────────────────────────────────────────────────────────────────

@router.patch("/{script_id}")
async def update_script(
    script_id: str,
    body: ScriptUpdate,
    user=Depends(current_user),
    db: firestore.AsyncClient = Depends(get_db),
):
    s       = await _own_script(script_id, user, db)
    updates = {}

    if body.name        is not None: updates["name"]        = body.name.strip()
    if body.description is not None: updates["description"] = body.description.strip()
    if body.active      is not None: updates["active"]      = bool(body.active)

    if body.source is not None:
        level               = max(1, min(2, body.obf_level or s.get("obf_level", 1)))
        obfuscated          = _process_source(body.source, level)
        enc                 = encrypt(obfuscated.encode(), MASTER_KEY)
        updates["payload_enc"] = enc
        updates["obf_level"]   = level

    if updates:
        updates["updated_at"] = int(time.time())
        await db.collection("scripts").document(script_id).update(updates)

    return {"ok": True}


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{script_id}")
async def delete_script(
    script_id: str,
    user=Depends(current_user),
    db: firestore.AsyncClient = Depends(get_db),
):
    await _own_script(script_id, user, db)

    # Cascade delete executions
    execs = await db.collection("executions").where("script_id", "==", script_id).get()
    for e in execs:
        await e.reference.delete()

    await db.collection("scripts").document(script_id).delete()
    return {"ok": True}


# ── Get loader ────────────────────────────────────────────────────────────────

@router.get("/{script_id}/loader")
async def get_loader(
    script_id: str,
    user=Depends(current_user),
    db: firestore.AsyncClient = Depends(get_db),
):
    s = await _own_script(script_id, user, db)
    if not s.get("payload_enc"):
        raise HTTPException(400, "No source uploaded for this script")

    # Check if project requires key
    require_key = False
    project_id = s.get("project_id", "")
    if project_id:
        proj_doc = await db.collection("projects").document(project_id).get()
        if proj_doc.exists:
            cfg = proj_doc.to_dict().get("loader_config", {})
            if cfg.get("role_management") and cfg.get("force_getkey"):
                require_key = True

    loader = generate_loader(script_id, PUBLIC_BASE_URL, require_key=require_key)
    return {"loader": loader, "script_id": script_id, "require_key": require_key}


# ── Metrics ───────────────────────────────────────────────────────────────────

@router.get("/{script_id}/metrics")
async def get_metrics(
    script_id: str,
    user=Depends(current_user),
    db: firestore.AsyncClient = Depends(get_db),
):
    await _own_script(script_id, user, db)

    cutoff_7d = int(time.time()) - 604800
    execs     = await db.collection("executions").where("script_id", "==", script_id).get()

    all_docs    = [e.to_dict() for e in execs]
    total_runs  = len(all_docs)
    total_hooks = sum(1 for d in all_docs if d.get("hook_flag"))

    # Daily breakdown (last 7 days)
    from collections import defaultdict
    from datetime import datetime, timezone
    daily_map: dict = defaultdict(lambda: {"total": 0, "hooks": 0})
    for d in all_docs:
        ts = d.get("ts", 0)
        if ts > cutoff_7d:
            day = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d")
            daily_map[day]["total"] += 1
            if d.get("hook_flag"):
                daily_map[day]["hooks"] += 1
    daily = [{"day": k, "total": v["total"], "hooks": v["hooks"]}
             for k, v in sorted(daily_map.items())]

    # Unique IPs and fingerprints
    unique_ips = len({d.get("ip", "") for d in all_docs if d.get("ip")})
    unique_fps = len({d.get("fp", "") for d in all_docs if d.get("fp")})

    # Recent hook events
    from datetime import datetime, timezone
    recent_hooks = []
    for d in sorted(
        (d for d in all_docs if d.get("hook_flag")),
        key=lambda x: x.get("ts", 0), reverse=True
    )[:20]:
        ts = d.get("ts", 0)
        recent_hooks.append({
            "ip":         d.get("ip"),
            "user_agent": d.get("user_agent"),
            "hook_reason":d.get("hook_reason"),
            "fp":         d.get("fp"),
            "time":       datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        })

    return {
        "daily":          daily,
        "total_runs":     total_runs,
        "total_hooks":    total_hooks,
        "unique_ips":     unique_ips,
        "unique_devices": unique_fps,
        "recent_hooks":   recent_hooks,
    }
