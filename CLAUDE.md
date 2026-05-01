# Automation Reports Platform

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
                         │  Disk   │
                         │ /data/  │
                         │attachm. │
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
│   │   │   └── analyses.py      # AI analysis trigger/results/override
│   │   ├── models/          # SQLAlchemy models
│   │   │   ├── launch.py        # Launch (status, stats)
│   │   │   ├── test_item.py     # TestItem (status, error, trace)
│   │   │   ├── log.py           # TestLog (level, message, order)
│   │   │   ├── attachment.py    # Attachment (file on disk)
│   │   │   └── analysis.py      # FailureAnalysis (defect type, confidence)
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/
│   │   │   └── ai_analyzer.py   # Ollama client, prompt engineering
│   │   ├── database.py      # Engine, session, Base
│   │   └── main.py          # App setup, CORS, router registration
│   ├── migrations/
│   │   └── versions/        # 001_logs, 002_attachments, 003_analyses
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
│   │   │   └── analyses.ts
│   │   ├── components/      # Reusable UI components
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── StatsBar.tsx
│   │   │   ├── LogViewer.tsx
│   │   │   ├── ScreenshotViewer.tsx
│   │   │   ├── AnalysisBadge.tsx
│   │   │   ├── AnalysisPanel.tsx
│   │   │   └── LaunchAnalysisSummary.tsx
│   │   ├── pages/
│   │   │   ├── LaunchList.tsx   # Dashboard with metrics + table
│   │   │   └── LaunchDetail.tsx # Metrics + charts + expandable test rows
│   │   ├── styles/
│   │   │   ├── design-tokens.css  # CSS custom properties (colors, spacing, etc.)
│   │   │   └── components.css     # Full component class library
│   │   ├── types/index.ts   # All TypeScript interfaces
│   │   └── App.tsx          # Router + sidebar layout
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
├── docker-compose.yml       # db + backend + frontend + ollama
└── .env.example
```

## Data Model

```
Launch (1) ──> (N) TestItem
  │                  │
  │                  ├──> (N) TestLog       (ordered by order_index)
  │                  ├──> (N) Attachment    (files on disk)
  │                  └──> (N) FailureAnalysis (AI or manual)
  │
  └──> (N) Attachment (launch-level)
```

### Key Enums
- **LaunchStatus**: IN_PROGRESS, PASSED, FAILED, STOPPED
- **TestStatus**: PASSED, FAILED, SKIPPED, ERROR
- **LogLevel**: TRACE, DEBUG, INFO, WARN, ERROR
- **AttachmentType**: SCREENSHOT, LOG_FILE, VIDEO, OTHER
- **DefectType**: PRODUCT_BUG, AUTOMATION_BUG, SYSTEM_ISSUE, NO_DEFECT, TO_INVESTIGATE
- **AnalysisSource**: AI_AUTO, MANUAL

## API Endpoints (all under /api/v1)

### Launches
- `POST /launches/` — create
- `GET /launches/` — list (paginated)
- `GET /launches/{id}` — get one
- `PUT /launches/{id}/finish` — finish with status
- `DELETE /launches/{id}` — delete

### Test Items
- `POST /launches/{id}/items/` — create single
- `POST /launches/{id}/items/batch` — create batch
- `GET /launches/{id}/items/` — list (filter by status, suite)
- `GET /launches/{id}/items/{item_id}` — get one

### Logs
- `POST /launches/{id}/items/{item_id}/logs/` — create single
- `POST /launches/{id}/items/{item_id}/logs/batch` — create batch (primary path)
- `GET /launches/{id}/items/{item_id}/logs/` — list (filter by level, paginated)

### Attachments
- `POST /launches/{id}/items/{item_id}/attachments` — upload file (multipart, 20MB max)
- `POST /launches/{id}/attachments` — launch-level upload
- `GET /launches/{id}/items/{item_id}/attachments` — list
- `GET /attachments/{id}/file` — serve file (FileResponse)
- `DELETE /attachments/{id}` — delete file + DB record

### AI Analysis
- `POST /launches/{id}/analyze` — trigger all failures (BackgroundTasks, 202)
- `POST /launches/{id}/items/{item_id}/analyze` — trigger single (202)
- `GET /launches/{id}/items/{item_id}/analyses` — get analyses
- `GET /launches/{id}/analysis-summary` — aggregate defect counts
- `PUT /launches/{id}/items/{item_id}/analyses/{analysis_id}` — manual override

## Frontend Design System

### Design Tokens (CSS Custom Properties)
All styling uses `var(--token)` references defined in `design-tokens.css`. Never hardcode colors, spacing, or fonts.

- **Colors**: Semantic names like `--color-passed`, `--color-primary`, `--color-text-secondary`
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

### Layout
- Dark sidebar (240px) with navigation links
- Main content area with max-width 1280px
- Metric cards in auto-fit grid at top of pages

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

Services: db (:5432), backend (:8000), frontend (:3000), ollama (:11434), bot (Telegram polling)

GPU: Ollama uses nvidia GPU if available. Remove `deploy.resources` block for CPU-only.

## Telegram CEO Agent Bot

### What It Is
A Telegram bot powered by Claude AI that serves as the project's intelligent assistant. It carries full project knowledge (architecture, APIs, code conventions) and can query the live system.

### Architecture
```
Telegram User ↔ Telegram API ↔ Bot (python-telegram-bot)
                                  │
                                  ├── Claude API (reasoning, project knowledge)
                                  └── Backend API (live data: launches, tests, analysis)
```

### Files
```
bot/
├── main.py            # Entry point, handler registration
├── config.py          # Env vars (tokens, URLs, allowed users)
├── agent.py           # Claude client with tools + conversation history
├── handlers.py        # Telegram command & message handlers
├── backend_client.py  # Async httpx client for backend API
├── requirements.txt   # python-telegram-bot, anthropic, httpx
└── Dockerfile
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
- **Migrations**: Sequential numbering `001_`, `002_`, etc. in `migrations/versions/`.
- **No external API calls**: Everything local. AI runs through Ollama on the same network.
- **File storage**: Attachments on disk at `ATTACHMENT_STORAGE_PATH`, organized as `{launch_id}/{item_id}/{uuid}_{filename}`.
