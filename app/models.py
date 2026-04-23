from __future__ import annotations

from datetime import UTC, datetime

from .extensions import db


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class User(TimestampMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    phone_number = db.Column(db.String(32), unique=True, nullable=False, index=True)
    display_name = db.Column(db.String(120), nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    avatar_storage_provider = db.Column(db.String(32), nullable=True)
    avatar_storage_path = db.Column(db.String(500), nullable=True)
    avatar_stored_name = db.Column(db.String(255), nullable=True)
    avatar_drive_id = db.Column(db.String(255), nullable=True)
    avatar_drive_item_id = db.Column(db.String(255), nullable=True)
    status_text = db.Column(db.String(280), default="", nullable=False)
    profile_completed = db.Column(db.Boolean, default=False, nullable=False)
    theme = db.Column(db.String(16), default="light", nullable=False)
    browser_notifications_enabled = db.Column(db.Boolean, default=False, nullable=False)
    sound_enabled = db.Column(db.Boolean, default=True, nullable=False)
    vibration_enabled = db.Column(db.Boolean, default=True, nullable=False)
    read_receipts_enabled = db.Column(db.Boolean, default=True, nullable=False)
    last_seen_visibility = db.Column(db.Boolean, default=True, nullable=False)
    media_auto_download_enabled = db.Column(db.Boolean, default=False, nullable=False)
    last_seen_at = db.Column(db.DateTime(timezone=True), nullable=True)

    conversations_as_first = db.relationship(
        "Conversation",
        foreign_keys="Conversation.participant_one_id",
        back_populates="participant_one",
        lazy="dynamic",
    )
    conversations_as_second = db.relationship(
        "Conversation",
        foreign_keys="Conversation.participant_two_id",
        back_populates="participant_two",
        lazy="dynamic",
    )

    def initials(self) -> str:
        source = (self.display_name or self.phone_number or "U").strip()
        parts = [piece[0] for piece in source.split()[:2] if piece]
        return "".join(parts).upper() or "U"


class OtpChallenge(TimestampMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    phone_number = db.Column(db.String(32), nullable=False, index=True)
    code_hash = db.Column(db.String(128), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    consumed_at = db.Column(db.DateTime(timezone=True), nullable=True)
    verify_attempts = db.Column(db.Integer, default=0, nullable=False)
    request_ip = db.Column(db.String(64), nullable=True)


class Conversation(TimestampMixin, db.Model):
    __table_args__ = (
        db.UniqueConstraint("participant_one_id", "participant_two_id", name="uq_conversation_participants"),
    )

    id = db.Column(db.Integer, primary_key=True)
    participant_one_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    participant_two_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    participant_one = db.relationship("User", foreign_keys=[participant_one_id], back_populates="conversations_as_first")
    participant_two = db.relationship("User", foreign_keys=[participant_two_id], back_populates="conversations_as_second")
    messages = db.relationship("Message", back_populates="conversation", lazy="selectin", order_by="Message.created_at.asc()")

    def other_participant(self, user_id: int) -> User:
        return self.participant_two if self.participant_one_id == user_id else self.participant_one


class Message(TimestampMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversation.id"), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    message_type = db.Column(db.String(32), nullable=False, default="text")
    text_body = db.Column(db.Text, nullable=True)
    delivery_status = db.Column(db.String(32), nullable=False, default="pending")
    read_at = db.Column(db.DateTime(timezone=True), nullable=True)
    failure_reason = db.Column(db.String(500), nullable=True)

    conversation = db.relationship("Conversation", back_populates="messages")
    sender = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])
    file_asset = db.relationship("FileAsset", back_populates="message", uselist=False, lazy="selectin")


class FileAsset(TimestampMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey("message.id"), nullable=False, unique=True, index=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversation.id"), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    original_name = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=True)
    mime_type = db.Column(db.String(255), nullable=False)
    extension = db.Column(db.String(24), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False)
    provider = db.Column(db.String(32), nullable=False, default="local")
    drive_id = db.Column(db.String(255), nullable=True)
    drive_item_id = db.Column(db.String(255), nullable=True)
    web_url = db.Column(db.String(1000), nullable=True)
    folder_path = db.Column(db.String(500), nullable=True)
    thumbnail_path = db.Column(db.String(500), nullable=True)
    upload_status = db.Column(db.String(32), nullable=False, default="pending")
    local_temp_path = db.Column(db.String(500), nullable=True)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)

    message = db.relationship("Message", back_populates="file_asset")
    sender = db.relationship("User", foreign_keys=[sender_id])


class SessionAudit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    session_token_hash = db.Column(db.String(128), nullable=False, unique=True, index=True)
    device_info = db.Column(db.String(255), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)

    user = db.relationship("User")
