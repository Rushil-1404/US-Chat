from __future__ import annotations

from flask import request
from flask_socketio import join_room

from ..extensions import db
from ..models import Conversation
from ..services.messages import room_name
from ..services.sessions import resolve_user_from_token


def register_socket_handlers(socketio) -> None:
    @socketio.on("join_conversation")
    def handle_join_conversation(payload):
        token = request.cookies.get("chat_session")
        user, _session = resolve_user_from_token(token)
        if not user:
            return {"ok": False, "error": "auth_required"}

        conversation_id = int((payload or {}).get("conversation_id", 0))
        conversation = db.session.get(Conversation, conversation_id)
        if not conversation or user.id not in {conversation.participant_one_id, conversation.participant_two_id}:
            return {"ok": False, "error": "conversation_not_found"}

        join_room(room_name(conversation_id))
        return {"ok": True, "conversation_id": conversation_id}
