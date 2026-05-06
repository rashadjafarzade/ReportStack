"""HTTP client for the radio devices' backend.

The backend is the primary integration target — tests POST tune commands,
GET status, and so on, against a REST API rather than driving radios over
SSH. (For low-level fixture setup use radios/ instead.)
"""
from __future__ import annotations

from typing import Any

from api_client.base import APIError, BaseClient


class RadioBackendClient(BaseClient):
    """High-level methods for the radio backend's REST surface.

    Endpoint paths are kept here in one place so a backend route change is a
    one-line edit, not a sweep across every test file.
    """

    # ---- inventory / discovery -------------------------------------------
    def list_radios(self) -> list[dict[str, Any]]:
        return self.get("/api/v1/radios")

    def get_radio(self, radio_id: str) -> dict[str, Any]:
        return self.get(f"/api/v1/radios/{radio_id}")

    # ---- power ------------------------------------------------------------
    def power_on(self, radio_id: str) -> dict[str, Any]:
        return self.post(f"/api/v1/radios/{radio_id}/power", json={"state": "on"})

    def power_off(self, radio_id: str) -> dict[str, Any]:
        return self.post(f"/api/v1/radios/{radio_id}/power", json={"state": "off"})

    # ---- tune / measure ---------------------------------------------------
    def set_frequency(self, radio_id: str, freq_mhz: float) -> dict[str, Any]:
        return self.put(
            f"/api/v1/radios/{radio_id}/frequency",
            json={"mhz": freq_mhz},
        )

    def get_status(self, radio_id: str) -> dict[str, Any]:
        """Returns at minimum: locked (bool), rssi_dbm (int), freq_mhz (float)."""
        return self.get(f"/api/v1/radios/{radio_id}/status")

    def is_locked(self, radio_id: str) -> bool:
        return bool(self.get_status(radio_id).get("locked", False))

    def read_rssi(self, radio_id: str) -> int:
        rssi = self.get_status(radio_id).get("rssi_dbm")
        if rssi is None:
            raise APIError(f"radio {radio_id} did not return rssi_dbm")
        return int(rssi)

    # ---- diagnostics ------------------------------------------------------
    def get_metrics(self, radio_id: str) -> dict[str, Any]:
        """Backend-side performance counters — useful for NFR tests."""
        return self.get(f"/api/v1/radios/{radio_id}/metrics")
