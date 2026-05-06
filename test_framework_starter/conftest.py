"""Root conftest — fixtures and hooks shared by every test.

Three layers, three fixtures:
  - api_client      Radio devices' backend HTTP client
  - web_driver      Selenium WebDriver for the TNC web UI
  - radio (legacy)  Direct SSH/serial control — only for lab bring-up
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

import pytest


# ============================================================================
# CLI flags
# ============================================================================
def pytest_addoption(parser: pytest.Parser) -> None:
    api = parser.getgroup("radio backend (api layer)")
    api.addoption("--api-url", default=None,
                  help="Base URL of the radio devices' backend (e.g. http://radio-backend.lab:8080)")
    api.addoption("--api-token", default=None,
                  help="Bearer token for the backend; or set RADIO_BACKEND_TOKEN env var")
    api.addoption("--radio-id", default="radio-001",
                  help="Default radio identifier used by example tests")

    web = parser.getgroup("TNC web (ui layer)")
    web.addoption("--tnc-url", default=None,
                  help="Base URL of the TNC web application (e.g. http://tnc.lab)")
    web.addoption("--tnc-user", default=None, help="TNC login email")
    web.addoption("--tnc-pass", default=None, help="TNC login password")
    web.addoption("--browser", default="chrome",
                  choices=("chrome", "firefox"),
                  help="Selenium browser. Default chrome.")
    web.addoption("--headless", action="store_true", default=True,
                  help="Run browser headless. Default true.")

    legacy = parser.getgroup("radio (legacy SSH/serial — bring-up only)")
    legacy.addoption("--device-host", default=None)
    legacy.addoption("--device-user", default="root")
    legacy.addoption("--device-key", default=None)
    legacy.addoption("--device-serial-port", default=None)
    legacy.addoption("--device-serial-baud", default=115200, type=int)
    legacy.addoption("--device-cmds", default=None,
                     help="Path to the JSON command catalog (legacy radios/ layer)")


# ============================================================================
# api fixture — primary backend client
# ============================================================================
@pytest.fixture(scope="session")
def api_client(request: pytest.FixtureRequest):
    from api_client import RadioBackendClient
    url = request.config.getoption("--api-url")
    if not url:
        pytest.skip("no --api-url given")
    token = (
        request.config.getoption("--api-token")
        or os.getenv("RADIO_BACKEND_TOKEN")
    )
    with RadioBackendClient(base_url=url, token=token) as client:
        yield client


@pytest.fixture
def radio_id(request: pytest.FixtureRequest) -> str:
    return request.config.getoption("--radio-id")


# ============================================================================
# web fixture — Selenium driver
# ============================================================================
@pytest.fixture(scope="session")
def web_driver(request: pytest.FixtureRequest) -> Iterator[object]:
    """One headless browser per pytest session, reused by every UI test.

    Per-test isolation comes from clearing cookies/storage at the start of
    each test; opening a fresh driver per test would cost ~2s each.
    """
    tnc_url = request.config.getoption("--tnc-url")
    if not tnc_url:
        pytest.skip("no --tnc-url given")

    from selenium import webdriver  # type: ignore
    browser = request.config.getoption("--browser")
    headless = request.config.getoption("--headless")
    if browser == "chrome":
        opts = webdriver.ChromeOptions()
        if headless:
            opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        driver = webdriver.Chrome(options=opts)
    else:
        opts = webdriver.FirefoxOptions()
        if headless:
            opts.add_argument("-headless")
        driver = webdriver.Firefox(options=opts)
    driver.set_window_size(1280, 800)
    try:
        yield driver
    finally:
        driver.quit()


@pytest.fixture
def tnc_url(request: pytest.FixtureRequest) -> str:
    return request.config.getoption("--tnc-url")


@pytest.fixture
def tnc_credentials(request: pytest.FixtureRequest) -> tuple[str, str]:
    user = request.config.getoption("--tnc-user")
    pw = request.config.getoption("--tnc-pass")
    if not (user and pw):
        pytest.skip("--tnc-user / --tnc-pass not provided")
    return user, pw


@pytest.fixture
def fresh_session(web_driver):
    """Clear cookies + localStorage so each UI test starts logged-out."""
    try:
        web_driver.delete_all_cookies()
        web_driver.execute_script("window.localStorage.clear();")
        web_driver.execute_script("window.sessionStorage.clear();")
    except Exception:
        pass
    yield web_driver


# ============================================================================
# legacy radio fixture — SSH / serial direct (bring-up only)
# ============================================================================
@pytest.fixture(scope="session")
def radio(request: pytest.FixtureRequest):
    """Direct SSH/serial control. Most tests should use api_client instead."""
    from commands.loader import load_catalog
    from radios.serial_radio import SerialRadio
    from radios.ssh_radio import SSHRadio

    host = request.config.getoption("--device-host")
    serial_port = request.config.getoption("--device-serial-port")
    cmds_path = request.config.getoption("--device-cmds")
    if not (host or serial_port):
        pytest.skip("no --device-host or --device-serial-port given")
    if not cmds_path:
        pytest.skip("--device-cmds is required for the legacy radio fixture")
    catalog = load_catalog(cmds_path)
    if host:
        device = SSHRadio(
            name=host, host=host,
            username=request.config.getoption("--device-user"),
            key_filename=request.config.getoption("--device-key"),
            command_catalog=catalog,
        )
    else:
        device = SerialRadio(
            name=os.path.basename(serial_port),
            port=serial_port,
            baudrate=request.config.getoption("--device-serial-baud"),
            command_catalog=catalog,
        )
    with device.session() as d:
        yield d


# ============================================================================
# capture-on-failure
# ============================================================================
@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo):
    outcome = yield
    report = outcome.get_result()
    setattr(item, f"rep_{report.when}", report)


@pytest.fixture(autouse=True)
def attach_diagnostics_on_fail(request: pytest.FixtureRequest):
    """On failure, attach a screenshot (UI tests) or a status snapshot
    (API tests) so the ReportStack analyzer has something to classify on."""
    yield
    rep = getattr(request.node, "rep_call", None)
    if rep is None or rep.passed:
        return

    out_dir = Path(getattr(request.config, "_ar_attachment_dir", "/tmp"))
    name = request.node.name

    # UI failure -> screenshot
    if "web_driver" in request.fixturenames:
        try:
            driver = request.getfixturevalue("web_driver")
            driver.save_screenshot(str(out_dir / f"fail_{name}.png"))
        except Exception:
            pass

    # API failure -> status snapshot
    if "api_client" in request.fixturenames:
        try:
            client = request.getfixturevalue("api_client")
            rid = request.config.getoption("--radio-id")
            snapshot = client.get_status(rid)
            (out_dir / f"fail_{name}.json").write_text(str(snapshot))
        except Exception:
            pass
