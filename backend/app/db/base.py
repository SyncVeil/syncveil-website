"""SQLAlchemy Base and all models"""
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models so Alembic can detect them
from app.db.models import (
    User,
    Session,
    OTPAttempt,
    EmailVerification,
    LoginLog,
    AdminUser,
    AdminAction,
)

__all__ = [
    "Base",
    "User",
    "Session",
    "OTPAttempt",
    "EmailVerification",
    "LoginLog",
    "AdminUser",
    "AdminAction",
]