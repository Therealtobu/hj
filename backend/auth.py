"""auth.py – JWT + password hashing + Firestore user lookup."""
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from google.cloud import firestore

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_DAYS
from firebase_db import get_db

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer  = HTTPBearer()

# bcrypt hard limit is 72 bytes — truncate to avoid ValueError
def _safe_pwd(plain: str) -> str:
    return plain[:72] if len(plain.encode()) > 72 else plain

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(_safe_pwd(plain))

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(_safe_pwd(plain), hashed)

def create_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

async def current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: firestore.AsyncClient = Depends(get_db),
) -> dict:
    uid = decode_token(creds.credentials)
    if not uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    doc = await db.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return {"id": doc.id, **doc.to_dict()}
