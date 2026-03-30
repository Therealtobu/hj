"""
routes/load.py — Legacy GET /api/load endpoint (kept for backwards compatibility).
The active loader now uses POST /api/load in challenge.py.
"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(tags=["load"])


@router.get("/api/load")
async def load_legacy():
    """Legacy endpoint — current loaders use POST /api/load (challenge.py)."""
    return JSONResponse({"error": "Use POST /api/load"}, status_code=405)
