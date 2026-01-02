import os
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.models import RefreshToken, User
from app.core.config import get_settings
from app.core.email import get_email_service
from app.core.jwt import create_access_token, create_refresh_token
from app.core.security import generate_otp, hash_password, hash_token, verify_password
from app.db.mongodb import get_sync_mongodb

settings = get_settings()
REFRESH_EXPIRES_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))
OTP_COLLECTION = "email_otps"
OTP_PURPOSE_EMAIL = "email_verification"


def _serialize_user(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "email_verified": user.email_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def _issue_tokens(db: Session, user: User) -> dict:
    access_token = create_access_token(str(user.id), {"email": user.email})
    refresh_token = create_refresh_token(str(user.id), {"email": user.email})
    token_record = RefreshToken(
        user_id=user.id,
        refresh_token_hash=hash_token(refresh_token),
        expires_at=datetime.utcnow() + timedelta(days=REFRESH_EXPIRES_DAYS),
        last_used_at=datetime.utcnow(),
    )
    db.add(token_record)
    db.commit()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


def register_user(db: Session, email: str, password: str) -> dict:
    existing = db.query(User).filter(User.email == email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=email.lower(), password_hash=hash_password(password), email_verified=False)
    db.add(user)
    db.commit()
    db.refresh(user)

    otp_code = _create_email_verification_otp(user)
    _send_verification_email(user.email, otp_code)

    return {
        "user": _serialize_user(user),
        "verification_token": None,
    }


def verify_email(db: Session, token: str) -> dict:
    otp_code = token.strip()
    if not otp_code.isdigit() or len(otp_code) != settings.OTP_LENGTH:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP code")

    collection = _get_otp_collection()
    otp_hash = hash_token(otp_code)
    record = collection.find_one({"otp_hash": otp_hash, "purpose": OTP_PURPOSE_EMAIL})
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid or expired OTP")

    now = datetime.utcnow()
    if record.get("used"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP already used")
    if record.get("expires_at") and record["expires_at"] <= now:
        collection.update_one({"_id": record["_id"]}, {"$set": {"used": True, "used_at": now}})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OTP expired")

    try:
        user_id = UUID(str(record.get("user_id")))
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OTP record")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        collection.update_one({"_id": record["_id"]}, {"$set": {"used": True, "used_at": now}})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.email_verified = True
    user.email_verified_at = now
    db.commit()

    collection.update_one({"_id": record["_id"]}, {"$set": {"used": True, "used_at": now}})
    return _serialize_user(user)


def login_user(db: Session, email: str, password: str) -> dict:
    user = db.query(User).filter(User.email == email.lower()).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")

    tokens = _issue_tokens(db, user)
    return {"user": _serialize_user(user), **tokens}


def _get_otp_collection():
    try:
        db = get_sync_mongodb()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"OTP storage unavailable: {exc}")
    return db[OTP_COLLECTION]


def _create_email_verification_otp(user: User) -> str:
    collection = _get_otp_collection()
    otp_code = generate_otp(settings.OTP_LENGTH)
    otp_hash = hash_token(otp_code)
    expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    # Remove any existing unused OTPs for this user/purpose
    collection.delete_many({"user_id": str(user.id), "purpose": OTP_PURPOSE_EMAIL, "used": False})

    collection.insert_one(
        {
            "user_id": str(user.id),
            "email": user.email,
            "purpose": OTP_PURPOSE_EMAIL,
            "otp_hash": otp_hash,
            "expires_at": expires_at,
            "created_at": datetime.utcnow(),
            "used": False,
            "used_at": None,
            "attempts": 0,
        }
    )

    return otp_code


def _send_verification_email(email: str, otp_code: str) -> None:
    email_service = get_email_service()
    try:
        email_service.send_verification_email(email, otp_code)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to send verification email") from exc