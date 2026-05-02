# ReportStack — E2E test suite

Playwright-based browser + API tests covering auth, launch lifecycle,
test items / logs / attachments, AI analysis, defects, and comments.

## What's covered

| File | Surface |
|------|---------|
| `auth.spec.ts` | Register, login, logout, role gating (`/auth/users` admin-only), invalid-credentials error, register/login form toggle. |
| `launches.spec.ts` | Launch list rendering, launch detail navigation, LIVE badge, finish lifecycle, status filter, retry chain, bulk-update. |
| `test-items-logs.spec.ts` | Failed items in launch detail, log batch upload + level filter, attachment upload + serve, oversize attachment rejection, test detail rendering. |
| `analysis-defects.spec.ts` | Trigger AI analysis, manual override, comment CRUD, defect CRUD, analysis-summary aggregation, comments/defects rendered on test detail page. |

Total: 28 test cases across the four files.

## Running locally

```bash
# 1. Make sure the backend is up and reachable.
docker compose up -d backend db
# 2. Make sure the frontend is up.
cd frontend && npm start &
# 3. Install deps + browsers (one-off).
cd tests/e2e
npm install
npm run install:browsers
# 4. Run the suite.
npm test
```

## Configuration

| Env var | Default | Purpose |
|---------|---------|---------|
| `RS_FRONTEND_URL` | `http://localhost:3000` | Where the React app is served. |
| `RS_API_URL` | `http://localhost:8000/api/v1` | Backend REST API. |
| `RS_HEADLESS` | (headless) | Set `0` to watch the browser drive. |

## Design notes

The ReportStack UI doesn't expose forms for creating launches or test items
(those come from the pytest plugin in production). Tests use the REST API to
seed data, then drive the UI for assertions. Helpers in `fixtures/api-helper.ts`
register users, create launches, batch-upload items and logs, upload
attachments, and add comments/defects.

Auth is injected into the SPA by writing `rs_token` and `rs_user` to
`localStorage` before reload — see `bootSignedIn`. This avoids paying the
login UI cost on every test that doesn't specifically test auth.

Tests use unique user emails (`<prefix>.<random>@e2e.test`) and timestamped
launch names so they're independent: a fresh DB is nice but not required.

The first user to register becomes `ADMIN` (auto-promotion in
`backend/app/api/auth.py`); two tests rely on this. Run against a clean
database for those to pass deterministically.

## Sandbox limitations the suite handles

- **Ollama unreachable**: when AI analysis runs without Ollama, the analyzer
  falls back to `TO_INVESTIGATE`. Tests assert defect_type ∈ the known set
  rather than a specific bucket.
- **MinIO**: attachment tests use a 1×1 PNG (`TINY_PNG`) and only assert that
  bytes round-trip, so they pass against any S3-compatible backend.

## CI integration

The `playwright.config.ts` opts into a single retry on CI. Add
`PLAYWRIGHT_HTML_REPORT=playwright-report` to your job's artifact upload list
to surface trace + video on failure.
