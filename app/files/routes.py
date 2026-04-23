from __future__ import annotations

from pathlib import Path

from flask import Blueprint, abort, g, jsonify, redirect, render_template, request, send_file, url_for

from ..decorators import api_login_required, login_required
from ..models import FileAsset, User
from ..services.conversations import get_user_conversation_or_404, list_user_conversations
from ..services.files import UploadValidationError, avatar_absolute_path, delete_file_asset, file_absolute_path, retry_failed_file
from ..services.serializers import serialize_file_asset, serialize_message, serialize_user
from ..services.storage import get_storage_provider


files_bp = Blueprint("files", __name__)


@files_bp.get("/files")
@login_required
def files_landing():
    conversations = list_user_conversations(g.current_user)
    if not conversations:
        return redirect(url_for("conversations.chats_page"))
    return redirect(url_for("files.gallery_page", conversation_id=conversations[0].id))


@files_bp.get("/files/<int:conversation_id>")
@login_required
def gallery_page(conversation_id: int):
    conversation = get_user_conversation_or_404(conversation_id, g.current_user)
    assets = (
        FileAsset.query.filter(
            FileAsset.conversation_id == conversation.id,
            FileAsset.deleted_at.is_(None),
        )
        .order_by(FileAsset.created_at.desc())
        .all()
    )
    serialized_assets = [serialize_file_asset(asset) for asset in assets]
    return render_template(
        "storage.html",
        conversation=conversation,
        assets=serialized_assets,
        bootstrap={
            "conversationId": conversation.id,
            "assets": serialized_assets,
            "user": serialize_user(g.current_user),
        },
    )


@files_bp.get("/api/conversations/<int:conversation_id>/files")
@api_login_required
def list_files_api(conversation_id: int):
    conversation = get_user_conversation_or_404(conversation_id, g.current_user)
    category = request.args.get("category")
    query = FileAsset.query.filter(
        FileAsset.conversation_id == conversation.id,
        FileAsset.deleted_at.is_(None),
    )
    assets = query.order_by(FileAsset.created_at.desc()).all()
    if category in {"image", "video", "document"}:
        assets = [asset for asset in assets if asset.message and asset.message.message_type == category]
    return jsonify({"ok": True, "files": [serialize_file_asset(asset) for asset in assets]})


@files_bp.delete("/api/files/<int:file_id>")
@api_login_required
def delete_file_api(file_id: int):
    asset = FileAsset.query.get_or_404(file_id)
    get_user_conversation_or_404(asset.conversation_id, g.current_user)
    try:
        delete_file_asset(asset, g.current_user)
    except PermissionError as exc:
        return jsonify({"ok": False, "error": "forbidden", "message": str(exc)}), 403
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": "delete_failed", "message": str(exc)}), 400
    return jsonify({"ok": True})


@files_bp.post("/api/files/<int:file_id>/retry")
@api_login_required
def retry_file_api(file_id: int):
    asset = FileAsset.query.get_or_404(file_id)
    get_user_conversation_or_404(asset.conversation_id, g.current_user)
    try:
        message, _asset = retry_failed_file(asset, g.current_user)
    except (PermissionError, UploadValidationError) as exc:
        return jsonify({"ok": False, "error": "retry_failed", "message": str(exc)}), 400
    return jsonify({"ok": True, "message": serialize_message(message, g.current_user.id)})


@files_bp.get("/files/download/<int:file_id>")
@login_required
def download_asset(file_id: int):
    asset = FileAsset.query.get_or_404(file_id)
    get_user_conversation_or_404(asset.conversation_id, g.current_user)
    if asset.deleted_at is not None:
        abort(404)

    absolute_path = file_absolute_path(asset)
    if absolute_path and absolute_path.exists():
        return send_file(absolute_path, as_attachment=True, download_name=asset.original_name)

    download_url = get_storage_provider().get_download_url(
        folder_path=asset.folder_path,
        stored_name=asset.stored_name,
        drive_id=asset.drive_id,
        drive_item_id=asset.drive_item_id,
        fallback_url=asset.web_url,
    )
    if not download_url:
        abort(404)
    return redirect(download_url)


@files_bp.get("/files/preview/<int:file_id>")
@login_required
def preview_asset(file_id: int):
    asset = FileAsset.query.get_or_404(file_id)
    get_user_conversation_or_404(asset.conversation_id, g.current_user)
    if asset.deleted_at is not None:
        abort(404)

    absolute_path = file_absolute_path(asset)
    if absolute_path and absolute_path.exists():
        return send_file(absolute_path, as_attachment=False, download_name=asset.original_name)

    preview_url = get_storage_provider().get_download_url(
        folder_path=asset.folder_path,
        stored_name=asset.stored_name,
        drive_id=asset.drive_id,
        drive_item_id=asset.drive_item_id,
        fallback_url=asset.web_url,
    )
    if not preview_url:
        abort(404)
    return redirect(preview_url)


@files_bp.get("/avatars/<int:user_id>")
@login_required
def user_avatar(user_id: int):
    user = User.query.get_or_404(user_id)
    absolute_path = avatar_absolute_path(user)
    if absolute_path and absolute_path.exists():
        return send_file(absolute_path, as_attachment=False)

    if user.avatar_drive_id and user.avatar_drive_item_id:
        avatar_url = get_storage_provider().get_download_url(
            folder_path=user.avatar_storage_path,
            stored_name=user.avatar_stored_name,
            drive_id=user.avatar_drive_id,
            drive_item_id=user.avatar_drive_item_id,
            fallback_url=user.avatar_url,
        )
        if avatar_url:
            return redirect(avatar_url)
    abort(404)
