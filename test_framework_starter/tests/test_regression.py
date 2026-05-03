"""Regression tests — full functional coverage. Run nightly.

Markers:  regression + (ui|api)
Run:      pytest -m regression
          pytest -m "regression and api and not slow"
"""
import pytest

from steps.api_steps import tune_and_wait_for_lock
from steps.web_steps import open_radio_control, set_frequency_via_ui, sign_in


# -------- API regression ---------------------------------------------------
@pytest.mark.regression
@pytest.mark.api
def test_api_rapid_retune_holds_lock(api_radio_up):
    """Re-tune across three frequencies in quick succession; the radio must
    lock on each. Catches firmware regressions where re-tuning leaves the PLL
    in a bad state."""
    client, rid = api_radio_up
    for f in (433.92, 868.0, 433.92):
        tune_and_wait_for_lock(client, rid, f, timeout_seconds=3.0)


@pytest.mark.regression
@pytest.mark.api
def test_api_status_reports_set_frequency(api_radio_up):
    """After PUT /frequency, the next GET /status echoes the same freq."""
    client, rid = api_radio_up
    client.set_frequency(rid, 433.92)
    status = client.get_status(rid)
    assert abs(float(status["freq_mhz"]) - 433.92) < 0.001


# -------- UI regression ----------------------------------------------------
@pytest.mark.regression
@pytest.mark.ui
def test_ui_set_frequency_via_radio_panel(fresh_session, tnc_url, tnc_credentials, radio_id):
    """End-to-end UI flow: log in, open the radio panel, change a frequency,
    verify the readout updates."""
    user, pw = tnc_credentials
    dashboard = sign_in(fresh_session, base_url=tnc_url, email=user, password=pw)
    radio_panel = open_radio_control(dashboard)
    set_frequency_via_ui(radio_panel, radio_id, 433.92)
    assert abs(radio_panel.reported_frequency_mhz() - 433.92) < 0.001


@pytest.mark.regression
@pytest.mark.ui
@pytest.mark.slow
def test_ui_login_logout_cycle_repeats(fresh_session, tnc_url, tnc_credentials):
    """5 login/logout cycles. Slow-marked so smoke runs can exclude it."""
    from web import LoginPage
    user, pw = tnc_credentials
    for _ in range(5):
        dashboard = LoginPage(fresh_session, base_url=tnc_url).open().sign_in(user, pw)
        dashboard.click("logout_button")
        # next iteration logs back in
