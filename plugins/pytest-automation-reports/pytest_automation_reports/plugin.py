import logging
import os
import time

import pytest

from .config import add_options, get_option
from .client import ARClient
from .log_capture import LogCaptureHandler
from .screenshot import capture_screenshot

logger = logging.getLogger("automation-reports")


def pytest_addoption(parser):
    add_options(parser)


@pytest.hookimpl(trylast=True)
def pytest_configure(config):
    url = get_option(config, "ar_url", "AR_URL")
    if not url:
        return
    plugin = AutomationReportsPlugin(config)
    config.pluginmanager.register(plugin, "automation-reports")


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    if not hasattr(item, "_ar_reports"):
        item._ar_reports = []
    item._ar_reports.append(rep)

    # Auto-screenshot on call-phase failure
    if call.when == "call" and rep.failed:
        driver = getattr(item, "_ar_driver", None)
        if driver:
            path = capture_screenshot(driver, f"failure_{item.name}")
            if path:
                if not hasattr(item, "_ar_screenshots_extra"):
                    item._ar_screenshots_extra = []
                item._ar_screenshots_extra.append(path)


class AutomationReportsPlugin:
    def __init__(self, config):
        self.config = config
        url = get_option(config, "ar_url", "AR_URL")
        self.client = ARClient(url)
        self.launch_name = get_option(config, "ar_launch_name", "AR_LAUNCH_NAME", "pytest run")
        self.launch_desc = get_option(config, "ar_launch_description", "AR_LAUNCH_DESCRIPTION")
        self.auto_analyze = (
            config.getoption("ar_auto_analyze", default=False)
            or os.environ.get("AR_AUTO_ANALYZE", "").lower() in ("1", "true", "yes")
        )

        self.launch_id = None
        self.log_handler = LogCaptureHandler()
        self.log_handler.setLevel(logging.DEBUG)
        self._start_times: dict[str, float] = {}
        self._has_failures = False

    def pytest_sessionstart(self, session):
        try:
            launch = self.client.create_launch(self.launch_name, self.launch_desc)
            self.launch_id = launch["id"]
            logger.info("Created launch #%s", self.launch_id)
        except Exception as e:
            logger.error("Failed to create launch: %s", e)

    def pytest_runtest_setup(self, item):
        self.log_handler.reset()
        logging.getLogger().addHandler(self.log_handler)
        self._start_times[item.nodeid] = time.time()

    def pytest_runtest_teardown(self, item):
        logging.getLogger().removeHandler(self.log_handler)

        if not self.launch_id:
            return

        start = self._start_times.pop(item.nodeid, None)
        duration_ms = int((time.time() - start) * 1000) if start else None

        status = "PASSED"
        error_message = None
        stack_trace = None

        for phase_report in getattr(item, "_ar_reports", []):
            if phase_report.failed:
                status = "FAILED"
                self._has_failures = True
                if phase_report.longrepr:
                    error_message = str(phase_report.longrepr).split("\n")[0]
                    stack_trace = str(phase_report.longrepr)
                break
            elif phase_report.skipped:
                status = "SKIPPED"

        try:
            test_item = self.client.create_test_item(self.launch_id, {
                "name": item.name,
                "suite": item.module.__name__ if hasattr(item, "module") else None,
                "status": status,
                "duration_ms": duration_ms,
                "error_message": error_message,
                "stack_trace": stack_trace,
            })
            item_id = test_item["id"]

            log_records = self.log_handler.get_records()
            if log_records:
                self.client.batch_create_logs(self.launch_id, item_id, log_records)

            for screenshot_path in getattr(item, "_ar_screenshots_extra", []):
                try:
                    filename = os.path.basename(screenshot_path)
                    self.client.upload_attachment(self.launch_id, item_id, screenshot_path, filename)
                except Exception as e:
                    logger.warning("Failed to upload screenshot: %s", e)

        except Exception as e:
            logger.error("Failed to report test item '%s': %s", item.name, e)

    def pytest_sessionfinish(self, session, exitstatus):
        if not self.launch_id:
            return

        if self._has_failures:
            status = "FAILED"
        elif exitstatus != 0:
            # Session aborted before any test reported failure
            # (collection error, INTERNALERROR, no tests collected, etc.)
            status = "FAILED"
        else:
            status = "PASSED"

        try:
            self.client.finish_launch(self.launch_id, status)
            logger.info("Finished launch #%s with status %s (exitstatus=%s)", self.launch_id, status, exitstatus)

            if self.auto_analyze and self._has_failures:
                self.client.trigger_analysis(self.launch_id)
                logger.info("Triggered AI analysis for launch #%s", self.launch_id)
        except Exception as e:
            logger.error("Failed to finish launch: %s", e)

@pytest.fixture
def report_screenshot(request):
    """Fixture to capture a screenshot and queue it for upload."""

    def _capture(driver_or_page, name="screenshot"):
        path = capture_screenshot(driver_or_page, name)
        if path:
            if not hasattr(request.node, "_ar_screenshots_extra"):
                request.node._ar_screenshots_extra = []
            request.node._ar_screenshots_extra.append(path)

    yield _capture
