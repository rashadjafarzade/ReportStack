# Automation Reports Platform (ReportStack)

## What This Project Is

A self-hosted test automation reporting platform (similar to ReportPortal.io). It collects test results from CI/CD pipelines, displays them in a dashboard, and uses local AI (Ollama) to classify test failures. The core reporting pipeline is fully self-contained — no external API calls.

**Target user**: QA/SDET teams running Selenium/Playwright test suites who need centralized reporting with failure analysis.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | FastAPI + SQLAlchemy + Alembic | Python 3.12, FastAPI 0.111 |
| Database | PostgreSQL | 16 (Alpine) |
| Frontend | React + TypeScript | React 19, TS 4.9.5 (pinned by CRA; compiles clean thanks to `skipLibCheck: true` — confirmed May 2026) |
| Charts | Recharts | 3.8 |
| AI | Ollama (local LLM) | mistral:7b default |
| Plugin | pytest plugin | pytest >= 7.0 |
| Storage | MinIO (S3-compatible) | latest |
| Auth | JWT (PyJWT + bcrypt) | — |
| E2E Tests | Playwright | ^1.48 |
| Infra | Docker Compose v2 | Compose file declares `version: "3.8"` (ignored by modern Compose) |

## Architecture

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│  pytest plugin   │────>│  FastAPI      │────>│  PostgreSQL  │
│  (test runner)   │     │  Backend      │     │              │
└──────────────────┘     │  :8000        │     └──────────────┘
                         │               │
┌──────────────────┐     │  /api/v1/*    │     ┌──────────────┐
│  React Frontend  │<───>│               │────>│  Ollama      │
│  :3000 (nginx)   │     │               │     │  :11434      │
└──────────────────┘     └──────────────┘     └──────────────┘
                              │
                         ┌────┴────┐
                         │  MinIO  │
                         │  :9000  │
                         │ S3 obj  │
                         └─────────┘
```

## Project Structure

```
automation-reports/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers
│   │   │   ├── launches.py      # CRUD launches
│   │   │   ├── test_items.py    # CRUD test items
│   │   │   ├── logs.py          # Test log CRUD + batch
│   │   │   ├── attachments.py   # File upload/serve/delete
│   │   │   ├── analyses.py      # AI analysis trigger/results/override
│   │   │   ├── comments.py      # Item-level and launch-level comment CRUD
│   │   │   ├── defects.py       # Defect CRUD with status management
│   │   │   ├── members.py       # Project member CRUD with roles
│   │   │   ├── project_settings.py  # GET/PUT singleton project settings
│   │   │   ├── dashboards.py       # Dashboard CRUD with widget management
│   │   │   ├── test_history.py     # Test history + most-failed endpoint
│   │   │   └── auth.py             # JWT login/register/me/users
│   │   ├── models/          # SQLAlchemy models
│   │   │   ├── launch.py        # Launch (status, stats)
│   │   │   ├── test_item.py     # TestItem (status, error, trace) + relationships to comments/defects
│   │   │   ├── log.py           # TestLog (level, message, order)
│   │   │   ├── attachment.py    # Attachment (file on disk)
│   │   │   ├── analysis.py      # FailureAnalysis (defect type, confidence)
│   │   │   ├── comment.py       # Comment (author, text, test_item/launch)
│   │   │   ├── defect.py        # Defect (summary, status, external link)
│   │   │   ├── member.py        # Member (name, email, role)
│   │   │   ├── project_settings.py  # ProjectSettings singleton
│   │   │   └── user.py             # User (email, password, role) for auth
│   │   ├── schemas/         # Pydantic request/response models
│   │   │   ├── launch.py / test_item.py / log.py / attachment.py / analysis.py
│   │   │   ├── comment.py       # CommentCreate, CommentUpdate, CommentResponse
│   │   │   ├── defect.py        # DefectCreate, DefectUpdate, DefectResponse
│   │   │   ├── member.py        # MemberCreate, MemberUpdate, MemberResponse
│   │   │   └── project_settings.py  # ProjectSettingsUpdate, ProjectSettingsResponse
│   │   ├── services/
│   │   │   ├── ai_analyzer.py   # Ollama client, prompt engineering
│   │   │   ├── storage.py       # MinIO S3 wrapper (upload/download/delete)
│   │   │   ├── auth.py          # JWT token creation/validation, password hashing
│   │   │   └── retention.py     # Data retention cleanup daemon
│   │   ├── database.py      # Engine, session, Base
│   │   └── main.py          # App setup, CORS, router registration
│   ├── migrations/
│   │   └── versions/        # 001-010: logs, attachments, analyses, comments_defects, members_settings, retention, dashboards, launch_tags, users, retry_tracking
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── alembic.ini
│   └── seed_data.py
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API clients
│   │   │   ├── client.ts       # Base axios instance (REACT_APP_API_URL)
│   │   │   ├── launches.ts
│   │   │   ├── logs.ts
│   │   │   ├── attachments.ts
│   │   │   ├── analyses.ts
│   │   │   ├── comments.ts     # getItemComments, createItemComment, deleteComment
│   │   │   ├── defects.ts      # getItemDefects, createItemDefect, updateDefect, deleteDefect
│   │   │   ├── members.ts      # getMembers, addMember, updateMemberRole, removeMember
│   │   │   ├── settings.ts     # getSettings, updateSettings
│   │   │   └── auth.ts         # login, register, getMe, updateProfile
│   │   ├── components/      # Reusable UI components
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── StatsBar.tsx
│   │   │   ├── LogViewer.tsx
│   │   │   ├── ScreenshotViewer.tsx
│   │   │   ├── AnalysisBadge.tsx
│   │   │   ├── AnalysisPanel.tsx
│   │   │   ├── LaunchAnalysisSummary.tsx
│   │   │   ├── CommentSection.tsx   # Comment list with avatars, add/delete
│   │   │   ├── DefectPanel.tsx      # Defect list with status dropdowns
│   │   │   └── DefectSelector.tsx   # ReportPortal-style defect type selector with AI suggestions
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # React auth context (user, token, setAuth, logout)
│   │   ├── pages/
│   │   │   ├── Dashboards.tsx   # Widget-based dashboard with dropdown selector
│   │   │   ├── LaunchList.tsx   # Dashboard with metrics + table
│   │   │   ├── LaunchDetail.tsx # Two-column layout: error/logs left, defect selector right
│   │   │   ├── Members.tsx      # Team member table with role management
│   │   │   ├── Settings.tsx     # 9-tab settings page (ReportPortal-style)
│   │   │   └── Login.tsx        # Login/Register form with auth
│   │   ├── styles/
│   │   │   ├── design-tokens.css    # CSS custom properties (colors, spacing, etc.)
│   │   │   ├── components.css       # Full component class library
│   │   │   └── project-settings.css # Settings page styles (ps-* classes, modals, tabs)
│   │   ├── types/index.ts   # All TypeScript interfaces
│   │   └── App.tsx          # Router + sidebar layout (Navigation + Project sections)
│   ├── Dockerfile           # Multi-stage: node build -> nginx
│   └── nginx.conf           # SPA routing + /api/ proxy
├── plugins/
│   └── pytest-automation-reports/
│       ├── pyproject.toml
│       └── pytest_automation_reports/
│           ├── plugin.py        # pytest hooks + fixture
│           ├── client.py        # HTTP client to backend
│           ├── config.py        # CLI options (--ar-url, etc.)
│           ├── log_capture.py   # logging.Handler for test logs
│           └── screenshot.py    # Selenium/Playwright screenshot capture
├── tests/
│   └── e2e/                 # Playwright E2E tests
│       ├── playwright.config.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── fixtures/
│       │   └── api-helper.ts    # API seeding helpers (register, createLaunch, etc.)
│       ├── auth.spec.ts         # Auth flow + role tests
│       ├── launches.spec.ts     # Launch lifecycle + filtering + bulk ops + retry
│       └── test-items-logs.spec.ts  # Items, logs, attachments, detail page
├── docker-compose.yml       # db + backend + frontend + minio + ollama
└── .env.example
```

## Data Model

```
Launch (1) ──> (N) TestItem
  │                  │
  │ tags (JSON)      ├──> (N) TestLog         (ordered by order_index)
  │                  ├──> (N) Attachment       (MinIO S3 objects)
  │                  ├──> (N) FailureAnalysis  (AI or manual)
  │                  ├──> (N) Comment          (author, text, timestamps)
  │                  ├──> (N) Defect           (summary, status, external link)
  │                  └──> (0..1) TestItem      (retry_of self-ref FK)
  │
  ├──> (N) Attachment (launch-level)
  └──> (N) Comment    (launch-level)

User (standalone)             # email, hashed_password, role (ADMIN/MANAGER/MEMBER/VIEWER)
Member (standalone)           # name, email, role (ADMIN/MANAGER/MEMBER/VIEWER)
  ⚠ User and Member overlap (name, email, role) but are fully independent — no FK, no
    dual-write. Registration creates User only; Members are managed separately via
    /members/. This is read-only overlap today (not a live bug), but will cause confusion
    in multi-user prod if someone expects "team members" to reflect registered users.
    Resolution: either merge into one table or add User→Member FK + auto-sync.
ProjectSettings (singleton)   # project config (name, retention, AI, notifications)
Dashboard (1) ──> (N) Widget  # configurable widget grids
```

### Key Enums
- **LaunchStatus**: IN_PROGRESS, PASSED, FAILED, STOPPED
- **TestStatus**: PASSED, FAILED, SKIPPED, ERROR
- **LogLevel**: TRACE, DEBUG, INFO, WARN, ERROR
- **AttachmentType**: SCREENSHOT, LOG_FILE, VIDEO, OTHER
- **DefectType**: PRODUCT_BUG, AUTOMATION_BUG, SYSTEM_ISSUE, NO_DEFECT, TO_INVESTIGATE
- **AnalysisSource**: AI_AUTO, MANUAL
- **DefectStatus**: OPEN, IN_PROGRESS, FIXED, WONT_FIX, DUPLICATE
- **MemberRole**: ADMIN, MANAGER, MEMBER, VIEWER

## API Endpoints (all under /api/v1)

### Launches
- `POST /launches/` — create (supports `tags` as JSON array)
- `GET /launches/` — list (paginated, filter by `status`, `tag`, `name`)
- `GET /launches/{id}` — get one
- `PUT /launches/{id}/finish` — finish with status
- `DELETE /launches/{id}` — delete

### Test Items
- `POST /launches/{id}/items/` — create single (supports `retry_of`)
- `POST /launches/{id}/items/batch` — create batch
- `GET /launches/{id}/items/` — list (filter by status, suite, name, duration_min/max, start_from/to; sort by start_time/duration_ms/name/status)
- `GET /launches/{id}/items/{item_id}` — get one
- `GET /launches/{id}/items/{item_id}/retries` — get retry chain
- `POST /launches/{id}/items/bulk-update` — bulk status update
- `POST /launches/{id}/items/bulk-defect` — bulk defect assignment
- `POST /launches/{id}/items/bulk-analyze` — bulk AI analysis (202)

### Test History
- `GET /items/most-failed` — aggregated most-failed tests across launches (note: not nested under `/launches/{id}` — intentionally cross-launch)

### Logs
- `POST /launches/{id}/items/{item_id}/logs/` — create single
- `POST /launches/{id}/items/{item_id}/logs/batch` — create batch (primary path)
- `GET /launches/{id}/items/{item_id}/logs/` — list (filter by level, paginated)

### Attachments
- `POST /launches/{id}/items/{item_id}/attachments` — upload file (multipart, 20MB max)
- `POST /launches/{id}/attachments` — launch-level upload
- `GET /launches/{id}/items/{item_id}/attachments` — list
- `GET /attachments/{id}/file` — serve file (from MinIO)
- `DELETE /attachments/{id}` — delete file from MinIO + DB record

### AI Analysis
- `POST /launches/{id}/analyze` — trigger all failures (BackgroundTasks, 202)
- `POST /launches/{id}/items/{item_id}/analyze` — trigger single (202)
- `GET /launches/{id}/items/{item_id}/analyses` — get analyses
- `GET /launches/{id}/analysis-summary` — aggregate defect counts
- `PUT /launches/{id}/items/{item_id}/analyses/{analysis_id}` — manual override

### Comments
- `POST /launches/{id}/items/{item_id}/comments/` — create item-level comment
- `GET /launches/{id}/items/{item_id}/comments/` — list item comments
- `POST /launches/{id}/comments/` — create launch-level comment
- `GET /launches/{id}/comments/` — list launch comments
- `PUT /comments/{id}` — update comment
- `DELETE /comments/{id}` — delete comment

### Defects
- `POST /launches/{id}/items/{item_id}/defects/` — create defect
- `GET /launches/{id}/items/{item_id}/defects/` — list defects
- `PUT /defects/{id}` — update defect (status, summary, external link)
- `DELETE /defects/{id}` — delete defect

### Members
- `GET /members/` — list all members
- `POST /members/` — add member (unique email)
- `PUT /members/{id}` — update role
- `DELETE /members/{id}` — remove member

### Project Settings
- `GET /settings/` — get settings (auto-creates with defaults)
- `PUT /settings/` — update settings

### Auth
- `POST /auth/register` — create user, return JWT token
- `POST /auth/login` — verify credentials, return JWT token
- `GET /auth/me` — get current user (requires auth)
- `PUT /auth/me` — update own name
- `GET /auth/users` — list all users (ADMIN only)
- `PUT /auth/users/{id}` — update role/active status (ADMIN only)

> **CI/CD service accounts**: The pytest plugin uses `AR_TOKEN` (a JWT). For Jenkins, register a dedicated service user (e.g., `jenkins@reportstack.local`) via `/auth/register` and store the returned JWT as a Jenkins credential. Current JWTs expire after `JWT_EXPIRE_MINUTES` (default 1440 = 24h). For long-lived CI tokens, either increase the expiry for the service user or implement a dedicated API-key table (future enhancement).

### Dashboards
- `GET /dashboards/` — list dashboards
- `POST /dashboards/` — create dashboard
- `GET /dashboards/{id}` — get dashboard with widgets
- `PUT /dashboards/{id}` — update dashboard
- `DELETE /dashboards/{id}` — delete dashboard
- `POST /dashboards/{id}/widgets` — add widget
- `DELETE /dashboards/{id}/widgets/{widget_id}` — remove widget

## Frontend Design System

### Design Tokens (CSS Custom Properties)
All styling uses `var(--token)` references defined in `design-tokens.css`. Never hardcode colors, spacing, or fonts.

- **Brand palette** (set May 2026 — supersedes the original indigo): `--color-primary` `#1e40af`, `--color-primary-hover` `#1e3a8a`, `--color-primary-active` `#3b82f6` (bright accent — sidebar stripe, focus ring), `--color-primary-soft` `#eff6ff` (row tints, subtle backgrounds), `--color-primary-light` `#dbeafe`
- **Brand gradients**: `--gradient-brand` (`#1e40af → #0b2e7c`, used on the logo tile and login top stripe), `--gradient-brand-soft` (`#eff6ff → #dbeafe`, reserved for hero/empty states)
- **Status colors**: `--color-passed`, `--color-failed`, `--color-skipped`, `--color-error`, `--color-in-progress`, `--color-stopped`
- **Spacing**: Scale from `--space-1` (4px) to `--space-12` (48px)
- **Typography**: `--font-sans` (Inter), `--font-mono` (JetBrains Mono), sizes `--text-xs` to `--text-2xl`
- **Shadows**: `--shadow-xs` to `--shadow-xl`
- **Radius**: `--radius-sm` (4px) to `--radius-full` (9999px)

### Branding & Logo Assets
Brand identity: stacked horizontal bars in three blue tones (a bar chart / "stack" metaphor matching the platform's purpose), paired with a "Report**Stack**" wordmark where "Stack" picks up the primary blue.

| Asset | Path | Purpose |
|-------|------|---------|
| Horizontal lockup | `frontend/src/logo.svg` | Imported in components (Sidebar, Login). Text is converted to vector paths so it renders identically without a font dependency. |
| Centered icon mark | (built inline in `App.tsx`) | 3-bar SVG inside the 36×36 brand-gradient tile in the sidebar logo block. |
| Favicon | `frontend/public/favicon.ico` | Multi-size (16/32/48/64/128/256) bundled from the rounded blue tile design. |
| PWA icons | `frontend/public/logo192.png`, `logo512.png` | Apple touch icon + PWA install icon. |
| App tile mark | (rendered inside `.sidebar-logo-icon`) | Uses `--gradient-brand` background with white/light bars. |

PWA metadata in `frontend/public/manifest.json` (`name`, `short_name`, `theme_color: #1E40AF`) and `<title>` / `<meta theme-color>` in `index.html` are aligned with the brand. The pre-existing CRA placeholders are gone.

Bonus working files (logo source SVGs, full lockup, stacked variant, icon tile) live outside the repo in the original Cowork session output folder; only the in-app assets above are versioned here.

### Component Classes (in components.css)
Use CSS classes, NOT inline styles. Key classes:
- Layout: `.layout`, `.layout-sidebar`, `.layout-main`, `.layout-content`
- Cards: `.card`, `.card-header`, `.card-body`, `.metric-card`
- Tables: `.data-table`, `.row-clickable`, `.row-expanded`, `.cell-name`, `.cell-secondary`
- Badges: `.badge`, `.badge-passed`, `.badge-failed`, `.badge-defect`
- Buttons: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm`, `.btn-lg`
- Forms: `.select`, `.input`
- Tabs: `.tabs`, `.tab`, `.tab.active`, `.tab-content`
- Loading: `.spinner`, `.loading-center`, `.skeleton`
- Empty: `.empty-state`, `.empty-state-icon`, `.empty-state-title`

### Project Settings Classes (in project-settings.css)
The Settings page uses a dedicated CSS file with `ps-*` prefixed classes:
- Shell: `.ps-shell` (grid layout with 220px sidebar + content)
- Tabs: `.ps-tabs`, `.ps-tab`, `.ps-tab.active`, `.ps-tab-icon`
- Panels: `.ps-panel`, `.ps-panel-head`, `.ps-panel-title`
- Fields: `.ps-field`, `.ps-field-label`, `.ps-input`, `.ps-select`, `.ps-select-wrap`
- Buttons: `.ps-btn`, `.ps-btn-primary`
- Toggle: `.ps-switch`, `.ps-switch.on`
- Integrations: `.ps-int-card`, `.ps-int-grid`, `.ps-int-status`
- Notifications: `.ps-channel`, `.ps-rule`, `.ps-create-rule-btn`
- Defect types: `.ps-dt-group`, `.ps-dt-row`, `.ps-dt-color-swatch`, `.ps-dt-abbr`
- Log types: `.ps-lt-table`, `.ps-lt-row`, `.ps-lt-preview`
- Analyzer: `.ps-subtabs`, `.ps-subtab`, `.ps-slider-wrap`, `.ps-radio`, `.ps-radio-row`
- Modals: `.ps-modal-overlay`, `.ps-modal-head`, `.ps-modal-foot`, `.ps-rule-modal`, `.ps-confirm-modal`
- Toast: `.ps-toast`

### Settings Page Tabs
The Project Settings page (`Settings.tsx`) has 9 tabs:
1. **General** — Project name, inactivity timeout, retention (launches/logs/attachments)
2. **Integrations** — Grid of integration cards (Jira, Azure DevOps, GitLab, Monday, Rally, Jama, Email, Sauce Labs)
3. **Notifications** — Master toggle, email/slack channels with expandable sections, notification rule CRUD with triggers/recipients/attributes
4. **Defect types** — 5 groups (PB, AB, SI, ND, TI) with color swatches, abbreviations, add/edit/delete subtypes via modal with color picker
5. **Log types** — Table of log types with color, level, preview, filter toggle; create/edit custom types
6. **Analyzer** — 4 sub-tabs: Index Settings, Auto-Analysis (toggle, base, match slider, log lines), Similar Items (match slider), Unique Errors (toggle, radio options)
7. **Pattern-analysis** — Placeholder (coming soon)
8. **Demo data** — Placeholder (coming soon)
9. **Quality gates** — Placeholder (coming soon)

### Layout
- Dark sidebar (240px) with navigation links (Dashboard, Launches) + Project section (Members, Settings). Logo header uses a 36×36 `--gradient-brand` tile housing the inline 3-bar SVG mark.
- Active `.sidebar-link` shows a 3px `--color-primary-active` left stripe (via `::before`) over a soft blue tint.
- Main content area with max-width 1280px. `.page-title` uses `-0.015em` letter-spacing for a tighter brand feel.
- Metric cards in auto-fit grid at top of pages; hover lifts with a brand-tinted shadow rather than the previous neutral one.
- Login surface uses a layered radial brand-tinted gradient backdrop, a 16-radius card with `--shadow-xl`, and a 3px `--gradient-brand` stripe across the card's top edge.
- LaunchDetail uses two-column layout for failed tests: error/logs left, DefectSelector right.

### Brand rollout status
Wave 1 (May 2026) — committed on `main`: tokens + Sidebar + Login + Launches list + small launch-detail polish (back button hover, page-title spacing, btn-primary brand shadow).

Wave 2 (May 2026) — completed: all hardcoded indigo colors (`#6366f1`, `#4f46e5`, etc.) replaced with brand tokens across Dashboards, Trends, LaunchDetail, extras.css, and components.css. Empty-state icons use `--color-primary-soft` / `--color-primary`.

Dark mode (May 2026) — completed: full `[data-theme="dark"]` token overrides in `design-tokens.css`, dark surface overrides in `extras.css`, functional theme switcher in Profile page (light/dark/system via `ThemeContext`), system preference detection via `matchMedia`.

## AI Analyzer Details

### How It Works
1. `POST /launches/{id}/analyze` triggers `BackgroundTasks`
2. For each FAILED/ERROR test item (without existing analysis):
   - Gathers: test name, suite, error_message, stack_trace (last 50 lines), recent logs (last 20)
   - Sends to Ollama with classification prompt
   - Expects JSON: `{"defect_type": "...", "confidence": 0.0-1.0, "reasoning": "..."}`
   - Confidence < 0.4 auto-flags as TO_INVESTIGATE
3. Retries once on JSON parse failure; falls back to TO_INVESTIGATE if Ollama unreachable

### Config
- `OLLAMA_BASE_URL` (default: http://localhost:11434)
- `OLLAMA_MODEL` (default: mistral:7b)
- System prompt version tracked in DB (`prompt_version` field)

## pytest Plugin Usage

```bash
pip install -e plugins/pytest-automation-reports/

pytest --ar-url=http://server:8000/api/v1 \
       --ar-launch-name="Regression Run" \
       --ar-launch-description="Build #123" \
       --ar-auto-analyze
```

### Fixture
```python
def test_login(report_screenshot, page):
    page.goto("/login")
    report_screenshot(page, "login_page")  # queued for upload
    assert page.title() == "Login"
```

## Deployment (Docker Compose)

```bash
docker compose up -d --build
docker compose exec ollama ollama pull mistral:7b
python3 backend/seed_data.py  # optional demo data
```

Services: db (:5432), minio (:9000/:9001), backend (:8000), frontend (:3000), ollama (:11434)

Docker healthchecks are configured with `condition: service_healthy` for startup ordering.

GPU: Ollama uses nvidia GPU if available. Remove `deploy.resources` block for CPU-only.

> **twd00030 deployment note**: The production compose (see `cicd-skill.md`) strips MinIO (uses local volume for attachments) and defers Ollama (`AI_ANALYSIS_ENABLED=false`). The backend code supports both storage backends — MinIO when `MINIO_ENDPOINT` is set, local disk when `ATTACHMENT_PATH` is set. The directory on twd00030 is `~/projects/reports-app/` (Compose network: `reports-app_default`).

## Conventions

- **Backend**: Follow existing pattern — router in `api/`, model in `models/`, schema in `schemas/`. All models exported from `models/__init__.py`. Routers registered in `main.py`.
- **Frontend**: Components in `src/components/`, pages in `src/pages/`, API clients in `src/api/`. All types in `src/types/index.ts`. Use design system CSS classes, not inline styles.
- **Settings page**: Uses `ps-*` prefixed CSS classes from `project-settings.css`. Each tab is a self-contained component within `Settings.tsx`. State is local (frontend-only) for tabs like Integrations, Notifications, Defect types, Log types, and Analyzer.
- **Migrations**: Sequential numbering `001_`, `002_`, etc. in `migrations/versions/`.
- **AI analysis**: Runs locally through Ollama on the Docker network. No external API calls.
- **File storage (dev)**: Attachments stored in MinIO (S3-compatible) in the `attachments` bucket, organized as `{launch_id}/{item_id}/{uuid}_{filename}`.
- **File storage (twd00030 production)**: MinIO replaced with local Docker volume at `ATTACHMENT_PATH=/data/attachments`. Backend currently only has a MinIO adapter (`services/storage.py`). Needs a `Storage` abstraction with two implementations:
  ```
  # services/storage.py — target shape
  class Storage(ABC):
      put(key: str, data: bytes, content_type: str) -> None
      get(key: str) -> tuple[bytes, str]
      delete(key: str) -> None
      url_for(key: str) -> str

  class MinIOStorage(Storage): ...   # existing code, wraps minio client
  class LocalDiskStorage(Storage): ... # reads/writes to ATTACHMENT_PATH

  # Pick implementation at startup:
  STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "minio")  # "minio" | "local"
  storage = MinIOStorage() if STORAGE_BACKEND == "minio" else LocalDiskStorage()
  ```
  Callers (`api/attachments.py`) import `storage` and call `storage.put()` etc. — no backend-specific logic leaks out.
