from __future__ import annotations

from datetime import timedelta

from flask import abort

from ..extensions import db
from ..models import Conversation, Message, User, utcnow


def normalized_pair(user_one_id: int, user_two_id: int) -> tuple[int, int]:
    if user_one_id == user_two_id:
        raise ValueError("Users must be different.")
    return tuple(sorted((user_one_id, user_two_id)))


def get_or_create_conversation(user_one: User, user_two: User) -> tuple[Conversation, bool]:
    participant_one_id, participant_two_id = normalized_pair(user_one.id, user_two.id)
    conversation = Conversation.query.filter_by(
        participant_one_id=participant_one_id,
        participant_two_id=participant_two_id,
    ).first()
    if conversation:
        return conversation, False

    conversation = Conversation(
        participant_one_id=participant_one_id,
        participant_two_id=participant_two_id,
    )
    db.session.add(conversation)
    db.session.commit()
    return conversation, True


def get_user_conversation_or_404(conversation_id: int, user: User) -> Conversation:
    conversation = Conversation.query.get_or_404(conversation_id)
    if user.id not in {conversation.participant_one_id, conversation.participant_two_id}:
        abort(404)
    return conversation


def list_user_conversations(user: User) -> list[Conversation]:
    return (
        Conversation.query.filter(
            (Conversation.participant_one_id == user.id) | (Conversation.participant_two_id == user.id)
        )
        .order_by(Conversation.updated_at.desc())
        .all()
    )


def latest_message(conversation: Conversation) -> Message | None:
    if not conversation.messages:
        return None
    return max(conversation.messages, key=lambda item: item.created_at)


def unread_count_for_user(conversation: Conversation, user: User) -> int:
    return Message.query.filter_by(
        conversation_id=conversation.id,
        receiver_id=user.id,
        read_at=None,
    ).count()


def presence_label(user: User) -> str:
    if not user.last_seen_visibility:
        return "Unavailable"
    if user.last_seen_at and user.last_seen_at >= utcnow() - timedelta(minutes=2):
        return "Online"
    if not user.last_seen_at:
        return "Offline"
    return f"Last seen {user.last_seen_at.strftime('%b %d, %I:%M %p')}"
