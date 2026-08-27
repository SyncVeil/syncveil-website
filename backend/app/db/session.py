"""
SQL session management.

SQL is REQUIRED for authentication.
If DATABASE_URL is missing, auth endpoints will return a clear error.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException, status

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Coerce legacy Render postgres:// to postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

_engine = None
SessionLocal = None

if DATABASE_URL:
    _engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=_engine,
        expire_on_commit=False,
    )

# Expose engine for Base.metadata.create_all in lifespan
engine = _engine


def get_db():
    """Dependency for getting database session"""
    if SessionLocal is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database not configured. Set DATABASE_URL environment variable.",
        )
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
