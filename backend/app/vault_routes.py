"""
SyncVeil Secure Container Engine — Vault Routes
=================================================
Drop-in replacement for the vault section of dashboard_routes.py.

Endpoints:
  POST   /api/vault/upload
  GET    /api/vault/files
  GET    /api/vault/files/{id}/download
  GET    /api/vault/files/{id}/integrity
  DELETE /api/vault/files/{id}
  GET    /api/vault/storage/stats

Plug this module into app/main.py:
  from app.vault_routes import router as vault_router
  app.include_router(vault_router)

Then REMOVE the vault endpoints from dashboard_routes.py
(the upload, list, delete, and download routes added earlier).
"""
from __future__ import annotations

import hashlib
import io
import json
import os
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import verify_token
from app.core.ssce import (
    ContainerMetadata,
    MalwareScanResult,
    build_container,
    parse_container,
    scan_bytes,
    verify_container_integrity,
)
from app.db.models import Session as UserSession, User, VaultAuditLog, VaultFile
from app.db.session import get_db

settings = get_settings()
router   = APIRouter(prefix="/api", tags=["vault"])

# Per-user quota — override via VAULT_QUOTA_MB env var (default 100 MB)
_quota_mb   = int(os.getenv("VAULT_QUOTA_MB", "100"))
VAULT_QUOTA = _quota_mb * 1024 * 1024

# Hard cap per file (5 MB MVP; raise when large-file streaming is implemented)
MAX_FILE_SIZE = 5 * 1024 * 1024


# ── Auth dependency (mirrors dashboard_routes.get_current_user) ───────────────

class AuthUser:
    def __init__(self, user: User, session: UserSession, db: Session):
        self.user = user
        self.session = session
        self.db = db


def get_current_user(
    authorization: str = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthUser:
    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Not authenticated",
                            headers={"WWW-Authenticate": "Bearer"})
    scheme, _, token = authorization.partition(" ")
    if scheme != "Bearer" or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token format",
                            headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = verify_token(token.strip())
        uid, sid = payload.get("sub"), payload.get("session_id")
        if not uid or not sid:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        uu, su = UUID(str(uid)), UUID(str(sid))
        sess = db.query(UserSession).filter(
            UserSession.id == su,
            UserSession.user_id == uu,
            UserSession.revoked.is_(False),
            UserSession.expires_at > datetime.utcnow(),
        ).first()
        if not sess:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Session expired or revoked")
        user = db.query(User).filter(User.id == uu).first()
        if not user or user.disabled:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="User unavailable")
        return AuthUser(user=user, session=sess, db=db)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


# ── Audit helper ──────────────────────────────────────────────────────────────

def _audit(
    db: Session,
    *,
    user_id,
    event_type: str,
    file_id=None,
    ip: str = "",
    ua: str = "",
    detail: str = "",
    success: bool = True,
) -> None:
    """Write a vault audit record. Never raises — failures are silently logged."""
    try:
        db.add(VaultAuditLog(
            user_id    = user_id,
            file_id    = file_id,
            event_type = event_type,
            ip_address = ip or None,
            user_agent = ua[:500] if ua else None,
            detail     = detail[:2000] if detail else None,
            success    = success,
        ))
        db.flush()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("Audit write failed: %s", exc)


def _ip_ua(request_headers) -> tuple[str, str]:
    """Extract IP and User-Agent from raw header dict (works with FastAPI Request too)."""
    try:
        ip = (request_headers.get("x-forwarded-for", "")
              .split(",")[0].strip()
              or request_headers.get("x-real-ip", ""))
        ua = request_headers.get("user-agent", "")
        return ip, ua
    except Exception:
        return "", ""


# ── Serialiser ───────────────────────────────────────────────────────────────

def _serialize(vf: VaultFile) -> dict:
    return {
        "id":                  str(vf.id),
        "file_name":           vf.file_name,
        "size_bytes":          vf.size_bytes,
        "container_size":      vf.container_size,
        "content_type":        vf.content_type,
        "sha256":              vf.sha256,
        "hmac":                vf.hmac,
        "compression_type":    vf.compression_type,
        "encryption_version":  vf.encryption_version,
        "storage_backend":     vf.storage_backend,
        "version":             vf.version,
        "malware_scan_status": vf.malware_scan_status,
        "malware_scan_at":     vf.malware_scan_at.isoformat() if vf.malware_scan_at else None,
        "uploaded_at":         vf.uploaded_at.isoformat() if vf.uploaded_at else None,
    }


# ── Upload ────────────────────────────────────────────────────────────────────

@router.post("/vault/upload")
async def upload_file(
    file: UploadFile = File(...),
    auth: AuthUser = Depends(get_current_user),
):
    """
    Full SSCE upload pipeline:
      Read → Quota check → Malware scan → Compress → Encrypt → Store
    """
    from fastapi import Request  # noqa — only needed for header extraction
    ip, ua = "", ""  # FastAPI UploadFile doesn't carry Request; IP logged best-effort

    # 1. Read content
    content = await file.read()

    # 2. Per-file size limit
    if len(content) > MAX_FILE_SIZE:
        _audit(auth.db, user_id=auth.user.id, event_type="upload",
               detail=f"Rejected: file {len(content)} bytes exceeds {MAX_FILE_SIZE}", success=False)
        auth.db.commit()
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"File exceeds {MAX_FILE_SIZE // (1024*1024)} MB limit")

    # 3. Quota check
    current_usage: int = (
        auth.db.query(func.sum(VaultFile.size_bytes))
        .filter(VaultFile.user_id == auth.user.id)
        .scalar()
    ) or 0
    if current_usage + len(content) > VAULT_QUOTA:
        remaining = max(0, VAULT_QUOTA - current_usage)
        _audit(auth.db, user_id=auth.user.id, event_type="quota_exceeded",
               detail=json.dumps({"used": current_usage, "upload_size": len(content), "quota": VAULT_QUOTA}),
               success=False)
        auth.db.commit()
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Storage quota exceeded. "
                f"Quota: {VAULT_QUOTA // (1024*1024)} MB, "
                f"Used: {current_usage // (1024*1024)} MB, "
                f"Available: {remaining // (1024*1024)} MB."
            ),
        )

    # 4. Malware scan (non-blocking if ClamAV unavailable)
    scan: MalwareScanResult = scan_bytes(content)
    scan_status = "clean" if scan.clean else "infected"
    if "unavailable" in scan.scanner:
        scan_status = "unavailable"

    if not scan.clean:
        _audit(auth.db, user_id=auth.user.id, event_type="malware_blocked",
               detail=json.dumps({"threat": scan.threat, "filename": file.filename}),
               success=False)
        auth.db.commit()
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File rejected: malware detected ({scan.threat})",
        )

    # 5. Build .syncveil container (compress → encrypt → wrap)
    filename     = (file.filename or "file").strip()[:500]
    content_type = file.content_type or "application/octet-stream"
    try:
        container, meta = build_container(
            content,
            filename=filename,
            content_type=content_type,
            user_id=str(auth.user.id),
        )
    except Exception as exc:
        _audit(auth.db, user_id=auth.user.id, event_type="upload",
               detail=f"Container build failed: {exc}", success=False)
        auth.db.commit()
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="Encryption failed — please try again")

    # 6. Compute HMAC hex for the DB index (already embedded in container, stored separately for queries)
    import hmac as _hmac_mod
    hmac_hex = _hmac_mod.new(
        # Re-use master key from ssce module
        __import__("app.core.ssce", fromlist=["MASTER_KEY"]).MASTER_KEY,
        container,
        __import__("hashlib").sha256,
    ).hexdigest()
    # Actually the HMAC is already the last 32 bytes of the container as raw bytes.
    # Store it as hex for the DB column.
    hmac_hex = container[-32:].hex()

    # 7. Extract encrypted_file_key from container for denormalized storage
    # Layout: MAGIC(8) + VERSION(1) + METALEN(4) + META(n) + FILE_NONCE(12) + ENC_KEY(48) + ...
    import struct
    offset     = 8 + 1 + 4
    meta_len_s = struct.unpack(">I", container[8+1:8+1+4])[0]
    offset    += meta_len_s + 12   # skip metadata + file_nonce
    enc_key    = container[offset: offset + 48]

    # 8. Persist
    vf = VaultFile(
        user_id             = auth.user.id,
        file_name           = meta.original_filename,
        content_type        = meta.content_type,
        size_bytes          = meta.original_size,
        container_size      = len(container),
        sha256              = meta.sha256_plaintext,
        hmac                = hmac_hex,
        encrypted_file_key  = enc_key,
        compression_type    = meta.compression,
        encryption_version  = meta.ssce_version,
        key_version         = meta.key_version,
        storage_backend     = "postgresql",
        version             = 1,
        malware_scan_status = scan_status,
        malware_scan_at     = datetime.utcnow(),
        encrypted_data      = container,
    )
    auth.db.add(vf)
    auth.db.flush()

    _audit(auth.db, user_id=auth.user.id, file_id=vf.id, event_type="upload",
           detail=json.dumps({
               "filename": filename,
               "original_size": meta.original_size,
               "container_size": len(container),
               "scan": scan.scanner,
               "compression_ratio": round(meta.compressed_size / max(meta.original_size, 1), 3),
           }))
    auth.db.commit()
    auth.db.refresh(vf)

    return {"file": _serialize(vf)}


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/vault/files")
def get_vault_files(auth: AuthUser = Depends(get_current_user)):
    files = (
        auth.db.query(VaultFile)
        .filter(VaultFile.user_id == auth.user.id)
        .order_by(desc(VaultFile.uploaded_at))
        .all()
    )
    return {"files": [_serialize(f) for f in files]}


# ── Download ──────────────────────────────────────────────────────────────────

@router.get("/vault/files/{file_id}/download")
def download_vault_file(file_id: str, auth: AuthUser = Depends(get_current_user)):
    """
    Verify HMAC → parse container → decrypt → decompress → stream to client.
    """
    try:
        fid = UUID(file_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid file ID")

    vf = auth.db.query(VaultFile).filter(
        VaultFile.id == fid,
        VaultFile.user_id == auth.user.id,
    ).first()
    if not vf:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File not found")

    try:
        plaintext, meta = parse_container(bytes(vf.encrypted_data))
    except ValueError as exc:
        _audit(auth.db, user_id=auth.user.id, file_id=vf.id,
               event_type="integrity_fail",
               detail=str(exc), success=False)
        auth.db.commit()
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="File integrity verification failed")

    _audit(auth.db, user_id=auth.user.id, file_id=vf.id, event_type="download")
    auth.db.commit()

    safe_name = vf.file_name.replace('"', '\\"')
    return StreamingResponse(
        io.BytesIO(plaintext),
        media_type=vf.content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "Content-Length":      str(len(plaintext)),
            "X-Content-Type-Options": "nosniff",
            "X-Vault-SHA256":      meta.sha256_plaintext,
            "X-Vault-Version":     str(vf.version),
        },
    )


# ── Integrity check ───────────────────────────────────────────────────────────

@router.get("/vault/files/{file_id}/integrity")
def check_file_integrity(file_id: str, auth: AuthUser = Depends(get_current_user)):
    """
    Verify HMAC and container structure without full decryption.
    Lightweight — suitable for periodic background health checks.
    """
    try:
        fid = UUID(file_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid file ID")

    vf = auth.db.query(VaultFile).filter(
        VaultFile.id == fid,
        VaultFile.user_id == auth.user.id,
    ).first()
    if not vf:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File not found")

    result = verify_container_integrity(bytes(vf.encrypted_data))

    if not result["integrity_ok"]:
        _audit(auth.db, user_id=auth.user.id, file_id=vf.id,
               event_type="integrity_fail",
               detail=json.dumps(result), success=False)
        auth.db.commit()

    return {
        "file_id":      str(vf.id),
        "file_name":    vf.file_name,
        "integrity":    result,
        "stored_hmac":  vf.hmac,
        "stored_sha256": vf.sha256,
    }


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/vault/files/{file_id}")
def delete_vault_file(file_id: str, auth: AuthUser = Depends(get_current_user)):
    try:
        fid = UUID(file_id)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid file ID")

    vf = auth.db.query(VaultFile).filter(
        VaultFile.id == fid,
        VaultFile.user_id == auth.user.id,
    ).first()
    if not vf:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="File not found")

    fname = vf.file_name
    _audit(auth.db, user_id=auth.user.id, file_id=vf.id, event_type="delete",
           detail=json.dumps({"filename": fname, "size_bytes": vf.size_bytes}))
    auth.db.delete(vf)
    auth.db.commit()
    return {"success": True}


# ── Storage stats ─────────────────────────────────────────────────────────────

@router.get("/vault/storage/stats")
def vault_storage_stats(auth: AuthUser = Depends(get_current_user)):
    """Per-user vault statistics including quota utilisation."""
    rows = (
        auth.db.query(
            func.count(VaultFile.id).label("file_count"),
            func.sum(VaultFile.size_bytes).label("total_plaintext"),
            func.sum(VaultFile.container_size).label("total_container"),
        )
        .filter(VaultFile.user_id == auth.user.id)
        .one()
    )

    malware_blocked = (
        auth.db.query(func.count(VaultAuditLog.id))
        .filter(
            VaultAuditLog.user_id == auth.user.id,
            VaultAuditLog.event_type == "malware_blocked",
        )
        .scalar()
    ) or 0

    integrity_fails = (
        auth.db.query(func.count(VaultAuditLog.id))
        .filter(
            VaultAuditLog.user_id == auth.user.id,
            VaultAuditLog.event_type == "integrity_fail",
        )
        .scalar()
    ) or 0

    file_count       = rows.file_count or 0
    total_plaintext  = rows.total_plaintext or 0
    total_container  = rows.total_container or 0
    quota_used_pct   = round((total_plaintext / VAULT_QUOTA) * 100, 1) if VAULT_QUOTA else 0

    # Vault Health Score: starts at 100, deductions for issues
    health = 100
    health -= min(50, integrity_fails * 20)
    health -= min(20, malware_blocked * 5)
    health = max(0, health)

    return {
        "file_count":          file_count,
        "total_size_bytes":    total_plaintext,
        "total_container_bytes": total_container,
        "quota_bytes":         VAULT_QUOTA,
        "quota_used_pct":      quota_used_pct,
        "quota_remaining_bytes": max(0, VAULT_QUOTA - total_plaintext),
        "malware_blocked":     malware_blocked,
        "integrity_fails":     integrity_fails,
        "vault_health_score":  health,
        "storage_backend":     "postgresql",
    }
