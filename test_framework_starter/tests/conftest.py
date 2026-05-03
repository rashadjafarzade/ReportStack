"""Test-scoped fixtures (per-test setup, not per-session)."""
from __future__ import annotations

import pytest

from radios.base import RadioDevice
from steps import bring_up, shut_down


@pytest.fixture
def radio_up(radio: RadioDevice) -> RadioDevice:
    """Bring the radio up before the test, power off after.

    Most tests need a running radio; depend on this rather than on `radio`
    directly so the boot/shutdown sequence is consistent.
    """
    bring_up(radio)
    yield radio
    shut_down(radio)
