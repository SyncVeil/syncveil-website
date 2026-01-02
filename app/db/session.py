"""
Legacy SQL session management placeholder.

Production deployment on Railway uses MongoDB only. SQL connections are
intentionally disabled unless explicitly configured for non-production use.
"""
import os
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException, status

from app.core.config import get_settings

settings = get_settings()

# Detect optional SQL usage (development only)
database_url = os.getenv("DATABASE_URL", "").strip()

# Default: SQL disabled; SessionLocal is unbound to avoid engine creation
engine = None
SessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False)

if database_url and not settings.is_production:
    from sqlalchemy import create_engine, event
    from sqlalchemy.pool import NullPool

    # Minimal engine configuration for development/debugging
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine_kwargs = {"connect_args": connect_args, "echo": False}
    if not database_url.startswith("sqlite"):
        engine_kwargs.update({
            "poolclass": NullPool,
            "pool_pre_ping": True,
        })

    engine = create_engine(database_url, **engine_kwargs)

    @event.listens_for(engine, "connect")
    def receive_connect(dbapi_conn, connection_record):
        """Configure PostgreSQL connections for dev convenience"""
        if database_url.startswith("postgresql"):
            cursor = dbapi_conn.cursor()
            cursor.execute("SET timezone = 'UTC'")
            cursor.close()

    SessionLocal.configure(bind=engine)


def get_db():
    """Dependency for getting database session; disabled when SQL is not configured"""
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="SQL database is disabled for this deployment.",
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()