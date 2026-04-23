from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from flask import current_app, g, request

from ..extensions import db
from ..models import SessionAudit, User, utcnow


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_user_session(user: User) -> str:
    token = secrets.token_urlsafe(32)
    session = SessionAudit(
        user_id=user.id,
        session_token_hash=hash_session_token(token),
        device_info=(request.user_agent.string or "")[:255],
        ip_address=request.remote_addr,
        expires_at=utcnow() + timedelta(days=current_app.config["SESSION_LIFETIME_DAYS"]),
    )
    db.session.add(session)
    db.session.commit()
    return token


def set_session_cookie(response, token: str) -> None:
    response.set_cookie(
        current_app.config["SESSION_COOKIE_NAME"],
        token,
        httponly=True,
        secure=current_app.config["SESSION_COOKIE_SECURE"],
        samesite=current_app.config["SESSION_COOKIE_SAMESITE"],
        max_age=current_app.config["SESSION_LIFETIME_DAYS"] * 24 * 60 * 60,
    )


def clear_session_cookie(response) -> None:
    response.delete_cookie(current_app.config["SESSION_COOKIE_NAME"])


def resolve_user_from_token(token: str | None) -> tuple[User | None, SessionAudit | None]:
    if not token:
        return None, None
    session = SessionAudit.query.filter_by(session_token_hash=hash_session_token(token), revoked_at=None).first()
    if not session or session.expires_at < utcnow():
        return None, None
    return session.user, session


def load_request_session() -> None:
    token = request.cookies.get(current_app.config["SESSION_COOKIE_NAME"])
    user, session = resolve_user_from_token(token)
    g.current_user = user
    g.current_session = session


def revoke_current_session() -> None:
    session = g.get("current_session")
    if session and session.revoked_at is None:
        session.revoked_at = utcnow()
        db.session.commit()


def touch_last_seen(user: User) -> None:
    now = utcnow()
    if user.last_seen_at and (now - user.last_seen_at) < timedelta(seconds=30):
        return
    user.last_seen_at = now
    db.session.commit()
