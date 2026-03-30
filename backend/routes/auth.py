import uuid, time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google.cloud import firestore

from firebase_db import get_db
from auth import hash_password, verify_password, create_token

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterBody(BaseModel):
    username: str
    email: str
    password: str

class LoginBody(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(body: RegisterBody, db: firestore.AsyncClient = Depends(get_db)):
    if len(body.username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    username = body.username.strip()
    email    = body.email.lower().strip()

    # Check uniqueness
    dup_user  = await db.collection("users").where("username", "==", username).limit(1).get()
    dup_email = await db.collection("users").where("email",    "==", email).limit(1).get()
    if dup_user or dup_email:
        raise HTTPException(409, "Username or email already exists")

    uid = str(uuid.uuid4())
    await db.collection("users").document(uid).set({
        "username":      username,
        "email":         email,
        "password_hash": hash_password(body.password),
        "created_at":    int(time.time()),
    })

    return {"token": create_token(uid), "user": {"id": uid, "username": username}}


@router.post("/login")
async def login(body: LoginBody, db: firestore.AsyncClient = Depends(get_db)):
    email = body.email.lower().strip()
    docs  = await db.collection("users").where("email", "==", email).limit(1).get()

    if not docs:
        raise HTTPException(401, "Invalid credentials")

    doc  = docs[0]
    user = {"id": doc.id, **doc.to_dict()}

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")

    return {"token": create_token(user["id"]), "user": {"id": user["id"], "username": user["username"]}}
