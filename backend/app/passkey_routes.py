"""Passkey Routes — Cloud-stored 6-digit PIN passkey"""
import hashlib
import hmac
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.jwt import decode_access_token
from app.core.request_context import get_request_context
from app.db.models import Passkey, User
from app.db.session import get_db

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/auth/passkey", tags=["passkey"])


# ─── helpers ─────────────────────────────────────────────────────────────────

def _hash_pin(pin: str) -> str:
    return hashlib.sha256(pin.encode()).hexdigest()


def _verify_pin(pin: str, pin_hash: str) -> bool:
    return hmac.compare_digest(_hash_pin(pin), pin_hash)


def _get_current_user(request: Request, db: Session) -> User:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing token")
    payload = decode_access_token(auth[7:])
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


# ─── schemas ─────────────────────────────────────────────────────────────────

class CreatePasskeyRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

class VerifyPasskeyRequest(BaseModel):
    email: str
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")

class DeletePasskeyRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


# ─── endpoints ───────────────────────────────────────────────────────────────

@router.post("/create")
def create_passkey(p: CreatePasskeyRequest, request: Request, db: Session = Depends(get_db)):
    """Create or replace the user's cloud passkey (6-digit PIN). Requires JWT."""
    user = _get_current_user(request, db)
    pk = db.query(Passkey).filter(Passkey.user_id == user.id).first()
    if pk:
        # Replace existing
        pk.pin_hash = _hash_pin(p.pin)
        pk.updated_at = datetime.utcnow()
    else:
        pk = Passkey(user_id=user.id, pin_hash=_hash_pin(p.pin))
        db.add(pk)
    db.commit()
    return {"message": "Passkey saved successfully"}


@router.get("/status")
def passkey_status(request: Request, db: Session = Depends(get_db)):
    """Return whether the current user has a passkey set."""
    user = _get_current_user(request, db)
    pk = db.query(Passkey).filter(Passkey.user_id == user.id).first()
    return {"has_passkey": pk is not None, "created_at": pk.created_at.isoformat() if pk else None}


@router.post("/verify")
def verify_passkey(p: VerifyPasskeyRequest, request: Request, db: Session = Depends(get_db)):
    """
    Verify passkey during login flow (no JWT needed — called after email+password step).
    On success returns the same tokens as /auth/login/challenge would.
    """
    from app.db.models import OTPAttempt
    from app.auth.service import _issue_tokens, _log

    ctx = get_request_context(request)

    user = db.query(User).filter(User.email == p.email).first()
    if not user or not user.email_verified:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    pk = db.query(Passkey).filter(Passkey.user_id == user.id).first()
    if not pk:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No passkey set for this account")

    if not _verify_pin(p.pin, pk.pin_hash):
        _log(db, email=p.email, ip=ctx.ip_address, ua=ctx.user_agent,
             success=False, user=user, reason="passkey_wrong_pin")
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect passkey PIN")

    pk.last_used_at = datetime.utcnow()
    user.last_login_at = datetime.utcnow()
    tokens = _issue_tokens(db, user, ip=ctx.ip_address, ua=ctx.user_agent)
    _log(db, email=p.email, ip=ctx.ip_address, ua=ctx.user_agent, success=True, user=user)
    db.commit()
    return {"access_token": tokens["access_token"], "refresh_token": tokens["refresh_token"],
            "token_type": "bearer", "user": {"id": str(user.id), "email": user.email,
            "full_name": user.full_name, "email_verified": user.email_verified}}


@router.delete("/delete")
def delete_passkey(p: DeletePasskeyRequest, request: Request, db: Session = Depends(get_db)):
    """Delete the user's passkey (requires PIN confirmation)."""
    user = _get_current_user(request, db)
    pk = db.query(Passkey).filter(Passkey.user_id == user.id).first()
    if not pk:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No passkey found")
    if not _verify_pin(p.pin, pk.pin_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect PIN")
    db.delete(pk)
    db.commit()
    return {"message": "Passkey deleted"}
