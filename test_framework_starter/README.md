# Three-layer pytest framework — starter

A minimal but real pytest framework for testing **three things**, all
reporting through ReportStack via the `pytest-automation-reports` plugin:

1. **UI** — the TNC web application (driven by Selenium)
2. **API** — the radio devices' backend (driven by httpx)
3. **NFR** — non-functional requirements in three flavours: performance,
   stress, reliability

This is the practical companion to `ReportStack_pytest_Framework_Guide.docx`.

## Marker taxonomy

Three orthogonal axes — combine with boolean expressions:

| Axis | Markers |
|---|---|
| Layer | `ui` · `api` · `nfr` |
| NFR sub-type | `nfr_performance` · `nfr_stress` · `nfr_reliability` |
| Kind | `smoke` · `regression` · `slow` |

Examples:

```bash
pytest -m smoke
pytest -m "ui and regression"
pytest -m "api and not slow"
pytest -m "nfr and nfr_performance"
pytest -m "(ui or api) and smoke"
```

There are **no team or feature markers**. One general team owns the suite;
test files name their layer through the file name + markers.

## Layout

```
test_framework_starter/
├── pyproject.toml          # deps + project metadata
├── pytest.ini              # marker registry + addopts
├── conftest.py             # session fixtures: api_client, web_driver, radio
│
├── api_client/             # primary backend test surface (httpx)
│   ├── base.py             # BaseClient — auth, retries, error wrapping
│   └── radio_backend.py    # RadioBackendClient — high-level radio endpoints
│
├── web/                    # TNC web app page objects (Selenium)
│   ├── base.py             # BasePage — explicit waits, locator catalog hook
│   ├── tnc_pages.py        # LoginPage, DashboardPage, RadioControlPage
│   └── locators/           # JSON locator catalogs (one per page)
│       ├── login.json
│       ├── dashboard.json
│       └── radio_control.json
│
├── radios/                 # legacy SSH/serial direct control (bring-up only)
│   ├── base.py             # RadioDevice abstract base
│   ├── ssh_radio.py        # paramiko-backed
│   └── serial_radio.py     # pyserial-backed
│
├── commands/               # JSON command catalogs for the legacy radios layer
│   ├── loader.py
│   └── examples/
│
├── steps/                  # composable verbs across all three layers
│   ├── api_steps.py        # bring_up, shut_down, tune_and_wait_for_lock
│   ├── web_steps.py        # sign_in, open_radio_control, set_frequency_via_ui
│   └── nfr_steps.py        # measure_call_latency, hammer_endpoint, repeated_cycle
│
└── tests/
    ├── conftest.py         # test-scoped fixtures (api_radio_up)
    ├── test_smoke.py            # smoke + (ui|api)
    ├── test_regression.py       # regression + (ui|api)
    ├── test_nfr_performance.py  # nfr + nfr_performance
    ├── test_nfr_stress.py       # nfr + nfr_stress
    └── test_nfr_reliability.py  # nfr + nfr_reliability
```

## Running

```bash
pip install -e .
pip install -e ../plugins/pytest-automation-reports/

# API smoke against a radio backend
pytest tests/ \
  --ar-url=http://reports.local:8000/api/v1 \
  --ar-launch-name="dev smoke $(date +%s)" \
  --ar-tag=dev --ar-auto-analyze \
  --api-url=http://radio-backend.lab:8080 \
  --api-token=$RADIO_BACKEND_TOKEN \
  --radio-id=radio-001 \
  -m "smoke and api"

# UI smoke against TNC
pytest tests/ \
  --ar-url=http://reports.local:8000/api/v1 \
  --tnc-url=http://tnc.lab \
  --tnc-user=qa.lead@example.com --tnc-pass=$TNC_PASS \
  -m "smoke and ui"

# Nightly NFR sweep
pytest tests/ \
  --ar-url=http://reports.local:8000/api/v1 \
  --ar-launch-name="nightly NFR" --ar-tag=nightly \
  --api-url=http://radio-backend.lab:8080 --api-token=$RADIO_BACKEND_TOKEN \
  -m "nfr"
```

## What each layer's tests prove

| Layer | Asserts | Failure surface |
|---|---|---|
| `ui` | The TNC dashboard is reachable, the login flow works, frequency changes round-trip through the panel | A screenshot is attached to the failing test item |
| `api` | The radio backend's REST endpoints return correct status codes, payloads echo what was sent, lock is achieved within a timeout | A status-snapshot JSON is attached to the failing test item |
| `nfr_performance` | p95 latency, lock time | Numeric metrics are forwarded to ReportStack as `kpi:*` properties |
| `nfr_stress` | No 5xx storms under 8 concurrent callers; oversize payloads → 4xx | Counts are forwarded as `kpi:stress_*` |
| `nfr_reliability` | 50 power/tune cycles ≥ 95% success; 5-minute lock has no flaps and no drift | Counts and drift forwarded as `kpi:reliability_*` |

## See also

- [`ReportStack_pytest_Framework_Guide.docx`](../ReportStack_pytest_Framework_Guide.docx) and [`.md`](../ReportStack_pytest_Framework_Guide.md) — full architectural guide.
- [`ReportStack_User_Guide.docx`](../ReportStack_User_Guide.docx) — end-user scenarios.
- [`deploy/PREREQUISITES.md`](../deploy/PREREQUISITES.md) — what to install on the host.
