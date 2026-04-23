from __future__ import annotations

from flask import Blueprint, g, jsonify, redirect, render_template, request, url_for

from ..decorators import api_login_required
from ..extensions import db
from ..models import User
from ..services.otp import get_otp_provider, normalize_phone_number
from ..services.sessions import clear_session_cookie, create_user_session, revoke_current_session, set_session_cookie


auth_bp = Blueprint("auth", __name__)


@auth_bp.get("/")
def login_page():
    if g.get("current_user"):
        destination = "users.profile_setup_page" if not g.current_user.profile_completed else "conversations.chats_page"
        return redirect(url_for(destination))
    return render_template("login.html", bootstrap={})


@auth_bp.post("/api/auth/request-otp")
def request_otp_api():
    payload = request.get_json(silent=True) or request.form
    phone_number = payload.get("phone_number", "")

    try:
        result = get_otp_provider().request_otp(phone_number, request.remote_addr)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": "otp_request_failed", "message": str(exc)}), 400

    return jsonify(
        {
            "ok": True,
            "phone_number": result.phone_number,
            "expires_in": result.expires_in,
            "dev_code": result.dev_code,
        }
    )


@auth_bp.post("/api/auth/verify-otp")
def verify_otp_api():
    payload = request.get_json(silent=True) or request.form
    phone_number = payload.get("phone_number", "")
    code = payload.get("otp", "")

    try:
        result = get_otp_provider().verify_otp(phone_number, code)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": "otp_verify_failed", "message": str(exc)}), 400

    if not result.success:
        return jsonify({"ok": False, "error": "invalid_otp", "message": result.error}), 400

    normalized_phone = normalize_phone_number(result.phone_number or phone_number)
    user = User.query.filter_by(phone_number=normalized_phone).first()
    is_new_user = False
    if not user:
        user = User(phone_number=normalized_phone, profile_completed=False)
        db.session.add(user)
        db.session.commit()
        is_new_user = True

    session_token = create_user_session(user)
    redirect_url = url_for("users.profile_setup_page" if not user.profile_completed else "conversations.chats_page")
    response = jsonify({"ok": True, "redirect_url": redirect_url, "is_new_user": is_new_user})
    set_session_cookie(response, session_token)
    return response


@auth_bp.post("/api/auth/logout")
@api_login_required
def logout_api():
    revoke_current_session()
    response = jsonify({"ok": True, "redirect_url": url_for("auth.login_page")})
    clear_session_cookie(response)
    return response
