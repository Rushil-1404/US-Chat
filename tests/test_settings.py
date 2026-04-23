from .conftest import login_with_dev_otp


def test_settings_update_persists(client, completed_user, app):
    login_with_dev_otp(client, completed_user)

    response = client.post(
        "/api/me/settings",
        json={
            "theme": "dark",
            "browser_notifications_enabled": True,
            "vibration_enabled": False,
            "read_receipts_enabled": True,
            "last_seen_visibility": False,
            "media_auto_download_enabled": True,
        },
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["ok"] is True
    assert payload["user"]["theme"] == "dark"
    assert payload["user"]["last_seen_visibility"] is False
