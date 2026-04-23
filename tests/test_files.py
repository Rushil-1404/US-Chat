from io import BytesIO

import pytest

from app.extensions import db
from app.models import FileAsset, Message
from app.services import files as file_service
from app.services.storage import StoredFile

from .conftest import login_with_dev_otp


def create_conversation(client, phone_number):
    response = client.post("/api/conversations/resolve-by-phone", json={"phone_number": phone_number})
    assert response.status_code == 200
    return response.get_json()["conversation"]["id"]


def test_upload_rejects_unsupported_extension(client, completed_user, second_completed_user):
    login_with_dev_otp(client, completed_user)
    conversation_id = create_conversation(client, second_completed_user)

    response = client.post(
        f"/api/conversations/{conversation_id}/messages/file",
        data={"file": (BytesIO(b"plain text"), "notes.txt")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "invalid_file"


def test_successful_upload_persists_metadata(client, completed_user, second_completed_user, app):
    login_with_dev_otp(client, completed_user)
    conversation_id = create_conversation(client, second_completed_user)

    response = client.post(
        f"/api/conversations/{conversation_id}/messages/file",
        data={"file": (BytesIO(b"fake png payload"), "preview.png")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["ok"] is True

    with app.app_context():
        asset = FileAsset.query.first()
        message = Message.query.first()
        assert asset is not None
        assert asset.upload_status == "uploaded"
        assert asset.folder_path.startswith("ChatApp/conversations/")
        assert message.delivery_status == "sent"


def test_failed_upload_can_be_retried(client, completed_user, second_completed_user, app, monkeypatch):
    class FlakyProvider:
        name = "graph"

        def __init__(self):
            self.calls = 0

        def upload_file(self, source_path, folder_path, stored_name, mime_type):
            self.calls += 1
            if self.calls == 1:
                raise RuntimeError("Temporary Graph outage")
            return StoredFile(
                provider="graph",
                stored_name=stored_name,
                folder_path=folder_path,
                drive_id="drive-id",
                drive_item_id="item-id",
                web_url="https://example.com/file",
            )

        def delete_file(self, **kwargs):
            return None

        def get_download_url(self, **kwargs):
            return "https://example.com/file"

    flaky_provider = FlakyProvider()
    monkeypatch.setattr(file_service, "get_storage_provider", lambda: flaky_provider)

    login_with_dev_otp(client, completed_user)
    conversation_id = create_conversation(client, second_completed_user)

    failed_response = client.post(
        f"/api/conversations/{conversation_id}/messages/file",
        data={"file": (BytesIO(b"png data"), "image.png")},
        content_type="multipart/form-data",
    )

    assert failed_response.status_code == 200
    assert failed_response.get_json()["ok"] is False

    with app.app_context():
        asset = FileAsset.query.first()
        assert asset.upload_status == "failed"
        file_id = asset.id

    retry_response = client.post(f"/api/files/{file_id}/retry")
    assert retry_response.status_code == 200
    assert retry_response.get_json()["ok"] is True

    with app.app_context():
        asset = db.session.get(FileAsset, file_id)
        assert asset.upload_status == "uploaded"
        assert asset.drive_item_id == "item-id"
