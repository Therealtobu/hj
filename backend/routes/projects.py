import uuid, time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google.cloud import firestore

from firebase_db import get_db
from auth import current_user

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectBody(BaseModel):
    name: str
    description: str = ""


async def _project_stats(db: firestore.AsyncClient, project_id: str) -> dict:
    """Return script_count, total_executions, hook_attempts for a project."""
    scripts = await db.collection("scripts").where("project_id", "==", project_id).get()
    script_ids = [s.id for s in scripts]

    total_exec  = 0
    hook_count  = 0
    exec_24h    = 0
    cutoff_24h  = int(time.time()) - 86400

    for sid in script_ids:
        execs = await db.collection("executions").where("script_id", "==", sid).get()
        for e in execs:
            d = e.to_dict()
            total_exec += 1
            if d.get("hook_flag"):
                hook_count += 1
            if d.get("ts", 0) > cutoff_24h:
                exec_24h += 1

    return {
        "script_count":      len(script_ids),
        "total_executions":  total_exec,
        "hook_attempts":     hook_count,
        "executions_24h":    exec_24h,
    }


@router.get("")
async def list_projects(user=Depends(current_user), db: firestore.AsyncClient = Depends(get_db)):
    docs = await (
        db.collection("projects")
        .where("user_id", "==", user["id"])
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .get()
    )

    result = []
    for doc in docs:
        data  = {"id": doc.id, **doc.to_dict()}
        stats = await _project_stats(db, doc.id)
        result.append({**data, **stats})

    return result


@router.post("")
async def create_project(
    body: ProjectBody,
    user=Depends(current_user),
    db: firestore.AsyncClient = Depends(get_db),
):
    if not body.name.strip():
        raise HTTPException(400, "Name required")

    pid = str(uuid.uuid4())
    await db.collection("projects").document(pid).set({
        "user_id":     user["id"],
        "name":        body.name.strip(),
        "description": body.description.strip(),
        "created_at":  int(time.time()),
    })
    return {"id": pid, "name": body.name, "description": body.description}


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    user=Depends(current_user),
    db: firestore.AsyncClient = Depends(get_db),
):
    doc = await db.collection("projects").document(project_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Project not found")

    project = {"id": doc.id, **doc.to_dict()}

    # Scripts with per-script metrics
    script_docs = await (
        db.collection("scripts")
        .where("project_id", "==", project_id)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .get()
    )

    cutoff_24h = int(time.time()) - 86400
    scripts = []
    for s in script_docs:
        sd = {"id": s.id, **s.to_dict()}
        execs = await db.collection("executions").where("script_id", "==", s.id).get()
        total = len(execs)
        hooks = sum(1 for e in execs if e.to_dict().get("hook_flag"))
        last24 = sum(1 for e in execs if e.to_dict().get("ts", 0) > cutoff_24h)
        scripts.append({
            **sd,
            "executions":     total,
            "hook_attempts":  hooks,
            "executions_24h": last24,
        })

    return {**project, "scripts": scripts}


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user=Depends(current_user),
    db: firestore.AsyncClient = Depends(get_db),
):
    doc = await db.collection("projects").document(project_id).get()
    if not doc.exists or doc.to_dict().get("user_id") != user["id"]:
        raise HTTPException(404, "Not found")

    # Cascade delete scripts → executions
    scripts = await db.collection("scripts").where("project_id", "==", project_id).get()
    for s in scripts:
        execs = await db.collection("executions").where("script_id", "==", s.id).get()
        for e in execs:
            await e.reference.delete()
        await s.reference.delete()

    await db.collection("projects").document(project_id).delete()
    return {"ok": True}
