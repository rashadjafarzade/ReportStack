"""Concrete TNC web-app page objects.

Each page exposes business-flavoured methods that read like a checklist:
LoginPage.sign_in(user, pw); DashboardPage.open_radio_panel(); etc.
"""
from __future__ import annotations

from pathlib import Path

from web.base import BasePage

# Locator JSONs sit next to this file; each page points at one. Keeping them
# as data lets QA contribute new selectors without touching Python.
_LOCATORS = Path(__file__).parent / "locators"


class LoginPage(BasePage):
    LOCATOR_FILE = str(_LOCATORS / "login.json")
    PATH = "/login"

    def open(self) -> "LoginPage":
        self.driver.get(self.base_url + self.PATH)
        self.wait_for("email_field")
        return self

    def sign_in(self, email: str, password: str) -> "DashboardPage":
        self.type("email_field", email)
        self.type("password_field", password)
        self.click("submit_button")
        return DashboardPage(self.driver, base_url=self.base_url).wait_loaded()


class DashboardPage(BasePage):
    LOCATOR_FILE = str(_LOCATORS / "dashboard.json")
    PATH = "/"

    def wait_loaded(self) -> "DashboardPage":
        self.wait_for("user_menu")
        return self

    def open_radio_panel(self) -> "RadioControlPage":
        self.click("radio_panel_link")
        return RadioControlPage(self.driver, base_url=self.base_url).wait_loaded()


class RadioControlPage(BasePage):
    LOCATOR_FILE = str(_LOCATORS / "radio_control.json")
    PATH = "/radios"

    def wait_loaded(self) -> "RadioControlPage":
        self.wait_for("radio_list")
        return self

    def select_radio(self, radio_id: str) -> "RadioControlPage":
        # Locator catalog has a CSS template — substitute the id at the
        # call site so any radio can be addressed without per-radio entries.
        by_kind, template = self.by("radio_row_by_id")
        from selenium.webdriver.common.by import By  # type: ignore
        from selenium.webdriver.support import expected_conditions as EC  # type: ignore
        from selenium.webdriver.support.ui import WebDriverWait  # type: ignore
        locator = (by_kind, template.format(id=radio_id))
        WebDriverWait(self.driver, self.DEFAULT_TIMEOUT).until(
            EC.element_to_be_clickable(locator)
        ).click()
        return self

    def set_frequency(self, mhz: float) -> "RadioControlPage":
        self.type("freq_input", f"{mhz}")
        self.click("freq_apply_button")
        return self

    def reported_frequency_mhz(self) -> float:
        return float(self.text_of("freq_readout"))

    def is_locked_indicator_on(self) -> bool:
        return "locked" in self.text_of("lock_status").lower()
