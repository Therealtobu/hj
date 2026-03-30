import base64, hashlib, hmac, os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def encrypt(plaintext: bytes, key: bytes) -> str:
    nonce = os.urandom(12)
    ct    = AESGCM(key).encrypt(nonce, plaintext, None)
    return base64.urlsafe_b64encode(nonce + ct).decode()

def decrypt(token: str, key: bytes) -> bytes:
    raw   = base64.urlsafe_b64decode(token.encode())
    return AESGCM(key).decrypt(raw[:12], raw[12:], None)

def derive_session_key(script_id: str, ts: int, secret: bytes) -> bytes:
    return hmac.new(secret, f"{script_id}:{ts}".encode(), hashlib.sha256).digest()

def sign_hmac(data: str, secret: bytes) -> str:
    return hmac.new(secret, data.encode(), hashlib.sha256).hexdigest()
