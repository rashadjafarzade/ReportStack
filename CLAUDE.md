# Automation Reports Platform (ReportStack)

## What This Project Is

A self-hosted test automation reporting platform (similar to ReportPortal.io). It collects test results from CI/CD pipelines, displays them in a dashboard, and uses local AI (Ollama) to classify test failures. No external API calls — everything runs on a local Linux server.

**Target user**: QA/SDET teams running Selenium/Playwright test suites who need centralized reporting with failure analysis.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | FastAPI + SQLAlchemy + Alembic | Python 3.12, FastAPI 0.111 |
| Database | PostgreSQL | 16 (Alpine) |
| Frontend | React + TypeScript | React 19, TS 4.9 |
| Charts | Recharts | 3.8 |
| AI | Ollama (local LLM) | mistral:7b default |
| Plugin | pytest plugin | pytest >= 7.0 |
| Storage | MinIO (S3-compatible) | latest |
| Auth | JWT (PyJWT + passlib/bcrypt) | — |
| Infra | Docker Compose | v3.8 |

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
├── bot/                     # Telegram CEO Agent Bot
│   ├── main.py              # Entry point, handler registration
│   ├── config.py            # Env vars (tokens, URLs, allowed users)
│   ├── agent.py             # Claude client with tools + conversation history
│   ├── handlers.py          # Telegram command & message handlers
│   ├── backend_client.py    # Async httpx client for backend API
│   ├── requirements.txt     # python-telegram-bot, anthropic, httpx
│   └── Dockerfile
├── docker-compose.yml       # db + backend + frontend + ollama + bot
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
- `GET /items/most-failed` — aggregated most-failed tests across launches

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

- **Colors**: Semantic names like `--color-passed`, `--color-primary`, `--color-text-secondary`, `--color-surface-secondary`
- **Spacing**: Scale from `--space-1` (4px) to `--space-12` (48px)
- **Typography**: `--font-sans` (Inter), `--font-mono` (JetBrains Mono), sizes `--text-xs` to `--text-2xl`
- **Shadows**: `--shadow-xs` to `--shadow-xl`
- **Radius**: `--radius-sm` (4px) to `--radius-full` (9999px)

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
3. **Notifications** — Master toggle, email/slack/telegram channels with expandable sections, notification rule CRUD with triggers/recipients/attributes
4. **Defect types** — 5 groups (PB, AB, SI, ND, TI) with color swatches, abbreviations, add/edit/delete subtypes via modal with color picker
5. **Log types** — Table of log types with color, level, preview, filter toggle; create/edit custom types
6. **Analyzer** — 4 sub-tabs: Index Settings, Auto-Analysis (toggle, base, match slider, log lines), Similar Items (match slider), Unique Errors (toggle, radio options)
7. **Pattern-analysis** — Placeholder (coming soon)
8. **Demo data** — Placeholder (coming soon)
9. **Quality gates** — Placeholder (coming soon)

### Layout
- Dark sidebar (240px) with navigation links (Dashboard, Launches) + Project section (Members, Settings)
- Main content area with max-width 1280px
- Metric cards in auto-fit grid at top of pages
- LaunchDetail uses two-column layout for failed tests: error/logs left, DefectSelector right

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

Services: db (:5432), minio (:9000/:9001), backend (:8000), frontend (:3000), ollama (:11434), bot (Telegram polling)

Docker healthchecks are configured with `condition: service_healthy` for startup ordering.

GPU: Ollama uses nvidia GPU if available. Remove `deploy.resources` block for CPU-only.

## Telegram CEO Agent Bot

### What It Is
A Telegram bot powered by Claude AI that serves as the project's intelligent assistant. It carries full project knowledge (architecture, APIs, code conventions) and can query the live system.

### Architecture
```
Telegram User <-> Telegram API <-> Bot (python-telegram-bot)
                                  |
                                  |-- Claude API (reasoning, project knowledge)
                                  +-- Backend API (live data: launches, tests, analysis)
```

### Commands
| Command | Description |
|---------|-------------|
| `/start`, `/help` | Welcome message and command list |
| `/status` | Backend health check + launch count |
| `/launches` | Recent 8 launches with pass rates |
| `/launch <id>` | Detailed launch info + analysis summary |
| `/failures <id>` | List failed tests with error previews |
| `/analyze <id>` | Trigger AI failure analysis |
| `/clear` | Reset conversation history |
| Free text | Routed to Claude agent with full project context |

### Claude Tools
The agent has 6 tools it can invoke during conversation:
1. `check_system_health` — GET /health
2. `get_launches` — GET /launches/ (paginated)
3. `get_launch_detail` — GET /launches/{id}
4. `get_failed_tests` — GET /items/ filtered by FAILED + ERROR
5. `get_analysis_summary` — GET /analysis-summary
6. `trigger_analysis` — POST /launches/{id}/analyze

### Config (env vars)
- `TELEGRAM_BOT_TOKEN` — from @BotFather
- `ANTHROPIC_API_KEY` — Claude API key
- `CLAUDE_MODEL` — default `claude-sonnet-4-20250514`
- `AR_BACKEND_URL` — default `http://backend:8000/api/v1` (Docker) or `http://localhost:8000/api/v1`
- `AR_FRONTEND_URL` — for generating dashboard links
- `ALLOWED_USER_IDS` — comma-separated Telegram user IDs (empty = allow all)
- `MAX_HISTORY` — conversation turns to retain per user (default 20)

### Setup
1. Create bot via @BotFather on Telegram, get token
2. Get Anthropic API key from console.anthropic.com
3. Set env vars in `.env` or docker-compose environment
4. Run: `docker compose up bot` or `cd bot && pip install -r requirements.txt && python main.py`

## Conventions

- **Backend**: Follow existing pattern — router in `api/`, model in `models/`, schema in `schemas/`. All models exported from `models/__init__.py`. Routers registered in `main.py`.
- **Frontend**: Components in `src/components/`, pages in `src/pages/`, API clients in `src/api/`. All types in `src/types/index.ts`. Use design system CSS classes, not inline styles.
- **Settings page**: Uses `ps-*` prefixed CSS classes from `project-settings.css`. Each tab is a self-contained component within `Settings.tsx`. State is local (frontend-only) for tabs like Integrations, Notifications, Defect types, Log types, and Analyzer.
- **Migrations**: Sequential numbering `001_`, `002_`, etc. in `migrations/versions/`.
- **No external API calls**: Everything local. AI runs through Ollama on the same network.
- **File storage**: Attachments stored in MinIO (S3-compatible) in the `attachments` bucket, organized as `{launch_id}/{item_id}/{uuid}_{filename}`.
