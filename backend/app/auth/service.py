"""Auth Service — Always-OTP login, password reset, registration"""
from __future__ import annotations
import logging
import threading
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken, User
from app.core.adaptive_security import compute_login_risk, prune_security_artifacts
from app.core.config import get_settings
from app.core.email import get_email_service
from app.core.jwt import create_access_token, create_refresh_token, decode_refresh_token
from app.core.security import generate_otp, hash_password, hash_token, verify_password, verify_token_hash
from app.db.models import LoginLog, OTPAttempt, PasswordResetToken

logger = logging.getLogger(__name__)
settings = get_settings()

OTP_VERIFY   = "email_verification"
OTP_LOGIN    = "login_challenge"
OTP_RESET    = "password_reset"


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _serialize(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name":      getattr(user, "full_name", None),
        "phone":          getattr(user, "phone", None),
        "country":        getattr(user, "country", None),
        "date_of_birth":  user.date_of_birth.isoformat() if getattr(user, "date_of_birth", None) else None,
        "avatar_url":     getattr(user, "avatar_url", None),
        "email_verified": user.email_verified,
        "created_at":     user.created_at.isoformat() if user.created_at else None,
        "last_login_at":  user.last_login_at.isoformat() if user.last_login_at else None,
    }


def _create_otp(db: Session, user: User, purpose: str) -> str:
    code = generate_otp(settings.OTP_LENGTH)
    db.query(OTPAttempt).filter(
        OTPAttempt.user_id == user.id,
        OTPAttempt.purpose == purpose,
        OTPAttempt.verified.is_(False),
    ).delete(synchronize_session=False)
    db.add(OTPAttempt(
        user_id=user.id, otp_hash=hash_token(code), purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        attempts=0, verified=False,
    ))
    db.flush()
    return code


def _verify_otp(db: Session, user: User, purpose: str, code: str) -> None:
    now = datetime.utcnow()
    attempt = (
        db.query(OTPAttempt)
        .filter(OTPAttempt.user_id == user.id, OTPAttempt.purpose == purpose, OTPAttempt.verified.is_(False))
        .order_by(OTPAttempt.created_at.desc()).first()
    )
    if not attempt:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
    if attempt.expires_at <= now:
        attempt.verified = True; attempt.verified_at = now; db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Code expired — request a new one")
    attempt.attempts = (attempt.attempts or 0) + 1
    if attempt.otp_hash != hash_token(code):
        if attempt.attempts >= settings.OTP_MAX_ATTEMPTS:
            attempt.verified = True; attempt.verified_at = now; db.commit()
        else:
            db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"Invalid code ({settings.OTP_MAX_ATTEMPTS - attempt.attempts} attempts left)" if attempt.attempts < settings.OTP_MAX_ATTEMPTS else "Too many attempts — request a new code")
    attempt.verified = True; attempt.verified_at = now


def _issue_tokens(db: Session, user: User, *, ip: str, ua: str, existing=None) -> dict:
    now = datetime.utcnow()
    from app.core.device_parser import parse_device
    parsed = parse_device(ua)
    if existing is None:
        session = RefreshToken(
            user_id=user.id,
            refresh_token_hash=f"pending-{uuid4().hex}",
            expires_at=now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            last_used_at=now, ip_address=ip, device_info=ua,
            device_name=parsed["name"],
        )
        db.add(session); db.flush()
    else:
        session = existing
        session.last_used_at = now; session.ip_address = ip; session.device_info = ua

    sid = str(session.id)
    access  = create_access_token(str(user.id), sid, {"email": user.email})
    refresh = create_refresh_token(str(user.id), sid, {"email": user.email})
    session.refresh_token_hash = hash_token(refresh)
    db.flush()
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


def _log(db: Session, *, email: str, ip: str, ua: str, success: bool, user=None, reason=None, location=None):
    db.add(LoginLog(
        user_id=user.id if user else None, email=email,
        success=success, failure_reason=reason,
        ip_address=ip, device_info=ua, location=location,
        timestamp=datetime.utcnow(),
    ))


def _try_send(fn, *args, **kwargs) -> bool:
    """Send email without blocking — never raises."""
    try:
        return fn(*args, **kwargs)
    except Exception as e:
        logger.warning(f"Email send failed: {e}")
        return False


def _send_login_notification_bg(email: str, ip: str, ua: str, ts: str):
    """Fire-and-forget login notification in background thread."""
    def _run():
        try:
            get_email_service().send_login_notification(email, ip=ip, user_agent=ua, timestamp=ts)
        except Exception as e:
            logger.warning(f"Login notification failed: {e}")
    threading.Thread(target=_run, daemon=True).start()


# ─── Registration ─────────────────────────────────────────────────────────────

def register_user(db: Session, email: str, password: str, *, full_name=None, phone=None, country=None, date_of_birth=None) -> dict:
    norm = email.lower().strip()
    if db.query(User).filter(User.email == norm).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    dob = None
    if date_of_birth:
        try:
            from datetime import date; dob = date.fromisoformat(date_of_birth)
        except Exception: pass

    kwargs = dict(email=norm, password_hash=hash_password(password), email_verified=False)
    for k, v in [("full_name", full_name), ("phone", phone), ("country", country), ("date_of_birth", dob)]:
        try: kwargs[k] = v.strip() if isinstance(v, str) else v
        except Exception: pass

    user = User(**kwargs)
    db.add(user)

    tokens: dict = {}
    email_sent = False

    try:
        db.flush()
        if settings.EMAIL_VERIFICATION_REQUIRED and settings.EMAIL_ENABLED:
            otp = _create_otp(db, user, OTP_VERIFY)
            email_sent = _try_send(get_email_service().send_verification_email, user.email, otp)
            if not email_sent:
                # Email failed → auto-verify so signup still works
                user.email_verified = True
                user.email_verified_at = datetime.utcnow()
                tokens = _issue_tokens(db, user, ip="0.0.0.0", ua="signup")
        else:
            user.email_verified = True
            user.email_verified_at = datetime.utcnow()
            tokens = _issue_tokens(db, user, ip="0.0.0.0", ua="signup")

        db.commit(); db.refresh(user)
    except HTTPException:
        db.rollback(); raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Registration failed") from exc

    return {
        "user": _serialize(user),
        "requires_verification": email_sent and not user.email_verified,
        "email_sent": email_sent,
        **tokens,
    }


# ─── Email Verification ───────────────────────────────────────────────────────

def verify_email(db: Session, token: str) -> dict:
    code = token.strip()
    if not code.isdigit() or len(code) != settings.OTP_LENGTH:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid verification code")
    otp = (
        db.query(OTPAttempt)
        .filter(OTPAttempt.otp_hash == hash_token(code), OTPAttempt.purpose == OTP_VERIFY, OTPAttempt.verified.is_(False))
        .order_by(OTPAttempt.created_at.desc()).first()
    )
    if not otp:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification code")
    if otp.expires_at <= datetime.utcnow():
        otp.verified = True; otp.verified_at = datetime.utcnow(); db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Code expired — request a new one")
    user = db.query(User).filter(User.id == otp.user_id).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    otp.verified = True; otp.verified_at = datetime.utcnow()
    user.email_verified = True; user.email_verified_at = datetime.utcnow()
    db.commit()
    return _serialize(user)


def resend_verification_code(db: Session, email: str) -> dict:
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.email_verified:
        return {"success": True, "already_verified": True}
    otp = _create_otp(db, user, OTP_VERIFY)
    email_sent = _try_send(get_email_service().send_verification_email, user.email, otp)
    db.commit()
    return {"success": True, "already_verified": False, "verification_token": otp if not email_sent else None}


# ─── Login — ALWAYS requires OTP ─────────────────────────────────────────────

def login_user(db: Session, email: str, password: str, *, ip: str, ua: str) -> dict:
    norm = email.lower().strip()
    now  = datetime.utcnow()

    try: prune_security_artifacts(db, now=now)
    except Exception: db.rollback()

    user = db.query(User).filter(User.email == norm).first()

    # Rate-limit / block check (adaptive security)
    risk = compute_login_risk(db, user=user, email=norm, ip_address=ip, user_agent=ua, now=now)
    if risk.action == "block_temporarily" and risk.cooldown_until:
        secs = max(1, int((risk.cooldown_until - now).total_seconds()))
        _log(db, email=norm, ip=ip, ua=ua, success=False, user=user, reason=f"cooldown:{secs}s")
        db.commit()
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail={"message": "Too many attempts. Try again shortly.", "retry_after_seconds": secs})

    if user and user.disabled:
        _log(db, email=norm, ip=ip, ua=ua, success=False, user=user, reason="disabled")
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Account disabled")

    if not user or not verify_password(password, user.password_hash):
        _log(db, email=norm, ip=ip, ua=ua, success=False, user=user, reason="bad_credentials")
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.email_verified:
        _log(db, email=norm, ip=ip, ua=ua, success=False, user=user, reason="email_not_verified")
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Please verify your email before signing in")

    # ── ALWAYS send OTP challenge ──
    otp = _create_otp(db, user, OTP_LOGIN)
    email_sent = _try_send(get_email_service().send_otp_email, user.email, otp)

    _log(db, email=norm, ip=ip, ua=ua, success=False, user=user, reason="otp_challenge_sent")
    db.commit()

    # Check if user has a passkey set
    from app.db.models import Passkey
    has_passkey = db.query(Passkey).filter(Passkey.user_id == user.id).first() is not None

    return {
        "challenge_required": True,
        "email": user.email,
        "has_passkey": has_passkey,
        "challenge_token": otp if not email_sent else None,   # dev fallback
        "message": "A sign-in code was sent to your email.",
    }


def verify_login_challenge(db: Session, email: str, code: str, *, ip: str, ua: str) -> dict:
    norm = email.lower().strip()
    user = db.query(User).filter(User.email == norm).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    _verify_otp(db, user, OTP_LOGIN, code.strip())

    # ── Check if 2FA is enrolled ──
    from app.core.twofa_service import is_2fa_enabled
    if is_2fa_enabled(db, user):
        # Signal to frontend: TOTP step required before tokens are issued
        _log(db, email=norm, ip=ip, ua=ua, success=False, user=user, reason="2fa_required")
        db.commit()
        return {
            "totp_required": True,
            "email": user.email,
            "message": "Enter your authenticator code or a recovery code.",
        }

    now = datetime.utcnow()
    user.last_login_at = now
    tokens = _issue_tokens(db, user, ip=ip, ua=ua)

    from app.core.email import _get_location
    location = _get_location(ip)
    # Backfill location on the newly-created session
    try:
        from app.auth.models import RefreshToken as RT
        from app.core.jwt import decode_refresh_token as _drt
        _pl = _drt(tokens["refresh_token"])
        if _pl:
            from uuid import UUID as _UUID
            _sess = db.query(RT).filter(RT.id == _UUID(str(_pl.get("session_id")))).first()
            if _sess:
                _sess.location = location
    except Exception:
        pass
    _log(db, email=norm, ip=ip, ua=ua, success=True, user=user, reason="otp_verified", location=location)
    db.commit()

    _send_login_notification_bg(user.email, ip, ua, now.strftime("%Y-%m-%d %H:%M:%S"))

    return {"user": _serialize(user), **tokens}


# ─── TOTP Login Challenge ─────────────────────────────────────────────────────

def verify_totp_login_challenge(db: Session, email: str, code: str, *, ip: str, ua: str) -> dict:
    """Final login step when user has 2FA enabled — verify TOTP or recovery code."""
    norm = email.lower().strip()
    user = db.query(User).filter(User.email == norm).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    from app.core.twofa_service import verify_2fa_for_login
    if not verify_2fa_for_login(db, user, code.strip()):
        _log(db, email=norm, ip=ip, ua=ua, success=False, user=user, reason="2fa_invalid")
        db.commit()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid authenticator code or recovery code")

    now = datetime.utcnow()
    user.last_login_at = now
    tokens = _issue_tokens(db, user, ip=ip, ua=ua)

    from app.core.email import _get_location
    location = _get_location(ip)
    try:
        from app.auth.models import RefreshToken as RT
        from app.core.jwt import decode_refresh_token as _drt
        _pl = _drt(tokens["refresh_token"])
        if _pl:
            from uuid import UUID as _UUID
            _sess = db.query(RT).filter(RT.id == _UUID(str(_pl.get("session_id")))).first()
            if _sess:
                _sess.location = location
    except Exception:
        pass
    _log(db, email=norm, ip=ip, ua=ua, success=True, user=user, reason="2fa_verified", location=location)
    db.commit()

    _send_login_notification_bg(user.email, ip, ua, now.strftime("%Y-%m-%d %H:%M:%S"))
    return {"user": _serialize(user), **tokens}


# ─── Password Reset ───────────────────────────────────────────────────────────

def forgot_password(db: Session, email: str, *, ip: str) -> dict:
    """Send OTP password reset code. Always returns success to prevent email enumeration."""
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user:
        return {"success": True, "message": "If that email exists, a reset code has been sent."}

    # Invalidate old reset tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used.is_(False),
    ).update({"used": True, "used_at": datetime.utcnow()}, synchronize_session=False)

    code = generate_otp(settings.OTP_LENGTH)
    db.add(PasswordResetToken(
        user_id=user.id,
        otp_hash=hash_token(code),
        expires_at=datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES),
        ip_address=ip,
    ))
    db.flush()

    _try_send(get_email_service().send_password_reset_email, user.email, code)
    db.commit()
    return {"success": True, "message": "If that email exists, a reset code has been sent.", "dev_token": code if not settings.EMAIL_ENABLED else None}


def reset_password(db: Session, email: str, code: str, new_password: str) -> dict:
    user = db.query(User).filter(User.email == email.lower().strip()).first()
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid reset request")

    now = datetime.utcnow()
    reset = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == user.id, PasswordResetToken.used.is_(False))
        .order_by(PasswordResetToken.created_at.desc()).first()
    )
    if not reset or reset.expires_at <= now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code")
    if reset.otp_hash != hash_token(code.strip()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid reset code")

    reset.used = True; reset.used_at = now
    user.password_hash = hash_password(new_password)

    # Revoke all sessions after password change
    from app.auth.models import RefreshToken as RT
    db.query(RT).filter(RT.user_id == user.id, RT.revoked.is_(False)).update(
        {"revoked": True, "revoked_at": now, "revoked_reason": "password_reset"}, synchronize_session=False
    )
    db.commit()
    return {"success": True, "message": "Password changed. Please sign in with your new password."}


# ─── Token Refresh ────────────────────────────────────────────────────────────

def refresh_access_token(db: Session, refresh_token: str, *, ip: str, ua: str) -> dict:
    payload = decode_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    try:
        user_uuid    = UUID(str(payload.get("sub")))
        session_uuid = UUID(str(payload.get("session_id")))
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    from app.auth.models import RefreshToken as RT
    session = db.query(RT).filter(RT.id == session_uuid, RT.user_id == user_uuid, RT.revoked.is_(False)).first()
    if not session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Session not found or revoked")
    if session.expires_at <= datetime.utcnow():
        session.revoked = True; session.revoked_at = datetime.utcnow(); session.revoked_reason = "expired"; db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    if not verify_token_hash(refresh_token, session.refresh_token_hash):
        session.revoked = True; session.revoked_at = datetime.utcnow(); session.revoked_reason = "security"; db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == user_uuid).first()
    if not user or user.disabled:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User unavailable")

    tokens = _issue_tokens(db, user, ip=ip, ua=ua, existing=session)
    db.commit()
    return {"user": _serialize(user), **tokens}


# ─── Logout ───────────────────────────────────────────────────────────────────

def logout_user(db: Session, *, refresh_token, ip: str, ua: str, all_devices: bool) -> dict:
    if not refresh_token:
        return {"success": True, "revoked": 0}
    payload = decode_refresh_token(refresh_token)
    if not payload:
        return {"success": True, "revoked": 0}
    try:
        user_uuid    = UUID(str(payload.get("sub")))
        session_uuid = UUID(str(payload.get("session_id")))
    except Exception:
        return {"success": True, "revoked": 0}

    from app.auth.models import RefreshToken as RT
    q = db.query(RT).filter(RT.user_id == user_uuid, RT.revoked.is_(False))
    if not all_devices:
        q = q.filter(RT.id == session_uuid)
    sessions = q.all()
    now = datetime.utcnow()
    for s in sessions:
        s.revoked = True; s.revoked_at = now
        s.revoked_reason = "logout_all" if all_devices else "logout"
        s.last_used_at = now; s.ip_address = ip; s.device_info = ua
    db.commit()
    return {"success": True, "revoked": len(sessions)}


# ─── Profile ─────────────────────────────────────────────────────────────────

def update_user_profile(db: Session, user: User, *, full_name=None, phone=None, country=None, date_of_birth=None) -> dict:
    if full_name  is not None: user.full_name = full_name.strip() or None
    if phone      is not None: user.phone     = phone.strip()     or None
    if country    is not None: user.country   = country.strip()   or None
    if date_of_birth is not None:
        try:
            from datetime import date; user.date_of_birth = date.fromisoformat(date_of_birth) if date_of_birth else None
        except Exception: pass
    user.updated_at = datetime.utcnow()
    db.commit(); db.refresh(user)
    return _serialize(user)
