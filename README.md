# EXE Guard v3

Script protection platform — obfuscate, host, and protect Python scripts.

## Architecture

```
frontend/   Next.js 14 dashboard
backend/    FastAPI + SQLite
```

## Backend (Railway)

1. Create a Railway service from the `backend/` folder
2. Set environment variables:
   - `SERVER_SECRET` — 32-byte hex (python -c "import secrets; print(secrets.token_hex(32))")
   - `MASTER_KEY` — 32-byte hex
   - `JWT_SECRET` — 32-byte hex
   - `PUBLIC_BASE_URL` — https://YOUR-BACKEND.up.railway.app
3. Deploy

## Frontend (Railway / Vercel)

1. Set `NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.up.railway.app/api`
2. Deploy

## Security Layers (v3)

### Loader
- Challenge-response: SERVER_SECRET never leaves server
- IP-bound proof: replay from different IP = rejected
- Split execution: payload fetched in 3–6 parts, each with different key
- Memory wipe: buffers zeroed + gc.collect() after each part
- Self-destruct: any exception → sys.exit(1)
- Anti-debug: gettrace, builtins check, timing, frame inspection

### Payload
- Level 1: AST rename + string XOR encrypt + opaque predicates + CFF + anti-hook header
- Level 2: marshal bytecode → zlib → XOR stream cipher → base64 (VM wrap)

### Server
- One-time nonces (TTL 25s)
- Per-IP rate limiting + hook detection
- Machine fingerprint logging
- AES-GCM at rest (MASTER_KEY)
