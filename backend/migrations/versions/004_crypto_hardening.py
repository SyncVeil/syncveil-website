"""Crypto hardening — per-user keys, key_version, TOTP encryption

Revision ID: 004_crypto_hardening
Revises: 003_ssce_vault
Create Date: 2026-06-04

Changes:
  vault_files:
    - ADD key_version INTEGER NOT NULL DEFAULT 1
      Tracks which rotation of VAULT_ENCRYPTION_KEY encrypted the file key.
      Used by the key-rotation script to find rows that need re-wrapping.

  two_factor_configs:
    - COMMENT on totp_secret / totp_secret_pending columns to mark that
      values written after this migration are AES-256-GCM encrypted blobs
      (format: hex(nonce_12) + ":" + hex(ciphertext)).
      Legacy plaintext rows remain readable — twofa_service._decrypt_totp_secret
      handles both formats transparently.
      No schema type change is needed because the column is already String(64)
      and the encrypted format fits within a wider String; widen to 200 here
      to accommodate the hex-encoded nonce+ciphertext (~88 chars total).

Migration is idempotent — safe to re-run.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision      = "004_crypto_hardening"
down_revision = "003_ssce_vault"
branch_labels = None
depends_on    = None


def _col(table: str, col: str) -> bool:
    bind = op.get_bind()
    return col in [c["name"] for c in inspect(bind).get_columns(table)]


def upgrade() -> None:
    # ── vault_files.key_version ───────────────────────────────────────────────
    if not _col("vault_files", "key_version"):
        op.add_column(
            "vault_files",
            sa.Column("key_version", sa.Integer(), nullable=False, server_default="1"),
        )

    # ── two_factor_configs: widen secret columns for encrypted format ─────────
    # Encrypted format: hex(12-byte nonce) + ":" + hex(32-byte ciphertext + 16-byte tag)
    # = 24 + 1 + 96 = 121 chars max — widen to 200 for safety margin.
    op.alter_column(
        "two_factor_configs",
        "totp_secret",
        existing_type=sa.String(64),
        type_=sa.String(200),
        existing_nullable=True,
    )
    op.alter_column(
        "two_factor_configs",
        "totp_secret_pending",
        existing_type=sa.String(64),
        type_=sa.String(200),
        existing_nullable=True,
    )


def downgrade() -> None:
    # Narrow columns back (will truncate encrypted values — only run after
    # reverting twofa_service.py to plaintext storage).
    op.alter_column(
        "two_factor_configs",
        "totp_secret_pending",
        existing_type=sa.String(200),
        type_=sa.String(64),
        existing_nullable=True,
    )
    op.alter_column(
        "two_factor_configs",
        "totp_secret",
        existing_type=sa.String(200),
        type_=sa.String(64),
        existing_nullable=True,
    )

    if _col("vault_files", "key_version"):
        op.drop_column("vault_files", "key_version")
