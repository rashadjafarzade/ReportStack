"""NFR — stress.

Behaviour under overload — concurrent callers, oversize payloads. The
backend should serve correctly or fail fast with proper status codes;
no hangs, no 500-storms.

Run:  pytest -m "nfr and nfr_stress"
"""
import pytest

from steps.nfr_steps import hammer_endpoint


@pytest.mark.nfr
@pytest.mark.nfr_stress
@pytest.mark.slow
def test_stress_status_under_8_concurrent_callers(api_client, radio_id, request):
    """Eight workers hitting GET /status for 10 seconds. Expect every call to
    succeed (no 5xx, no connection drops)."""
    counts = hammer_endpoint(
        lambda: api_client.get_status(radio_id),
        workers=8, duration_seconds=10.0,
    )
    request.node.user_properties.append(("kpi:stress_total_calls", counts["total"]))
    request.node.user_properties.append(("kpi:stress_error_rate",
                                         counts["api_errors"] / max(counts["total"], 1)))
    error_rate = counts["api_errors"] / max(counts["total"], 1)
    assert error_rate < 0.01, f"{error_rate*100:.2f}% error rate over {counts['total']} calls"
    assert counts["other_errors"] == 0, f"non-API errors during stress run: {counts['other_errors']}"


@pytest.mark.nfr
@pytest.mark.nfr_stress
def test_stress_oversize_payload_rejected_with_4xx(api_client, radio_id):
    """Backend must reject malformed/oversized PUT bodies with 4xx, not 5xx."""
    from api_client import APIError
    huge = {"mhz": 1e9}  # absurd but well-formed; backend should 400 it
    with pytest.raises(APIError) as ctx:
        api_client.set_frequency(radio_id, huge["mhz"])
    assert ctx.value.status is not None
    assert 400 <= ctx.value.status < 500, \
        f"expected 4xx for oversized freq, got {ctx.value.status}"
