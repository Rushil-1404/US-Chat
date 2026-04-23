from app.extensions import db
from app.models import Conversation

from .conftest import login_with_dev_otp


def test_resolve_by_phone_creates_unique_conversation(client, completed_user, second_completed_user, app):
    login_with_dev_otp(client, completed_user)

    first_response = client.post("/api/conversations/resolve-by-phone", json={"phone_number": second_completed_user})
    second_response = client.post("/api/conversations/resolve-by-phone", json={"phone_number": second_completed_user})

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    assert first_response.get_json()["conversation"]["id"] == second_response.get_json()["conversation"]["id"]

    with app.app_context():
        assert db.session.query(Conversation).count() == 1


def test_resolve_by_phone_returns_not_found_for_missing_user(client, completed_user):
    login_with_dev_otp(client, completed_user)

    response = client.post("/api/conversations/resolve-by-phone", json={"phone_number": "+15559999999"})

    assert response.status_code == 404
    assert response.get_json()["error"] == "user_not_found"
