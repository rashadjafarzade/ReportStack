"""BasePage — shared helpers for every Selenium page object.

Replaces Osprey's BasePage. Provides explicit-wait wrappers, attachment-
on-failure helpers, and a JSON-locator-catalog hook so locator strings live
in data files rather than Python code (the same trick Osprey used).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping

from selenium.common.exceptions import (  # type: ignore
    NoSuchElementException,
    TimeoutException,
)
from selenium.webdriver.common.by import By  # type: ignore
from selenium.webdriver.remote.webdriver import WebDriver  # type: ignore
from selenium.webdriver.remote.webelement import WebElement  # type: ignore
from selenium.webdriver.support import expected_conditions as EC  # type: ignore
from selenium.webdriver.support.ui import WebDriverWait  # type: ignore


class WebError(RuntimeError):
    """Raised when a page-level interaction times out or doesn't find an element."""


# Map "by" strings in the locator JSON to selenium By constants.
_BY_MAP: dict[str, str] = {
    "id": By.ID,
    "css": By.CSS_SELECTOR,
    "xpath": By.XPATH,
    "name": By.NAME,
    "link_text": By.LINK_TEXT,
}


class BasePage:
    """Common ancestor for every TNC page object."""

    #: Default explicit-wait timeout (seconds).
    DEFAULT_TIMEOUT = 10.0

    #: Override in subclasses with the path to the locator JSON for this page.
    LOCATOR_FILE: str | None = None

    def __init__(self, driver: WebDriver, *, base_url: str) -> None:
        self.driver = driver
        self.base_url = base_url.rstrip("/")
        self.locators: dict[str, tuple[str, str]] = {}
        if self.LOCATOR_FILE:
            self._load_locators(self.LOCATOR_FILE)

    # ---- locator catalog -------------------------------------------------
    def _load_locators(self, path: str) -> None:
        p = Path(path)
        if not p.exists():
            raise WebError(f"locator file not found: {p}")
        raw = json.loads(p.read_text())
        for key, entry in raw.items():
            by = entry.get("by", "css").lower()
            if by not in _BY_MAP:
                raise WebError(f"{p}: unknown by={by!r} for locator {key!r}")
            self.locators[key] = (_BY_MAP[by], entry["value"])

    def by(self, key: str) -> tuple[str, str]:
        if key not in self.locators:
            raise WebError(f"unknown locator {key!r} on {type(self).__name__}")
        return self.locators[key]

    # ---- waits ------------------------------------------------------------
    def wait_for(self, key: str, *, timeout: float | None = None) -> WebElement:
        try:
            return WebDriverWait(self.driver, timeout or self.DEFAULT_TIMEOUT).until(
                EC.visibility_of_element_located(self.by(key))
            )
        except TimeoutException as e:
            raise WebError(f"{key!r} not visible within {timeout}s") from e

    def wait_clickable(self, key: str, *, timeout: float | None = None) -> WebElement:
        try:
            return WebDriverWait(self.driver, timeout or self.DEFAULT_TIMEOUT).until(
                EC.element_to_be_clickable(self.by(key))
            )
        except TimeoutException as e:
            raise WebError(f"{key!r} not clickable within {timeout}s") from e

    # ---- common interactions ---------------------------------------------
    def click(self, key: str) -> None:
        self.wait_clickable(key).click()

    def type(self, key: str, value: str) -> None:
        el = self.wait_for(key)
        el.clear()
        el.send_keys(value)

    def text_of(self, key: str) -> str:
        return self.wait_for(key).text

    def is_present(self, key: str) -> bool:
        try:
            self.driver.find_element(*self.by(key))
            return True
        except NoSuchElementException:
            return False

    # ---- screenshots / attachments ---------------------------------------
    def screenshot(self, dest: Path) -> Path:
        """Save a PNG screenshot to `dest`. Returns the path."""
        dest.parent.mkdir(parents=True, exist_ok=True)
        self.driver.save_screenshot(str(dest))
        return dest
