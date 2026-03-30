"""
firebase_db.py — Firestore client init + FastAPI dependency

Setup:
  Set FIREBASE_CREDENTIALS env var to a base64-encoded service account JSON.
  Or place firebase-credentials.json in the backend directory.

  To base64-encode your service account:
    base64 -w 0 firebase-credentials.json
"""
import os, json, base64
import firebase_admin
from firebase_admin import credentials

_app = None
_db  = None


def init_firebase():
    global _app, _db

    cred_env = os.getenv("FIREBASE_CREDENTIALS")
    if cred_env:
        try:
            cred_json = json.loads(base64.b64decode(cred_env).decode())
        except Exception as e:
            raise RuntimeError(f"FIREBASE_CREDENTIALS is not valid base64 JSON: {e}")
        cred = credentials.Certificate(cred_json)
    elif os.path.exists("firebase-credentials.json"):
        cred = credentials.Certificate("firebase-credentials.json")
    else:
        raise RuntimeError(
            "Firebase credentials not found. "
            "Set FIREBASE_CREDENTIALS env var (base64 service account JSON) "
            "or place firebase-credentials.json in the backend directory."
        )

    _app = firebase_admin.initialize_app(cred)

    from firebase_admin import firestore_async
    _db = firestore_async.client()


def get_firestore():
    """Return the shared Firestore async client (initialized at startup)."""
    if _db is None:
        raise RuntimeError("Firebase not initialized — call init_firebase() at startup.")
    return _db


def get_db():
    """FastAPI dependency — returns the Firestore async client."""
    return get_firestore()
