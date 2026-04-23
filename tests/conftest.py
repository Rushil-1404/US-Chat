from __future__ import annotations

from io import BytesIO

import pytest

from app import create_app
from app.extensions import db
from app.models import User


@pytest.fixture()
def app(tmp_path):
    database_path = tmp_path / "test.db"
    storage_root = tmp_path / "storage"
    app = create_app(
        {
            "TESTING": True,
            "AUTO_SEED_DEMO": False,
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{database_path.as_posix()}",
            "LOCAL_STORAGE_ROOT": str(storage_root),
            "STORAGE_MODE": "local",
            "DEV_OTP_EXPOSE_CODE": True,
            "SECRET_KEY": "test-secret",
        }
    )
    with app.app_context():
        yield app


@pytest.fixture()
def client(app):
    return app.test_client()


def login_with_dev_otp(client, phone_number: str):
    request_response = client.post("/api/auth/request-otp", json={"phone_number": phone_number})
    assert request_response.status_code == 200
    dev_code = request_response.get_json()["dev_code"]

    verify_response = client.post(
        "/api/auth/verify-otp",
        json={"phone_number": phone_number, "otp": dev_code},
    )
    assert verify_response.status_code == 200
    return verify_response


@pytest.fixture()
def completed_user(app):
    with app.app_context():
        user = User(phone_number="+15550000021", display_name="Test User", profile_completed=True)
        db.session.add(user)
        db.session.commit()
        return user.phone_number


@pytest.fixture()
def second_completed_user(app):
    with app.app_context():
        user = User(phone_number="+15550000022", display_name="Second User", profile_completed=True)
        db.session.add(user)
        db.session.commit()
        return user.phone_number


@pytest.fixture()
def sample_upload():
    return BytesIO(b"sample image payload"), "preview.png"
