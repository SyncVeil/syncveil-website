"""
MongoDB Connection Management
Production-ready MongoDB Atlas connection using Motor (async driver)
Requires MONGO_URI environment variable with mongodb+srv:// connection string
"""
import asyncio
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import MongoClient

from app.core.config import get_settings

settings = get_settings()


class MongoDB:
    """MongoDB connection manager"""
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None


class SyncMongoDB:
    """Synchronous MongoDB connection manager"""
    client: Optional[MongoClient] = None
    db = None


mongodb = MongoDB()
sync_mongodb = SyncMongoDB()


def _validate_mongo_uri() -> None:
    """Shared validation for MongoDB configuration"""
    if not settings.MONGO_URI:
        raise RuntimeError(
            "MONGO_URI environment variable is required for MongoDB connection. "
            "Please set MONGO_URI to your MongoDB Atlas connection string (mongodb+srv://...)"
        )

    if not settings.MONGO_URI.startswith("mongodb+srv://") and not settings.MONGO_URI.startswith("mongodb://"):
        raise ValueError(
            f"Invalid MONGO_URI format. Expected mongodb+srv:// or mongodb:// connection string, "
            f"got: {settings.MONGO_URI[:20]}..."
        )

    if "localhost" in settings.MONGO_URI or "127.0.0.1" in settings.MONGO_URI:
        print("⚠️  WARNING: Using localhost MongoDB connection. This will not work on Railway.")
        print("   Please use MongoDB Atlas (mongodb+srv://) for production deployment.")


async def connect_to_mongodb():
    """Initialize MongoDB Atlas connection"""
    import certifi
    _validate_mongo_uri()
    
    try:
        # Create MongoDB client with production-safe settings
        mongodb.client = AsyncIOMotorClient(
            settings.MONGO_URI,
            tlsCAFile=certifi.where(),  # Use certifi for SSL certificate validation
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=10000,
            maxPoolSize=10,
            minPoolSize=1,
            retryWrites=True,
            w="majority"
        )
        
        # Explicitly select database (don't rely on connection string defaults)
        mongodb.db = mongodb.client[settings.MONGO_DB_NAME]
        
        # Test connection with timeout
        await asyncio.wait_for(
            mongodb.client.admin.command('ping'),
            timeout=10.0
        )
        
        print(f"✅ Connected to MongoDB Atlas")
        print(f"   Database: {settings.MONGO_DB_NAME}")
        print(f"   Connection: {settings.MONGO_URI.split('@')[1] if '@' in settings.MONGO_URI else 'hidden'}")
        
    except asyncio.TimeoutError:
        mongodb.client = None
        mongodb.db = None
        raise RuntimeError(
            f"MongoDB connection timeout. Please check:\n"
            f"  1. MONGO_URI is correct\n"
            f"  2. Network access is configured in MongoDB Atlas\n"
            f"  3. Database user credentials are valid"
        )
    except Exception as e:
        mongodb.client = None
        mongodb.db = None
        error_msg = str(e)
        if "authentication failed" in error_msg.lower():
            raise RuntimeError(f"MongoDB authentication failed. Check username/password in MONGO_URI: {error_msg}")
        elif "connection refused" in error_msg.lower():
            raise RuntimeError(f"MongoDB connection refused. Check if cluster is accessible: {error_msg}")
        else:
            raise RuntimeError(f"MongoDB connection failed: {error_msg}")


async def close_mongodb_connection():
    """Close MongoDB connection"""
    if mongodb.client:
        mongodb.client.close()
        print("✅ MongoDB connection closed")


def get_sync_mongodb():
    """Get synchronous MongoDB database instance (for thread-based code paths)"""
    import certifi

    if sync_mongodb.db is not None:
        return sync_mongodb.db

    _validate_mongo_uri()

    try:
        sync_mongodb.client = MongoClient(
            settings.MONGO_URI,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=10000,
            maxPoolSize=10,
        )
        sync_mongodb.db = sync_mongodb.client[settings.MONGO_DB_NAME]
        sync_mongodb.client.admin.command("ping")
        print(f"✅ Connected to MongoDB Atlas (sync client) for DB: {settings.MONGO_DB_NAME}")
        return sync_mongodb.db
    except Exception as exc:
        sync_mongodb.client = None
        sync_mongodb.db = None
        raise RuntimeError(f"MongoDB connection failed: {exc}")


def get_mongodb() -> AsyncIOMotorDatabase:
    """
    Get MongoDB database instance
    Raises RuntimeError if MongoDB is not connected
    """
    if mongodb.db is None:
        raise RuntimeError(
            "MongoDB is not initialized. Please ensure MONGO_URI environment variable is set "
            "and the application has successfully connected to MongoDB Atlas."
        )
    return mongodb.db
