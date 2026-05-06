"""HTTP API client for the radio devices' backend.

This is the primary test target for the `api` marker. Tests call high-level
methods like `client.set_frequency(radio_id, 433.92)` and never assemble
URLs or JSON payloads inline.
"""
from api_client.base import APIError, BaseClient
from api_client.radio_backend import RadioBackendClient

__all__ = ["APIError", "BaseClient", "RadioBackendClient"]
