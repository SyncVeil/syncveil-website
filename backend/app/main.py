from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth.routes import router as auth_router
from app.dashboard_routes import router as dashboard_router
from app.vault_routes import router as vault_router
from app.twofa_routes import router as twofa_router
from app.passkey_routes import router as passkey_router
from app.core.config import get_settings
import sys

try:
    settings = get_settings()
except Exception as _cfg_err:
    print(f"❌ FATAL: Configuration error — {_cfg_err}", flush=True)
    sys.exit(1)

def _apply_schema(engine):
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name    VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone        VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS country      VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url   VARCHAR(500)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMP NOT NULL DEFAULT NOW()",
        "ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS location    VARCHAR(255)",
        "ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS device_info TEXT",
        "ALTER TABLE login_logs ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(255)",
        """CREATE TABLE IF NOT EXISTS connected_accounts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            provider VARCHAR(50) NOT NULL,
            provider_user_id VARCHAR(255) NOT NULL,
            email VARCHAR(255), display_name VARCHAR(255),
            avatar_url VARCHAR(500), access_token TEXT, refresh_token TEXT,
            connected_at TIMESTAMP NOT NULL DEFAULT NOW(),
            last_synced_at TIMESTAMP)""",
        "CREATE INDEX IF NOT EXISTS idx_connected_account_user ON connected_accounts(user_id, provider)",
        """CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            otp_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            used_at TIMESTAMP, ip_address VARCHAR(45))""",
        "CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id, used)",
        """CREATE TABLE IF NOT EXISTS vault_files (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            file_name VARCHAR(500) NOT NULL,
            content_type VARCHAR(200) NOT NULL DEFAULT 'application/octet-stream',
            size_bytes BIGINT NOT NULL DEFAULT 0,
            sha256 VARCHAR(64),
            encrypted_data BYTEA NOT NULL,
            nonce BYTEA,
            uploaded_at TIMESTAMP NOT NULL DEFAULT NOW())""",
        "CREATE INDEX IF NOT EXISTS idx_vault_user ON vault_files(user_id, uploaded_at)",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS container_size BIGINT",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS hmac VARCHAR(64)",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS encrypted_file_key BYTEA",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS compression_type VARCHAR(20) NOT NULL DEFAULT 'zstd'",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS encryption_version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(50) NOT NULL DEFAULT 'postgresql'",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS malware_scan_status VARCHAR(20) NOT NULL DEFAULT 'skipped'",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS malware_scan_at TIMESTAMP",
        "ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        """CREATE TABLE IF NOT EXISTS vault_audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            file_id UUID REFERENCES vault_files(id) ON DELETE SET NULL,
            event_type VARCHAR(50) NOT NULL,
            ip_address VARCHAR(45), user_agent TEXT, detail TEXT,
            success BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW())""",
        "CREATE INDEX IF NOT EXISTS idx_vault_audit_user_time ON vault_audit_logs(user_id, created_at)",
        "CREATE INDEX IF NOT EXISTS idx_vault_audit_file ON vault_audit_logs(file_id, created_at)",
        "CREATE INDEX IF NOT EXISTS idx_vault_audit_event ON vault_audit_logs(event_type, created_at)",
        # ── 2FA ──
        """CREATE TABLE IF NOT EXISTS two_factor_configs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            enabled BOOLEAN NOT NULL DEFAULT FALSE,
            totp_secret VARCHAR(64),
            totp_secret_pending VARCHAR(64),
            totp_pending_at TIMESTAMP,
            enabled_at TIMESTAMP,
            disabled_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW())""",
        "CREATE INDEX IF NOT EXISTS idx_2fa_config_user ON two_factor_configs(user_id)",
        """CREATE TABLE IF NOT EXISTS two_factor_recovery_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            config_id UUID REFERENCES two_factor_configs(id) ON DELETE CASCADE,
            code_hash VARCHAR(64) NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            used_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT NOW())""",
        "CREATE INDEX IF NOT EXISTS idx_2fa_recovery_user_used ON two_factor_recovery_codes(user_id, used)",
        # ── Session enhancements ──
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name VARCHAR(200)",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS location VARCHAR(255)",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS trusted BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS trusted_at TIMESTAMP",
        # ── Passkeys ──
        """CREATE TABLE IF NOT EXISTS passkeys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            pin_hash VARCHAR(64) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
            last_used_at TIMESTAMP)""",
        "CREATE INDEX IF NOT EXISTS idx_passkey_user ON passkeys(user_id)",
    ]
    with engine.begin() as conn:
        for s in stmts:
            try: conn.execute(text(s.strip()))
            except Exception as e: print(f"⚠ schema: {e}")
    print("✅ Schema up to date")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        from app.db.session import engine
        from app.db.base import Base
        if engine is None:
            print("⚠ DATABASE_URL not set")
        else:
            Base.metadata.create_all(bind=engine)
            print("✅ Database tables initialized successfully")
            _apply_schema(engine)
    except Exception as e:
        print(f"⚠ DB init warning: {e}")
    yield

app = FastAPI(title="SyncVeil API", lifespan=lifespan)

# Build CORS origins list — combine CORS_ORIGINS env var + FRONTEND_URL
if settings.CORS_ORIGINS == "*":
    origins = ["*"]
else:
    _origin_set = {o.rstrip("/") for o in settings.cors_origins_list if o.strip() and o != "*"}
    if settings.FRONTEND_URL:
        _origin_set.add(settings.FRONTEND_URL.rstrip("/"))
    _origin_set.discard("")
    origins = list(_origin_set) if _origin_set else ["*"]  # fallback: allow all
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Vault-SHA256", "X-Vault-Version"],
)

@app.get("/health")
def health(): return {"status": "ok"}

app.include_router(auth_router, prefix="/auth")
app.include_router(dashboard_router)
app.include_router(vault_router)
app.include_router(twofa_router)
app.include_router(passkey_router)
