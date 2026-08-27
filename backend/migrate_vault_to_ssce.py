#!/usr/bin/env python3
"""
scripts/migrate_vault_to_ssce.py
=================================
One-time script that re-wraps existing vault rows written by the old
raw-AES scheme (nonce stored in a separate column, no .syncveil container)
into the new SSCE .syncveil container format.

When to run:
  After deploying migration 003 and vault_routes.py, but BEFORE users
  try to download pre-existing files. Any row that still has
  encryption_version = 1 AND a NULL hmac field is a legacy row.

Safety:
  - Reads the existing encrypted_data + the legacy nonce to decrypt
  - Re-encrypts with a fresh per-file key inside a .syncveil container
  - Updates the row in-place; does NOT delete old data until commit
  - Dry-run mode by default — pass --commit to apply changes
  - Idempotent: rows that already have a valid hmac are skipped

Usage:
  DATABASE_URL=postgresql://... \
  VAULT_ENCRYPTION_KEY=your-key \
      python scripts/migrate_vault_to_ssce.py [--commit] [--batch 50]
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
from datetime import datetime
from uuid import UUID

# Make sure the backend app is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.ssce import MASTER_KEY, build_container


# ── Derive the legacy AESKEY (same derivation as old dashboard_routes.py) ─────
def _legacy_aeskey() -> bytes:
    vault_key = os.getenv("VAULT_ENCRYPTION_KEY", "")
    jwt_secret = os.getenv("JWT_SECRET", "")
    raw = (vault_key or jwt_secret or "dev-key").encode()
    return hashlib.sha256(raw).digest()


LEGACY_KEY = _legacy_aeskey()


def migrate(db_url: str, *, commit: bool, batch_size: int) -> None:
    engine = create_engine(db_url, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Fetch legacy rows: no hmac yet AND have a nonce column value
    # We check for nonce IS NOT NULL as the distinguishing marker.
    # (Migration 003 drops the nonce column but the data still lives in
    #  the row if the column hasn't been dropped yet, OR we check hmac IS NULL.)
    try:
        rows = session.execute(text(
            "SELECT id, user_id, file_name, content_type, size_bytes, sha256, "
            "       encrypted_data, nonce "
            "FROM vault_files "
            "WHERE hmac IS NULL "
            "ORDER BY uploaded_at"
        )).fetchall()
    except Exception as exc:
        # nonce column already dropped — use hmac IS NULL only
        print(f"Note: nonce column absent ({exc}); querying by hmac IS NULL only")
        rows = session.execute(text(
            "SELECT id, user_id, file_name, content_type, size_bytes, sha256, "
            "       encrypted_data, NULL as nonce "
            "FROM vault_files "
            "WHERE hmac IS NULL "
            "ORDER BY uploaded_at"
        )).fetchall()

    total = len(rows)
    print(f"Found {total} legacy row(s) to migrate")
    if total == 0:
        print("Nothing to do.")
        return

    ok = err = skip = 0

    for i, row in enumerate(rows, 1):
        file_id    = row.id
        user_id    = row.user_id
        file_name  = row.file_name or "file"
        content_type = row.content_type or "application/octet-stream"
        enc_data   = bytes(row.encrypted_data) if row.encrypted_data else b""
        nonce      = bytes(row.nonce) if row.nonce else None

        print(f"  [{i}/{total}] {file_id}  {file_name!r}", end="  ")

        # ── Decrypt legacy ciphertext ──────────────────────────────────────────
        if nonce is None:
            # No nonce — cannot decrypt; skip
            print("SKIP (no nonce)")
            skip += 1
            continue

        try:
            aad       = str(user_id).encode()
            cipher    = AESGCM(LEGACY_KEY)
            plaintext = cipher.decrypt(nonce, enc_data, aad)
        except Exception as exc:
            print(f"DECRYPT FAIL ({exc})")
            err += 1
            continue

        # ── Verify SHA-256 if stored ────────────────────────────────────────────
        stored_sha = row.sha256
        if stored_sha and hashlib.sha256(plaintext).hexdigest() != stored_sha:
            print("INTEGRITY FAIL (sha256 mismatch)")
            err += 1
            continue

        # ── Build SSCE container ───────────────────────────────────────────────
        try:
            container, meta = build_container(
                plaintext,
                filename=file_name,
                content_type=content_type,
            )
        except Exception as exc:
            print(f"CONTAINER BUILD FAIL ({exc})")
            err += 1
            continue

        hmac_hex     = container[-32:].hex()
        import struct
        offset       = 8 + 1 + 4
        meta_len_val = struct.unpack(">I", container[8+1:8+1+4])[0]
        offset      += meta_len_val + 12
        enc_key      = container[offset: offset + 48]

        if commit:
            try:
                session.execute(text("""
                    UPDATE vault_files SET
                        encrypted_data       = :container,
                        container_size       = :container_size,
                        hmac                 = :hmac,
                        encrypted_file_key   = :enc_key,
                        compression_type     = 'zstd',
                        encryption_version   = 1,
                        storage_backend      = 'postgresql',
                        malware_scan_status  = 'skipped',
                        sha256               = :sha256,
                        updated_at           = :now
                    WHERE id = :id
                """), {
                    "container":      container,
                    "container_size": len(container),
                    "hmac":           hmac_hex,
                    "enc_key":        enc_key,
                    "sha256":         meta.sha256_plaintext,
                    "now":            datetime.utcnow(),
                    "id":             str(file_id),
                })
                print(f"OK ({len(plaintext)} → {len(container)} bytes)")
                ok += 1

                if ok % batch_size == 0:
                    session.commit()
                    print(f"    [checkpoint] committed {ok} rows so far")

            except Exception as exc:
                print(f"UPDATE FAIL ({exc})")
                session.rollback()
                err += 1
        else:
            print(f"DRY-RUN OK ({len(plaintext)} → {len(container)} bytes)")
            ok += 1

    if commit and ok > 0:
        session.commit()

    session.close()
    print(f"\nDone. migrated={ok}  skipped={skip}  errors={err}")
    if not commit:
        print("DRY RUN — no changes written. Pass --commit to apply.")
    if err > 0:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate legacy vault rows to SSCE format")
    parser.add_argument("--commit", action="store_true",
                        help="Actually write changes (default: dry-run)")
    parser.add_argument("--batch",  type=int, default=50,
                        help="Commit every N rows (default: 50)")
    args = parser.parse_args()

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    migrate(db_url, commit=args.commit, batch_size=args.batch)
