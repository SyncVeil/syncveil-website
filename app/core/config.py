"""
Core configuration module - Environment-based settings

RULES:
- No secrets hardcoded
- Production must fail fast if critical config is missing
- Development must NEVER crash due to missing external services
"""

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
    ENV: str = Field(default="development", env="ENV")

    # ======================
    # Database (MongoDB)
    # ======================
    MONGO_URI: str = Field(default="", env="MONGO_URI")
    MONGO_DB_NAME: str = Field(default="", env="MONGO_DB_NAME")

    # ======================
    # JWT
    # ======================
    JWT_SECRET: str = Field(default="", env="JWT_SECRET")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ======================
    # Redis (Optional)
    # ======================
    REDIS_URL: str = Field(default="", env="REDIS_URL")

    # ======================
    # Email (Brevo)
    # ======================
    EMAIL_ENABLED: bool = False
    BREVO_API_KEY: str = Field(default="", env="BREVO_API_KEY")
    SMTP_FROM: str = Field(default="", env="SMTP_FROM")
    EMAIL_FROM_NAME: str = "SyncVeil"

    # ======================
    # OTP
    # ======================
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3

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
    CORS_ORIGINS: str = Field(default="*", env="CORS_ORIGINS")

    # ======================
    # Admin
    # ======================
    INITIAL_ADMIN_EMAIL: str = Field(
        default="admin@syncveil.com",
        env="INITIAL_ADMIN_EMAIL",
    )

    # ======================
    # Logging
    # ======================
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FILE: str = "logs/syncveil.log"

    # ======================
    # Frontend
    # ======================
    FRONTEND_URL: str = Field(default="", env="FRONTEND_URL")

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

        # Core required settings
        if not self.MONGO_URI:
            errors.append("MONGO_URI is required")
        if not self.MONGO_DB_NAME:
            errors.append("MONGO_DB_NAME is required")
        if not self.JWT_SECRET:
            errors.append("JWT_SECRET is required")

        # Security checks
        if self.JWT_SECRET and len(self.JWT_SECRET) < 32:
            errors.append("JWT_SECRET must be at least 32 characters")

        if self.MONGO_URI and not (
            self.MONGO_URI.startswith("mongodb://")
            or self.MONGO_URI.startswith("mongodb+srv://")
        ):
            errors.append("MONGO_URI must be a valid MongoDB connection string")

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
