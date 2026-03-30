"""
routes/turnstile.py — Cloudflare Turnstile server-side verification
"""
import httpx, logging
from fastapi import APIRouter
from pydantic import BaseModel
from config import TURNSTILE_SECRET

log = logging.getLogger("exeguard")
router = APIRouter(prefix="/auth", tags=["auth"])
CF_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

class TurnstileBody(BaseModel):
    token: str

@router.post("/turnstile-verify")
async def verify_turnstile(body: TurnstileBody):
    # Skip if no secret configured
    if not TURNSTILE_SECRET or TURNSTILE_SECRET in ("CHANGE_ME", ""):
        return {"success": True, "dev_mode": True}

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.post(CF_VERIFY_URL, data={
                "secret":   TURNSTILE_SECRET,
                "response": body.token,
            })
        data = resp.json()
        if not data.get("success"):
            log.warning("Turnstile rejected: %s", data.get("error-codes"))
            # Don't block — just log. Remove this line to enforce strictly.
            return {"success": True, "warning": data.get("error-codes")}
        return {"success": True}
    except Exception as e:
        log.error("Turnstile verify error: %s", e)
        return {"success": True, "error": str(e)}
