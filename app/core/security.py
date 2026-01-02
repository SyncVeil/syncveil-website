"""
Security utilities - Password hashing, token generation, OTP
CRITICAL: Uses Argon2 for password hashing (industry standard, more secure than PBKDF2)
"""
import hashlib
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, status
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import get_settings
from app.core.jwt import decode_access_token

settings = get_settings()

# Initialize Argon2 password hasher with production-grade settings
ph = PasswordHasher(
    time_cost=settings.PASSWORD_HASH_TIME_COST,
    memory_cost=settings.PASSWORD_HASH_MEMORY_COST,
    parallelism=settings.PASSWORD_HASH_PARALLELISM,
)


def hash_password(password: str) -> str:
    """
    Hash a password using Argon2.
    NEVER store plain passwords in the database.
    """
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    Returns True if password matches, False otherwise.
    Supports both Argon2 (new) and legacy PBKDF2 (for migration).
    """
    # Check if it's an Argon2 hash
    if hashed_password.startswith('$argon2'):
        try:
            ph.verify(hashed_password, plain_password)
            return True
        except VerifyMismatchError:
            return False
    
    # Legacy PBKDF2 support (for existing users during migration)
    if hashed_password.startswith('pbkdf2:'):
        try:
            scheme, salt_b64, digest_b64 = hashed_password.split("$")
            _, algo, iter_str = scheme.split(":")
            iterations = int(iter_str)
            
            import base64
            def _decode_bytes(raw: str) -> bytes:
                padding = '=' * (-len(raw) % 4)
                return base64.urlsafe_b64decode(raw + padding)
            
            salt = _decode_bytes(salt_b64)
            expected = _decode_bytes(digest_b64)
            derived = hashlib.pbkdf2_hmac(algo, plain_password.encode(), salt, iterations, dklen=len(expected))
            
            import hmac
            return hmac.compare_digest(derived, expected)
        except Exception:
            return False
    
    return False


def generate_secure_token(length: int = 32) -> str:
    """
    Generate a cryptographically secure random token.
    Used for email verification tokens, session IDs, etc.
    """
    return secrets.token_urlsafe(length)


def generate_otp(length: int = 6) -> str:
    """
    Generate a numeric OTP code.
    Used for two-factor authentication via email.
    """
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def hash_token(token: str) -> str:
    """
    Hash a token for secure storage using SHA-256.
    Used for refresh tokens, OTP codes, and session tokens.
    We hash these so if the database is compromised, tokens can't be used directly.
    """
    return hashlib.sha256(token.encode()).hexdigest()


def verify_token_hash(token: str, token_hash: str) -> bool:
    """
    Verify a token against its hash using constant-time comparison.
    """
    import hmac
    return hmac.compare_digest(hash_token(token), token_hash)


def verify_token(token: str) -> dict:
    """
    Validate an access token and return its payload or raise HTTP 401.
    """
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload


def is_token_expired(expires_at: datetime) -> bool:
    """
    Check if a token/OTP/session has expired.
    """
    return datetime.utcnow() >= expires_at


def get_expiry_time(minutes: Optional[int] = None, hours: Optional[int] = None, days: Optional[int] = None) -> datetime:
    """
    Calculate expiry time from current UTC time.
    """
    delta_kwargs = {}
    if minutes:
        delta_kwargs['minutes'] = minutes
    if hours:
        delta_kwargs['hours'] = hours
    if days:
        delta_kwargs['days'] = days
    
    return datetime.utcnow() + timedelta(**delta_kwargs)