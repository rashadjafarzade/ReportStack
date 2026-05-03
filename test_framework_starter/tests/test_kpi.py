"""KPI tests — measure performance and assert against thresholds.

Every KPI test pushes its measurement to ReportStack as test metadata so the
Trends page can plot the value over time. The pytest-automation-reports
plugin reads `request.node.user_properties` and forwards anything tagged
with the "kpi:" prefix as a numeric metric.
"""
import pytest

from steps import tune_and_wait_for_lock


@pytest.mark.kpi
@pytest.mark.feature_tune
def test_lock_time_at_433mhz_under_2s(radio_up, request):
    """Lock time at 433.92 MHz must be < 2.0 seconds.

    The measured value is attached to the ReportStack test item so the
    Trends widget can graph regression over the last N nightly runs.
    """
    elapsed = tune_and_wait_for_lock(radio_up, 433.92, timeout_seconds=5.0)
    request.node.user_properties.append(("kpi:lock_time_433_seconds", elapsed))
    assert elapsed < 2.0, f"lock time {elapsed:.3f}s exceeded 2.0s budget"
