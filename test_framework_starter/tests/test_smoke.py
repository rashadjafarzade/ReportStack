"""Smoke tests — fast, broad coverage. Run on every push."""
import pytest

from steps import tune_and_wait_for_lock


@pytest.mark.smoke
def test_radio_powers_on_and_responds(radio_up):
    """The radio must answer is_locked() after bring_up — proves the
    transport works and the device booted."""
    # If we got here, conftest.bring_up already raised on a dead radio.
    assert radio_up.is_locked() in (True, False)


@pytest.mark.smoke
@pytest.mark.feature_tune
@pytest.mark.parametrize(
    "freq_mhz",
    [88.5, 100.0, 433.92, 868.0],
    ids=["fm_low", "fm_mid", "ism_433", "ism_868"],
)
def test_tune_locks_within_5s(radio_up, freq_mhz):
    """Standard frequencies must achieve PLL lock within 5 seconds."""
    elapsed = tune_and_wait_for_lock(radio_up, freq_mhz, timeout_seconds=5.0)
    assert elapsed < 5.0, f"lock took {elapsed:.2f}s, expected < 5"
