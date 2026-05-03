"""Measurement steps — low-level SSH/serial fallback. NFR measurement helpers
that run against the HTTP backend live in ``steps/nfr_steps.py``."""
from __future__ import annotations

import statistics
import time

from radios.base import RadioDevice


def measure_rssi_average(
    device: RadioDevice, *, samples: int = 5, interval: float = 0.2
) -> int:
    """Take ``samples`` RSSI readings and return their median in dBm.

    Median over a small window smooths the spikes typical of consumer radios
    without introducing the heavy averaging that would mask real drift.
    """
    if samples < 1:
        raise ValueError("samples must be >= 1")
    readings: list[int] = []
    for _ in range(samples):
        readings.append(device.read_rssi())
        time.sleep(interval)
    return int(statistics.median(readings))
