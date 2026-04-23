from __future__ import annotations

from functools import wraps

from flask import g, jsonify, redirect, request, url_for


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not g.get("current_user"):
            return redirect(url_for("auth.login_page", next=request.full_path))
        return view(*args, **kwargs)

    return wrapped_view


def api_login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if not g.get("current_user"):
            return jsonify({"ok": False, "error": "auth_required", "message": "Please sign in to continue."}), 401
        return view(*args, **kwargs)

    return wrapped_view
