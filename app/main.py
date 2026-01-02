import os
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.auth import models  # noqa: F401 ensures models are registered
from app.auth.routes import router as auth_router
from app.dashboard_routes import router as dashboard_router
from app.db.base import Base
from app.db.session import engine
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
from app.mongodb.routes import router as mongodb_router


@asynccontextmanager
async def lifespan(app: FastAPI):
	# Startup
	Base.metadata.create_all(bind=engine)
	
	# Initialize MongoDB connection (optional - app works without it)
	mongo_uri = os.getenv("MONGO_URI", "")
	if mongo_uri:
		print("🔌 Attempting MongoDB Atlas connection...")
		asyncio.create_task(try_connect_mongodb())
	else:
		print("⚠️  MONGO_URI not set - MongoDB features will be unavailable")
		print("   Set MONGO_URI environment variable to enable MongoDB endpoints")
	
	yield
	
	# Shutdown
	try:
		await close_mongodb_connection()
	except:
		pass


async def try_connect_mongodb():
	"""Try to connect to MongoDB without blocking startup"""
	try:
		await connect_to_mongodb()
	except Exception as e:
		print(f"⚠️  MongoDB connection failed: {str(e)}")
		print("   App will continue without MongoDB endpoints")


app = FastAPI(title="Security Backend", lifespan=lifespan)

allowed_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
	CORSMiddleware,
	allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
	return {"status": "ok"}


app.include_router(auth_router, prefix="/auth")
app.include_router(dashboard_router)
app.include_router(mongodb_router, prefix="/api")

# Serve static frontend files (for production deployment)
# Mount after API routes to ensure API routes take precedence
static_dir = Path(__file__).parent.parent  # Go up to project root
if static_dir.exists() and (static_dir / "index.html").exists():
	print(f"📁 Serving static files from: {static_dir}")
	app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
else:
	print("⚠️  Static files directory not found, running in API-only mode")
