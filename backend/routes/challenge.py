"""
routes/challenge.py — v5: HWID ban check + Key system integration
"""
import time, os, hmac, hashlib, base64, uuid, math
import collections
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from google.cloud import firestore

from firebase_db import get_db
from crypto import encrypt, decrypt
from config import MASTER_KEY, SERVER_SECRET, LOAD_TOKEN_TTL, HOOK_RATE_THRESHOLD

router = APIRouter(tags=["challenge"])

_sessions:    dict[str, dict] = {}
_used_nonces: set[str]        = set()
_req_log:     dict            = collections.defaultdict(list)

NONCE_TTL  = 25
PART_TTL   = 20
MIN_PARTS  = 3
MAX_PARTS  = 6


def _cleanup():
    now  = time.time()
    dead = [n for n, s in _sessions.items() if now > s["expires_at"]]
    for n in dead:
        _sessions.pop(n, None)
        _used_nonces.discard(n)


def _ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _runtime_key(sid: str, ts: int, nonce: str, ip: str, part: int) -> bytes:
    return hashlib.sha256(f"{sid}:{ts}:{nonce}:{ip}:{part}".encode()).digest()


def _split_payload(data: bytes, n_parts: int) -> list[bytes]:
    size = math.ceil(len(data) / n_parts)
    return [data[i*size:(i+1)*size] for i in range(n_parts) if data[i*size:(i+1)*size]]


def _is_hook(request: Request, sid: str, ts: int) -> tuple[bool, list[str]]:
    ip   = _ip(request)
    ua   = request.headers.get("user-agent", "")
    hard = []
    soft = []
    now  = time.time()

    key = (sid, ip)
    _req_log[key] = [t for t in _req_log[key] if now - t < 60]
    _req_log[key].append(now)
    if len(_req_log[key]) > HOOK_RATE_THRESHOLD:
        hard.append("rate_exceeded")

    if not ua:
        soft.append("no_ua")
    ts_header = request.headers.get("x-req-ts", "")
    if ts_header != str(ts):
        soft.append("ts_header_mismatch")
    if abs(now - ts) > 20:
        soft.append("ts_drift")

    return len(hard) > 0 or len(soft) >= 2, hard + soft


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _is_hwid_banned(db: firestore.AsyncClient, project_id: str, hwid: str) -> bool:
    if not hwid:
        return False
    docs = await db.collection("hwid_bans") \
        .where(filter=firestore.FieldFilter("project_id", "==", project_id)) \
        .where(filter=firestore.FieldFilter("hwid", "==", hwid)).limit(1).get()
    return bool(docs)


async def _is_hwid_whitelisted(db: firestore.AsyncClient, project_id: str, hwid: str) -> bool:
    if not hwid:
        return False
    docs = await db.collection("hwid_whitelist") \
        .where(filter=firestore.FieldFilter("project_id", "==", project_id)) \
        .where(filter=firestore.FieldFilter("hwid", "==", hwid)).limit(1).get()
    return bool(docs)


async def _get_loader_config(db: firestore.AsyncClient, project_id: str) -> dict:
    doc = await db.collection("projects").document(project_id).get()
    if not doc.exists:
        return {}
    return doc.to_dict().get("loader_config", {})


async def _validate_key(db: firestore.AsyncClient, project_id: str, key_str: str, hwid: str) -> Optional[dict]:
    """Validate a key and return its data, or None if invalid."""
    docs = await db.collection("keys") \
        .where(filter=firestore.FieldFilter("project_id", "==", project_id)) \
        .where(filter=firestore.FieldFilter("key", "==", key_str)).limit(1).get()
    if not docs:
        return None
    kdoc = docs[0]
    k = {**kdoc.to_dict()}
    if not k.get("active"):
        return None
    if k.get("expires_at") and k["expires_at"] < int(time.time()):
        return None
    if k.get("hwid") and k["hwid"] != hwid:
        return None
    # Lock HWID on first use
    if not k.get("hwid") and hwid:
        await kdoc.reference.update({"hwid": hwid, "uses": k.get("uses", 0) + 1})
    else:
        await kdoc.reference.update({"uses": k.get("uses", 0) + 1})
    k["id"] = kdoc.id
    return k


# ── Challenge endpoint ────────────────────────────────────────────────────────

@router.get("/api/challenge")
async def get_challenge(
    request: Request,
    sid: str,
    db: firestore.AsyncClient = Depends(get_db),
):
    _cleanup()
    ip = _ip(request)

    doc = await db.collection("scripts").document(sid).get()
    if not doc.exists:
        raise HTTPException(404, "Script not found")

    s = doc.to_dict()
    if not s.get("active"):
        raise HTTPException(403, "Script disabled")
    if not s.get("payload_enc"):
        raise HTTPException(400, "No payload")

    try:
        plaintext = decrypt(s["payload_enc"], MASTER_KEY)
    except Exception:
        raise HTTPException(500, "Payload error")

    n_parts = max(MIN_PARTS, min(MAX_PARTS, len(plaintext) // 8192 + MIN_PARTS))

    nonce = base64.urlsafe_b64encode(os.urandom(24)).decode().rstrip("=")
    _sessions[nonce] = {
        "sid":          sid,
        "project_id":   s.get("project_id", ""),
        "ip":           ip,
        "expires_at":   time.time() + NONCE_TTL,
        "part_count":   n_parts,
        "parts_issued": set(),
        "payload_len":  len(plaintext),
    }

    return JSONResponse({
        "nonce":      nonce,
        "part_count": n_parts,
        "ttl":        NONCE_TTL,
        "ip":         ip,
    })


# ── Load part endpoint ────────────────────────────────────────────────────────

class LoadRequest(BaseModel):
    sid:   str
    ts:    int
    nonce: str
    proof: str
    fp:    str = ""     # HWID / device fingerprint
    part:  int = 0
    key:   str = ""     # Optional key for key-gated projects


import logging as _logging
_log = _logging.getLogger("exeguard.load")

@router.post("/api/load")
async def load_part(
    request: Request,
    body: LoadRequest,
    db: firestore.AsyncClient = Depends(get_db),
):
    ip  = _ip(request)
    ua  = request.headers.get("user-agent", "")[:512]
    now = int(time.time())

    _log.info("▶ POST /api/load  sid=%s  part=%d  ts=%d  now=%d  diff=%d  nonce=%s…  ip=%s  key=%s",
              body.sid, body.part, body.ts, now, abs(now - body.ts),
              body.nonce[:12] if body.nonce else "?", ip,
              "yes" if body.key else "no")

    # 1. Timestamp TTL
    if abs(now - body.ts) > LOAD_TOKEN_TTL:
        _log.warning("✗ Token expired  (diff=%ds, ttl=%ds)", abs(now - body.ts), LOAD_TOKEN_TTL)
        raise HTTPException(401, "Token expired")

    # 2. Session valid
    _cleanup()
    session = _sessions.get(body.nonce)
    if not session:
        _log.warning("✗ Invalid nonce  (active_sessions=%d, nonce=%s)", len(_sessions), body.nonce[:16])
        raise HTTPException(401, "Invalid or expired nonce")
    if session["sid"] != body.sid:
        _log.warning("✗ Nonce/script mismatch  session_sid=%s  body_sid=%s", session["sid"], body.sid)
        raise HTTPException(401, "Nonce/script mismatch")
    if time.time() > session["expires_at"]:
        _log.warning("✗ Session expired  (%.1fs past expiry)", time.time() - session["expires_at"])
        _sessions.pop(body.nonce, None)
        raise HTTPException(401, "Session expired")

    session_ip = session["ip"]
    project_id = session.get("project_id", "")
    _log.info("  session OK  session_ip=%s  project=%s", session_ip, project_id)

    # 3. Part index valid
    n_parts = session["part_count"]
    if not (0 <= body.part < n_parts):
        raise HTTPException(400, f"Invalid part index (0..{n_parts-1})")
    if body.part in session["parts_issued"]:
        _log.warning("✗ Part %d already issued", body.part)
        raise HTTPException(401, "Part already issued")

    # 4. Verify HMAC proof
    loader_key = hashlib.sha256(f"{body.sid}:{body.ts}:{session_ip}".encode()).digest()
    expected   = hmac.new(loader_key, body.nonce.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.proof):
        _log.warning("✗ HMAC proof mismatch  expected=%s…  got=%s…  (sid=%s ts=%d ip=%s)",
                     expected[:16], body.proof[:16], body.sid, body.ts, session_ip)
        await _log_exec(db, body.sid, ip, ua, hook=1, reason="proof_fail")
        raise HTTPException(401, "Auth failed")

    # 5. Script fetch
    doc = await db.collection("scripts").document(body.sid).get()
    if not doc.exists or not doc.to_dict().get("active"):
        raise HTTPException(403, "Script unavailable")

    s = doc.to_dict()

    # 6. HWID ban check (only on part 0 to avoid extra reads)
    if body.part == 0 and body.fp and project_id:
        whitelisted = await _is_hwid_whitelisted(db, project_id, body.fp)
        if not whitelisted:
            banned = await _is_hwid_banned(db, project_id, body.fp)
            if banned:
                _log.warning("✗ HWID banned  fp=%s  project=%s", body.fp, project_id)
                await _log_exec(db, body.sid, ip, ua, hook=1, reason="hwid_ban", fp=body.fp)
                raise HTTPException(403, "Device is banned")

    # 7. Key system check (only on part 0)
    if body.part == 0 and project_id:
        cfg = await _get_loader_config(db, project_id)
        _log.info("  loader_config  role_management=%s  force_getkey=%s",
                  cfg.get("role_management"), cfg.get("force_getkey"))
        if cfg.get("role_management"):
            if not body.key:
                if cfg.get("force_getkey"):
                    _log.warning("✗ Key required but loader sent none  project=%s", project_id)
                    raise HTTPException(401, "Key required")
                # No key + no force → allow but only if free_script_id matches
                free_sid = cfg.get("free_script_id")
                if free_sid and free_sid != body.sid:
                    _log.warning("✗ Script not available for free users  sid=%s  free_sid=%s", body.sid, free_sid)
                    raise HTTPException(403, "Script not available for free users")
            else:
                # Validate key
                k = await _validate_key(db, project_id, body.key, body.fp)
                if not k:
                    _log.warning("✗ Invalid key  project=%s  key=%s…", project_id, body.key[:8])
                    await _log_exec(db, body.sid, ip, ua, hook=1, reason="invalid_key", fp=body.fp)
                    raise HTTPException(401, "Invalid or expired key")
                # Verify key tier matches requested script
                tier    = k.get("tier", "free")
                tgt_sid = cfg.get("paid_script_id") if tier == "paid" else cfg.get("free_script_id")
                if tgt_sid and tgt_sid != body.sid:
                    raise HTTPException(403, "Key does not grant access to this script")

    # 8. Hook detection
    hook, reasons = _is_hook(request, body.sid, body.ts)

    # 9. Log on first part only
    if body.part == 0:
        await _log_exec(db, body.sid, ip, ua,
                        hook=1 if hook else 0,
                        reason=",".join(reasons),
                        fp=body.fp)

    # 10. Decrypt → split → re-encrypt part with runtime key
    try:
        plaintext = decrypt(s["payload_enc"], MASTER_KEY)
    except Exception:
        raise HTTPException(500, "Payload integrity error")

    parts     = _split_payload(plaintext, n_parts)
    plaintext = b"\x00" * len(plaintext)
    del plaintext

    if body.part >= len(parts):
        raise HTTPException(500, "Part index out of range")

    part_data = parts[body.part]
    for i, p in enumerate(parts):
        if i != body.part:
            parts[i] = b"\x00" * len(p)

    part_key  = _runtime_key(body.sid, body.ts, body.nonce, session_ip, body.part)
    encrypted = (encrypt(os.urandom(len(part_data)), part_key)
                 if hook else encrypt(part_data, part_key))

    session["parts_issued"].add(body.part)
    if len(session["parts_issued"]) >= n_parts:
        _sessions.pop(body.nonce, None)

    remaining = n_parts - len(session.get("parts_issued", set()))

    return JSONResponse({
        "data":      encrypted,
        "ts":        body.ts,
        "part":      body.part,
        "remaining": max(0, remaining),
    })


async def _log_exec(db: firestore.AsyncClient, script_id, ip, ua, hook, reason="", fp=""):
    try:
        eid = str(uuid.uuid4())
        await db.collection("executions").document(eid).set({
            "script_id":   script_id,
            "ip":          ip,
            "user_agent":  ua,
            "ts":          int(time.time()),
            "hook_flag":   hook,
            "hook_reason": reason,
            "fp":          fp,
        })
    except Exception:
        pass
