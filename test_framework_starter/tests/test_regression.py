"""Regression tests — full functional coverage. Run nightly."""
import pytest

from steps import measure_rssi_average, tune_and_wait_for_lock


@pytest.mark.regression
@pytest.mark.team_allstars
@pytest.mark.feature_measure
def test_rssi_within_expected_range_at_known_frequency(radio_up):
    """At the lab's reference 433.92 MHz beacon, median RSSI should sit
    in the [-90, -40] dBm window. Wider than typical floor noise but
    tight enough to flag a regression in the AGC path."""
    tune_and_wait_for_lock(radio_up, 433.92)
    rssi = measure_rssi_average(radio_up, samples=5)
    assert -90 <= rssi <= -40, f"RSSI {rssi} dBm outside [-90, -40]"


@pytest.mark.regression
@pytest.mark.team_gogeta
@pytest.mark.feature_tune
def test_rapid_retune_does_not_lose_lock(radio_up):
    """Re-tune across three frequencies in quick succession; the radio
    must lock on each. Catches firmware regressions where re-tuning
    leaves the PLL in a bad state."""
    for f in (433.92, 868.0, 433.92):
        tune_and_wait_for_lock(radio_up, f, timeout_seconds=3.0)


@pytest.mark.regression
@pytest.mark.slow
def test_bringup_shutdown_cycle_repeated(radio_up):
    """Power-cycle the radio 10 times; lock must succeed every time.
    Slow (~60s); slow marker so smoke runs can exclude it via -m 'not slow'."""
    from steps import bring_up, shut_down
    for i in range(10):
        shut_down(radio_up)
        bring_up(radio_up)
        tune_and_wait_for_lock(radio_up, 433.92), f"cycle {i} failed"
