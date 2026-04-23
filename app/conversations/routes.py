from __future__ import annotations

from flask import Blueprint, g, jsonify, redirect, render_template, request, url_for

from ..decorators import api_login_required, login_required
from ..models import User
from ..services.conversations import get_or_create_conversation, get_user_conversation_or_404, list_user_conversations
from ..services.messages import mark_messages_read
from ..services.otp import normalize_phone_number, validate_phone_number
from ..services.serializers import serialize_conversation_summary, serialize_message, serialize_user


conversations_bp = Blueprint("conversations", __name__)


def _profile_gate():
    if not g.current_user.profile_completed:
        return redirect(url_for("users.profile_setup_page"))
    return None


@conversations_bp.get("/chats")
@login_required
def chats_page():
    redirect_response = _profile_gate()
    if redirect_response:
        return redirect_response

    conversations = list_user_conversations(g.current_user)
    summaries = [serialize_conversation_summary(conversation, g.current_user) for conversation in conversations]
    nav_cloud_url = summaries[0]["files_url"] if summaries else url_for("files.files_landing")

    return render_template(
        "chatlist.html",
        conversations=summaries,
        nav_cloud_url=nav_cloud_url,
        bootstrap={
            "conversations": summaries,
            "user": serialize_user(g.current_user),
            "navCloudUrl": nav_cloud_url,
        },
    )


@conversations_bp.get("/chats/<int:conversation_id>")
@login_required
def chat_page(conversation_id: int):
    redirect_response = _profile_gate()
    if redirect_response:
        return redirect_response

    conversation = get_user_conversation_or_404(conversation_id, g.current_user)
    partner = conversation.other_participant(g.current_user.id)
    mark_messages_read(conversation, g.current_user)
    messages = [serialize_message(message, g.current_user.id) for message in conversation.messages]

    return render_template(
        "chat.html",
        conversation=conversation,
        partner=partner,
        messages=messages,
        bootstrap={
            "conversationId": conversation.id,
            "currentUserId": g.current_user.id,
            "filesUrl": url_for("files.gallery_page", conversation_id=conversation.id),
            "messagesApiUrl": url_for("messages.get_messages_api", conversation_id=conversation.id),
            "sendTextUrl": url_for("messages.send_text_message_api", conversation_id=conversation.id),
            "sendFileUrl": url_for("messages.send_file_message_api", conversation_id=conversation.id),
        },
    )


@conversations_bp.get("/api/conversations")
@api_login_required
def list_conversations_api():
    summaries = [serialize_conversation_summary(conversation, g.current_user) for conversation in list_user_conversations(g.current_user)]
    return jsonify({"ok": True, "conversations": summaries})


@conversations_bp.post("/api/conversations/resolve-by-phone")
@api_login_required
def resolve_conversation_api():
    payload = request.get_json(silent=True) or request.form
    phone_number = normalize_phone_number(payload.get("phone_number", ""))
    if not validate_phone_number(phone_number):
        return jsonify({"ok": False, "error": "invalid_phone", "message": "Enter a valid phone number."}), 400
    if phone_number == g.current_user.phone_number:
        return jsonify({"ok": False, "error": "same_user", "message": "Use a different phone number to start a chat."}), 400

    target_user = User.query.filter_by(phone_number=phone_number).first()
    if not target_user:
        return jsonify({"ok": False, "error": "user_not_found", "message": "No registered user was found for that phone number."}), 404

    conversation, _ = get_or_create_conversation(g.current_user, target_user)
    summary = serialize_conversation_summary(conversation, g.current_user)
    return jsonify({"ok": True, "conversation": summary, "redirect_url": summary["chat_url"]})
