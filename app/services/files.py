from __future__ import annotations

import mimetypes
import os
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path

from flask import current_app, url_for
from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import Conversation, FileAsset, Message, User, utcnow
from .messages import DELIVERY_FAILED, DELIVERY_PENDING, DELIVERY_SENT, emit_message_created
from .storage import StorageError, get_storage_provider


IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
VIDEO_EXTENSIONS = {"mp4", "mov", "m4v", "avi", "mkv", "webm"}
DOCUMENT_EXTENSIONS = {"pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx"}


@dataclass
class UploadDescriptor:
    original_name: str
    extension: str
    mime_type: str
    size_bytes: int
    category: str


class UploadValidationError(ValueError):
    pass


def detect_category(extension: str) -> str:
    extension = extension.lower()
    if extension in IMAGE_EXTENSIONS:
        return "image"
    if extension in VIDEO_EXTENSIONS:
        return "video"
    if extension in DOCUMENT_EXTENSIONS:
        return "document"
    raise UploadValidationError("Unsupported file type.")


def validate_upload(file_storage: FileStorage, allowed_categories: set[str] | None = None) -> UploadDescriptor:
    if not file_storage or not file_storage.filename:
        raise UploadValidationError("Select a file before sending.")

    original_name = secure_filename(file_storage.filename)
    if not original_name:
        raise UploadValidationError("The selected file name is not valid.")

    extension = Path(original_name).suffix.lower().lstrip(".")
    if not extension:
        raise UploadValidationError("Files without an extension are not supported.")

    category = detect_category(extension)
    if allowed_categories and category not in allowed_categories:
        raise UploadValidationError("This upload type is not allowed here.")

    stream = file_storage.stream
    current_position = stream.tell()
    stream.seek(0, os.SEEK_END)
    size_bytes = stream.tell()
    stream.seek(current_position)

    if size_bytes <= 0:
        raise UploadValidationError("Empty files cannot be uploaded.")
    if size_bytes > current_app.config["MAX_CONTENT_LENGTH"]:
        raise UploadValidationError("This file exceeds the configured upload limit.")

    mime_type = file_storage.mimetype or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    return UploadDescriptor(
        original_name=original_name,
        extension=extension,
        mime_type=mime_type,
        size_bytes=size_bytes,
        category=category,
    )


def build_folder_path(category: str, conversation_id: int | None = None, user_id: int | None = None) -> str:
    now = utcnow()
    if category == "avatar" and user_id is not None:
        return f"ChatApp/users/{user_id}/avatars"
    if conversation_id is None:
        raise UploadValidationError("Conversation folder path requires a conversation id.")
    category_folder = {
        "image": "images",
        "video": "videos",
        "document": "documents",
    }[category]
    return f"ChatApp/conversations/{conversation_id}/{category_folder}/{now.strftime('%Y/%m')}"


def save_temp_upload(file_storage: FileStorage) -> Path:
    temp_dir = Path(current_app.instance_path) / "temp_uploads"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_path = temp_dir / f"{uuid.uuid4().hex}_{secure_filename(file_storage.filename)}"
    file_storage.save(temp_path)
    return temp_path


def unique_stored_name(original_name: str) -> str:
    base_name = Path(original_name).stem
    extension = Path(original_name).suffix.lower()
    safe_base = secure_filename(base_name) or "file"
    return f"{safe_base}-{uuid.uuid4().hex[:12]}{extension}"


def upload_avatar_for_user(user: User, file_storage: FileStorage) -> User:
    descriptor = validate_upload(file_storage, allowed_categories={"image"})
    temp_path = save_temp_upload(file_storage)
    folder_path = build_folder_path("avatar", user_id=user.id)
    stored_name = unique_stored_name(descriptor.original_name)
    provider = get_storage_provider()

    try:
        stored_file = provider.upload_file(temp_path, folder_path, stored_name, descriptor.mime_type)
    finally:
        if temp_path.exists():
            temp_path.unlink()

    user.avatar_storage_provider = stored_file.provider
    user.avatar_storage_path = folder_path
    user.avatar_stored_name = stored_name
    user.avatar_drive_id = stored_file.drive_id
    user.avatar_drive_item_id = stored_file.drive_item_id
    user.avatar_url = stored_file.web_url if stored_file.provider == "graph" and stored_file.web_url else url_for("files.user_avatar", user_id=user.id)
    db.session.commit()
    return user


def upload_message_file(conversation: Conversation, sender: User, file_storage: FileStorage) -> tuple[Message, FileAsset, bool, str | None]:
    descriptor = validate_upload(file_storage)
    receiver = conversation.other_participant(sender.id)
    temp_path = save_temp_upload(file_storage)
    folder_path = build_folder_path(descriptor.category, conversation_id=conversation.id)
    stored_name = unique_stored_name(descriptor.original_name)
    provider = get_storage_provider()

    message = Message(
        conversation_id=conversation.id,
        sender_id=sender.id,
        receiver_id=receiver.id,
        message_type=descriptor.category,
        text_body=descriptor.original_name,
        delivery_status=DELIVERY_PENDING,
    )
    db.session.add(message)
    db.session.flush()

    asset = FileAsset(
        message_id=message.id,
        conversation_id=conversation.id,
        sender_id=sender.id,
        original_name=descriptor.original_name,
        stored_name=stored_name,
        mime_type=descriptor.mime_type,
        extension=descriptor.extension,
        size_bytes=descriptor.size_bytes,
        provider=provider.name,
        folder_path=folder_path,
        upload_status="pending",
        local_temp_path=str(temp_path),
    )
    db.session.add(asset)
    conversation.updated_at = utcnow()
    db.session.commit()

    try:
        stored_file = provider.upload_file(temp_path, folder_path, stored_name, descriptor.mime_type)
    except Exception as exc:  # noqa: BLE001
        current_app.logger.exception("Attachment upload failed for message %s", message.id)
        message.delivery_status = DELIVERY_FAILED
        message.failure_reason = str(exc)
        asset.upload_status = "failed"
        db.session.commit()
        return message, asset, False, str(exc)

    if temp_path.exists():
        temp_path.unlink()

    asset.provider = stored_file.provider
    asset.drive_id = stored_file.drive_id
    asset.drive_item_id = stored_file.drive_item_id
    asset.web_url = stored_file.web_url
    asset.folder_path = stored_file.folder_path
    asset.upload_status = "uploaded"
    asset.local_temp_path = None
    message.delivery_status = DELIVERY_SENT
    message.failure_reason = None
    db.session.commit()
    emit_message_created(message, sender.id)
    return message, asset, True, None


def retry_failed_file(asset: FileAsset, actor: User) -> tuple[Message, FileAsset]:
    if asset.sender_id != actor.id:
        raise PermissionError("Only the uploader can retry this file.")
    if asset.upload_status != "failed":
        raise UploadValidationError("Only failed uploads can be retried.")
    if not asset.local_temp_path or not Path(asset.local_temp_path).exists():
        raise UploadValidationError("The original upload payload is no longer available for retry.")

    provider = get_storage_provider()
    temp_path = Path(asset.local_temp_path)
    message = asset.message

    try:
        stored_file = provider.upload_file(temp_path, asset.folder_path, asset.stored_name, asset.mime_type)
    except Exception as exc:  # noqa: BLE001
        current_app.logger.exception("Retry failed for file asset %s", asset.id)
        message.delivery_status = DELIVERY_FAILED
        message.failure_reason = str(exc)
        asset.upload_status = "failed"
        db.session.commit()
        raise UploadValidationError(str(exc)) from exc

    if temp_path.exists():
        temp_path.unlink()

    asset.provider = stored_file.provider
    asset.drive_id = stored_file.drive_id
    asset.drive_item_id = stored_file.drive_item_id
    asset.web_url = stored_file.web_url
    asset.upload_status = "uploaded"
    asset.local_temp_path = None
    message.delivery_status = DELIVERY_SENT
    message.failure_reason = None
    db.session.commit()
    emit_message_created(message, actor.id)
    return message, asset


def delete_file_asset(asset: FileAsset, actor: User) -> None:
    if asset.sender_id != actor.id:
        raise PermissionError("Only the uploader can delete this file.")
    if asset.deleted_at is not None:
        return

    provider = get_storage_provider()
    provider.delete_file(
        folder_path=asset.folder_path,
        stored_name=asset.stored_name,
        drive_id=asset.drive_id,
        drive_item_id=asset.drive_item_id,
    )
    asset.deleted_at = utcnow()
    db.session.commit()


def file_absolute_path(asset: FileAsset) -> Path | None:
    provider = get_storage_provider()
    if provider.name != "local":
        return None
    if not asset.folder_path or not asset.stored_name:
        return None
    return provider.absolute_path(asset.folder_path, asset.stored_name)


def avatar_absolute_path(user: User) -> Path | None:
    provider = get_storage_provider()
    if provider.name != "local":
        return None
    if not user.avatar_storage_path or not user.avatar_stored_name:
        return None
    return provider.absolute_path(user.avatar_storage_path, user.avatar_stored_name)
