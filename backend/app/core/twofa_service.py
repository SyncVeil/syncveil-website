"""Two-Factor Authentication service layer."""
from __future__ import annotations
import json
import os
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.totp import (
    generate_recovery_codes,
    generate_totp_secret,
    hash_recovery_code,
    provisioning_uri,
    verify_recovery_code,
    verify_totp,
)
from app.core.ssce import derive_user_key
from app.db.models import TwoFactorConfig, TwoFactorRecoveryCode, User
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# ─── TOTP secret encryption ──────────────────────────────────────────────────
# TOTP secrets are encrypted at rest using a key derived from the user's
# scoped key (from ssce.derive_user_key).  A separate HKDF context is used
# to keep the TOTP key distinct from the vault file-wrapping key.
# Format stored in DB:  hex(nonce_12) + ":" + hex(aesgcm_ciphertext)

def _totp_cipher_key(user_id: str) -> bytes:
    """Derive a 32-byte AES key for TOTP secret encryption for this user."""
    from cryptography.hazmat.primitives.hashes import SHA256
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    user_key = derive_user_key(str(user_id))
    return HKDF(
        algorithm=SHA256(),
        length=32,
        salt=b"totp-secret-v1",
        info=f"syncveil-totp:{user_id}".encode(),
    ).derive(user_key)


def _encrypt_totp_secret(user_id: str, secret: str) -> str:
    """Encrypt a plaintext TOTP secret; return storable string."""
    key    = _totp_cipher_key(str(user_id))
    nonce  = os.urandom(12)
    ct     = AESGCM(key).encrypt(nonce, secret.encode("utf-8"), None)
    return nonce.hex() + ":" + ct.hex()


def _decrypt_totp_secret(user_id: str, stored: str) -> str:
    """Decrypt a stored TOTP secret string; return plaintext."""
    if ":" not in stored:
        # Legacy plaintext — return as-is during migration window.
        return stored
    nonce_hex, ct_hex = stored.split(":", 1)
    key  = _totp_cipher_key(str(user_id))
    pt   = AESGCM(key).decrypt(bytes.fromhex(nonce_hex), bytes.fromhex(ct_hex), None)
    return pt.decode("utf-8")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_or_none(db: Session, user: User) -> Optional[TwoFactorConfig]:
    return db.query(TwoFactorConfig).filter(TwoFactorConfig.user_id == user.id).first()


def _require_config(db: Session, user: User) -> TwoFactorConfig:
    cfg = _get_or_none(db, user)
    if not cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="2FA not set up")
    return cfg


# ─── Setup — step 1 ──────────────────────────────────────────────────────────

def begin_totp_setup(db: Session, user: User) -> dict:
    """
    Generate a fresh TOTP secret and return the provisioning URI + QR data.
    The secret is stored as *pending* (not yet confirmed/enabled).
    """
    secret = generate_totp_secret()
    uri    = provisioning_uri(secret, user.email)

    cfg = _get_or_none(db, user)
    if cfg is None:
        cfg = TwoFactorConfig(user_id=user.id)
        db.add(cfg)

    cfg.totp_secret_pending = _encrypt_totp_secret(user.id, secret)
    cfg.totp_pending_at     = datetime.utcnow()
    db.commit()

    return {
        "secret": secret,
        "provisioning_uri": uri,
        "issuer": "SyncVeil",
        "account": user.email,
    }


# ─── Setup — step 2 (confirm) ────────────────────────────────────────────────

def confirm_totp_setup(db: Session, user: User, code: str) -> dict:
    """
    Verify the first TOTP code from the authenticator app.
    On success: activate 2FA and issue fresh recovery codes.
    """
    cfg = _require_config(db, user)
    if not cfg.totp_secret_pending:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="No pending 2FA setup — call /2fa/setup first")

    pending_plain = _decrypt_totp_secret(user.id, cfg.totp_secret_pending)
    if not verify_totp(pending_plain, code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid code — check your authenticator app time sync")

    # Activate — keep the already-encrypted pending value as the active secret
    cfg.totp_secret         = cfg.totp_secret_pending
    cfg.totp_secret_pending = None
    cfg.totp_pending_at     = None
    cfg.enabled      = True
    cfg.enabled_at   = datetime.utcnow()

    # Purge old recovery codes
    db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
    ).delete(synchronize_session=False)

    # Issue new recovery codes
    plain_codes = generate_recovery_codes()
    for c in plain_codes:
        db.add(TwoFactorRecoveryCode(
            user_id=user.id,
            code_hash=hash_recovery_code(c),
        ))

    db.commit()
    return {"enabled": True, "recovery_codes": plain_codes}


# ─── Disable ─────────────────────────────────────────────────────────────────

def disable_totp(db: Session, user: User, code: str) -> dict:
    """Disable 2FA after verifying current TOTP or a recovery code."""
    cfg = _get_or_none(db, user)
    if not cfg or not cfg.enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="2FA is not enabled")

    # Accept TOTP code or recovery code
    active_plain = _decrypt_totp_secret(user.id, cfg.totp_secret)
    ok = verify_totp(active_plain, code)
    if not ok:
        ok = _try_recovery_code(db, user, code)

    if not ok:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid code")

    cfg.enabled      = False
    cfg.disabled_at  = datetime.utcnow()
    cfg.totp_secret  = None
    db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"enabled": False}


# ─── Status ───────────────────────────────────────────────────────────────────

def get_2fa_status(db: Session, user: User) -> dict:
    cfg = _get_or_none(db, user)
    if not cfg or not cfg.enabled:
        return {"enabled": False, "recovery_codes_remaining": 0}

    remaining = db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
        TwoFactorRecoveryCode.used.is_(False),
    ).count()

    return {
        "enabled": True,
        "enabled_at": cfg.enabled_at.isoformat() if cfg.enabled_at else None,
        "recovery_codes_remaining": remaining,
    }


# ─── Regenerate recovery codes ───────────────────────────────────────────────

def regenerate_recovery_codes(db: Session, user: User, code: str) -> dict:
    cfg = _get_or_none(db, user)
    if not cfg or not cfg.enabled:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="2FA is not enabled")

    active_plain = _decrypt_totp_secret(user.id, cfg.totp_secret)
    if not verify_totp(active_plain, code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid TOTP code")

    db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
    ).delete(synchronize_session=False)

    plain_codes = generate_recovery_codes()
    for c in plain_codes:
        db.add(TwoFactorRecoveryCode(user_id=user.id, code_hash=hash_recovery_code(c)))

    db.commit()
    return {"recovery_codes": plain_codes}


# ─── Login verification ──────────────────────────────────────────────────────

def verify_2fa_for_login(db: Session, user: User, code: str) -> bool:
    """
    Called during the login challenge flow when 2FA is enabled.
    Returns True if valid TOTP or valid (unused) recovery code.
    """
    cfg = _get_or_none(db, user)
    if not cfg or not cfg.enabled:
        return True  # 2FA not enrolled — pass through

    if verify_totp(_decrypt_totp_secret(user.id, cfg.totp_secret), code):
        return True

    return _try_recovery_code(db, user, code)


def is_2fa_enabled(db: Session, user: User) -> bool:
    cfg = _get_or_none(db, user)
    return bool(cfg and cfg.enabled)


# ─── Internal ────────────────────────────────────────────────────────────────

def _try_recovery_code(db: Session, user: User, code: str) -> bool:
    """Consume a recovery code if valid. Returns True on success."""
    unused = db.query(TwoFactorRecoveryCode).filter(
        TwoFactorRecoveryCode.user_id == user.id,
        TwoFactorRecoveryCode.used.is_(False),
    ).all()
    for rc in unused:
        if verify_recovery_code(code, rc.code_hash):
            rc.used    = True
            rc.used_at = datetime.utcnow()
            db.commit()
            return True
    return False
