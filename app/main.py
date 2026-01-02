import os
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth import models  # noqa: F401 (ensure models are registered)
from app.auth.routes import router as auth_router
from app.dashboard_routes import router as dashboard_router
from app.mongodb.routes import router as mongodb_router
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
from app.core.config import get_settings


# ==========================
# LIFESPAN (Startup / Shutdown)
# ==========================
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Validate configuration (production-safe)
    settings = get_settings()

    # MongoDB connection (non-blocking)
    if settings.MONGO_URI:
        print("🔌 Attempting MongoDB Atlas connection...")
        asyncio.create_task(try_connect_mongodb())
    else:
        if settings.is_production:
            raise RuntimeError("MONGO_URI is required in production")
        print("⚠️  MONGO_URI not set - MongoDB features disabled")

    yield

    # Shutdown cleanup
    try:
        await close_mongodb_connection()
    except Exception:
        pass


async def try_connect_mongodb():
    try:
        await connect_to_mongodb()
    except Exception as e:
        print(f"⚠️  MongoDB connection failed: {e}")
        print("   App will continue without MongoDB endpoints")


# ==========================
# APP INITIALIZATION
# ==========================
app = FastAPI(
    title="SyncVeil Backend",
    lifespan=lifespan,
)


# ==========================
# CORS
# ==========================
allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in allowed_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================
# STATIC FRONTEND (MUST BE FIRST)
# ==========================
serve_static = os.getenv("SERVE_STATIC_FRONTEND", "").lower() == "true"

if serve_static:
    dist_dir = Path(__file__).parent.parent / "dist"
    index_file = dist_dir / "index.html"

    if dist_dir.exists() and index_file.exists():
        print(f"📁 Serving static frontend from: {dist_dir}")
        app.mount(
            "/",
            StaticFiles(directory=str(dist_dir), html=True),
            name="static",
        )
    else:
        print("⚠️  dist/ not found — running API-only mode")
else:
    print("ℹ️  Static file serving disabled (API-only mode)")


# ==========================
# HEALTH CHECK
# ==========================
@app.get("/health")
def health():
    return {"status": "ok"}


# ==========================
# API ROUTES (AFTER STATIC)
# ==========================
app.include_router(auth_router, prefix="/auth")
app.include_router(dashboard_router)
app.include_router(mongodb_router, prefix="/api")
