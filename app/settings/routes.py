from __future__ import annotations

from flask import Blueprint, g, jsonify, redirect, render_template, request, url_for

from ..decorators import api_login_required, login_required
from ..extensions import db
from ..services.conversations import list_user_conversations
from ..services.serializers import serialize_user


settings_bp = Blueprint("settings", __name__)


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


@settings_bp.get("/settings")
@login_required
def settings_page():
    if not g.current_user.profile_completed:
        return redirect(url_for("users.profile_setup_page"))
    conversations = list_user_conversations(g.current_user)
    storage_url = url_for("files.gallery_page", conversation_id=conversations[0].id) if conversations else url_for("files.files_landing")
    return render_template(
        "settings.html",
        storage_url=storage_url,
        bootstrap={"user": serialize_user(g.current_user), "storageUrl": storage_url},
    )


@settings_bp.route("/api/me/settings", methods=["PATCH", "POST"])
@api_login_required
def update_settings_api():
    payload = request.get_json(silent=True) or request.form
    g.current_user.theme = payload.get("theme", g.current_user.theme) or "light"
    g.current_user.browser_notifications_enabled = parse_bool(
        payload.get("browser_notifications_enabled"),
        g.current_user.browser_notifications_enabled,
    )
    g.current_user.sound_enabled = parse_bool(payload.get("sound_enabled"), g.current_user.sound_enabled)
    g.current_user.vibration_enabled = parse_bool(payload.get("vibration_enabled"), g.current_user.vibration_enabled)
    g.current_user.read_receipts_enabled = parse_bool(
        payload.get("read_receipts_enabled"),
        g.current_user.read_receipts_enabled,
    )
    g.current_user.last_seen_visibility = parse_bool(
        payload.get("last_seen_visibility"),
        g.current_user.last_seen_visibility,
    )
    g.current_user.media_auto_download_enabled = parse_bool(
        payload.get("media_auto_download_enabled"),
        g.current_user.media_auto_download_enabled,
    )
    db.session.commit()
    return jsonify({"ok": True, "user": serialize_user(g.current_user)})
