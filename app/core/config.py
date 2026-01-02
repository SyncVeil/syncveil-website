"""
Core configuration module - Environment-based settings
CRITICAL: Never expose secrets or allow hardcoded values in production
"""
import os
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Environment
    ENV: str = os.getenv("ENV", "development")
    
    # MongoDB Atlas (NoSQL)
    MONGO_URI: str = os.getenv("MONGO_URI", "")  # Must be mongodb+srv:// connection string
    MONGO_DB_NAME: str = os.getenv("MONGO_DB_NAME", "")
    
    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    
    # Email (Brevo Transactional API)
    BREVO_API_KEY: str = os.getenv("BREVO_API_KEY", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")
    EMAIL_FROM_NAME: str = "SyncVeil"
    
    # OTP
    OTP_LENGTH: int = 6
    OTP_EXPIRE_MINUTES: int = 5
    OTP_MAX_ATTEMPTS: int = 3
    
    # Email Verification
    EMAIL_VERIFICATION_EXPIRE_HOURS: int = 24
    EMAIL_VERIFICATION_REQUIRED: bool = True
    
    # Security - Argon2
    PASSWORD_HASH_TIME_COST: int = 2
    PASSWORD_HASH_MEMORY_COST: int = 65536
    PASSWORD_HASH_PARALLELISM: int = 1
    
    # Rate Limiting
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_OTP: str = "3/minute"
    RATE_LIMIT_SIGNUP: str = "2/minute"
    
    # CORS
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")
    
    # Admin
    INITIAL_ADMIN_EMAIL: str = os.getenv("INITIAL_ADMIN_EMAIL", "admin@syncveil.com")
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE: str = "logs/syncveil.log"
    
    # Frontend
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "")
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.ENV.lower() == "production"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins into list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    def validate_production_settings(self):
        """Validate critical settings for production"""
        if not self.is_production:
            return
        
        errors = []
        
        # Required production environment variables
        required_env = {
            "MONGO_URI": self.MONGO_URI,
            "MONGO_DB_NAME": self.MONGO_DB_NAME,
            "JWT_SECRET": self.JWT_SECRET,
            "BREVO_API_KEY": self.BREVO_API_KEY,
            "SMTP_FROM": self.SMTP_FROM,
        }
        
        missing = [name for name, value in required_env.items() if not value]
        if missing:
            errors.append(
                f"Missing required environment variables: {', '.join(missing)}\n"
                f"Production requires: ENV=production, MONGO_URI, MONGO_DB_NAME, "
                f"JWT_SECRET, BREVO_API_KEY, SMTP_FROM"
            )
        
        # Additional validation for non-empty values
        if self.JWT_SECRET and len(self.JWT_SECRET) < 32:
            errors.append("JWT_SECRET must be at least 32 characters in production")
        
        if self.MONGO_URI and not (self.MONGO_URI.startswith("mongodb://") or self.MONGO_URI.startswith("mongodb+srv://")):
            errors.append("MONGO_URI must be a valid MongoDB connection string (mongodb:// or mongodb+srv://)")
        
        if errors:
            raise ValueError(
                f"❌ Production validation failed:\n" + 
                "\n".join(f"   • {e}" for e in errors)
            )
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields from .env for backwards compatibility


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    settings = Settings()
    settings.validate_production_settings()
    return settings
