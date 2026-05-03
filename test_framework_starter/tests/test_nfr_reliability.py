"""NFR — reliability.

Long-running stability. Catches leaks, drift, and degradation that
short tests miss.

Run:  pytest -m "nfr and nfr_reliability"
"""
import pytest

from steps.api_steps import bring_up, shut_down, tune_and_wait_for_lock
from steps.nfr_steps import repeated_cycle


@pytest.mark.nfr
@pytest.mark.nfr_reliability
@pytest.mark.slow
def test_reliability_50_power_tune_cycles(api_client, radio_id, request):
    """50 power-up / tune / power-down cycles. Expect ≥ 95% success.

    Bails out early if more than 5 cycles fail in a row (probably hardware
    rather than flakiness — don't waste an hour confirming it)."""
    succeeded = repeated_cycle(
        setup=lambda: bring_up(api_client, radio_id),
        action=lambda: tune_and_wait_for_lock(api_client, radio_id, 433.92, timeout_seconds=3.0),
        cycles=50,
        fail_after=5,
    )
    request.node.user_properties.append(("kpi:reliability_cycles_passed", succeeded))
    assert succeeded >= 48, f"only {succeeded}/50 cycles succeeded"
    # Ensure radio is off after the test no matter what.
    shut_down(api_client, radio_id)


@pytest.mark.nfr
@pytest.mark.nfr_reliability
@pytest.mark.slow
def test_reliability_status_no_drift_over_5min(api_client, radio_id, request):
    """For 5 minutes, sample status every second. The locked state must not
    flap and the reported frequency must not drift."""
    import time

    api_client.set_frequency(radio_id, 433.92)
    start = time.monotonic()
    samples: list[dict] = []
    while time.monotonic() - start < 300.0:
        samples.append(api_client.get_status(radio_id))
        time.sleep(1.0)

    flaps = sum(
        1 for a, b in zip(samples, samples[1:])
        if bool(a.get("locked")) != bool(b.get("locked"))
    )
    freqs = [float(s["freq_mhz"]) for s in samples if "freq_mhz" in s]
    drift = max(freqs) - min(freqs) if freqs else 0.0

    request.node.user_properties.append(("kpi:reliability_lock_flaps", flaps))
    request.node.user_properties.append(("kpi:reliability_freq_drift_mhz", drift))

    assert flaps == 0, f"lock flapped {flaps} times in 5 minutes"
    assert drift < 0.005, f"frequency drifted {drift:.6f} MHz"
