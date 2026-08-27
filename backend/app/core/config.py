"""
Core configuration module - Environment-based settings

RULES:
- No secrets hardcoded
- Production must fail fast if critical config is missing
- Development must NEVER crash due to missing external services
"""

import os
from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""

    # ======================
    # Pydantic Settings
    # ======================
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )

    # ======================
    # Environment
    # ======================
    ENV: str = Field(default="development", alias="ENV")

    # ======================
    # JWT
    # ======================
    JWT_SECRET: str = Field(default="", alias="JWT_SECRET")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ======================
    # Redis (Optional)
    # ======================
    REDIS_URL: str = Field(default="", alias="REDIS_URL")

    # ======================
    # Email (Brevo)
    # ======================
    EMAIL_ENABLED: bool = False
    BREVO_API_KEY: str = Field(default="", alias="BREVO_API_KEY")
    SMTP_FROM: str = Field(default="", alias="SMTP_FROM")
    EMAIL_FROM_NAME: str = "SyncVeil"

    # ======================
    # OTP
    # ======================
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3

    # ======================
    # Adaptive Security Engine
    # ======================
    SECURITY_CHALLENGE_THRESHOLD: int = 60
    SECURITY_CRITICAL_THRESHOLD: int = 85
    SECURITY_EVENTS_DAYS: int = 7

    # ======================
    # Vault Storage
    # ======================
    VAULT_ENCRYPTION_KEY: str = Field(default="", alias="VAULT_ENCRYPTION_KEY")
    VAULT_STORAGE_DIR: str = Field(default="/tmp/vault_storage", alias="VAULT_STORAGE_DIR")

    # ======================
    # Email Verification
    # ======================
    EMAIL_VERIFICATION_REQUIRED: bool = False
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24

    # ======================
    # Password Hashing (Argon2)
    # ======================
    PASSWORD_HASH_TIME_COST: int = 2
    PASSWORD_HASH_MEMORY_COST: int = 65536
    PASSWORD_HASH_PARALLELISM: int = 1

    # ======================
    # Rate Limiting
    # ======================
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_OTP: str = "3/minute"
    RATE_LIMIT_SIGNUP: str = "2/minute"

    # ======================
    # CORS
    # ======================
    CORS_ORIGINS: str = Field(default="", alias="CORS_ORIGINS")

    # ======================
    # Admin
    # ======================
    INITIAL_ADMIN_EMAIL: str = Field(
        default="",
        alias="INITIAL_ADMIN_EMAIL",
    )

    # ======================
    # Logging
    # ======================
    LOG_LEVEL: str = Field(default="INFO", alias="LOG_LEVEL")
    LOG_FILE: str = "logs/syncveil.log"

    # ======================
    # SSCE — Secure Container Engine
    # ======================
    VAULT_QUOTA_MB: int = Field(default=100, alias="VAULT_QUOTA_MB")
    CLAMD_SOCKET: str   = Field(default="/var/run/clamav/clamd.ctl", alias="CLAMD_SOCKET")
    CLAMD_HOST: str     = Field(default="", alias="CLAMD_HOST")
    CLAMD_PORT: int     = Field(default=3310, alias="CLAMD_PORT")
    CLAMAV_ENABLED: bool = Field(default=False, alias="CLAMAV_ENABLED")

    # ======================
    # Frontend
    # ======================
    FRONTEND_URL: str = Field(default="", alias="FRONTEND_URL")

    # ======================
    # Validators & Helpers
    # ======================
    @field_validator("ENV", mode="before")
    @classmethod
    def normalize_env(cls, value: str) -> str:
        return (value or "development").strip().lower()

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    # ======================
    # Production Validation
    # ======================
    def validate_production_settings(self) -> None:
        """
        Production MUST fail fast.
        Development MUST NOT crash.
        """
        if not self.is_production:
            return

        errors: list[str] = []

        # Database configuration
        database_url = os.getenv("DATABASE_URL", "").strip()
        if not database_url:
            errors.append("DATABASE_URL is required")
        elif not database_url.startswith(("postgresql://", "postgres://")):
            errors.append("DATABASE_URL must be a PostgreSQL connection string")

        # Core required settings
        if not self.JWT_SECRET:
            errors.append("JWT_SECRET is required")

        # Security checks
        if self.JWT_SECRET and len(self.JWT_SECRET) < 32:
            errors.append("JWT_SECRET must be at least 32 characters")

        if not self.VAULT_ENCRYPTION_KEY:
            errors.append("VAULT_ENCRYPTION_KEY is required")
        elif len(self.VAULT_ENCRYPTION_KEY) < 32:
            errors.append("VAULT_ENCRYPTION_KEY must be at least 32 characters")

        # Frontend URL — warn but don't block startup
        if not self.FRONTEND_URL:
            print("⚠ FRONTEND_URL not set — CORS may be misconfigured")

        # Email only enforced if enabled
        if self.EMAIL_ENABLED:
            if not self.BREVO_API_KEY:
                errors.append("BREVO_API_KEY is required when EMAIL_ENABLED=true")
            if not self.SMTP_FROM:
                errors.append("SMTP_FROM is required when EMAIL_ENABLED=true")

        if errors:
            raise ValueError(
                "❌ Production configuration invalid:\n"
                + "\n".join(f"- {e}" for e in errors)
            )


# ======================
# Settings Loader
# ======================
@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_production_settings()
    return settings
