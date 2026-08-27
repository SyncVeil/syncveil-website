"""2FA endpoints — TOTP setup, confirmation, disable, recovery codes, login challenge."""
from __future__ import annotations
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID

from app.core.twofa_service import (
    begin_totp_setup, confirm_totp_setup, disable_totp,
    get_2fa_status, regenerate_recovery_codes, is_2fa_enabled,
)
from app.db.models import Session as UserSession, User
from app.db.session import get_db
from app.core.security import verify_token

router = APIRouter(prefix="/api/2fa", tags=["2fa"])


# ─── Auth dependency (reuse same pattern as dashboard_routes) ─────────────────

class AuthUser:
    def __init__(self, user: User, session: UserSession, db: Session):
        self.user = user; self.session = session; self.db = db


def get_current_user(
    authorization: str = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthUser:
    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    scheme, _, token = authorization.partition(" ")
    if scheme != "Bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token format")
    try:
        payload = verify_token(token.strip())
        uid, sid = payload.get("sub"), payload.get("session_id")
        if not uid or not sid:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        uu, su = UUID(str(uid)), UUID(str(sid))
        sess = db.query(UserSession).filter(
            UserSession.id == su, UserSession.user_id == uu,
            UserSession.revoked.is_(False), UserSession.expires_at > datetime.utcnow(),
        ).first()
        if not sess:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Session expired or revoked")
        user = db.query(User).filter(User.id == uu).first()
        if not user or user.disabled:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User unavailable")
        return AuthUser(user=user, session=sess, db=db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from e


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CodeRequest(BaseModel):
    code: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/status")
def twofa_status(auth: AuthUser = Depends(get_current_user)):
    """Return current 2FA status for the authenticated user."""
    return get_2fa_status(auth.db, auth.user)


@router.post("/setup")
def twofa_setup(auth: AuthUser = Depends(get_current_user)):
    """
    Begin TOTP setup — returns secret + provisioning URI for QR code.
    Must be confirmed by POST /2fa/confirm before it takes effect.
    """
    return begin_totp_setup(auth.db, auth.user)


@router.post("/confirm")
def twofa_confirm(p: CodeRequest, auth: AuthUser = Depends(get_current_user)):
    """Confirm TOTP setup by verifying the first code from the authenticator app."""
    return confirm_totp_setup(auth.db, auth.user, p.code)


@router.post("/disable")
def twofa_disable(p: CodeRequest, auth: AuthUser = Depends(get_current_user)):
    """Disable 2FA (requires valid TOTP code or recovery code)."""
    return disable_totp(auth.db, auth.user, p.code)


@router.post("/recovery-codes/regenerate")
def regen_recovery(p: CodeRequest, auth: AuthUser = Depends(get_current_user)):
    """Regenerate all recovery codes (requires valid TOTP code)."""
    return regenerate_recovery_codes(auth.db, auth.user, p.code)
