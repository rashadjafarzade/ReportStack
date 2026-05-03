# Linux radio device test framework — starter

A minimal but real pytest framework for testing **Linux-based radio devices**
(SSH or serial-controlled), wired to the **ReportStack** reporting backend
through the `pytest-automation-reports` plugin.

This is the practical companion to `ReportStack_pytest_Framework_Guide.docx`.

## What you get

- **Pytest fundamentals**: markers, fixtures, conftest hooks, parametrize, parallel runs via `pytest-xdist`.
- **Page-Object analog for radios**: a `RadioDevice` interface with SSH and serial implementations, plus JSON command catalogs that swap per device family (the equivalent of Osprey's locator JSONs).
- **ReportStack integration**: every test run becomes a Launch; failures surface in the dashboard with screenshots/log files; AI failure analysis runs automatically when `--ar-auto-analyze` is on.
- **A worked KPI test**: lock-time measurement that pushes the duration to ReportStack and asserts a threshold.

## Layout

```
test_framework_starter/
├── pyproject.toml          # deps + project metadata
├── pytest.ini              # marker registry + addopts
├── conftest.py             # root fixtures + ReportStack hooks
├── radios/                 # device abstractions ("page objects" for hardware)
│   ├── __init__.py
│   ├── base.py             # RadioDevice abstract base
│   ├── ssh_radio.py        # paramiko-backed SSHRadio
│   └── serial_radio.py     # pyserial-backed SerialRadio
├── commands/               # JSON command catalogs ("locator JSONs")
│   ├── loader.py
│   └── examples/
│       ├── wnc_radio.json
│       └── generic_linux.json
├── steps/                  # composable business operations
│   ├── __init__.py
│   ├── power.py
│   ├── tune.py
│   └── measure.py
└── tests/
    ├── conftest.py         # test-scoped fixtures
    ├── test_smoke.py       # 2 smoke checks
    ├── test_regression.py  # 3 regression checks
    └── test_kpi.py         # 1 lock-time KPI
```

## Running

Local against a real device:

```bash
pip install -e .
pip install -e ../plugins/pytest-automation-reports/

pytest tests/ \
  --ar-url=http://reports.local:8000/api/v1 \
  --ar-launch-name="dev smoke $(date +%s)" \
  --ar-tag=dev --ar-auto-analyze \
  --device-host=10.0.0.42 --device-user=root \
  --device-cmds=commands/examples/wnc_radio.json \
  -m smoke
```

Marker-driven test selection — you don't edit suite XML, you compose markers:

```bash
pytest -m "smoke and not slow"
pytest -m "regression and team_allstars"
pytest -m kpi --ar-launch-name="kpi-nightly"
```

Parallel across two radios:

```bash
pytest -n 2 -m smoke --device-host=radio1 --device-host=radio2
```

## See also

- [`ReportStack_pytest_Framework_Guide.docx`](../ReportStack_pytest_Framework_Guide.docx) — full architectural guide.
- [`ReportStack_User_Guide.docx`](../ReportStack_User_Guide.docx) — end-user scenarios.
- [`deploy/PREREQUISITES.md`](../deploy/PREREQUISITES.md) — what to install on the host.
