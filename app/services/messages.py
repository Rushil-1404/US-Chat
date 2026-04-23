from __future__ import annotations

from flask import current_app

from ..extensions import db, socketio
from ..models import Conversation, Message, User, utcnow
from .serializers import serialize_message


MESSAGE_TYPE_TEXT = "text"
DELIVERY_PENDING = "pending"
DELIVERY_SENT = "sent"
DELIVERY_DELIVERED = "delivered"
DELIVERY_READ = "read"
DELIVERY_FAILED = "failed"


def room_name(conversation_id: int) -> str:
    return f"conversation:{conversation_id}"


def create_text_message(conversation: Conversation, sender: User, text_body: str) -> Message:
    text_body = (text_body or "").strip()
    if not text_body:
        raise ValueError("Message cannot be empty.")

    receiver = conversation.other_participant(sender.id)
    message = Message(
        conversation_id=conversation.id,
        sender_id=sender.id,
        receiver_id=receiver.id,
        message_type=MESSAGE_TYPE_TEXT,
        text_body=text_body,
        delivery_status=DELIVERY_SENT,
    )
    db.session.add(message)
    conversation.updated_at = utcnow()
    db.session.commit()
    emit_message_created(message, sender.id)
    return message


def mark_message_delivered(message: Message, actor: User) -> Message:
    if actor.id != message.receiver_id:
        raise PermissionError("Only the receiver can mark this message delivered.")
    if message.delivery_status in {DELIVERY_SENT, DELIVERY_PENDING}:
        message.delivery_status = DELIVERY_DELIVERED
        db.session.commit()
        socketio.emit(
            "message_delivered",
            {"message_id": message.id, "delivery_status": message.delivery_status},
            room=room_name(message.conversation_id),
        )
    return message


def mark_messages_read(conversation: Conversation, viewer: User) -> list[int]:
    unread_messages = [
        message
        for message in conversation.messages
        if message.receiver_id == viewer.id and message.read_at is None
    ]
    if not unread_messages:
        return []

    now = utcnow()
    message_ids = []
    for message in unread_messages:
        message.read_at = now
        message.delivery_status = DELIVERY_READ
        message_ids.append(message.id)

    db.session.commit()
    socketio.emit(
        "message_read",
        {"message_ids": message_ids, "read_at": now.isoformat()},
        room=room_name(conversation.id),
    )
    return message_ids


def emit_message_created(message: Message, viewer_id: int) -> None:
    socketio.emit(
        "message_created",
        serialize_message(message, viewer_id),
        room=room_name(message.conversation_id),
    )
    current_app.logger.info("Message %s emitted to room %s", message.id, room_name(message.conversation_id))
