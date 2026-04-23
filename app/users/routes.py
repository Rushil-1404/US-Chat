from __future__ import annotations

from flask import Blueprint, g, jsonify, redirect, render_template, request, url_for

from ..decorators import api_login_required, login_required
from ..extensions import db
from ..services.files import UploadValidationError, upload_avatar_for_user
from ..services.serializers import serialize_user


users_bp = Blueprint("users", __name__)


@users_bp.get("/profile/setup")
@login_required
def profile_setup_page():
    if g.current_user.profile_completed:
        return redirect(url_for("conversations.chats_page"))
    return render_template("profile_setup.html", bootstrap={"user": serialize_user(g.current_user)})


@users_bp.route("/api/me/profile", methods=["PATCH", "POST"])
@api_login_required
def update_profile_api():
    payload = request.form if request.form else (request.get_json(silent=True) or {})
    display_name = (payload.get("display_name") or g.current_user.display_name or "").strip()
    status_text = (payload.get("status_text") or g.current_user.status_text or "").strip()

    if not display_name:
        return jsonify({"ok": False, "error": "display_name_required", "message": "Display name is required."}), 400

    g.current_user.display_name = display_name
    g.current_user.status_text = status_text
    g.current_user.profile_completed = True

    avatar = request.files.get("avatar")
    if avatar and avatar.filename:
        try:
            upload_avatar_for_user(g.current_user, avatar)
        except UploadValidationError as exc:
            db.session.rollback()
            return jsonify({"ok": False, "error": "avatar_upload_failed", "message": str(exc)}), 400

    db.session.commit()
    return jsonify(
        {
            "ok": True,
            "user": serialize_user(g.current_user),
            "redirect_url": url_for("conversations.chats_page"),
        }
    )
