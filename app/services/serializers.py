from __future__ import annotations

from flask import url_for

from .conversations import latest_message, presence_label, unread_count_for_user


def isoformat_or_none(value):
    return value.isoformat() if value else None


def serialize_user(user):
    return {
        "id": user.id,
        "phone_number": user.phone_number,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url or "",
        "status_text": user.status_text,
        "profile_completed": user.profile_completed,
        "theme": user.theme,
        "browser_notifications_enabled": user.browser_notifications_enabled,
        "sound_enabled": user.sound_enabled,
        "vibration_enabled": user.vibration_enabled,
        "read_receipts_enabled": user.read_receipts_enabled,
        "last_seen_visibility": user.last_seen_visibility,
        "media_auto_download_enabled": user.media_auto_download_enabled,
        "last_seen_at": isoformat_or_none(user.last_seen_at),
        "initials": user.initials(),
    }


def serialize_file_asset(asset):
    if asset is None:
        return None
    return {
        "id": asset.id,
        "sender_id": asset.sender_id,
        "original_name": asset.original_name,
        "stored_name": asset.stored_name,
        "mime_type": asset.mime_type,
        "extension": asset.extension,
        "size_bytes": asset.size_bytes,
        "provider": asset.provider,
        "drive_id": asset.drive_id,
        "drive_item_id": asset.drive_item_id,
        "web_url": asset.web_url,
        "folder_path": asset.folder_path,
        "upload_status": asset.upload_status,
        "deleted_at": isoformat_or_none(asset.deleted_at),
        "download_url": url_for("files.download_asset", file_id=asset.id),
        "preview_url": url_for("files.preview_asset", file_id=asset.id),
        "retry_url": url_for("files.retry_file_api", file_id=asset.id),
        "delete_url": url_for("files.delete_file_api", file_id=asset.id),
    }


def serialize_message(message, viewer_id: int):
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "receiver_id": message.receiver_id,
        "message_type": message.message_type,
        "text_body": message.text_body,
        "delivery_status": message.delivery_status,
        "read_at": isoformat_or_none(message.read_at),
        "created_at": isoformat_or_none(message.created_at),
        "is_mine": message.sender_id == viewer_id,
        "failure_reason": message.failure_reason,
        "file": serialize_file_asset(message.file_asset),
    }


def serialize_conversation_summary(conversation, viewer):
    partner = conversation.other_participant(viewer.id)
    newest_message = latest_message(conversation)
    return {
        "id": conversation.id,
        "partner": serialize_user(partner),
        "latest_message": serialize_message(newest_message, viewer.id) if newest_message else None,
        "unread_count": unread_count_for_user(conversation, viewer),
        "presence_label": presence_label(partner),
        "chat_url": url_for("conversations.chat_page", conversation_id=conversation.id),
        "files_url": url_for("files.gallery_page", conversation_id=conversation.id),
    }
