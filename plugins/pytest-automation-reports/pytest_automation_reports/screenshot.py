from __future__ import annotations

import tempfile
import os
import logging

logger = logging.getLogger("automation-reports")


def capture_screenshot(driver_or_page, name: str) -> str | None:
    """Capture a screenshot from Selenium WebDriver or Playwright Page.

    Returns the path to the saved screenshot file, or None on failure.
    """
    tmp_dir = tempfile.mkdtemp(prefix="ar_screenshots_")
    safe_name = "".join(c if c.isalnum() or c in "-_." else "_" for c in name)
    filepath = os.path.join(tmp_dir, f"{safe_name}.png")

    try:
        # Selenium WebDriver
        if hasattr(driver_or_page, "save_screenshot"):
            driver_or_page.save_screenshot(filepath)
            return filepath

        # Playwright Page
        if hasattr(driver_or_page, "screenshot"):
            driver_or_page.screenshot(path=filepath)
            return filepath

        logger.warning("Unknown driver type for screenshot capture: %s", type(driver_or_page))
        return None
    except Exception as e:
        logger.warning("Failed to capture screenshot '%s': %s", name, e)
        return None
