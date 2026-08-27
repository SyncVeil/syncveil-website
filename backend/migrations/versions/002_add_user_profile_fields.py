"""add user profile fields and connected accounts

Revision ID: 002
Revises: 
Create Date: 2025-05-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import UUID

revision = '002'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None


def _column_exists(table, column):
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c['name'] for c in insp.get_columns(table)]
    return column in cols


def _table_exists(table):
    bind = op.get_bind()
    insp = inspect(bind)
    return table in insp.get_table_names()


def upgrade() -> None:
    # Safely add profile columns (skip if already exist)
    if not _column_exists('users', 'full_name'):
        op.add_column('users', sa.Column('full_name', sa.String(255), nullable=True))
    if not _column_exists('users', 'phone'):
        op.add_column('users', sa.Column('phone', sa.String(50), nullable=True))
    if not _column_exists('users', 'country'):
        op.add_column('users', sa.Column('country', sa.String(100), nullable=True))
    if not _column_exists('users', 'date_of_birth'):
        op.add_column('users', sa.Column('date_of_birth', sa.Date(), nullable=True))
    if not _column_exists('users', 'avatar_url'):
        op.add_column('users', sa.Column('avatar_url', sa.String(500), nullable=True))

    # Create connected_accounts table only if it doesn't exist
    if not _table_exists('connected_accounts'):
        op.create_table(
            'connected_accounts',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('provider', sa.String(50), nullable=False),
            sa.Column('provider_user_id', sa.String(255), nullable=False),
            sa.Column('email', sa.String(255), nullable=True),
            sa.Column('display_name', sa.String(255), nullable=True),
            sa.Column('avatar_url', sa.String(500), nullable=True),
            sa.Column('access_token', sa.Text(), nullable=True),
            sa.Column('refresh_token', sa.Text(), nullable=True),
            sa.Column('connected_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('last_synced_at', sa.DateTime(), nullable=True),
        )
        op.create_index('idx_connected_account_user', 'connected_accounts', ['user_id', 'provider'])


def downgrade() -> None:
    if _table_exists('connected_accounts'):
        op.drop_index('idx_connected_account_user', table_name='connected_accounts')
        op.drop_table('connected_accounts')
    if _column_exists('users', 'avatar_url'):
        op.drop_column('users', 'avatar_url')
    if _column_exists('users', 'date_of_birth'):
        op.drop_column('users', 'date_of_birth')
    if _column_exists('users', 'country'):
        op.drop_column('users', 'country')
    if _column_exists('users', 'phone'):
        op.drop_column('users', 'phone')
    if _column_exists('users', 'full_name'):
        op.drop_column('users', 'full_name')
