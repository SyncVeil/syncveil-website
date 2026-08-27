import os
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app


if __name__ == "__main__":
    uvicorn_port = int(os.getenv("PORT", "8000"))
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=uvicorn_port)
