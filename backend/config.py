import os, secrets

HOST            = os.getenv("HOST", "0.0.0.0")
PORT            = int(os.getenv("PORT", "8000"))
DEBUG           = os.getenv("DEBUG", "false").lower() == "true"

SERVER_SECRET   = os.getenv("SERVER_SECRET", secrets.token_hex(32)).encode()
_mk             = os.getenv("MASTER_KEY", secrets.token_hex(32))
MASTER_KEY      = bytes.fromhex(_mk)

JWT_SECRET      = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM   = "HS256"
JWT_EXPIRE_DAYS = 30

LOAD_TOKEN_TTL  = int(os.getenv("LOAD_TOKEN_TTL", "25"))
PAYLOAD_TTL     = int(os.getenv("PAYLOAD_TTL", "86400"))
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")

FIREBASE_CREDENTIALS = os.getenv("FIREBASE_CREDENTIALS", "")

HOOK_RATE_THRESHOLD  = int(os.getenv("HOOK_RATE_THRESHOLD", "20"))

# Cloudflare Turnstile
TURNSTILE_SECRET     = os.getenv("TURNSTILE_SECRET", "CHANGE_ME")
TURNSTILE_SITE_KEY   = os.getenv("TURNSTILE_SITE_KEY", "1x00000000000000000000AA")  # test sitekey
