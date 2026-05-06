"""Smoke tests across both layers — fast, broad coverage. Run on every push.

Marker shape:  smoke + (ui|api)
Run:           pytest -m smoke
               pytest -m "smoke and ui"
"""
import pytest

from steps.api_steps import tune_and_wait_for_lock
from steps.web_steps import sign_in


# -------- API smoke ---------------------------------------------------------
@pytest.mark.smoke
@pytest.mark.api
def test_api_radio_responds_to_status(api_client, radio_id):
    """Bare-minimum check: the backend returns a status payload for the radio."""
    status = api_client.get_status(radio_id)
    assert "locked" in status, f"status payload missing 'locked' field: {status}"


@pytest.mark.smoke
@pytest.mark.api
@pytest.mark.parametrize(
    "freq_mhz",
    [88.5, 100.0, 433.92, 868.0],
    ids=["fm_low", "fm_mid", "ism_433", "ism_868"],
)
def test_api_tune_locks_within_5s(api_radio_up, freq_mhz):
    client, rid = api_radio_up
    elapsed = tune_and_wait_for_lock(client, rid, freq_mhz, timeout_seconds=5.0)
    assert elapsed < 5.0, f"lock took {elapsed:.2f}s, expected < 5"


# -------- UI smoke ----------------------------------------------------------
@pytest.mark.smoke
@pytest.mark.ui
def test_ui_login_lands_on_dashboard(fresh_session, tnc_url, tnc_credentials):
    """The TNC login form accepts valid credentials and redirects to /"""
    user, pw = tnc_credentials
    dashboard = sign_in(fresh_session, base_url=tnc_url, email=user, password=pw)
    assert dashboard.text_of("user_menu"), "user menu not visible after sign-in"
