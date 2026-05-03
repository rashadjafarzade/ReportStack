"""Tuning steps."""
from __future__ import annotations

import time

from radios.base import RadioDevice, RadioError


def tune_and_wait_for_lock(
    device: RadioDevice,
    freq_mhz: float,
    *,
    timeout_seconds: float = 5.0,
    poll_interval: float = 0.1,
) -> float:
    """Tune to ``freq_mhz`` and wait until the radio reports lock.

    Returns the elapsed lock time in seconds. Used by both regression tests
    (assert lock happens at all) and KPI tests (assert lock time < threshold).
    """
    start = time.monotonic()
    device.tune(freq_mhz)
    deadline = start + timeout_seconds
    while time.monotonic() < deadline:
        if device.is_locked():
            return time.monotonic() - start
        time.sleep(poll_interval)
    raise RadioError(
        f"{device.name} failed to lock on {freq_mhz} MHz within {timeout_seconds}s"
    )
