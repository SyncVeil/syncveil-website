"""Local encrypted vault storage for uploaded user files."""
from __future__ import annotations

import hashlib  # still used for sha256 content digest
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import get_settings


settings = get_settings()


def _derive_key() -> bytes:
    """Derive vault key via HKDF-SHA256.

    This is the legacy file-storage path (filesystem-backed vault).
    Uses the same IKM as ssce.py but a distinct salt/info so the derived
    key is domain-separated from the SSCE root key.
    """
    ikm = (settings.VAULT_ENCRYPTION_KEY or settings.JWT_SECRET or "syncveil-dev-key").encode("utf-8")
    return HKDF(
        algorithm=SHA256(),
        length=32,
        salt=b"vault-fs-v1",
        info=b"syncveil-vault-fs-key",
    ).derive(ikm)


AES_KEY = _derive_key()
AESCIPHER = AESGCM(AES_KEY)
BASE_DIR = Path(settings.VAULT_STORAGE_DIR).resolve()
BASE_DIR.mkdir(parents=True, exist_ok=True)


def _safe_name(filename: str) -> str:
    candidate = (filename or "file").strip()
    if not candidate:
        candidate = "file"

    # Keep only conservative filename characters.
    safe = "".join(ch for ch in candidate if ch.isalnum() or ch in {"-", "_", ".", " "})
    safe = safe.strip().replace(" ", "_")
    return safe[:120] or "file"


def _user_dir(user_id: str) -> Path:
    path = BASE_DIR / user_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def _index_path(user_id: str) -> Path:
    return _user_dir(user_id) / "index.json"


def _load_index(user_id: str) -> list[dict[str, Any]]:
    index_path = _index_path(user_id)
    if not index_path.exists():
        return []

    try:
        payload = json.loads(index_path.read_text(encoding="utf-8"))
    except Exception:
        # Self-heal: preserve corrupt index and rebuild from scratch.
        corrupt_name = index_path.with_suffix(f".corrupt-{int(datetime.utcnow().timestamp())}.json")
        try:
            index_path.rename(corrupt_name)
        except Exception:
            pass
        return []

    if not isinstance(payload, list):
        return []

    cleaned: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        if not item.get("id") or not item.get("stored_name"):
            continue
        cleaned.append(item)

    return cleaned


def _save_index(user_id: str, records: list[dict[str, Any]]) -> None:
    index_path = _index_path(user_id)
    tmp_path = index_path.with_suffix(".tmp")
    tmp_path.write_text(json.dumps(records, indent=2), encoding="utf-8")
    os.replace(tmp_path, index_path)


def list_files(user_id: str) -> list[dict[str, Any]]:
    records = _load_index(user_id)
    user_path = _user_dir(user_id)

    valid: list[dict[str, Any]] = []
    changed = False
    for record in records:
        stored_path = user_path / record["stored_name"]
        if not stored_path.exists():
            changed = True
            continue
        valid.append(record)

    if changed:
        _save_index(user_id, valid)

    return [
        {
            "id": record["id"],
            "name": record["name"],
            "size": record["size"],
            "content_type": record.get("content_type") or "application/octet-stream",
            "uploaded_at": record["uploaded_at"],
            "sha256": record["sha256"],
        }
        for record in valid
    ]


def store_file(user_id: str, *, filename: str, content: bytes, content_type: str = "application/octet-stream") -> dict[str, Any]:
    user_path = _user_dir(user_id)
    safe_name = _safe_name(filename)
    file_id = uuid4().hex
    stored_name = f"{file_id}.enc"
    stored_path = user_path / stored_name

    nonce = os.urandom(12)
    aad = user_id.encode("utf-8")
    encrypted_payload = nonce + AESCIPHER.encrypt(nonce, content, aad)
    stored_path.write_bytes(encrypted_payload)

    sha256_digest = hashlib.sha256(content).hexdigest()

    metadata = {
        "id": file_id,
        "name": safe_name,
        "stored_name": stored_name,
        "size": len(content),
        "content_type": content_type,
        "uploaded_at": datetime.utcnow().isoformat() + "Z",
        "sha256": sha256_digest,
    }

    records = _load_index(user_id)
    records.insert(0, metadata)
    _save_index(user_id, records)

    return {
        "id": file_id,
        "name": safe_name,
        "size": len(content),
        "content_type": content_type,
        "uploaded_at": metadata["uploaded_at"],
        "sha256": sha256_digest,
    }


def user_vault_stats(user_id: str) -> dict[str, Any]:
    records = _load_index(user_id)
    total_size = sum(item.get("size", 0) for item in records)
    return {
        "file_count": len(records),
        "total_size": total_size,
    }
