import os

from app.main import app


if __name__ == "__main__":
    # Simple dev entrypoint; Railway uses Procfile
    uvicorn_port = int(os.getenv("PORT", "8000"))
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=uvicorn_port)
