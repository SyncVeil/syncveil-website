#!/bin/bash
# SyncVeil Backend - Render Production Start Script

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting SyncVeil Backend"
echo "Working directory: $SCRIPT_DIR"
echo ""

PORT=${PORT:-10000}

echo "Configuration:"
echo "  Host: 0.0.0.0"
echo "  Port: $PORT"
echo "  CORS: $(python - <<'PY'
from app.core.config import get_settings
print(', '.join(get_settings().cors_origins_list))
PY
)"
echo ""
echo "API Documentation: http://0.0.0.0:$PORT/docs"
echo "Health Check: http://0.0.0.0:$PORT/health"
echo ""

echo "🔄 Running database migrations..."

# Detect DB state and stamp if tables exist but Alembic has no record of them.
# This handles three cases:
#   "tracked"  - alembic_version has rows → normal upgrade
#   "untracked" - tables exist but alembic_version is missing or empty → stamp first
#   "empty_db"  - brand new DB, no tables at all → normal upgrade from scratch
DB_STATE=$(python - <<'PY'
import os, psycopg2
url = os.environ["DATABASE_URL"].replace("postgres://", "postgresql://", 1)
try:
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    # Check if alembic_version exists and has rows
    cur.execute("""
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_name = 'alembic_version'
    """)
    has_av = cur.fetchone()[0] > 0
    if has_av:
        cur.execute("SELECT COUNT(*) FROM alembic_version")
        stamped = cur.fetchone()[0] > 0
        print("tracked" if stamped else "untracked")
    else:
        # Check if users table exists (i.e. DB already has schema)
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_name = 'users'
        """)
        has_users = cur.fetchone()[0] > 0
        print("untracked" if has_users else "empty_db")
    conn.close()
except Exception as e:
    print(f"error: {e}", flush=True)
    raise
PY
)

echo "  Alembic state: $DB_STATE"

if [ "$DB_STATE" = "untracked" ]; then
    echo "  ⚠ Schema exists but not tracked by Alembic — stamping as heads"
    alembic stamp heads
    echo "  ✓ Stamped"
fi

alembic upgrade heads
echo "✓ Migrations complete"
echo ""

exec python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
