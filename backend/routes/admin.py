"""Admin API — protected by ADMIN_SECRET header."""
import os, time, psutil
from fastapi import APIRouter, Depends, HTTPException, Header
from google.cloud import firestore
from firebase_db import get_db

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_SECRET = os.getenv("ADMIN_SECRET", "change-me-in-env")


def _auth(x_admin_secret: str = Header(...)):
    if x_admin_secret != ADMIN_SECRET:
        raise HTTPException(403, "Forbidden")


# ── System stats ──────────────────────────────────────────────────────────────
@router.get("/stats", dependencies=[Depends(_auth)])
async def admin_stats(db: firestore.AsyncClient = Depends(get_db)):
    users_snap   = await db.collection("users").get()
    scripts_snap = await db.collection("scripts").get()
    execs_snap   = await db.collection("executions").get()
    projects_snap= await db.collection("projects").get()

    cutoff_24h = int(time.time()) - 86400
    execs_24h  = sum(
        1 for e in execs_snap
        if e.to_dict().get("ts", 0) > cutoff_24h
    )
    hooks_total = sum(
        1 for e in execs_snap
        if e.to_dict().get("hook_flag")
    )

    # System metrics
    cpu    = psutil.cpu_percent(interval=0.2)
    mem    = psutil.virtual_memory()
    disk   = psutil.disk_usage("/")
    uptime = int(time.time() - psutil.boot_time())

    return {
        "users":          len(users_snap),
        "projects":       len(projects_snap),
        "scripts":        len(scripts_snap),
        "executions":     len(execs_snap),
        "executions_24h": execs_24h,
        "hook_attempts":  hooks_total,
        "system": {
            "cpu_pct":    cpu,
            "mem_pct":    mem.percent,
            "mem_used_mb":round(mem.used / 1024 / 1024),
            "mem_total_mb":round(mem.total / 1024 / 1024),
            "disk_pct":   disk.percent,
            "disk_used_gb":round(disk.used / 1024**3, 1),
            "disk_total_gb":round(disk.total / 1024**3, 1),
            "uptime_s":   uptime,
        },
    }


# ── User list ─────────────────────────────────────────────────────────────────
@router.get("/users", dependencies=[Depends(_auth)])
async def admin_users(db: firestore.AsyncClient = Depends(get_db)):
    users_snap = await db.collection("users").order_by(
        "created_at", direction=firestore.Query.DESCENDING
    ).get()

    result = []
    for doc in users_snap:
        u = {"id": doc.id, **doc.to_dict()}
        u.pop("password_hash", None)  # never expose hash

        # Count projects + scripts
        projs = await db.collection("projects").where("user_id", "==", doc.id).get()
        proj_ids = [p.id for p in projs]

        script_count = 0
        exec_count   = 0
        for pid in proj_ids:
            scrs = await db.collection("scripts").where("project_id", "==", pid).get()
            script_count += len(scrs)
            for s in scrs:
                exs = await db.collection("executions").where("script_id", "==", s.id).get()
                exec_count += len(exs)

        result.append({
            **u,
            "project_count": len(proj_ids),
            "script_count":  script_count,
            "exec_count":    exec_count,
            "banned":        u.get("banned", False),
        })

    return result


# ── Ban / unban user ──────────────────────────────────────────────────────────
@router.patch("/users/{uid}/ban", dependencies=[Depends(_auth)])
async def admin_ban(uid: str, db: firestore.AsyncClient = Depends(get_db)):
    doc = await db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(404, "User not found")
    cur = doc.to_dict().get("banned", False)
    await db.collection("users").document(uid).update({"banned": not cur})
    return {"banned": not cur}


# ── Delete user + cascade ─────────────────────────────────────────────────────
@router.delete("/users/{uid}", dependencies=[Depends(_auth)])
async def admin_delete_user(uid: str, db: firestore.AsyncClient = Depends(get_db)):
    projs = await db.collection("projects").where("user_id", "==", uid).get()
    for p in projs:
        scrs = await db.collection("scripts").where("project_id", "==", p.id).get()
        for s in scrs:
            exs = await db.collection("executions").where("script_id", "==", s.id).get()
            for e in exs:
                await e.reference.delete()
            await s.reference.delete()
        await p.reference.delete()
    await db.collection("users").document(uid).delete()
    return {"ok": True}


# ── Recent executions feed ────────────────────────────────────────────────────
@router.get("/feed", dependencies=[Depends(_auth)])
async def admin_feed(db: firestore.AsyncClient = Depends(get_db)):
    cutoff = int(time.time()) - 3600  # last 1 hour
    snap = await db.collection("executions").order_by(
        "ts", direction=firestore.Query.DESCENDING
    ).limit(50).get()

    rows = []
    for e in snap:
        d = {"id": e.id, **e.to_dict()}
        rows.append(d)
    return rows
