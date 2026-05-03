"""Power-cycle steps."""
from __future__ import annotations

import time

from radios.base import RadioDevice, RadioError


def bring_up(device: RadioDevice, *, settle_seconds: float = 1.5) -> None:
    """Power on the radio and wait for it to settle.

    Settle time is the empirically-observed delay between `power_on` and the
    radio being ready to accept further commands. Tweak per device family.
    """
    device.power_on()
    time.sleep(settle_seconds)
    # Sanity check: if reading the lock state itself fails after settle, the
    # device hasn't booted. Surface that as a clean RadioError so the test
    # detail page in ReportStack shows something actionable.
    try:
        device.is_locked()
    except RadioError:
        raise RadioError(f"{device.name} did not respond after power_on") from None


def shut_down(device: RadioDevice) -> None:
    """Power off; never raise — used in teardown paths where errors don't matter."""
    try:
        device.power_off()
    except RadioError:
        pass
