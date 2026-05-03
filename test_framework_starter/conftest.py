"""Root conftest — fixtures and hooks shared by every test.

Replaces Osprey's DTVNBaseTest @BeforeSuite / @BeforeMethod hierarchy.
Pytest fixtures are composable and explicit, so there's no inheritance —
tests opt into the fixtures they need.

Key responsibilities:
1. Read CLI flags that point at a real device.
2. Build a session-scoped RadioDevice fixture (one device per pytest run).
3. On test failure, attach diagnostic data (lock state, RSSI) so the
   ReportStack analyzer has something to classify on.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

import pytest

from commands.loader import load_catalog
from radios.base import RadioDevice
from radios.serial_radio import SerialRadio
from radios.ssh_radio import SSHRadio


# ---- CLI flags -------------------------------------------------------------
def pytest_addoption(parser: pytest.Parser) -> None:
    g = parser.getgroup("radio device")
    g.addoption("--device-host", action="store", default=None,
                help="SSH host for the radio (e.g. 10.0.0.42). Mutually exclusive with --device-serial-port.")
    g.addoption("--device-user", action="store", default="root",
                help="SSH username. Default 'root'.")
    g.addoption("--device-key", action="store", default=None,
                help="Path to SSH private key. Default uses the agent.")
    g.addoption("--device-serial-port", action="store", default=None,
                help="Serial port (e.g. /dev/ttyUSB0). Mutually exclusive with --device-host.")
    g.addoption("--device-serial-baud", action="store", type=int, default=115200,
                help="Serial baud rate. Default 115200.")
    g.addoption("--device-cmds", action="store",
                default=str(Path(__file__).parent / "commands" / "examples" / "wnc_radio.json"),
                help="Path to the JSON command catalog for this device.")


# ---- session-scoped device -------------------------------------------------
@pytest.fixture(scope="session")
def radio(request: pytest.FixtureRequest) -> Iterator[RadioDevice]:
    """One radio per pytest session.

    Configured by --device-host or --device-serial-port. If neither is given,
    skips the entire test session — make this an explicit error during CI by
    setting --device-host on the command line.
    """
    host = request.config.getoption("--device-host")
    serial_port = request.config.getoption("--device-serial-port")
    cmds_path = request.config.getoption("--device-cmds")
    if not host and not serial_port:
        pytest.skip("no --device-host or --device-serial-port given")
    catalog = load_catalog(cmds_path)
    device: RadioDevice
    if host:
        device = SSHRadio(
            name=host,
            host=host,
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


# ---- test-result hook (capture-on-failure) ---------------------------------
@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo):
    """Stash test outcome on the item so post-test fixtures can react to it.

    Equivalent of Osprey's FailListener.onTestFailure. The
    pytest-automation-reports plugin reads this attribute to decide whether
    to upload diagnostics with the test result.
    """
    outcome = yield
    report = outcome.get_result()
    setattr(item, f"rep_{report.when}", report)


@pytest.fixture(autouse=True)
def attach_diagnostics_on_fail(request: pytest.FixtureRequest):
    """If the test fails, snapshot the radio's state and attach it.

    Called before each test (autouse). After the test runs, we check the
    'rep_call' report — if it's a failure, we ask the device for its current
    lock + RSSI + temperature and stash them as a JSON attachment that the
    pytest-automation-reports plugin will upload.
    """
    yield
    rep = getattr(request.node, "rep_call", None)
    if rep is None or rep.passed:
        return
    # Best-effort: if the radio fixture wasn't requested, skip.
    if "radio" not in request.fixturenames:
        return
    device: RadioDevice = request.getfixturevalue("radio")
    snapshot: dict[str, object] = {"name": device.name}
    for key in ("read_lock_state", "read_rssi", "read_temperature"):
        if key in device.commands:
            try:
                snapshot[key] = device.cmd(key.replace("read_", "")).stdout.strip()
            except Exception as e:
                snapshot[key] = f"<error: {e}>"
    # Stash as a JSON file the AR plugin will pick up.
    out = Path(getattr(request.config, "_ar_attachment_dir", "/tmp")) / f"diag_{request.node.name}.json"
    try:
        import json
        out.write_text(json.dumps(snapshot, indent=2))
    except Exception:
        pass  # never let diagnostic capture mask the original failure
