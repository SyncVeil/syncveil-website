"""
JWT Token Management
CRITICAL: Short-lived access tokens, long-lived refresh tokens
All tokens must be validated against active sessions in the database
"""
from datetime import datetime, timedelta
from typing import Dict, Optional

from jose import jwt, JWTError

from app.core.config import get_settings

settings = get_settings()


def create_token(data: Dict, expires_delta: timedelta) -> str:
    """Create a JWT token with expiration"""
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + expires_delta
    payload["iat"] = datetime.utcnow()
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, session_id: str, extra: Optional[Dict] = None) -> str:
    """
    Create short-lived access token.
    CRITICAL: Access tokens must include session_id for validation.
    """
    payload = {
        "sub": user_id,
        "session_id": session_id,
        "type": "access"
    }
    if extra:
        payload.update(extra)
    return create_token(payload, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))


def create_refresh_token(user_id: str, session_id: str, extra: Optional[Dict] = None) -> str:
    """
    Create long-lived refresh token.
    CRITICAL: Refresh tokens are stored hashed in the database.
    """
    payload = {
        "sub": user_id,
        "session_id": session_id,
        "type": "refresh"
    }
    if extra:
        payload.update(extra)
    return create_token(payload, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))


def decode_access_token(token: str) -> Optional[Dict]:
    """
    Decode and validate an access token.
    Returns payload if valid, None otherwise.
    CRITICAL: Frontend never decides authentication - always verify on backend.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        
        # Validate token type
        if payload.get("type") != "access":
            return None
        
        # Validate required fields
        if not payload.get("sub") or not payload.get("session_id"):
            return None
        
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> Optional[Dict]:
    """
    Decode and validate a refresh token.
    Returns payload if valid, None otherwise.
    """
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        
        # Validate token type
        if payload.get("type") != "refresh":
            return None
        
        # Validate required fields
        if not payload.get("sub") or not payload.get("session_id"):
            return None
        
        return payload
    except JWTError:
        return None