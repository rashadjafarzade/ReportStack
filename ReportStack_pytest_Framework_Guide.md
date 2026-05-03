# ReportStack — pytest framework guide

A pytest-native framework for testing Linux radio devices with ReportStack
reporting. Companion to [`test_framework_starter/`](test_framework_starter/).
Replaces the Java/TestNG **Osprey Framework Analysis** with a pytest-native
architecture.

> Markdown twin of `ReportStack_pytest_Framework_Guide.docx`. Both are
> regenerated from `generate_pytest_framework_guide.py`. If you edit one,
> mirror the change in the other.

**Version 1.0** · May 03, 2026

---

## Table of contents

1. [Overview](#1-overview)
2. [Tech stack](#2-tech-stack)
3. [Project structure](#3-project-structure)
4. [Architecture and design patterns](#4-architecture-and-design-patterns)
5. [Dependency management](#5-dependency-management)
6. [Pytest fundamentals](#6-pytest-fundamentals)
7. [Test categories and marker taxonomy](#7-test-categories-and-marker-taxonomy)
8. [Linux radio device control](#8-linux-radio-device-control)
9. [ReportStack integration](#9-reportstack-integration)
10. [AI failure analysis](#10-ai-failure-analysis)
11. [Defects and external links](#11-defects-and-external-links)
12. [Performance KPIs](#12-performance-kpis)
13. [Artifacts via ReportStack attachments](#13-artifacts-via-reportstack-attachments)
14. [Notifications](#14-notifications)
15. [Jenkins CI/CD pipeline](#15-jenkins-cicd-pipeline)
16. [Migration mapping: Osprey → this framework](#16-migration-mapping-osprey--this-framework)
17. [Worked example — one full test, end to end](#17-worked-example--one-full-test-end-to-end)

---

## 1. Overview

This guide describes a pytest-native automation framework for **Linux radio
devices**, with results reported through ReportStack. It draws inspiration
from the Osprey/TestNG framework analysis (where the layered architecture and
team-based suite organization come from) but replaces every Java, Maven,
TestNG, and AspectJ component with its idiomatic pytest equivalent.

The framework deliberately keeps four invariants from Osprey:

- **Separation of concerns** — Tests → Steps → Devices → Commands.
- **Configuration over code** — JSON command catalogs, marker-based suite selection, runtime CLI flags for device endpoints.
- **Team-based test organization** — markers like `team_allstars` and `team_gogeta` let multiple teams share one repo.
- **Multi-level reporting** — execution logs + screenshots + diagnostic snapshots + AI classification, all visible in the ReportStack dashboard.

And changes everything else:

- Java 11 → Python 3.12.
- TestNG XML suites → pytest markers + `pytest.ini`.
- Maven + AspectJ → `pyproject.toml` + pytest hooks.
- Appium / UIAutomator2 / ADB → SSH (`paramiko`) and serial (`pyserial`) for radios.
- ReportPortal listener → the `pytest-automation-reports` plugin shipped in this repo.
- AWS Lambda triage → Ollama (local LLM) via ReportStack's analyzer.

---

## 2. Tech stack

| Layer | Technology | Purpose |
|---|---|---|
| Language | Python 3.12 | Backend match; type hints throughout |
| Test runner | pytest ≥ 7.4 | Markers, fixtures, parametrize, plugins |
| Parallelism | pytest-xdist ≥ 3.5 | `-n N` replaces TestNG `parallel=methods` |
| Retry | pytest-rerunfailures ≥ 14 | Equivalent of TestNG `RetryListener` |
| Build / packaging | `pyproject.toml` + setuptools | Replaces Maven `pom.xml` |
| Device — SSH | paramiko ≥ 3.4 | Linux radio control plane over SSH |
| Device — serial | pyserial ≥ 3.5 | Console-only / bring-up scenarios |
| Logging | structlog ≥ 24 | Structured logs forwarded to ReportStack |
| Reporting | `pytest-automation-reports` | In-repo plugin; replaces RP listener |
| AI triage | Ollama (local LLM) | Replaces AWS Lambda; local, no API keys |
| Issue tracking | ReportStack defects + `external_link` | Replaces Jira/QMetry TAM API |
| Artifact storage | ReportStack attachments → MinIO | Replaces Nexus binary repo |
| Image / screenshots | Pillow ≥ 10 | Diff and processing |
| CI/CD | Jenkins (existing) | Pipeline calls `pytest` instead of `mvn` |

> **Tip** — Pytest doesn't need AOP. The cross-cutting concerns Osprey solved
> with AspectJ (logging, retry, reporting) are first-class pytest features:
> hooks for cross-cutting, fixtures for setup, plugins for extension.

---

## 3. Project structure

The starter project layout — see `test_framework_starter/` in this repo for
the actual files.

```
test_framework_starter/
├── pyproject.toml          # deps + project metadata
├── pytest.ini              # marker registry + addopts
├── conftest.py             # root fixtures + ReportStack hooks
├── radios/                 # device abstractions
│   ├── base.py             # RadioDevice abstract base + CommandResult
│   ├── ssh_radio.py        # paramiko-backed SSHRadio
│   └── serial_radio.py     # pyserial-backed SerialRadio
├── commands/               # JSON command catalogs
│   ├── loader.py           # validates required keys
│   └── examples/
│       ├── wnc_radio.json
│       └── generic_linux.json
├── steps/                  # composable business operations
│   ├── power.py            # bring_up, shut_down
│   ├── tune.py             # tune_and_wait_for_lock
│   └── measure.py          # measure_rssi_average
└── tests/
    ├── conftest.py         # test-scoped fixtures (radio_up)
    ├── test_smoke.py       # smoke + parametrized tune tests
    ├── test_regression.py  # regression tests with team markers
    └── test_kpi.py         # lock-time KPI w/ threshold assertion
```

> **Tip** — `tests/` is a flat folder. Per-team or per-feature breakdowns
> happen via markers (`team_allstars`, `feature_tune`), not directories.
> This avoids the duplication-by-folder problem Osprey ran into with 70+
> feature suite XMLs.

---

## 4. Architecture and design patterns

Four layers, top to bottom. Every layer depends only on the one below — the
test layer never reaches into a transport client; the radio layer never knows
about pytest.

| Layer | Responsibility | Pattern |
|---|---|---|
| Tests (pytest functions) | Assertions and data-driven scenarios | Specification by example |
| Steps (Python modules) | Business-flavoured verbs (`bring_up`, `tune_and_wait_for_lock`) | Strategy + Builder |
| Radios (`RadioDevice` subclasses) | Device control — power, tune, read_rssi | Page Object Model |
| Commands (JSON catalogs) | Per-device-family text strings sent over the wire | Factory + lookup |

### Design patterns

| Pattern | Where it lives | Why |
|---|---|---|
| Page Object Model | `radios/base.py` + impls | Tests call `device.tune()`, not a raw shell command |
| Factory + lookup | `commands/loader.py` | JSON files swap in per-device-family strings without code change |
| Strategy | `SSHRadio` vs `SerialRadio` | Same `RadioDevice` surface, different transport |
| Template Method | `RadioDevice.session()` context manager | Standard cleanup path; subclasses fill in `run`/`close` |
| Listener / Observer | pytest hooks + the AR plugin | Cross-cutting — logging, capture-on-fail, reporting |
| Retry | `pytest-rerunfailures` + `retry_of` in ReportStack | Surface flakes without losing them |

---

## 5. Dependency management

`pyproject.toml` replaces `pom.xml`. Optional groups (`test`, `dev`) replace
Maven profiles. Pin specific versions for reproducibility, looser ranges for
libs.

```toml
[project]
name = "radio-test-framework-starter"
requires-python = ">=3.10"
dependencies = [
  "pytest>=7.4",
  "pytest-xdist>=3.5",
  "pytest-rerunfailures>=14.0",
  "paramiko>=3.4",
  "pyserial>=3.5",
  "Pillow>=10.0",
]

[project.optional-dependencies]
dev = ["ruff>=0.5", "mypy>=1.10"]
```

> **Note** — Install in editable mode during development (`pip install -e .`)
> so changes to `radios/`, `steps/`, and `commands/` are picked up without
> reinstall.

---

## 6. Pytest fundamentals

If you're coming from TestNG, the cheat sheet:

| TestNG concept | Pytest equivalent |
|---|---|
| `@Test(groups = {"smoke"})` | `@pytest.mark.smoke` (registered in `pytest.ini`) |
| `@DataProvider` | `@pytest.mark.parametrize` |
| `@BeforeSuite` / `@AfterSuite` | Session-scoped fixture (yield-style) |
| `@BeforeMethod` / `@AfterMethod` | Function-scoped fixture (yield-style) |
| `BaseTest` inheritance | `conftest.py` + composable fixtures (no inheritance) |
| `RetryListener` | `pytest-rerunfailures` (`--reruns N`) |
| `FailListener` | `pytest_runtest_makereport` hook in conftest |
| TestNG XML suite | `pytest.ini` markers + `pytest -m` expression |
| `parallel=methods, thread-count=2` | pytest-xdist: `pytest -n 2` |
| `@Listeners` | pytest plugin (entry point or `conftest.py`) |

### Markers

Markers tag tests with metadata. Register every marker in `pytest.ini` — the
strict-markers option turns typos into collection errors instead of
silently-skipped tests.

```ini
# pytest.ini
[pytest]
markers =
    smoke: fast, broad coverage; runs on every push
    regression: full functional suite; runs nightly
    kpi: performance KPI measurements
    team_allstars: AllStars team's regression scope
    feature_tune: tuning / channel-change feature
addopts =
    --strict-markers
    -ra
```

### Fixtures (the Page Object enabler)

Fixtures replace TestNG's `@BeforeMethod`/`@AfterMethod` and the implicit
field state of a `BaseTest` subclass. Yield-style fixtures handle setup and
teardown in one block.

```python
import pytest
from radios.ssh_radio import SSHRadio
from commands import load_catalog

@pytest.fixture(scope="session")
def radio(request):
    catalog = load_catalog(request.config.getoption("--device-cmds"))
    device = SSHRadio(
        name=request.config.getoption("--device-host"),
        host=request.config.getoption("--device-host"),
        username=request.config.getoption("--device-user"),
        command_catalog=catalog,
    )
    with device.session() as d:
        yield d   # teardown after this line
```

### Parametrize (replaces `@DataProvider`)

```python
@pytest.mark.smoke
@pytest.mark.parametrize(
    "freq_mhz",
    [88.5, 100.0, 433.92, 868.0],
    ids=["fm_low", "fm_mid", "ism_433", "ism_868"],
)
def test_tune_locks_within_5s(radio_up, freq_mhz):
    elapsed = tune_and_wait_for_lock(radio_up, freq_mhz, timeout_seconds=5.0)
    assert elapsed < 5.0
```

### Parallel runs with pytest-xdist

```bash
# Two workers; one radio per worker via separate --device-host values.
pytest -n 2 -m smoke \
  --device-host=radio1.lab \
  --device-host=radio2.lab
```

> **Watch out** — xdist runs tests across multiple workers. For radio testing
> each worker needs its own physical device — pass the same flag twice, or
> read a device pool from a config file in conftest.

---

## 7. Test categories and marker taxonomy

Three orthogonal axes — **kind**, **team**, **feature**. Combine them with
boolean expressions on the command line.

| Axis | Markers | Example |
|---|---|---|
| Kind | `smoke`, `regression`, `kpi`, `nfr`, `stress` | `pytest -m smoke` |
| Team | `team_allstars`, `team_gogeta`, `team_xteam` | `pytest -m "regression and team_allstars"` |
| Feature | `feature_tune`, `feature_power`, `feature_measure` | `pytest -m "smoke and feature_tune"` |
| Speed | `slow` | `pytest -m "regression and not slow"` |

> **Tip** — Stop creating new test files for each suite. With markers, one
> `regression.py` can serve every team via `@pytest.mark.team_xxx`.

---

## 8. Linux radio device control

Radios speak shell or serial. The `RadioDevice` abstract base normalises
both into a single API; tests don't know which transport they're using.

### The `RadioDevice` contract

```python
class RadioDevice(ABC):
    @abstractmethod
    def run(self, command: str, *, timeout: float = 10.0) -> CommandResult: ...
    @abstractmethod
    def close(self) -> None: ...

    # Catalog-driven helpers — same on every transport
    def cmd(self, key: str, **fmt) -> CommandResult: ...
    def power_on(self) -> None: ...
    def tune(self, freq_mhz: float) -> None: ...
    def read_rssi(self) -> int: ...
    def is_locked(self) -> bool: ...
```

### JSON command catalogs

Each device family ships with a JSON file mapping logical command names to
the actual shell strings. Adding a new device is a matter of writing one
JSON file — no Python code changes.

```json
// commands/examples/wnc_radio.json
{
  "power_on":        "radioctl --on",
  "power_off":       "radioctl --off",
  "set_freq":        "radioctl --freq {mhz}",
  "read_rssi":       "radioctl --query rssi",
  "read_lock_state": "radioctl --query lock"
}
```

> **Note** — `loader.py` validates that every catalog defines the five
> required keys (`power_on`, `power_off`, `set_freq`, `read_rssi`,
> `read_lock_state`). Missing a key is a collection-time error, not a runtime
> surprise.

### Picking a transport

| Use | When |
|---|---|
| `SSHRadio` | Device has Ethernet/WiFi and runs `sshd` |
| `SerialRadio` | Bring-up / lab bench, or no network stack |
| Future: TCP socket / SCPI | Test instruments speaking SCPI over LAN — implement `RadioDevice` the same way |

---

## 9. ReportStack integration

The `pytest-automation-reports` plugin (in `plugins/` at the repo root)
registers as a pytest plugin and forwards every test outcome to ReportStack
via REST. Install it once, then enable per run with CLI flags.

```bash
pip install -e plugins/pytest-automation-reports/
```

### CLI flags

| Flag | Default | Purpose |
|---|---|---|
| `--ar-url` | (none — required to enable) | Backend base URL, e.g. `http://reports.local:8000/api/v1` |
| `--ar-launch-name` | auto-generated timestamp | Label shown on the launches list |
| `--ar-launch-description` | (none) | Free-form context — build number, branch, etc. |
| `--ar-tag` | (none) | Repeatable tag for filtering (e.g. `nightly`, `hotfix`) |
| `--ar-auto-analyze` | `false` | Trigger AI analysis as soon as the launch finishes |

### What the plugin does for you

- Creates a Launch on session start; finishes it on session end with `PASSED` / `FAILED` / `STOPPED`.
- Reports each test as a TestItem with status, duration, error message, and stack trace.
- Captures pytest log records and uploads them as TestLogs in batches.
- Uploads files registered via `request.node.user_properties[("attachment", path)]` as Attachments.
- Forwards numeric KPIs registered as `user_properties[("kpi:name", value)]` for the Trends page.

---

## 10. AI failure analysis

When `--ar-auto-analyze` is on, ReportStack triggers Ollama-backed
classification on every failed test once the launch finishes. The analyzer
reads the test's error message, last 50 stack-trace lines, and last 20 log
entries; returns one of `PRODUCT_BUG`, `AUTOMATION_BUG`, `SYSTEM_ISSUE`,
`NO_DEFECT`, `TO_INVESTIGATE`.

> **Tip** — If Ollama is unreachable, the analyzer falls back to
> `TO_INVESTIGATE` rather than crashing the BackgroundTask — a safety net
> added in May 2026.

### Manual override

On the Test Detail page, the Defect Selector dropdown lets a triager
override the AI's call. The override is stored as a separate FailureAnalysis
row with `source=MANUAL`, so the original AI decision is preserved for audit.

---

## 11. Defects and external links

Replaces Osprey's Jira/QMetry TAM API. Defects are first-class ReportStack
resources with `summary`, `status`, `defect_type`, and `external_link`. Use
the `external_link` to point at a Jira ticket, GitHub issue, or any URL —
ReportStack doesn't reach into your tracker, it just links out.

| Status | Meaning |
|---|---|
| `OPEN` | Newly filed, not assigned |
| `IN_PROGRESS` | Owner picked it up |
| `FIXED` | Code merged; verify on next run |
| `WONT_FIX` | Acknowledged, not actioned |
| `DUPLICATE` | Reference an existing defect via `external_link` |

---

## 12. Performance KPIs

Radio-relevant KPIs supersede Osprey's TV-specific ones. Each KPI test
measures a value, attaches it to the test item via `user_properties`, and
asserts a threshold. The Trends widget plots the value across launches.

| KPI | Measured value | Suggested threshold |
|---|---|---|
| Lock time at 433 MHz | Seconds from `tune()` to `is_locked()=true` | < 2.0 s |
| Channel switch time | Seconds between two `tune()` calls reaching lock | < 1.0 s |
| Power-on to first response | Seconds from `power_on` to first responsive cmd | < 5.0 s |
| RSSI stability (median over 60 s) | Standard deviation of dBm samples | < 3 dB |
| Bit error rate (when supported) | Fraction of erroneous bits | < 1e-5 |
| Reboot recovery time | Seconds from reboot to lock at known frequency | < 30 s |

### Reporting a KPI

```python
@pytest.mark.kpi
def test_lock_time_at_433mhz_under_2s(radio_up, request):
    elapsed = tune_and_wait_for_lock(radio_up, 433.92, timeout_seconds=5.0)
    request.node.user_properties.append(
        ("kpi:lock_time_433_seconds", elapsed)
    )
    assert elapsed < 2.0
```

---

## 13. Artifacts via ReportStack attachments

Replaces Nexus binary repos. The ReportStack backend stores attachments in
MinIO (S3-compatible) and serves them by stable URL. From a test, register
a path you want uploaded:

```python
import pytest
from pathlib import Path

def test_with_recording(radio_up, request, tmp_path):
    log_file = tmp_path / "capture.log"
    log_file.write_text("...")
    request.node.user_properties.append(("attachment", str(log_file)))
```

Maximum 20 MB per attachment. For larger files (long captures, raw IQ
data), upload directly to your own object store and set the test item's
comment with the URL.

---

## 14. Notifications

ReportStack handles notification rules in the dashboard
(*Settings → Notifications*). Configure them once per project — no
test-side changes needed. Triggers include launch finished, launch failed,
threshold exceeded; recipients are email, Slack, or Telegram.

> **Note** — Email Freemarker templates from Osprey don't translate. Use
> ReportStack's in-app notification settings instead.

---

## 15. Jenkins CI/CD pipeline

Replace `mvn integration-test` with `pytest`. Everything else (cron triggers,
agent labels, Nexus credentials) stays as it was.

```groovy
// Jenkinsfile (declarative)
pipeline {
  agent { label 'radio-lab' }
  triggers { cron('H 1 * * *') }   // nightly 1 AM
  environment {
    AR_URL   = credentials('AR_URL')
    AR_TOKEN = credentials('AR_TOKEN')
  }
  stages {
    stage('Install') {
      steps {
        sh 'pip install -e test_framework_starter/'
        sh 'pip install -e plugins/pytest-automation-reports/'
      }
    }
    stage('Test') {
      steps {
        sh '''
          pytest test_framework_starter/tests/ \
            --ar-url=$AR_URL \
            --ar-launch-name="$JOB_NAME #$BUILD_NUMBER" \
            --ar-launch-description="build $GIT_COMMIT" \
            --ar-tag=nightly --ar-auto-analyze \
            --device-host=10.0.0.42 \
            -m "smoke or (regression and not slow)"
        '''
      }
    }
  }
}
```

---

## 16. Migration mapping: Osprey → this framework

| Osprey component | ReportStack pytest equivalent | Notes |
|---|---|---|
| Java 11 | Python 3.12 | |
| Maven (`pom.xml`) | `pyproject.toml` | Optional groups replace profiles |
| TestNG | pytest | Markers replace `@Test` groups; fixtures replace `@Before`/`@After` |
| TestNG XML suites | `pytest -m` expressions | No more file-per-suite |
| AspectJ AOP | Pytest hooks + plugins | First-class — no weaving needed |
| OAT Core `BaseTest` | Composable fixtures in `conftest` | Avoid base-class inheritance |
| Page Object Model | `RadioDevice` + impls | Same pattern, hardware-flavoured |
| Locator JSON files | Command catalog JSONs | Same idea, different vocabulary |
| `DataProvider` | `@pytest.mark.parametrize` | |
| `RetryListener` | `pytest-rerunfailures` | |
| `FailListener` | `pytest_runtest_makereport` hook | |
| `OspreyReportPortalListener` | `pytest-automation-reports` plugin | |
| AWS Lambda triage | Ollama via ReportStack analyzer | Local, no API key |
| Jira/QMetry TAM API | ReportStack defects + `external_link` | Manual link out |
| Confluence auto-update | ReportStack Dashboards | Configurable widgets |
| Nexus artifact storage | ReportStack attachments → MinIO | 20 MB cap |
| Email Freemarker | ReportStack notification rules | In-app config |
| Appium / UIAutomator2 / ADB | paramiko (SSH) / pyserial | Linux radios, not Android |
| Charles Proxy HAR parsing | (out of scope) | Add as a later module if needed |

---

## 17. Worked example — one full test, end to end

A complete trace from CLI invocation to ReportStack dashboard. Assumes a
radio at `10.0.0.42` with the `wnc_radio.json` catalog and the AR backend
at `http://reports.local:8000`.

### The invocation

```bash
pytest test_framework_starter/tests/test_kpi.py \
  --ar-url=http://reports.local:8000/api/v1 \
  --ar-launch-name="lock-time spot check" \
  --ar-tag=manual --ar-auto-analyze \
  --device-host=10.0.0.42 --device-user=root \
  --device-cmds=test_framework_starter/commands/examples/wnc_radio.json \
  -m kpi
```

### What happens

1. The AR plugin POSTs to `/launches/` and remembers the launch ID.
2. Pytest collects the kpi-marked test (`test_lock_time_at_433mhz_under_2s`).
3. The session-scoped `radio` fixture opens an SSH connection to `10.0.0.42` and validates the command catalog.
4. The test-scoped `radio_up` fixture calls `bring_up` — `power_on` then a 1.5 s settle.
5. The test calls `tune_and_wait_for_lock(433.92, timeout_seconds=5.0)`; records 1.34 s.
6. The test pushes `("kpi:lock_time_433_seconds", 1.34)` onto `user_properties`; asserts `< 2.0`.
7. The AR plugin reports the test result + the KPI metric.
8. Teardown — `radio_up` calls `shut_down`, the `radio` fixture closes the SSH session.
9. Session end — the AR plugin PUTs `/launches/{id}/finish` with status `PASSED`, then POSTs `/launches/{id}/analyze` (because `--ar-auto-analyze`).
10. In the dashboard, the launch shows PASSED; the Trends page plots 1.34 s for the `kpi:lock_time_433_seconds` metric.

### If it had failed

- The test would raise `AssertionError` with the elapsed time in its message.
- `pytest_runtest_makereport` stamps `rep_call=failed` on the item.
- `attach_diagnostics_on_fail` (autouse fixture) snapshots lock state, RSSI, and temperature into a JSON file.
- The AR plugin uploads the JSON as an attachment.
- After the launch finishes, the analyzer triggers — Ollama classifies the failure (likely `PRODUCT_BUG` or `AUTOMATION_BUG` given the message).
- On the Test Detail page, the triager sees the assertion, the diagnostic snapshot, and the AI's call. They can override via the Defect Selector if they disagree.

---

*Generated from `generate_pytest_framework_guide.py`. Companion to
[`test_framework_starter/`](test_framework_starter/),
[`ReportStack_pytest_Framework_Guide.docx`](ReportStack_pytest_Framework_Guide.docx),
[`ReportStack_User_Guide.docx`](ReportStack_User_Guide.docx),
[`deploy/PREREQUISITES.md`](deploy/PREREQUISITES.md).*
