"""High-level verbs for the TNC web UI."""
from __future__ import annotations

from web import DashboardPage, LoginPage, RadioControlPage


def sign_in(driver, *, base_url: str, email: str, password: str) -> DashboardPage:
    """Open /login, submit credentials, and return the dashboard page."""
    return LoginPage(driver, base_url=base_url).open().sign_in(email, password)


def open_radio_control(dashboard: DashboardPage) -> RadioControlPage:
    return dashboard.open_radio_panel()


def set_frequency_via_ui(page: RadioControlPage, radio_id: str, freq_mhz: float) -> None:
    page.select_radio(radio_id).set_frequency(freq_mhz)
