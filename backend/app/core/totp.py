"""TOTP / 2FA — Google Authenticator & Microsoft Authenticator compatible (RFC 6238)"""
from __future__ import annotations
import base64
import hashlib
import hmac as _hmac
import os
import secrets
import struct
import time
import urllib.parse
from typing import Optional

import pyotp

APP_NAME = "SyncVeil"
RECOVERY_CODE_COUNT = 8
RECOVERY_CODE_LEN   = 10  # characters, grouped as XXXXX-XXXXX


# ─── Key generation ──────────────────────────────────────────────────────────

def generate_totp_secret() -> str:
    """Return a new random base32 TOTP secret (160-bit)."""
    return pyotp.random_base32()


def get_totp(secret: str) -> pyotp.TOTP:
    return pyotp.TOTP(secret, interval=30, digits=6)


# ─── QR / provisioning URI ───────────────────────────────────────────────────

def provisioning_uri(secret: str, email: str) -> str:
    """otpauth:// URI for QR code scanners."""
    return get_totp(secret).provisioning_uri(name=email, issuer_name=APP_NAME)


# ─── Verification ────────────────────────────────────────────────────────────

def verify_totp(secret: str, code: str, valid_window: int = 1) -> bool:
    """Verify a 6-digit code with ±1 step tolerance (±30 s)."""
    if not secret or not code:
        return False
    code = code.strip().replace(" ", "")
    if not code.isdigit() or len(code) != 6:
        return False
    try:
        return get_totp(secret).verify(code, valid_window=valid_window)
    except Exception:
        return False


# ─── Recovery codes ──────────────────────────────────────────────────────────

def _fmt(raw: str) -> str:
    """Format as XXXXX-XXXXX."""
    return f"{raw[:5]}-{raw[5:]}"


def generate_recovery_codes() -> list[str]:
    """Generate RECOVERY_CODE_COUNT human-readable recovery codes."""
    codes = []
    for _ in range(RECOVERY_CODE_COUNT):
        raw = "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(RECOVERY_CODE_LEN))
        codes.append(_fmt(raw))
    return codes


def hash_recovery_code(code: str) -> str:
    """SHA-256 hash of a normalised recovery code (store this, not the plaintext)."""
    normalised = code.upper().replace("-", "").strip()
    return hashlib.sha256(normalised.encode()).hexdigest()


def verify_recovery_code(code: str, stored_hash: str) -> bool:
    normalised = code.upper().replace("-", "").strip()
    candidate  = hashlib.sha256(normalised.encode()).hexdigest()
    return _hmac.compare_digest(candidate, stored_hash)
