from app.models import SessionAudit, User

from .conftest import login_with_dev_otp


def test_request_and_verify_otp_creates_session(client, app):
    verify_response = login_with_dev_otp(client, "+15550000111")
    payload = verify_response.get_json()

    assert payload["ok"] is True
    assert payload["redirect_url"] == "/profile/setup"

    with app.app_context():
        user = User.query.filter_by(phone_number="+15550000111").first()
        assert user is not None
        assert SessionAudit.query.filter_by(user_id=user.id).count() == 1


def test_existing_user_skips_profile_setup(client, completed_user):
    verify_response = login_with_dev_otp(client, completed_user)
    payload = verify_response.get_json()

    assert payload["ok"] is True
    assert payload["redirect_url"] == "/chats"


def test_logout_revokes_session(client, completed_user, app):
    login_with_dev_otp(client, completed_user)
    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 200

    with app.app_context():
        session = SessionAudit.query.first()
        assert session.revoked_at is not None
