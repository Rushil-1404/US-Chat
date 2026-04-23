from __future__ import annotations

from flask import Blueprint, g, jsonify, request

from ..decorators import api_login_required
from ..extensions import db
from ..models import Message
from ..services.conversations import get_user_conversation_or_404
from ..services.files import UploadValidationError, upload_message_file
from ..services.messages import create_text_message, mark_message_delivered
from ..services.serializers import serialize_message


messages_bp = Blueprint("messages", __name__)


@messages_bp.get("/api/conversations/<int:conversation_id>/messages")
@api_login_required
def get_messages_api(conversation_id: int):
    conversation = get_user_conversation_or_404(conversation_id, g.current_user)
    page_size = max(1, min(int(request.args.get("page_size", 50)), 100))
    messages = conversation.messages[-page_size:]
    return jsonify({"ok": True, "messages": [serialize_message(message, g.current_user.id) for message in messages]})


@messages_bp.post("/api/conversations/<int:conversation_id>/messages/text")
@api_login_required
def send_text_message_api(conversation_id: int):
    conversation = get_user_conversation_or_404(conversation_id, g.current_user)
    payload = request.get_json(silent=True) or request.form
    text_body = payload.get("text_body", "")

    try:
        message = create_text_message(conversation, g.current_user, text_body)
    except ValueError as exc:
        return jsonify({"ok": False, "error": "invalid_message", "message": str(exc)}), 400

    return jsonify({"ok": True, "message": serialize_message(message, g.current_user.id)}), 201


@messages_bp.post("/api/conversations/<int:conversation_id>/messages/file")
@api_login_required
def send_file_message_api(conversation_id: int):
    conversation = get_user_conversation_or_404(conversation_id, g.current_user)
    upload = request.files.get("file")
    try:
        message, asset, uploaded, error_message = upload_message_file(conversation, g.current_user, upload)
    except UploadValidationError as exc:
        return jsonify({"ok": False, "error": "invalid_file", "message": str(exc)}), 400

    serialized_message = serialize_message(message, g.current_user.id)
    if uploaded:
        return jsonify({"ok": True, "message": serialized_message}), 201

    return jsonify({"ok": False, "error": "upload_failed", "message": error_message, "message_payload": serialized_message})


@messages_bp.post("/api/messages/<int:message_id>/delivered")
@api_login_required
def mark_message_delivered_api(message_id: int):
    message = Message.query.get_or_404(message_id)
    conversation = get_user_conversation_or_404(message.conversation_id, g.current_user)
    _ = conversation
    try:
        updated_message = mark_message_delivered(message, g.current_user)
    except PermissionError as exc:
        return jsonify({"ok": False, "error": "forbidden", "message": str(exc)}), 403
    return jsonify({"ok": True, "message": serialize_message(updated_message, g.current_user.id)})


@messages_bp.post("/api/messages/<int:message_id>/read")
@api_login_required
def mark_message_read_api(message_id: int):
    message = Message.query.get_or_404(message_id)
    if g.current_user.id != message.receiver_id:
        return jsonify({"ok": False, "error": "forbidden", "message": "Only the receiver can mark this message as read."}), 403
    if message.read_at is None:
        from ..models import utcnow

        message.read_at = utcnow()
        message.delivery_status = "read"
        db.session.commit()
    return jsonify({"ok": True, "message": serialize_message(message, g.current_user.id)})
