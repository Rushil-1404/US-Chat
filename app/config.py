from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
INSTANCE_DIR = BASE_DIR / "instance"

load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    raw_database_url = os.getenv("DATABASE_URL", "")
    if raw_database_url.startswith("postgres://"):
        raw_database_url = raw_database_url.replace("postgres://", "postgresql://", 1)

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    SQLALCHEMY_DATABASE_URI = raw_database_url or f"sqlite:///{(INSTANCE_DIR / 'chat_app.db').resolve().as_posix()}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

    SESSION_COOKIE_NAME = "chat_session"
    SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", False)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_LIFETIME_DAYS = int(os.getenv("SESSION_LIFETIME_DAYS", "30"))

    OTP_PROVIDER_MODE = os.getenv("OTP_PROVIDER_MODE", "dev").strip().lower()
    DEV_OTP_EXPOSE_CODE = env_bool("DEV_OTP_EXPOSE_CODE", True)
    OTP_LENGTH = int(os.getenv("OTP_LENGTH", "6"))
    OTP_EXPIRY_SECONDS = int(os.getenv("OTP_EXPIRY_SECONDS", "300"))
    OTP_RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("OTP_RATE_LIMIT_WINDOW_SECONDS", "3600"))
    OTP_MAX_REQUESTS_PER_WINDOW = int(os.getenv("OTP_MAX_REQUESTS_PER_WINDOW", "5"))
    OTP_MAX_VERIFY_ATTEMPTS = int(os.getenv("OTP_MAX_VERIFY_ATTEMPTS", "5"))

    STORAGE_MODE = os.getenv("STORAGE_MODE", "auto").strip().lower()
    LOCAL_STORAGE_ROOT = os.getenv("LOCAL_STORAGE_ROOT") or str((INSTANCE_DIR / "storage").resolve())
    MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "25"))
    MAX_CONTENT_LENGTH = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    SOCKETIO_ASYNC_MODE = os.getenv("SOCKETIO_ASYNC_MODE", "threading")

    GRAPH_TENANT_ID = os.getenv("GRAPH_TENANT_ID", "")
    GRAPH_CLIENT_ID = os.getenv("GRAPH_CLIENT_ID", "")
    GRAPH_CLIENT_SECRET = os.getenv("GRAPH_CLIENT_SECRET", "")
    GRAPH_SHARE_LINK = os.getenv(
        "GRAPH_SHARE_LINK",
        "https://svkmmumbai-my.sharepoint.com/:f:/g/personal/rushil_patil198_nmims_in/IgCSd7AP2oHES7EeAcLFgsGhAbwDk9L2Zq2_ugNFWRIoGPE?e=Lynjcy",
    )
    GRAPH_SITE_ID = os.getenv("GRAPH_SITE_ID", "")
    GRAPH_DRIVE_ID = os.getenv("GRAPH_DRIVE_ID", "")
    GRAPH_ROOT_ITEM_ID = os.getenv("GRAPH_ROOT_ITEM_ID", "")
    GRAPH_SIMPLE_UPLOAD_MAX_BYTES = int(os.getenv("GRAPH_SIMPLE_UPLOAD_MAX_BYTES", str(4 * 1024 * 1024)))

    AUTO_SEED_DEMO = env_bool("AUTO_SEED_DEMO", True)
    DEMO_USER_ONE_PHONE = os.getenv("DEMO_USER_ONE_PHONE", "+15550000001")
    DEMO_USER_TWO_PHONE = os.getenv("DEMO_USER_TWO_PHONE", "+15550000002")
