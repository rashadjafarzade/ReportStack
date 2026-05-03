"""Test-scoped fixtures."""
from __future__ import annotations

import pytest

from steps.api_steps import bring_up, shut_down


@pytest.fixture
def api_radio_up(api_client, radio_id):
    """Power-on a radio via the backend, hand it to the test, power-off after."""
    bring_up(api_client, radio_id)
    yield api_client, radio_id
    shut_down(api_client, radio_id)
