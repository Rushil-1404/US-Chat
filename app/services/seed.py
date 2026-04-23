from __future__ import annotations

from ..extensions import db
from ..models import Message, User
from .conversations import get_or_create_conversation
from .messages import DELIVERY_DELIVERED, DELIVERY_READ
from .otp import normalize_phone_number


def ensure_demo_data(force: bool = False) -> None:
    from flask import current_app

    phone_one = normalize_phone_number(current_app.config["DEMO_USER_ONE_PHONE"])
    phone_two = normalize_phone_number(current_app.config["DEMO_USER_TWO_PHONE"])

    user_one = User.query.filter_by(phone_number=phone_one).first()
    user_two = User.query.filter_by(phone_number=phone_two).first()

    if force and user_one and user_two:
        pass

    if not user_one:
        user_one = User(
            phone_number=phone_one,
            display_name="Alex Rivers",
            status_text="Always open to a good idea.",
            profile_completed=True,
        )
        db.session.add(user_one)

    if not user_two:
        user_two = User(
            phone_number=phone_two,
            display_name="Rushil Patil",
            status_text="Focused and available.",
            profile_completed=True,
        )
        db.session.add(user_two)

    db.session.commit()

    conversation, created = get_or_create_conversation(user_one, user_two)
    if created or not conversation.messages:
        demo_messages = [
            Message(
                conversation_id=conversation.id,
                sender_id=user_one.id,
                receiver_id=user_two.id,
                message_type="text",
                text_body="Hey! Did you see the final mockups for the new project?",
                delivery_status=DELIVERY_READ,
            ),
            Message(
                conversation_id=conversation.id,
                sender_id=user_two.id,
                receiver_id=user_one.id,
                message_type="text",
                text_body="Not yet, can you send them over?",
                delivery_status=DELIVERY_DELIVERED,
            ),
        ]
        db.session.add_all(demo_messages)
        db.session.commit()
