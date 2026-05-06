"""NFR measurement helpers — used by performance, stress, and reliability tests."""
from __future__ import annotations

import statistics
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from api_client import APIError, RadioBackendClient


# ---- nfr_performance --------------------------------------------------------
def measure_call_latency(
    fn: Callable[[], object],
    *,
    samples: int = 30,
    warmup: int = 3,
) -> dict[str, float]:
    """Call `fn` `samples` times and return p50/p95/p99 latency in seconds.

    Discards the first `warmup` calls so JIT / connection-pool warmup
    doesn't pollute the percentiles.
    """
    for _ in range(warmup):
        fn()
    timings: list[float] = []
    for _ in range(samples):
        t0 = time.monotonic()
        fn()
        timings.append(time.monotonic() - t0)
    timings.sort()
    return {
        "p50": statistics.median(timings),
        "p95": timings[int(0.95 * len(timings))],
        "p99": timings[min(int(0.99 * len(timings)), len(timings) - 1)],
        "max": timings[-1],
    }


# ---- nfr_stress -------------------------------------------------------------
def hammer_endpoint(
    fn: Callable[[], object],
    *,
    workers: int = 8,
    duration_seconds: float = 10.0,
) -> dict[str, int]:
    """Concurrently call `fn` for `duration_seconds`. Returns counts by outcome.

    A canonical NFR-stress shape: backend should serve correctly under N
    concurrent callers, or fail fast with proper status codes — no hangs,
    no 500-storms.
    """
    successes = 0
    api_errors = 0
    other_errors = 0
    deadline = time.monotonic() + duration_seconds

    def worker() -> tuple[int, int, int]:
        s = a = o = 0
        while time.monotonic() < deadline:
            try:
                fn()
                s += 1
            except APIError:
                a += 1
            except Exception:
                o += 1
        return s, a, o

    with ThreadPoolExecutor(max_workers=workers) as pool:
        for s, a, o in pool.map(lambda _: worker(), range(workers)):
            successes += s
            api_errors += a
            other_errors += o
    return {
        "successes": successes,
        "api_errors": api_errors,
        "other_errors": other_errors,
        "total": successes + api_errors + other_errors,
    }


# ---- nfr_reliability --------------------------------------------------------
def repeated_cycle(
    setup: Callable[[], None],
    action: Callable[[], None],
    *,
    cycles: int = 100,
    fail_after: int = 0,
) -> int:
    """Run setup + action `cycles` times. Returns the number that succeeded.

    `fail_after` is an optional hard stop — abort once that many failures
    have accumulated, so a broken radio doesn't burn an hour proving
    repeatedly that it's broken.
    """
    failures = 0
    succeeded = 0
    for _ in range(cycles):
        try:
            setup()
            action()
            succeeded += 1
        except Exception:
            failures += 1
            if fail_after and failures >= fail_after:
                break
    return succeeded
