"""Add SSCE vault fields and vault_audit_logs table

Revision ID: 003_ssce_vault
Revises: 002
Create Date: 2026-06-03

Adds to vault_files:
  - container_size, hmac, encrypted_file_key
  - compression_type, encryption_version, storage_backend
  - version, malware_scan_status, malware_scan_at, updated_at
  - drops the legacy `nonce` column (nonces now live inside the container)

Creates:
  - vault_audit_logs table
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import UUID

revision      = '003_ssce_vault'
down_revision = '002'
branch_labels = None
depends_on    = None


def _col(table, col):
    bind = op.get_bind()
    return col in [c["name"] for c in inspect(bind).get_columns(table)]


def _tbl(table):
    return table in inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    # ── vault_files new columns ────────────────────────────────────────────────
    if not _col("vault_files", "container_size"):
        op.add_column("vault_files", sa.Column("container_size", sa.BigInteger(), nullable=True))

    if not _col("vault_files", "hmac"):
        op.add_column("vault_files", sa.Column("hmac", sa.String(64), nullable=True))

    if not _col("vault_files", "encrypted_file_key"):
        op.add_column("vault_files", sa.Column("encrypted_file_key", sa.LargeBinary(), nullable=True))

    if not _col("vault_files", "compression_type"):
        op.add_column("vault_files", sa.Column(
            "compression_type", sa.String(20), nullable=False, server_default="zstd"))

    if not _col("vault_files", "encryption_version"):
        op.add_column("vault_files", sa.Column(
            "encryption_version", sa.Integer(), nullable=False, server_default="1"))

    if not _col("vault_files", "storage_backend"):
        op.add_column("vault_files", sa.Column(
            "storage_backend", sa.String(50), nullable=False, server_default="postgresql"))

    if not _col("vault_files", "version"):
        op.add_column("vault_files", sa.Column(
            "version", sa.Integer(), nullable=False, server_default="1"))

    if not _col("vault_files", "malware_scan_status"):
        op.add_column("vault_files", sa.Column(
            "malware_scan_status", sa.String(20), nullable=False, server_default="skipped"))

    if not _col("vault_files", "malware_scan_at"):
        op.add_column("vault_files", sa.Column("malware_scan_at", sa.DateTime(), nullable=True))

    if not _col("vault_files", "updated_at"):
        op.add_column("vault_files", sa.Column("updated_at", sa.DateTime(), nullable=True))

    # Drop legacy nonce column — nonces are now embedded in the container blob.
    # Existing rows that still have the old plaintext-AES scheme keep their
    # encrypted_data as-is; the download route handles both formats gracefully.
    if _col("vault_files", "nonce"):
        op.drop_column("vault_files", "nonce")

    # Refresh indexes
    bind = op.get_bind()
    existing_indexes = [i["name"] for i in inspect(bind).get_indexes("vault_files")]
    if "idx_vault_user" in existing_indexes:
        op.drop_index("idx_vault_user", table_name="vault_files")
    if "idx_vault_user_uploaded" not in existing_indexes:
        op.create_index("idx_vault_user_uploaded", "vault_files", ["user_id", "uploaded_at"])
    if "idx_vault_user_version" not in existing_indexes:
        op.create_index("idx_vault_user_version",  "vault_files", ["user_id", "version"])

    # ── vault_audit_logs ───────────────────────────────────────────────────────
    if not _tbl("vault_audit_logs"):
        op.create_table(
            "vault_audit_logs",
            sa.Column("id",         UUID(as_uuid=True), primary_key=True,  server_default=sa.text("gen_random_uuid()")),
            sa.Column("user_id",    UUID(as_uuid=True), sa.ForeignKey("users.id",        ondelete="CASCADE"), nullable=False),
            sa.Column("file_id",    UUID(as_uuid=True), sa.ForeignKey("vault_files.id",  ondelete="SET NULL"), nullable=True),
            sa.Column("event_type", sa.String(50),  nullable=False),
            sa.Column("ip_address", sa.String(45),  nullable=True),
            sa.Column("user_agent", sa.Text(),       nullable=True),
            sa.Column("detail",     sa.Text(),       nullable=True),
            sa.Column("success",    sa.Boolean(),    nullable=False, server_default="true"),
            sa.Column("created_at", sa.DateTime(),   nullable=False, server_default=sa.func.now()),
        )
        op.create_index("idx_vault_audit_user_time", "vault_audit_logs", ["user_id",    "created_at"])
        op.create_index("idx_vault_audit_file",      "vault_audit_logs", ["file_id",    "created_at"])
        op.create_index("idx_vault_audit_event",     "vault_audit_logs", ["event_type", "created_at"])


def downgrade() -> None:
    if _tbl("vault_audit_logs"):
        op.drop_index("idx_vault_audit_event",     table_name="vault_audit_logs")
        op.drop_index("idx_vault_audit_file",      table_name="vault_audit_logs")
        op.drop_index("idx_vault_audit_user_time", table_name="vault_audit_logs")
        op.drop_table("vault_audit_logs")

    for col in ["updated_at", "malware_scan_at", "malware_scan_status",
                "version", "storage_backend", "encryption_version",
                "compression_type", "encrypted_file_key", "hmac", "container_size"]:
        if _col("vault_files", col):
            op.drop_column("vault_files", col)

    # Restore nonce column (required by old format)
    if not _col("vault_files", "nonce"):
        op.add_column("vault_files", sa.Column("nonce", sa.LargeBinary(), nullable=True))
