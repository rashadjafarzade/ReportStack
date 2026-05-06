"""High-level verbs for the radio-backend API."""
from __future__ import annotations

import time

from api_client import APIError, RadioBackendClient


def tune_and_wait_for_lock(
    client: RadioBackendClient,
    radio_id: str,
    freq_mhz: float,
    *,
    timeout_seconds: float = 5.0,
    poll_interval: float = 0.1,
) -> float:
    """Set the frequency and poll status until lock. Returns elapsed seconds.

    Used by both functional regression tests (assert lock at all) and
    nfr_performance tests (assert lock < threshold).
    """
    start = time.monotonic()
    client.set_frequency(radio_id, freq_mhz)
    deadline = start + timeout_seconds
    while time.monotonic() < deadline:
        if client.is_locked(radio_id):
            return time.monotonic() - start
        time.sleep(poll_interval)
    raise APIError(
        f"radio {radio_id} did not lock on {freq_mhz} MHz within {timeout_seconds}s"
    )


def bring_up(client: RadioBackendClient, radio_id: str, *, settle: float = 1.0) -> None:
    client.power_on(radio_id)
    time.sleep(settle)
    # Sanity: status endpoint must respond — otherwise the device hasn't booted.
    client.get_status(radio_id)


def shut_down(client: RadioBackendClient, radio_id: str) -> None:
    """Best-effort power-off used in teardown paths."""
    try:
        client.power_off(radio_id)
    except APIError:
        pass
