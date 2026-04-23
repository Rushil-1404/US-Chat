import os

from app import create_app
from app.extensions import socketio


app = create_app()


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5000"))
    socketio.run(
        app,
        host=host,
        port=port,
        debug=app.config.get("DEBUG", False),
        allow_unsafe_werkzeug=True,
    )
