"""NFR — performance.

Latency / throughput thresholds against the radio backend at a steady,
single-caller workload. Each measurement is also forwarded to ReportStack as
a numeric metric so the Trends widget can plot it across nightly runs.

Run:  pytest -m "nfr and nfr_performance"
"""
import pytest

from steps.api_steps import tune_and_wait_for_lock
from steps.nfr_steps import measure_call_latency


@pytest.mark.nfr
@pytest.mark.nfr_performance
def test_perf_get_status_p95_under_50ms(api_client, radio_id, request):
    """GET /status must return p95 latency under 50 ms."""
    timings = measure_call_latency(
        lambda: api_client.get_status(radio_id), samples=50, warmup=5
    )
    request.node.user_properties.append(("kpi:status_p95_seconds", timings["p95"]))
    request.node.user_properties.append(("kpi:status_p99_seconds", timings["p99"]))
    assert timings["p95"] < 0.050, f"p95 {timings['p95']*1000:.1f}ms exceeded 50ms"


@pytest.mark.nfr
@pytest.mark.nfr_performance
def test_perf_lock_time_at_433mhz_under_2s(api_radio_up, request):
    """End-to-end lock time at the lab reference frequency must be < 2 s."""
    client, rid = api_radio_up
    elapsed = tune_and_wait_for_lock(client, rid, 433.92, timeout_seconds=5.0)
    request.node.user_properties.append(("kpi:lock_time_433_seconds", elapsed))
    assert elapsed < 2.0, f"lock time {elapsed:.3f}s exceeded 2.0s budget"
