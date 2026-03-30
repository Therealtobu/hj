import logging, sys, time
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from firebase_db import init_firebase
from routes.auth       import router as auth_router
from routes.projects   import router as proj_router
from routes.scripts    import router as script_router
from routes.load       import router as load_router
from routes.challenge  import router as challenge_router
from routes.management import router as mgmt_router
from routes.keys       import router as keys_router
from routes.turnstile  import router as turnstile_router
from routes.admin      import router as admin_router
import config

logging.basicConfig(stream=sys.stdout, level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("exeguard")

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="EXE Guard API", version="5.0.0", docs_url="/docs")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def log_req(request: Request, call_next):
    t0   = time.perf_counter()
    resp = await call_next(request)
    log.info("%s %s → %d  (%.0fms)", request.method, request.url.path,
             resp.status_code, (time.perf_counter()-t0)*1000)
    return resp

app.include_router(auth_router,      prefix="/api")
app.include_router(proj_router,      prefix="/api")
app.include_router(script_router,    prefix="/api")
app.include_router(load_router)
app.include_router(challenge_router)
app.include_router(mgmt_router,      prefix="/api")
app.include_router(keys_router,      prefix="/api")
app.include_router(turnstile_router, prefix="/api")
app.include_router(admin_router,     prefix="/api")

@app.on_event("startup")
def startup():
    init_firebase()
    log.info("EXE Guard API v5 ready")

@app.get("/health")
def health():
    return {"status": "ok", "version": "5.0.0"}

@app.get("/api/myip")
def myip(request: Request):
    xff = request.headers.get("x-forwarded-for", "")
    ip  = xff.split(",")[0].strip() if xff else (
        request.client.host if request.client else "unknown"
    )
    return {"ip": ip}

if __name__ == "__main__":
    uvicorn.run("main:app", host=config.HOST, port=config.PORT,
                reload=config.DEBUG, log_level="info")
