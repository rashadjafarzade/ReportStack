---
name: automation-architect
description: Design, upgrade, and maintain the TNC test automation framework. Use this skill when the user asks about framework architecture, adding new test modules, restructuring test layers, integrating with ReportStack/Jama/Jira, improving CI/CD test pipelines, or migrating patterns from the Osprey framework. Trigger on phrases like "framework", "page object", "test architecture", "steps layer", "locators", "conftest", "fixtures", "Jama integration", "nightly pipeline", or any mention of TNC automation design decisions.
---

# TNC Automation Architect Skill

## Purpose

Guide the evolution of the TWT Network Controller (TNC) automation framework from its current 3-layer Selenium/pytest design toward an enterprise-grade architecture, drawing proven patterns from the Osprey (DIRECTV) framework while keeping TNC's Python/pytest identity.

## Current State — TNC Framework

```
Language:    Python 3.10+
Runner:      pytest 7.1.3
Browser:     Selenium WebDriver 4.5.0 (Firefox/GeckoDriver)
Reporting:   pytest-html, Jira (pytest-jira), ReportStack (pytest-automation-reports)
CI/CD:       Jenkins + Docker
Target:      Trellisware Network Controller (TNC) web UI
Protocols:   REST API, MQTT, Protobuf, SSH (radio communication)
Waveforms:   TSM, Katana/Narrowband, Programming Mode
```

### Current Architecture (3-layer)

```
Test_Cases/          →  pytest test classes with markers
TNC/                 →  Page Object Model (Selenium interactions + locators)
Helper/              →  Radio communication, config, protobuf, utilities
```

### Current Markers (40+)

Waveform: `@pytest.mark.TSM`, `@pytest.mark.Katana`, `@pytest.mark.NB`
Mode: `@pytest.mark.programming_mode`, `@pytest.mark.default`
Functional: `@pytest.mark.dashboard`, `@pytest.mark.devices`, `@pytest.mark.remote_control`, `@pytest.mark.gps`, `@pytest.mark.networking`, `@pytest.mark.voice`

### Current Config

- `Configuration/configuration.ini` — headless, URL, wait time, resolution, expected results
- `pytest.ini` — markers, log format, CLI options
- Environment vars: `AR_URL`, `AR_TOKEN`, `AR_PROJECT`

---

## Target Architecture (4-layer)

```
Test_Cases/          →  pytest tests (thin: call steps, assert)
Steps/               →  Business-logic workflows (multi-page orchestration)  [NEW]
TNC/                 →  Page Objects (UI interactions, explicit waits)
Locators/            →  JSON-externalized element definitions              [NEW]
Helper/              →  Radio API, MQTT, Protobuf, SSH, utilities (unchanged)
```

### Layer Responsibilities

#### Layer 1: Test Cases (`Test_Cases/`)
- One test = one scenario, single responsibility
- Tests call Steps, never Page Objects directly
- All assertions live here
- Fixtures handle setup/teardown
- Markers for categorization

```python
# Test_Cases/Devices/Remote_Control/test_frequency_change.py

@pytest.mark.TSM
@pytest.mark.devices
@pytest.mark.smoke
def test_change_frequency_tsm(device_steps, remote_control_steps, radio_config):
    """Verify frequency change via Remote Control panel for TSM waveform."""
    device_steps.open_device(radio_config.device_id)
    remote_control_steps.set_frequency(radio_config.tsm_frequency)
    remote_control_steps.save_and_wait_reboot()
    assert remote_control_steps.get_current_frequency() == radio_config.tsm_frequency
```

#### Layer 2: Steps (`Steps/`)
- Business-level operations spanning multiple pages
- Reusable across tests
- No direct Selenium calls — delegates to Page Objects
- Named by domain action, not UI action

```python
# Steps/device_steps.py

class DeviceSteps:
    def __init__(self, driver):
        self.dashboard = DashboardPage(driver)
        self.devices = DevicesPage(driver)

    def open_device(self, device_id: str):
        """Navigate to device detail from dashboard."""
        self.dashboard.click_devices_nav()
        self.devices.select_device(device_id)

    def verify_device_online(self, device_id: str) -> bool:
        self.dashboard.click_devices_nav()
        return self.devices.get_device_status(device_id) == "online"
```

```python
# Steps/remote_control_steps.py

class RemoteControlSteps:
    def __init__(self, driver, radio_helper):
        self.menu = RemoteControlMenu(driver)
        self.radio = radio_helper

    def set_frequency(self, freq: str):
        self.menu.open_remote_control_tab()
        self.menu.enter_frequency(freq)

    def save_and_wait_reboot(self):
        self.menu.click_save()
        self.radio.wait_for_radio_reboot()

    def get_current_frequency(self) -> str:
        return self.menu.read_frequency_field()
```

#### Layer 3: Page Objects (`TNC/`)
- Thin wrappers around Selenium interactions
- Load locators from JSON files
- Use explicit waits (WebDriverWait), never `time.sleep()`
- Return data or self, never raw WebElements to callers

```python
# TNC/Page/Devices_Page.py

from TNC.base_page import BasePage

class DevicesPage(BasePage):
    def __init__(self, driver):
        super().__init__(driver, locator_file="devices_page.json")

    def select_device(self, device_id: str):
        locator = self.get_locator("device_row", device_id=device_id)
        self.click(locator)

    def get_device_status(self, device_id: str) -> str:
        locator = self.get_locator("status_badge", device_id=device_id)
        return self.get_text(locator)
```

#### Layer 4: Locators (`Locators/`)
- JSON files, one per page
- Parameterized with `{placeholders}`
- Swappable per TNC version if UI changes

```json
// Locators/devices_page.json
{
  "device_row": {
    "by": "xpath",
    "value": "//tr[contains(., '{device_id}')]"
  },
  "status_badge": {
    "by": "css",
    "value": "[data-testid='device-status-{device_id}']"
  },
  "settings_btn": {
    "by": "css",
    "value": "#device-settings-{device_id}"
  }
}
```

#### BasePage — Locator Loader

```python
# TNC/base_page.py

import json
from pathlib import Path
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

LOCATOR_DIR = Path(__file__).parent.parent / "Locators"

BY_MAP = {"css": By.CSS_SELECTOR, "xpath": By.XPATH, "id": By.ID}

class BasePage:
    def __init__(self, driver, locator_file: str, timeout: int = 25):
        self.driver = driver
        self.wait = WebDriverWait(driver, timeout)
        self._locators = {}
        if locator_file:
            with open(LOCATOR_DIR / locator_file) as f:
                self._locators = json.load(f)

    def get_locator(self, name: str, **kwargs) -> tuple:
        entry = self._locators[name]
        value = entry["value"].format(**kwargs) if kwargs else entry["value"]
        return (BY_MAP[entry["by"]], value)

    def click(self, locator: tuple):
        self.wait.until(EC.element_to_be_clickable(locator)).click()

    def get_text(self, locator: tuple) -> str:
        return self.wait.until(EC.visibility_of_element_located(locator)).text

    def send_keys(self, locator: tuple, text: str):
        el = self.wait.until(EC.visibility_of_element_located(locator))
        el.clear()
        el.send_keys(text)
```

#### Helper Layer (unchanged)
- `Radio_Helper.py` — REST, MQTT, Protobuf, SSH
- `Configuration/` — INI files, Firefox profiles
- Utilities, custom exceptions

---

## Suite Organization

No team-based suites. Organized by **execution tier** and **waveform**.

### Execution Tiers

| Tier | Marker | When | Purpose |
|---|---|---|---|
| Smoke | `@pytest.mark.smoke` | Every PR / pre-merge | Fast gate, critical paths only |
| Regression | `@pytest.mark.regression` | Nightly build | Full functional coverage |
| Release | `@pytest.mark.release` | Pre-release sign-off | Release candidate validation |
| NFR | `@pytest.mark.nfr` | Nightly or on-demand | Performance thresholds |

### Waveform Markers (keep existing)

`@pytest.mark.TSM`, `@pytest.mark.Katana`, `@pytest.mark.NB`, `@pytest.mark.programming_mode`

### Functional Markers (keep existing)

`@pytest.mark.dashboard`, `@pytest.mark.devices`, `@pytest.mark.remote_control`, `@pytest.mark.gps`, `@pytest.mark.networking`, `@pytest.mark.voice`, `@pytest.mark.links`, `@pytest.mark.map`, `@pytest.mark.settings`, `@pytest.mark.sip`

### Suite Config Files

```
suites/
├── smoke.ini              # pytest -c suites/smoke.ini
├── nightly_tsm.ini        # Nightly: TSM waveform full regression
├── nightly_katana.ini     # Nightly: Katana waveform full regression
├── nightly_all.ini        # Nightly: all waveforms
├── release.ini            # Release sign-off suite
└── nfr.ini                # Performance / threshold tests
```

Example:

```ini
# suites/nightly_tsm.ini
[pytest]
addopts = -m "regression and TSM" --ar-url=$AR_URL --ar-launch-name="Nightly-TSM" --ar-auto-analyze
```

---

## NFR / Performance Testing

Adapted from Osprey's `NFRBaseTest` pattern, implemented as pytest fixtures.

### Threshold Config

```json
// Configuration/nfr_thresholds.json
{
  "page_load_dashboard": {"max_seconds": 3.0, "description": "Dashboard page load"},
  "page_load_devices": {"max_seconds": 4.0, "description": "Devices page load"},
  "api_response_radio_get": {"max_seconds": 1.0, "description": "Radio GET API response"},
  "api_response_radio_post": {"max_seconds": 2.0, "description": "Radio POST API response"},
  "radio_reboot_time": {"max_seconds": 60.0, "description": "Radio reboot cycle"}
}
```

### KPI Collector Fixture

```python
# Test_Cases/conftest.py

import json, time
from pathlib import Path

class KPICollector:
    def __init__(self, thresholds: dict):
        self.thresholds = thresholds
        self.results = {}

    def record(self, metric: str, value: float):
        self.results[metric] = value

    def assert_all(self):
        failures = []
        for metric, value in self.results.items():
            threshold = self.thresholds.get(metric, {})
            max_val = threshold.get("max_seconds")
            if max_val and value > max_val:
                failures.append(f"{metric}: {value:.2f}s > {max_val}s")
        if failures:
            raise AssertionError(f"KPI thresholds exceeded:\n" + "\n".join(failures))

@pytest.fixture
def kpi_collector():
    thresholds_file = Path(__file__).parent.parent / "Configuration" / "nfr_thresholds.json"
    with open(thresholds_file) as f:
        thresholds = json.load(f)
    collector = KPICollector(thresholds)
    yield collector
    collector.assert_all()
```

### NFR Test Example

```python
@pytest.mark.nfr
@pytest.mark.TSM
def test_dashboard_load_time(kpi_collector, browser_driver):
    start = time.time()
    DashboardPage(browser_driver).load()
    kpi_collector.record("page_load_dashboard", time.time() - start)

@pytest.mark.nfr
def test_radio_api_response_time(kpi_collector, radio_helper):
    start = time.time()
    radio_helper.radio_get("/api/v1/status")
    kpi_collector.record("api_response_radio_get", time.time() - start)
```

---

## Retry / Flaky Test Resilience

```ini
# pytest.ini
[pytest]
retries = 1
retry_delay = 2
```

Use `pytest-retry` plugin. ReportStack tracks retries via `retry_of` field — the `pytest-automation-reports` plugin wires this automatically when a test is retried.

---

## Reporting Integration — ReportStack

### How It Connects

```
pytest runs
  → pytest-automation-reports plugin
    → POST /api/v1/launches/ (creates launch)
    → POST /api/v1/launches/{id}/items/ (per test)
    → POST /api/v1/launches/{id}/items/{id}/logs/batch (logs)
    → POST /api/v1/launches/{id}/items/{id}/attachments (screenshots)
    → PUT /api/v1/launches/{id}/finish (close launch)
    → POST /api/v1/launches/{id}/analyze (if --ar-auto-analyze)
```

### Launch Naming Convention

```
{waveform}-{tier}-{build_version}

Examples:
  TSM-Nightly-v6.2.1-build42
  Katana-Smoke-v6.2.1-build42
  All-Release-v6.2.1-RC1
  TSM-NFR-v6.2.1-build42
```

### CLI Usage

```bash
pytest -m "regression and TSM" \
  --ar-url=http://localhost:8000/api/v1 \
  --ar-launch-name="TSM-Nightly-v6.2.1-build42" \
  --ar-launch-description="Nightly regression for TSM waveform" \
  --ar-tags="nightly,TSM,v6.2.1" \
  --ar-auto-analyze \
  --radio "appstestnw2-0.trellisware.com"
```

### AI Failure Triage

ReportStack's `/analyze` endpoint categorizes failures using the standard DefectType enum:
- `PRODUCT_BUG` — real TNC software defect
- `AUTOMATION_BUG` — test code or locator issue
- `SYSTEM_ISSUE` — infrastructure (radio unreachable, network, hardware/firmware problems)
- `NO_DEFECT` — expected behavior, test needs updating
- `TO_INVESTIGATE` — confidence too low, needs manual review

> Note: Radio-specific hardware/firmware failures map to `SYSTEM_ISSUE`. There is no separate `RADIO_ISSUE` category — keep the enum consistent with ReportStack's data model (see CLAUDE.md).

---

## Jama Integration — Test Case Management

### Purpose

Jama is the test case management system. When a nightly build runs from Jenkins, results are automatically pushed to Jama to populate the automation results table using Jama's REST API with API key auth.

### Instance

```
URL:   https://jama.trellisware.com
Auth:  API key (header: Authorization: Bearer <api-key>)
API:   /rest/v1/ (Jama Connect may use /rest/v2/ — verify with:
       curl -H "Authorization: Bearer <key>" https://jama.trellisware.com/rest/v1/projects
       If 404, try /rest/v2/ and update JAMA_API_VERSION in jama_mapping.json)
```

### Jama Project Structure

```
Project
├── Test Cases
│   ├── UI Testing/           # TNC web UI functional tests
│   │   ├── TC-1001  Dashboard loads
│   │   ├── TC-1002  Device list populates
│   │   ├── TC-1003  ...
│   │   └── ...
│   ├── NFR/                  # Non-functional / performance tests
│   │   ├── TC-2001  Dashboard load time < 3s
│   │   ├── TC-2002  Radio API response < 1s
│   │   └── ...
│   └── Radio Device Testing/ # Radio-specific hardware tests
│       ├── TC-3001  Frequency change TSM
│       ├── TC-3002  Reboot recovery
│       └── ...
```

### Test Case ID Mapping

```json
// Configuration/jama_mapping.json
{
  "jama_url": "https://jama.trellisware.com",
  "jama_api_key": "",

  "project_key": "TNC",

  "test_plans": {
    "nightly": {"id": 0, "name": "Nightly Regression"},
    "release": {"id": 0, "name": "Release Sign-Off"}
  },

  "categories": {
    "ui_testing": {
      "folder": "UI Testing",
      "tests": {
        "Test_Cases.Dashboard.test_dashboard_loads": "TC-1001",
        "Test_Cases.Dashboard.test_dashboard_metrics": "TC-1002",
        "Test_Cases.Devices.Remote_Control.test_frequency_change_tsm": "TC-1010",
        "Test_Cases.Devices.Networking.test_ip_configuration": "TC-1020",
        "Test_Cases.Settings.test_save_settings": "TC-1030"
      }
    },
    "nfr": {
      "folder": "NFR",
      "tests": {
        "Test_Cases.NFR.test_dashboard_load_time": "TC-2001",
        "Test_Cases.NFR.test_radio_api_response_time": "TC-2002"
      }
    },
    "radio_device_testing": {
      "folder": "Radio Device Testing",
      "tests": {
        "Test_Cases.Devices.Remote_Control.test_frequency_change_tsm": "TC-3001",
        "Test_Cases.Devices.Remote_Control.test_reboot_recovery": "TC-3002"
      }
    }
  }
}
```

> **Fill in**: `jama_api_key` (leave empty in repo, set via env var), `test_plans.*.id` (Jama plan IDs), and expand the test mappings as tests are written. TC IDs must match what exists in Jama.

### Jama REST API Flow (post-suite)

```
Nightly build completes
  → pytest-sessionfinish hook fires
  → Jama plugin:
    1. GET  /rest/v1/testplans/{plan_id}           — verify test plan exists
    2. POST /rest/v1/testcycles                     — create test cycle under plan
    3. POST /rest/v1/testcycles/{cycle_id}/testruns — create test run per mapped test
    4. PUT  /rest/v1/testruns/{run_id}              — set result + attach HTML report
```

### Jama API Auth

```python
# All requests use API key in header:
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
}
```

### Jama Reporter Plugin

```python
# plugins/jama_reporter/plugin.py

"""
Jama test results reporter for TNC automation.
Pushes results to Jama REST API after test suite completion.
Only active when PUBLISH_TO_JAMA=true.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path

import pytest
import requests

logger = logging.getLogger("jama-reporter")

MAPPING_FILE = Path(__file__).parent.parent.parent / "Configuration" / "jama_mapping.json"


def pytest_addoption(parser):
    group = parser.getgroup("jama", "Jama test case reporting")
    group.addoption("--jama-publish", action="store_true", default=False,
                    help="Publish results to Jama (default: false)")
    group.addoption("--jama-plan", default="nightly",
                    help="Jama test plan key: nightly|release (default: nightly)")


@pytest.hookimpl(trylast=True)
def pytest_configure(config):
    publish = (
        config.getoption("jama_publish", default=False)
        or os.environ.get("PUBLISH_TO_JAMA", "").lower() in ("1", "true", "yes")
    )
    if not publish:
        return
    plugin = JamaReporterPlugin(config)
    config.pluginmanager.register(plugin, "jama-reporter")


class JamaClient:
    """Thin wrapper around Jama REST API."""

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        })
        # Jama may use self-signed certs internally
        self.session.verify = True

    def _url(self, path: str) -> str:
        return f"{self.base_url}/rest/v1/{path.lstrip('/')}"

    def get_test_plan(self, plan_id: int) -> dict:
        r = self.session.get(self._url(f"testplans/{plan_id}"))
        r.raise_for_status()
        return r.json().get("data", {})

    def create_test_cycle(self, plan_id: int, name: str, description: str = "") -> dict:
        payload = {
            "fields": {
                "name": name,
                "description": description,
                "testPlan": plan_id,
            }
        }
        r = self.session.post(self._url("testcycles"), json=payload)
        r.raise_for_status()
        return r.json().get("meta", {})

    def create_test_run(self, cycle_id: int, test_case_id: int) -> dict:
        payload = {
            "fields": {
                "testCase": test_case_id,
                "testCycle": cycle_id,
            }
        }
        r = self.session.post(self._url(f"testcycles/{cycle_id}/testruns"), json=payload)
        r.raise_for_status()
        return r.json().get("meta", {})

    def update_test_run_result(self, run_id: int, status: str,
                                notes_html: str = "") -> dict:
        """
        status: PASSED | FAILED | BLOCKED | NOT_RUN
        notes_html: HTML content for the result notes (Jama renders HTML)
        """
        payload = {
            "fields": {
                "testRunStatus": status,
                "notes": notes_html,
            }
        }
        r = self.session.put(self._url(f"testruns/{run_id}"), json=payload)
        r.raise_for_status()
        return r.json()


class JamaReporterPlugin:
    """pytest plugin that publishes results to Jama after session finishes."""

    def __init__(self, config):
        self.config = config
        self.results = []  # list of (nodeid, status, duration_ms, error_message)

        # Load mapping
        with open(MAPPING_FILE) as f:
            self.mapping = json.load(f)

        # API key: env var takes priority, then mapping file
        api_key = os.environ.get("JAMA_API_KEY", "") or self.mapping.get("jama_api_key", "")
        jama_url = os.environ.get("JAMA_URL", "") or self.mapping.get("jama_url", "")
        self.plan_key = config.getoption("jama_plan", default="nightly")

        if not api_key or not jama_url:
            logger.warning("Jama URL or API key not set — results will not be published")
            self.client = None
        else:
            self.client = JamaClient(jama_url, api_key)

        # Build flat test→TC-ID lookup from all categories
        self.test_to_jama = {}
        for cat in self.mapping.get("categories", {}).values():
            for nodeid, tc_id in cat.get("tests", {}).items():
                self.test_to_jama[nodeid] = tc_id

    def pytest_runtest_teardown(self, item):
        status = "PASSED"
        error_message = ""
        duration_ms = 0

        for phase_report in getattr(item, "_ar_reports", []):
            if phase_report.failed:
                status = "FAILED"
                if phase_report.longrepr:
                    error_message = str(phase_report.longrepr).split("\n")[0][:500]
                break
            elif phase_report.skipped:
                status = "NOT_RUN"

        start = getattr(item, "_ar_start_time", None)
        if start:
            import time
            duration_ms = int((time.time() - start) * 1000)

        self.results.append((item.nodeid, status, duration_ms, error_message))

    def pytest_sessionfinish(self, session, exitstatus):
        if not self.client:
            logger.warning("Jama client not configured — skipping publish")
            return

        plan_config = self.mapping.get("test_plans", {}).get(self.plan_key)
        if not plan_config or not plan_config.get("id"):
            logger.warning("Jama test plan '%s' not configured — skipping", self.plan_key)
            return

        plan_id = plan_config["id"]
        launch_name = self.config.getoption("ar_launch_name", default="pytest run")
        reportstack_url = os.environ.get("AR_URL", "")

        # Collect only mapped results
        mapped_results = []
        for nodeid, status, duration_ms, error_msg in self.results:
            # Try exact match, then try without parametrize suffix
            tc_id = self.test_to_jama.get(nodeid)
            if not tc_id:
                # Strip parametrize: "Test_Cases.Dashboard.test_foo[param1]" → "Test_Cases.Dashboard.test_foo"
                base_id = nodeid.split("[")[0].replace("/", ".").replace(".py::", ".")
                tc_id = self.test_to_jama.get(base_id)
            if tc_id:
                mapped_results.append({
                    "tc_id": tc_id,
                    "status": status,
                    "duration_ms": duration_ms,
                    "error_message": error_msg,
                })

        if not mapped_results:
            logger.info("No mapped test results for Jama — skipping")
            return

        try:
            # 1. Create test cycle
            cycle_name = f"{launch_name}-{datetime.now().strftime('%Y-%m-%d')}"
            cycle_resp = self.client.create_test_cycle(
                plan_id=plan_id,
                name=cycle_name,
                description=f"Auto-generated by TNC automation pipeline",
            )
            cycle_id = cycle_resp.get("id")
            if not cycle_id:
                logger.error("Failed to create Jama test cycle: %s", cycle_resp)
                return

            logger.info("Created Jama test cycle: %s (ID: %s)", cycle_name, cycle_id)

            # 2. Create test runs and set results
            passed = failed = skipped = 0
            for r in mapped_results:
                try:
                    # Create test run
                    run_resp = self.client.create_test_run(cycle_id, int(r["tc_id"].replace("TC-", "")))
                    run_id = run_resp.get("id")
                    if not run_id:
                        logger.warning("Failed to create test run for %s", r["tc_id"])
                        continue

                    # Build HTML notes (template — user will customize in Jama)
                    notes_html = _build_result_html(
                        tc_id=r["tc_id"],
                        status=r["status"],
                        duration_ms=r["duration_ms"],
                        error_message=r["error_message"],
                        reportstack_url=reportstack_url,
                        launch_name=launch_name,
                    )

                    # Set result
                    self.client.update_test_run_result(
                        run_id=run_id,
                        status=r["status"],
                        notes_html=notes_html,
                    )

                    if r["status"] == "PASSED":
                        passed += 1
                    elif r["status"] == "FAILED":
                        failed += 1
                    else:
                        skipped += 1

                except Exception as e:
                    logger.warning("Failed to report %s to Jama: %s", r["tc_id"], e)

            logger.info(
                "Jama publish complete: %d passed, %d failed, %d skipped (cycle: %s)",
                passed, failed, skipped, cycle_name,
            )

        except Exception as e:
            logger.error("Jama publish failed: %s", e)


def _build_result_html(tc_id: str, status: str, duration_ms: int,
                       error_message: str, reportstack_url: str,
                       launch_name: str) -> str:
    """
    Build HTML fragment for Jama test run notes.
    This is a template — customize the format in Jama's rich text editor
    or replace this function with your own HTML layout.
    """
    status_color = {
        "PASSED": "#22c55e",
        "FAILED": "#ef4444",
        "BLOCKED": "#f59e0b",
        "NOT_RUN": "#6b7280",
    }.get(status, "#6b7280")

    duration_str = f"{duration_ms / 1000:.1f}s" if duration_ms else "—"

    error_row = ""
    if error_message and status == "FAILED":
        error_row = f"""
        <tr>
            <td style="padding:6px 12px;font-weight:600;vertical-align:top;">Error</td>
            <td style="padding:6px 12px;"><code style="font-size:12px;">{error_message}</code></td>
        </tr>"""

    reportstack_row = ""
    if reportstack_url:
        reportstack_row = f"""
        <tr>
            <td style="padding:6px 12px;font-weight:600;">ReportStack</td>
            <td style="padding:6px 12px;"><a href="{reportstack_url}">{launch_name}</a></td>
        </tr>"""

    return f"""
    <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;width:100%;">
        <tr>
            <td style="padding:6px 12px;font-weight:600;width:120px;">Test Case</td>
            <td style="padding:6px 12px;">{tc_id}</td>
        </tr>
        <tr>
            <td style="padding:6px 12px;font-weight:600;">Result</td>
            <td style="padding:6px 12px;">
                <span style="background:{status_color};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">{status}</span>
            </td>
        </tr>
        <tr>
            <td style="padding:6px 12px;font-weight:600;">Duration</td>
            <td style="padding:6px 12px;">{duration_str}</td>
        </tr>{error_row}{reportstack_row}
        <tr>
            <td style="padding:6px 12px;font-weight:600;">Executed</td>
            <td style="padding:6px 12px;">{datetime.now().strftime('%Y-%m-%d %H:%M')}</td>
        </tr>
    </table>
    """
```

### conftest.py Wiring

The Jama plugin reads `_ar_reports` from the ReportStack plugin (they share the same pytest item attributes). No extra fixture needed — just install both plugins:

```
pip install -e plugins/jama_reporter/
```

### Trigger Rules

| Tier | Push to Jama? | Push to ReportStack? |
|---|---|---|
| Smoke | No | Yes |
| Nightly Regression | **Yes** — auto-generate results table | Yes |
| Release | **Yes** — linked to release test plan | Yes |
| NFR | **Yes** — NFR category in Jama | Yes |

### Jenkins Parameters

```
JAMA_URL        = https://jama.trellisware.com
JAMA_API_KEY    = (Jenkins secret text credential)
PUBLISH_TO_JAMA = true  (nightly/release only)
```

### HTML Results Template

The `_build_result_html()` function generates a default HTML table per test run in Jama. It includes:
- Test case ID
- Pass/Fail badge with color
- Duration
- Error message (on failure)
- Link to ReportStack launch
- Execution timestamp

To customize: either modify the function or replace the HTML in Jama's rich text editor after the first run. The function is a starting template — your Jama HTML format takes priority.

---

## Jira Integration — Defect Tracking Only

Jira is used for **bug/issue tracking**, not test case management.

### How Defects Flow

```
Test fails → ReportStack AI categorizes as PRODUCT_BUG
  → QA reviews in ReportStack dashboard
  → Creates Jira issue from ReportStack (manual or future auto-create)
  → Links Jira issue to ReportStack defect record (external_link field)
```

### pytest-jira Marker (existing)

```python
@pytest.mark.jira("TNC-1234")
def test_known_bug_frequency_reset():
    """Skip/xfail if TNC-1234 is still open in Jira."""
    ...
```

This is kept as-is. The `pytest-jira` plugin checks issue status before running marked tests.

---

## CI/CD Pipeline — Jenkins

### Pipeline Overview

```
Jenkins Nightly (cron: H 2 * * *)
  │
  ├── Stage: Checkout
  ├── Stage: Build Docker image (python:3.10 + dependencies)
  ├── Stage: Pre-flight (verify radio connectivity)
  ├── Stage: Run Tests
  │     └── pytest with ReportStack plugin + Jama flag
  ├── Stage: Publish Results
  │     ├── Archive HTML report
  │     ├── ReportStack: launch auto-closed, AI triage runs
  │     └── Jama: test cycle auto-generated (nightly/release only)
  └── Post: Notify (email or Slack with ReportStack launch URL)
```

### Jenkinsfile

```groovy
pipeline {
    agent any
    options {
        timeout(time: 120, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30'))
    }
    parameters {
        string(name: 'RADIO_DEVICE', defaultValue: 'appstestnw2-0.trellisware.com')
        choice(name: 'SUITE', choices: ['nightly_all', 'nightly_tsm', 'nightly_katana', 'smoke', 'release', 'nfr'])
        string(name: 'BUILD_VERSION', defaultValue: '')
        booleanParam(name: 'PUBLISH_TO_JAMA', defaultValue: true)
    }
    environment {
        IMAGE_TAG = "tnc-automation:${env.BUILD_NUMBER}"
        AR_URL = "http://localhost:8000/api/v1"
    }
    stages {
        stage('Checkout') { steps { checkout scm } }

        stage('Build image') {
            steps { sh "docker build -t $IMAGE_TAG ." }
        }

        stage('Pre-flight') {
            steps {
                sh """
                    curl -sf --max-time 10 \
                      https://${params.RADIO_DEVICE}/api/v1/status \
                      || (echo 'Radio unreachable' && exit 1)
                """
            }
        }

        stage('Run tests') {
            steps {
                withCredentials([
                    string(credentialsId: 'AR_TOKEN', variable: 'AR_TOKEN'),
                    string(credentialsId: 'JAMA_API_KEY', variable: 'JAMA_API_KEY')
                ]) {
                    sh """
                        docker run --rm \
                          --network host \
                          -e AR_URL=$AR_URL \
                          -e AR_TOKEN=$AR_TOKEN \
                          -e JAMA_URL=https://jama.trellisware.com \
                          -e JAMA_API_KEY=$JAMA_API_KEY \
                          -e PUBLISH_TO_JAMA=${params.PUBLISH_TO_JAMA} \
                          -v $WORKSPACE/reports:/app/reports \
                          $IMAGE_TAG \
                          pytest -c suites/${params.SUITE}.ini \
                                 --radio "${params.RADIO_DEVICE}" \
                                 --ar-launch-name="${params.SUITE}-${params.BUILD_VERSION}" \
                                 --ar-tags="${params.SUITE},${params.BUILD_VERSION}" \
                                 --ar-auto-analyze \
                                 --junitxml=reports/junit.xml
                    """
                }
            }
        }
    }
    post {
        always { junit 'reports/junit.xml' }
        failure {
            slackSend channel: '#tnc-qa-alerts', color: 'danger',
                message: "TNC ${params.SUITE} failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
        }
        cleanup { sh "docker rmi $IMAGE_TAG || true" }
    }
}
```

---

## Directory Structure — Target State

```
twt-network-controller-automation/
├── Configuration/
│   ├── configuration.ini          # Existing: headless, URL, wait time
│   ├── nfr_thresholds.json        # NEW: KPI pass/fail thresholds
│   └── jama_mapping.json          # NEW: test → Jama test case ID map
├── Helper/
│   ├── Radio_Helper.py            # Existing: REST, MQTT, Protobuf, SSH
│   ├── Interface/                 # Existing: Protobuf definitions
│   └── ...
├── Locators/                      # NEW: JSON locator files
│   ├── dashboard_page.json
│   ├── devices_page.json
│   ├── links_page.json
│   ├── map_page.json
│   ├── settings_page.json
│   └── remote_control/
│       ├── menu.json
│       ├── remote_control_tab.json
│       ├── networking_tab.json
│       ├── ota_tab.json
│       └── info_tab.json
├── Steps/                         # NEW: business-logic orchestration
│   ├── __init__.py
│   ├── dashboard_steps.py
│   ├── device_steps.py
│   ├── remote_control_steps.py
│   ├── networking_steps.py
│   ├── map_steps.py
│   └── settings_steps.py
├── TNC/                           # REFACTORED: page objects load from Locators/
│   ├── base_page.py               # NEW: BasePage with JSON locator loader
│   ├── tnc.py                     # Existing base class (save, reboot, toast)
│   ├── Page/
│   │   ├── Dashboard_Page.py
│   │   ├── Devices_Page.py
│   │   ├── Links_Page.py
│   │   ├── Map_Page.py
│   │   └── Settings_Page.py
│   └── Remote_Control_Panel/
│       ├── Menu.py
│       ├── Remote_Control_Tab/
│       ├── Networking_Tab/
│       ├── OTA_Tab/
│       └── Info_Tab/
├── Test_Cases/
│   ├── conftest.py                # UPDATED: Steps fixtures + KPI collector
│   ├── Dashboard/
│   ├── Devices/
│   │   ├── Info/
│   │   ├── Networking/
│   │   ├── OTA/
│   │   └── Remote_Control/
│   ├── Links/
│   ├── Map/
│   ├── Navigation_Bar/
│   ├── Settings/
│   ├── SIP/
│   ├── NFR/                       # NEW: performance/threshold tests
│   └── Barrage_Beamforming/
├── plugins/
│   └── jama_reporter/             # NEW: Jama REST API integration
│       ├── plugin.py
│       └── conftest.py
├── suites/                        # NEW: suite config files
│   ├── smoke.ini
│   ├── nightly_tsm.ini
│   ├── nightly_katana.ini
│   ├── nightly_all.ini
│   ├── release.ini
│   └── nfr.ini
├── Result/
├── Dockerfile
├── Jenkinsfile.reportstack
├── pytest.ini
├── requirements.txt
├── run_test.sh
└── README.md
```

---

## Migration Sequence

Do not attempt all changes at once. Follow this order.

### Prerequisites (before any phase)

These must be done first — they are cross-skill dependencies:

- **Storage abstraction** in ReportStack backend (`services/storage.py`) — implement `LocalDiskStorage` + `STORAGE_BACKEND` env switch (see CLAUDE.md). Without this, screenshot attachments crash on twd00030.
- **ReportStack deployed on twd00030** — follow cicd-skill.md deploy sequence steps 1-10.
- **Service account token** — register a Jenkins CI user in ReportStack (cicd-skill.md step 11), save `AR_TOKEN` in Jenkins credentials.
- **pytest-automation-reports plugin** — already built (`plugins/pytest-automation-reports/`). Install with `pip install -e plugins/pytest-automation-reports/`. Uses `--ar-url`, `--ar-launch-name`, `--ar-auto-analyze` CLI flags + `AR_URL`/`AR_TOKEN` env vars.

### Phase 1: Foundation (no test changes)
1. Create `Locators/` directory with JSON files extracted from existing page objects
2. Create `TNC/base_page.py` with locator loader
3. Refactor one page object (e.g., `Dashboard_Page.py`) to use `BasePage` + JSON
4. Verify all existing tests still pass

### Phase 2: Steps Layer
5. Create `Steps/` directory
6. Extract one workflow into steps (e.g., `device_steps.py`)
7. Update corresponding tests to use steps
8. Repeat for remaining functional areas

### Phase 3: Suite Organization
9. Create `suites/` directory with INI configs
10. Add `@pytest.mark.smoke` / `@pytest.mark.regression` / `@pytest.mark.release` to existing tests
11. Update Jenkinsfile to use suite parameter

### Phase 4: NFR
12. Add `Configuration/nfr_thresholds.json`
13. Add `KPICollector` fixture to `conftest.py`
14. Write initial NFR tests for critical paths
15. Add `suites/nfr.ini`

### Phase 5: Jama Integration
16. Create `plugins/jama_reporter/`
17. Create `Configuration/jama_mapping.json` with test-to-Jama-ID mappings
18. Wire into Jenkins nightly pipeline with `PUBLISH_TO_JAMA=true`
19. Verify auto-generated test cycle appears in Jama after nightly run

### Phase 6: Polish
20. Add retry resilience (`pytest-retry`)
21. Wire AI triage (`--ar-auto-analyze` in all CI runs)
22. Add email/Slack notifications in Jenkins post-build
23. Document all changes in README.md

---

## When to Load This Skill

Load when:
- Designing or restructuring the TNC automation framework
- Adding new test modules, pages, or steps
- Setting up or modifying CI/CD pipeline for test execution
- Integrating with ReportStack, Jama, or Jira
- Adding NFR/performance tests
- Migrating patterns from Osprey or other frameworks
- Reviewing framework conventions or best practices

Do not load for:
- ReportStack application code (use CLAUDE.md)
- twd00030 host infrastructure (use cicd-skill.md)
- Device lab hardware management (future device-lab-skill.md)
- General Python/pytest questions unrelated to TNC
