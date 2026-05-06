# Automation Reports Platform (ReportStack)

> Source-of-truth document for **how ReportStack works today**. Structured to
> mirror the ReportPortal architecture reference (`docs/reportportal-architecture.md`)
> so the two are easy to compare side-by-side. Every fact in this file
> reflects the system as currently implemented — aspirational changes
> belong in `docs/architecture-roadmap.md`, not here.
>
> **Working with Claude Code:** This file is read automatically by Claude Code
> when invoked from the project root. For deeper detail on specific topics:
>
> - UI navigation patterns and drill-down flows → `docs/UI_NAVIGATION.md`
> - twd00030 deployment host → `cicd-skill.md`
> - TNC test framework that feeds this app → `automation-architect-skill.md`
> - Device lab → `device-lab-skill.md`
> - Top-level routing across skills → `ROUTER.md`

---

## 1. What ReportStack Is

A self-hosted test automation reporting platform, modeled on
[ReportPortal.io](https://reportportal.io) but **deliberately much smaller**.
It collects test results from CI/CD pipelines, displays them in a dashboard,
and uses a local LLM (Ollama) to classify test failures. The core reporting
pipeline is fully self-contained — no external API calls.

**Target user:** QA/SDET teams running Selenium/Playwright/pytest test suites
who need centralized reporting with failure analysis, without paying for or
operating a full ReportPortal stack.

**License model:** internal-only. Not packaged for redistribution.

---

## 2. High-Level Architecture

ReportStack is a **monolithic FastAPI backend + React frontend**, backed by
PostgreSQL for all relational data and either MinIO (dev) or local disk
(twd00030 prod) for binary attachments. There is no message broker, no
search index, no separate analyzer service — these are intentional
simplifications relative to ReportPortal's microservice topology.

```
                      ┌───────────────────────┐
                      │   Test agents         │
                      │   (pytest plugin:     │
                      │ pytest-automation-    │
                      │       reports)        │
                      └──────────┬────────────┘
                                 │ REST (HTTP) — Bearer auth
                                 ▼
        ┌───────────────────────────────────────────────────┐
        │   nginx (frontend container, :3000 / :80)         │
        │   - Serves React SPA                              │
        │   - Reverse-proxies /api/ → backend:8000          │
        │   - /health endpoint for Docker healthcheck       │
        └────────┬──────────────────────────────────┬───────┘
                 │ static                           │ /api/*
                 ▼                                  ▼
        ┌───────────────┐               ┌──────────────────────┐
        │   React SPA   │               │   FastAPI backend    │
        │   (browser)   │ ───────────▶  │   :8000              │
        └───────────────┘    REST       │                      │
                                        │  - all routers       │
                                        │  - all models        │
                                        │  - BackgroundTasks   │
                                        │    for AI analysis   │
                                        └──┬───────────────┬───┘
                                           │               │
                                           ▼               ▼
                                  ┌─────────────┐   ┌─────────────┐
                                  │ PostgreSQL  │   │   Storage   │
                                  │ (metadata,  │   │  MinIO (dev)│
                                  │  results,   │   │     OR      │
                                  │  logs)      │   │  Local disk │
                                  └─────────────┘   │  (prod)     │
                                                    └─────────────┘
                                           │
                                           ▼ (optional, profile-gated)
                                  ┌─────────────┐
                                  │   Ollama    │
                                  │ (mistral:7b)│
                                  │  DEFERRED   │
                                  │  on twd00030│
                                  └─────────────┘
```

Compared to ReportPortal: ReportPortal has 7 services (Gateway, API, UAT,
Analyzer, Jobs, Index, UI) plus 4 backing systems (Postgres, RabbitMQ,
OpenSearch, MinIO). ReportStack collapses everything into 1 backend service
+ 1 frontend container, with Postgres and storage as the only required
backing systems. See §12 for the full comparison.

---

## 3. Component-by-Component

### 3.1 Frontend (nginx + React)

The frontend container does double duty: it serves the compiled React
single-page app **and** acts as the reverse proxy for `/api/` traffic to
the backend. Built with a multi-stage Dockerfile: `node:20-alpine` build
stage compiles the React bundle, then `nginx:1.27-alpine` serves the
static output with a small custom config.

**Routes:**
- `/` and SPA paths → `index.html` (React Router takes over)
- `/api/*` → reverse-proxied to `backend:8000`
- `/health` → returns `200 ok` (used by Docker healthcheck)
- Static assets get long-cache `immutable` headers

**Implementation:** React 19 + TypeScript 4.9.5 (TS pinned by CRA, compiles
clean thanks to `skipLibCheck: true`). Recharts 3.8 for visualizations.

### 3.2 Backend (FastAPI)

The core service. A single FastAPI app at port 8000 that owns everything:

- All HTTP routers (launches, items, logs, attachments, analyses, comments,
  defects, members, project settings, dashboards, test history, auth, api-keys)
- All SQLAlchemy models and Alembic migrations
- The Ollama client and AI analysis logic
- The Storage abstraction (MinIO ↔ Local Disk)
- JWT issuance and API-key generation
- BackgroundTasks for async work (AI analysis fan-out, etc.)

**Implementation:** Python 3.12, FastAPI 0.111, SQLAlchemy + Alembic, PyJWT
+ bcrypt. Single process per container (no separate worker).

**Why a monolith and not RP-style microservices:** at this scale (one
team's tests, ~10s of launches/day), the operational cost of microservices
exceeds the architectural benefit. See §12 for the full reasoning.

### 3.3 PostgreSQL

The single source of truth for all relational data. There is no separate
log index — log text lives in PostgreSQL like everything else. See §4.1
for the schema.

**Implementation:** PostgreSQL 16 (Alpine image). Connection from the
backend is a single SQLAlchemy session per request.

### 3.4 Object storage — MinIO or Local Disk

Binary attachments (screenshots, video recordings, log files) live outside
PostgreSQL. The backend has a `Storage` abstraction (`services/storage.py`)
with two implementations selected at startup via `STORAGE_BACKEND`:

- `MinIOStorage` — S3-compatible, default for Docker Compose dev
- `LocalDiskStorage` — reads/writes to `ATTACHMENT_PATH`, used on twd00030

Both implementations use the same key layout
(`launches/{launch_id}/items/{item_id}/{sha8}_{filename}`) so migrating
between backends is a straight `cp` / `mc cp`.

> **Status (May 2026):** The `Storage` ABC and `LocalDiskStorage`
> implementation are still pending — only MinIO is wired up today. This is
> the top deploy blocker for twd00030. See `ROUTER.md` blocker list.

### 3.5 Ollama (deferred on production)

A local LLM service for failure classification. Runs `mistral:7b` by default.

**Production status:** **deferred on twd00030.** mistral:7b consumes 5-6 GiB
during inference and the host has only 15 GiB total once Jenkins, Postgres,
the backend, the frontend, and a test runner are loaded. The backend ships
with `AI_ANALYSIS_ENABLED=false` as the prod default; the `/analyze`
endpoint returns a graceful "not configured" response when disabled.

The `ollama` service in `docker-compose.yml` is gated behind a Compose
profile (`profiles: ["ollama"]`) — `docker compose up -d` will not start
it. To bring it back: `docker compose --profile ollama up -d`.

When stronger hardware is available, flip `AI_ANALYSIS_ENABLED=true` and
add the Ollama profile to the Compose command — no code changes needed.

**Alternative:** point `OLLAMA_BASE_URL` at a hosted LLM API (Anthropic,
OpenAI) instead of self-hosting.

### 3.6 pytest plugin (the reporting agent)

Lives in the same monorepo at `plugins/pytest-automation-reports/`. Hooks
into pytest's lifecycle to push launches, items, logs, and attachments to
the backend over HTTP.

**CLI flags:**
```
--ar-url=http://server:8000/api/v1
--ar-launch-name="Regression Run"
--ar-launch-description="Build #123"
--ar-tags="nightly,TSM,v6.2.1"
--ar-auto-analyze
```

**Env vars:** `AR_URL`, `AR_TOKEN` (Bearer — JWT or API key).

**Provided fixture:**
```python
def test_login(report_screenshot, page):
    page.goto("/login")
    report_screenshot(page, "login_page")  # queued for upload
    assert page.title() == "Login"
```

### 3.7 Migrations (Alembic)

Schema migrations are versioned files under `backend/migrations/versions/`.
Numbering is sequential `001_...`, `002_...`, etc. Run via
`docker compose exec backend alembic upgrade head` after deployment.

Unlike ReportPortal's `db-scripts` container, migrations are not a
separate service — they're invoked manually (or by a Jenkins post-deploy
step) against the running backend container.

---

## 4. Data Layer & Communication

### 4.1 PostgreSQL — schema

```
Launch (1) ──> (N) TestItem
  │                  │
  │ tags (JSON)      ├──> (N) TestLog         (ordered by order_index)
  │                  ├──> (N) Attachment       (storage_key → MinIO/disk)
  │                  ├──> (N) FailureAnalysis  (AI or manual)
  │                  ├──> (N) Comment          (author, text, timestamps)
  │                  ├──> (N) Defect           (summary, status, external link)
  │                  └──> (0..1) TestItem      (retry_of self-ref FK)
  │
  ├──> (N) Attachment (launch-level)
  └──> (N) Comment    (launch-level)

User (standalone)             # email, hashed_password, role — auth identity
APIKey                        # user_id FK, prefix, key_hash, expires_at — long-lived CI tokens
Member                        # name, email, role, user_id FK (nullable)
                              #   loosely coupled to User by email; auto-linked on register
                              #   long-term plan: drop redundant fields once every row has user_id
ProjectSettings (singleton)   # project config (name, retention, AI, notifications)
Dashboard (1) ──> (N) Widget  # configurable widget grids
```

**Key Enums:**
- **LaunchStatus:** IN_PROGRESS, PASSED, FAILED, STOPPED
- **TestStatus:** PASSED, FAILED, SKIPPED, ERROR
- **LogLevel:** TRACE, DEBUG, INFO, WARN, ERROR
- **AttachmentType:** SCREENSHOT, LOG_FILE, VIDEO, OTHER
- **DefectType:** PRODUCT_BUG, AUTOMATION_BUG, SYSTEM_ISSUE, NO_DEFECT, TO_INVESTIGATE
- **AnalysisSource:** AI_AUTO, MANUAL
- **DefectStatus:** OPEN, IN_PROGRESS, FIXED, WONT_FIX, DUPLICATE
- **MemberRole:** ADMIN, MANAGER, MEMBER, VIEWER

**Important:** test logs live in PostgreSQL, full stop. There is no separate
log index. ReportPortal uses OpenSearch as an ML similarity index on top of
PG-stored logs; ReportStack's failure volume doesn't justify that
infrastructure, so direct DB queries handle all log retrieval.

### 4.2 In-process messaging (no broker)

ReportStack does **not** run RabbitMQ or any message broker. Async work
inside the backend uses FastAPI's `BackgroundTasks`:

```python
@router.post("/launches/{id}/analyze")
def trigger_analysis(id: int, bt: BackgroundTasks, ...):
    bt.add_task(run_ai_analysis, launch_id=id)
    return {"status": "accepted"}
```

This runs in the same process as the API request handler, after the
response is sent. It works because:
- Volume is low (a few launches/day, not millions)
- Failures are recoverable — a crashed analysis can be re-triggered
  manually from the UI
- No multi-service fan-out needed

**Compared to ReportPortal:** RP uses RabbitMQ for three things — API↔Analyzer
inter-service calls, async reporting, and user activity events. ReportStack
needs none of these because everything lives in one process.

### 4.3 No external search / ML index

ReportPortal indexes log text into OpenSearch and runs ML similarity
queries to suggest defect types. ReportStack uses an entirely different
approach: the AI analyzer (§7) reads error_message + stack trace + recent
logs straight from PostgreSQL and asks a local LLM to classify the
failure. No vector search, no historical similarity, no training feedback
loop.

**Tradeoff:** simpler stack, no OpenSearch to operate, but no learning
from past triage decisions. If failure volume grows enough that LLM
classification becomes too slow or too expensive, this is the place to
add an index.

### 4.4 Object storage — Storage abstraction

Two backends, one interface (`backend/app/services/storage.py`):

```python
class Storage(ABC):
    def put(key, data, content_type): ...
    def get(key) -> tuple[bytes, str]: ...
    def delete(key): ...
    def exists(key) -> bool: ...
    def url_for(key) -> str: ...

class MinIOStorage(Storage): ...        # dev / Docker Compose
class LocalDiskStorage(Storage): ...    # twd00030 prod, reads ATTACHMENT_PATH

storage = MinIOStorage() if STORAGE_BACKEND == "minio" else LocalDiskStorage()
```

Routers (`api/attachments.py`) import the module-level `storage` singleton
and call `storage.put/get/delete` — no backend-specific code leaks out.

**Compared to ReportPortal:** RP uses MinIO by default and supports S3
plugins (S3, GCS, AzureBlob) via PF4J. ReportStack has just two backends
hard-coded; adding more is a one-class change rather than a plugin.

---

## 5. API Surface

The HTTP API is the integration surface. ReportPortal extends behavior
through PF4J plugins; ReportStack extends behavior by adding more
endpoints. All paths are under `/api/v1/`.

### Auth
- `POST /auth/register` — create user, return JWT
- `POST /auth/login` — verify credentials, return JWT
- `GET /auth/me` — get current user (requires auth)
- `PUT /auth/me` — update own name
- `GET /auth/users` — list all users (ADMIN only)
- `PUT /auth/users/{id}` — update role/active status (ADMIN only)

### API Keys (long-lived CI tokens)
- `POST /api-keys/` — create new key for current user (returns plaintext ONCE)
- `GET /api-keys/` — list current user's keys (no plaintext)
- `DELETE /api-keys/{id}` — soft-revoke

> **CI/CD service accounts:** The pytest plugin uses `AR_TOKEN` as a
> Bearer token. Two formats are accepted:
> - **JWTs** — short-lived (`JWT_EXPIRE_MINUTES`, default 24h). Used by the
>   React frontend for browser sessions.
> - **API keys** — long-lived, prefixed with `ars_`. Used by CI. Created
>   via `POST /api-keys/`. `expires_at` is optional; NULL means never
>   expires. Soft-revoke via DELETE.
>
> For Jenkins: register a service user (`jenkins@reportstack.local`), log
> in, mint an API key named "Jenkins CI", and store the returned plaintext
> as the `AR_TOKEN` Jenkins credential. The key is shown exactly once.

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
- `GET /attachments/{id}/file` — serve file (from storage backend)
- `DELETE /attachments/{id}` — delete from storage + DB record

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
- `PUT /comments/{id}` — update
- `DELETE /comments/{id}` — delete

### Defects
- `POST /launches/{id}/items/{item_id}/defects/` — create
- `GET /launches/{id}/items/{item_id}/defects/` — list
- `PUT /defects/{id}` — update (status, summary, external link)
- `DELETE /defects/{id}` — delete

### Members
- `GET /members/` — list all
- `POST /members/` — add member (unique email)
- `PUT /members/{id}` — update role
- `DELETE /members/{id}` — remove

### Project Settings
- `GET /settings/` — get (auto-creates with defaults)
- `PUT /settings/` — update

### Dashboards
- `GET /dashboards/` — list
- `POST /dashboards/` — create
- `GET /dashboards/{id}` — get with widgets
- `PUT /dashboards/{id}` — update
- `DELETE /dashboards/{id}` — delete
- `POST /dashboards/{id}/widgets` — add widget
- `DELETE /dashboards/{id}/widgets/{widget_id}` — remove widget

---

## 6. Frontend Design System

ReportStack's frontend is the system's most distinctive surface — it's
where most of the per-team customization happens. ReportPortal has a
similar settings-heavy UI; this section documents how ours is built.

### 6.1 Design Tokens (CSS Custom Properties)

All styling uses `var(--token)` references defined in `design-tokens.css`.
**Never hardcode colors, spacing, or fonts.**

- **Brand palette** (set May 2026 — supersedes the original indigo):
  - `--color-primary` `#1e40af`
  - `--color-primary-hover` `#1e3a8a`
  - `--color-primary-active` `#3b82f6` (bright accent — sidebar stripe, focus ring)
  - `--color-primary-soft` `#eff6ff` (row tints, subtle backgrounds)
  - `--color-primary-light` `#dbeafe`
- **Brand gradients:**
  - `--gradient-brand` (`#1e40af → #0b2e7c`, used on the logo tile and login top stripe)
  - `--gradient-brand-soft` (`#eff6ff → #dbeafe`, reserved for hero/empty states)
- **Status colors:** `--color-passed`, `--color-failed`, `--color-skipped`, `--color-error`, `--color-in-progress`, `--color-stopped`
- **Defect type colors:** `--color-pb` (Product Bug — red), `--color-ab` (Automation Bug — yellow), `--color-si` (System Issue — blue), `--color-nd` (No Defect — slate), `--color-ti` (To Investigate — teal)
- **Spacing:** scale from `--space-1` (4px) to `--space-12` (48px)
- **Typography:** `--font-sans` (Inter), `--font-mono` (JetBrains Mono), sizes `--text-xs` to `--text-2xl`
- **Shadows:** `--shadow-xs` to `--shadow-xl`
- **Radius:** `--radius-sm` (4px) to `--radius-full` (9999px)

### 6.2 Branding & Logo Assets

Brand identity: stacked horizontal bars in three blue tones (a bar chart /
"stack" metaphor matching the platform's purpose), paired with a
"Report**Stack**" wordmark where "Stack" picks up the primary blue.

| Asset | Path | Purpose |
|-------|------|---------|
| Horizontal lockup | `frontend/src/logo.svg` | Imported in components (Sidebar, Login). Text is converted to vector paths so it renders identically without a font dependency. |
| Centered icon mark | (built inline in `App.tsx`) | 3-bar SVG inside the 36×36 brand-gradient tile in the sidebar logo block. |
| Favicon | `frontend/public/favicon.ico` | Multi-size (16/32/48/64/128/256) bundled from the rounded blue tile design. |
| PWA icons | `frontend/public/logo192.png`, `logo512.png` | Apple touch icon + PWA install icon. |

### 6.3 Component Classes (in `components.css`)

Use CSS classes, NOT inline styles. Key classes:

- **Layout:** `.layout`, `.layout-sidebar`, `.layout-main`, `.layout-content`
- **Cards:** `.card`, `.card-header`, `.card-body`, `.metric-card`
- **Tables:** `.data-table`, `.row-clickable`, `.row-expanded`, `.cell-name`, `.cell-secondary`
- **Badges:** `.badge`, `.badge-passed`, `.badge-failed`, `.badge-defect`, `.badge-pb`, `.badge-ab`, `.badge-si`, `.badge-nd`, `.badge-ti`
- **Buttons:** `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm`, `.btn-lg`
- **Forms:** `.select`, `.input`
- **Tabs:** `.tabs`, `.tab`, `.tab.active`, `.tab-content`
- **Loading:** `.spinner`, `.loading-center`, `.skeleton`
- **Empty:** `.empty-state`, `.empty-state-icon`, `.empty-state-title`
- **Breadcrumb:** `.breadcrumb`, `.breadcrumb-item`, `.breadcrumb-separator` (see §6.7)

### 6.4 Project Settings Classes (in `project-settings.css`)

The Settings page uses a dedicated CSS file with `ps-*` prefixed classes:

- **Shell:** `.ps-shell` (grid layout with 220px sidebar + content)
- **Tabs:** `.ps-tabs`, `.ps-tab`, `.ps-tab.active`, `.ps-tab-icon`
- **Panels:** `.ps-panel`, `.ps-panel-head`, `.ps-panel-title`
- **Fields:** `.ps-field`, `.ps-field-label`, `.ps-input`, `.ps-select`, `.ps-select-wrap`
- **Buttons:** `.ps-btn`, `.ps-btn-primary`
- **Toggle:** `.ps-switch`, `.ps-switch.on`
- **Integrations:** `.ps-int-card`, `.ps-int-grid`, `.ps-int-status`
- **Notifications:** `.ps-channel`, `.ps-rule`, `.ps-create-rule-btn`
- **Defect types:** `.ps-dt-group`, `.ps-dt-row`, `.ps-dt-color-swatch`, `.ps-dt-abbr`
- **Log types:** `.ps-lt-table`, `.ps-lt-row`, `.ps-lt-preview`
- **Analyzer:** `.ps-subtabs`, `.ps-subtab`, `.ps-slider-wrap`, `.ps-radio`, `.ps-radio-row`
- **Modals:** `.ps-modal-overlay`, `.ps-modal-head`, `.ps-modal-foot`, `.ps-rule-modal`, `.ps-confirm-modal`
- **Toast:** `.ps-toast`

### 6.5 Settings Page Tabs

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

### 6.6 Layout

- Dark sidebar (240px) with navigation links (Dashboard, Launches) + Project section (Members, Settings). Logo header uses a 36×36 `--gradient-brand` tile housing the inline 3-bar SVG mark.
- Active `.sidebar-link` shows a 3px `--color-primary-active` left stripe (via `::before`) over a soft blue tint.
- Main content area with max-width 1280px. `.page-title` uses `-0.015em` letter-spacing for a tighter brand feel.
- Metric cards in auto-fit grid at top of pages; hover lifts with a brand-tinted shadow.
- Login surface uses a layered radial brand-tinted gradient backdrop, a 16-radius card with `--shadow-xl`, and a 3px `--gradient-brand` stripe across the card's top edge.
- LaunchDetail uses two-column layout for failed tests: error/logs left, DefectSelector right.
- TestDetail's stack-trace tab uses a side-by-side grid (`.stack-with-screenshot`): 1fr stack trace + 280px screenshot, collapsing to single column under 1100px.

### 6.7 User Navigation Flows

This is the **drill-down flow** users follow to investigate test results.
Modeled on ReportPortal's hierarchy. See `docs/UI_NAVIGATION.md` for the
full screen-by-screen spec.

#### URL Hierarchy

```
/dashboard                                                  → All Dashboards (list)
/dashboard/{id}                                             → Single Dashboard (widgets)
/launches                                                   → All Launches (filtered list)
/launches/{launchId}                                        → Launch Detail (suite/test list)
/launches/{launchId}/items/{itemId}                         → Suite or Test Case Detail
/launches/{launchId}/items/{itemId}/log                     → Test Detail with logs (terminal node)
/members                                                    → Project Members
/settings                                                   → Project Settings (9 tabs)
/profile                                                    → Current user profile
/login                                                      → Login / Register
```

#### Standard Drill-Down

```
Sidebar: Dashboard
    ↓ click
All Dashboards (list)
    ↓ click row
Single Dashboard (widgets, charts)

Sidebar: Launches
    ↓ click
All Launches (filterable list with status counts: PB, AB, SI, ND, TI per row)
    ↓ click launch name
Launch Detail
    Tabs at top: LIST VIEW | UNIQUE ERRORS | LOG VIEW | HISTORY
    Status badge bar: Passed % | Total | PB | AB | SI | ND | TI
    Body: REFINE filter + suite/test list with retry indicators
    ↓ click suite name
Suite Detail (same tab+badge structure, breadcrumb expands)
    ↓ click test case name
Test Case Detail (same tab+badge structure, columns now show METHOD TYPE, STATUS, ANALYSIS OWNER, DEFECT TYPE)
    ↓ click test name
Test Detail with logs ← terminal node, has its own tab structure
```

#### Breadcrumb Pattern

At every level except the dashboard list, the top of the page shows a
breadcrumb chain. Each segment is clickable and navigates back to that
level's list view. Example at the deepest level:

```
All > Demo API Tests #18 > Suite with retries > First test case > first test
```

Implementation: `<Breadcrumb items={[...]}>` component, classes
`.breadcrumb`, `.breadcrumb-item` (anchor), `.breadcrumb-separator` (`>` glyph).

#### Status Badge Convention

Across all list views and detail headers, the same five-badge bar appears
for at-a-glance status:

| Abbreviation | Defect Type | Token |
|---|---|---|
| **PB** | PRODUCT_BUG | `--color-pb` (red) |
| **AB** | AUTOMATION_BUG | `--color-ab` (yellow) |
| **SI** | SYSTEM_ISSUE | `--color-si` (blue) |
| **ND** | NO_DEFECT | `--color-nd` (slate) |
| **TI** | TO_INVESTIGATE | `--color-ti` (teal) |

Each badge shows a count. Combined with `Passed %` and `Total`, this is
the standard "status strip" shown in launch and suite headers.

#### Test Detail (terminal node)

This is where logs actually live. The page has its own tab structure
distinct from the list views above:

| Tab | Content |
|---|---|
| **STACK TRACE** | Error message + stack trace (paired with screenshot side-by-side via `.stack-with-screenshot`) |
| **ALL LOGS** | Filterable log viewer (Fatal, Error, Warn, Info, Debug, Trace, All) + "Logs with Attachment" toggle |
| **ATTACHMENTS** | Screenshots, video, log files, other |
| **ITEM DETAILS** | Metadata: duration, start/end time, parameters, tags |
| **HISTORY OF ACTIONS** | Audit trail: comments, defect changes, retries, manual overrides |

Above the tabs:
- **Retry chain visualization** — small status pills `#1 #2 #3 ...` for each
  retry attempt, current attempt highlighted. Click a pill to switch view.
- **Comment field** + status dropdown + defect type chip + **Make decision** button.
- **Make decision** opens the defect-selection modal (see below).

#### Defect Selection Workflow

When a user clicks "Make decision" on a failed test, a full-screen modal
opens with three tabs:

1. **Manual selection** — pick a defect type directly (5 buttons matching PB/AB/SI/ND/TI), comment editor, "Apply for: Current item only / All linked items" dropdown.
2. **Analyzer suggestion (NN%)** — shown when AI analysis exists. The percentage is the analyzer's confidence. Confirming this sends "User choice of suggested item was sent for handling to ML" feedback.
3. **History of the test** — shows past defect classifications across previous launches for this same test signature.

After applying: a toast appears (`Defects have been updated`). When the
suggestion was used, a second toast (`User choice of suggested item was
sent for handling to ML`) confirms feedback to the analyzer.

> **Today's status:** the modal exists but the AI analyzer is disabled on
> twd00030 (`AI_ANALYSIS_ENABLED=false`). The Analyzer tab gracefully
> shows "AI not configured" instead of a confidence percentage.

---

## 7. AI Analyzer Details

The analyzer is **not a separate service** in ReportStack (unlike RP's
`service-auto-analyzer`). It's a module inside the backend
(`backend/app/services/ai_analyzer.py`) invoked via FastAPI BackgroundTasks.

### 7.1 How It Works

1. `POST /launches/{id}/analyze` triggers `BackgroundTasks`
2. For each FAILED/ERROR test item (without existing analysis):
   - Gathers: test name, suite, error_message, stack_trace (last 50 lines), recent logs (last 20)
   - Sends to Ollama with classification prompt
   - Expects JSON: `{"defect_type": "...", "confidence": 0.0-1.0, "reasoning": "..."}`
   - Confidence < 0.4 auto-flags as `TO_INVESTIGATE`
3. Retries once on JSON parse failure; falls back to `TO_INVESTIGATE` if
   Ollama unreachable.

### 7.2 Config

- `OLLAMA_BASE_URL` (default: http://localhost:11434)
- `OLLAMA_MODEL` (default: mistral:7b)
- `AI_ANALYSIS_ENABLED` (default: false on prod)
- System prompt version tracked in DB (`prompt_version` field)

### 7.3 When AI is disabled (twd00030 prod)

- `/analyze` returns 200 with `{"status": "ai_analysis_disabled", "items_analyzed": 0}` instead of failing.
- Manual defect assignment via the UI continues to work normally.
- AnalysisSource defaults to `MANUAL` for any analyses created in this mode.

---

## 8. End-to-End Data Flow Examples

### 8.1 A test runs and fails

1. pytest plugin opens a launch via `POST /launches/`
2. For each test, the plugin posts the start, then logs (typically batched
   via `/logs/batch`), then the finish + status
3. On failure with a screenshot, the plugin uploads via
   `POST /launches/{id}/items/{item_id}/attachments` — backend streams
   bytes into the `Storage` backend (MinIO or local disk) and inserts an
   `Attachment` row in PG
4. Plugin calls `PUT /launches/{id}/finish` with the rolled-up status
5. If `--ar-auto-analyze` was passed: plugin calls `POST /launches/{id}/analyze`
6. UI polls launch detail and shows the new run

### 8.2 AI analysis of a finished launch (when enabled)

1. User clicks "Analyze" in the LaunchDetail UI (or the plugin auto-triggered it)
2. `POST /launches/{id}/analyze` returns 202 immediately
3. BackgroundTasks fan-outs over each FAILED/ERROR item
4. For each item: gather context (error, trace, last 20 logs) → POST to Ollama
5. Parse the JSON response, persist a `FailureAnalysis` row with
   `source=AI_AUTO`
6. UI polls `/launches/{id}/analysis-summary` for the summary card and
   `/items/{item_id}/analyses` per row
7. User can override → `PUT /analyses/{analysis_id}` with a manual
   classification (`source=MANUAL` overlays the AI verdict)

### 8.3 Comment/defect lifecycle

1. User opens a failed item, sees error + logs in the LaunchDetail page
2. Adds a comment via `POST /launches/{id}/items/{item_id}/comments/` —
   shows up immediately with avatar
3. Creates a defect via `POST /launches/{id}/items/{item_id}/defects/`,
   optionally with an external link (e.g. a Jira URL pasted manually —
   ReportStack does not currently call Jira's API)
4. Marks defect as `OPEN`, later transitions through
   `IN_PROGRESS → FIXED / WONT_FIX / DUPLICATE`
5. `pytest-jira` marker on the test side will skip/xfail the test if the
   linked Jira issue is still open (see `automation-architect-skill.md`)

---

## 9. Deployment Topologies

### 9.1 Docker Compose (dev)

Single host, all services in one `docker compose up`. Backend uses MinIO,
Ollama is enabled if hardware allows.

```bash
docker compose up -d --build
docker compose --profile ollama up -d ollama   # only if hardware permits
docker compose exec ollama ollama pull mistral:7b
python3 backend/seed_data.py  # optional demo data
```

Services: db (:5432), minio (:9000/:9001), backend (:8000), frontend (:3000), ollama (:11434, profile-gated).

Docker healthchecks are configured with `condition: service_healthy` for
startup ordering. The frontend has its own `/health` endpoint hit by
`wget --spider`.

### 9.2 twd00030 production

Same `docker-compose.yml`, with these env-driven differences:

- `STORAGE_BACKEND=local` → backend uses `LocalDiskStorage` writing to `/data/attachments` (mounted from a Docker volume)
- `AI_ANALYSIS_ENABLED=false` → Ollama service NOT included (profile not activated), `/analyze` returns degraded response
- `COMPOSE_PROJECT_NAME=reports-app` pinned in `.env` → produces deterministic network name `reports-app_default`, which the Jenkins test runner uses
- The `ollama` service uses Compose `profiles: ["ollama"]`, opt-in only — deferred (May 2026)

The backend code supports both storage backends via the `Storage` abstraction
in `services/storage.py`. The directory on twd00030 is `~/automation-reports/`.

See `cicd-skill.md` for the full deploy sequence and host operational details.

### 9.3 Future cloud deployment

Not currently planned. If pursued: replace MinIO with S3, replace local
Postgres with RDS, run the backend on ECS or GKE. Storage abstraction
already supports the S3 path via MinIO's S3 protocol.

---

## 10. Tech Stack & Versions

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | FastAPI + SQLAlchemy + Alembic | Python 3.12, FastAPI 0.111 |
| Database | PostgreSQL | 16 (Alpine) |
| Frontend | React + TypeScript | React 19, TS 4.9.5 (pinned by CRA; compiles clean thanks to `skipLibCheck: true`) |
| Charts | Recharts | 3.8 |
| AI | Ollama (local LLM) | mistral:7b default |
| Plugin | pytest plugin | pytest >= 7.0 |
| Storage (dev) | MinIO (S3-compatible) | latest |
| Storage (prod) | Local disk (Docker volume) | n/a |
| Auth | JWT (PyJWT + bcrypt) + API keys | — |
| E2E Tests | Playwright | ^1.48 |
| Infra | Docker Compose v2 | Compose file no longer declares a `version` (modern Compose ignores it) |

---

## 11. Project Structure

```
automation-reports/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers
│   │   │   ├── launches.py / test_items.py / logs.py / attachments.py
│   │   │   ├── analyses.py / comments.py / defects.py
│   │   │   ├── members.py / project_settings.py / dashboards.py
│   │   │   ├── test_history.py / auth.py / api_keys.py
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── ai_analyzer.py   # Ollama client, prompt engineering
│   │   │   ├── storage.py       # Storage ABC + MinIO + LocalDisk impls
│   │   │   ├── auth.py          # JWT + API-key generation/validation
│   │   │   └── retention.py     # Data retention cleanup daemon
│   │   ├── database.py / main.py
│   ├── migrations/versions/  # 001..011 (latest: 011_api_keys)
│   ├── requirements.txt / Dockerfile / alembic.ini / seed_data.py
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API clients (one per resource)
│   │   ├── components/      # StatusBadge, Breadcrumb, LogViewer,
│   │   │                    # AnalysisPanel, ScreenshotViewer,
│   │   │                    # StackTraceBlock, DefectSelector, etc.
│   │   ├── context/AuthContext.tsx
│   │   ├── pages/           # Dashboards, LaunchList, LaunchDetail,
│   │   │                    # SuiteDetail, TestDetail, Members,
│   │   │                    # Settings, Profile, Login
│   │   ├── styles/          # design-tokens.css, components.css,
│   │   │                    # project-settings.css, extras.css
│   │   ├── types/index.ts   # All TypeScript interfaces
│   │   └── App.tsx
│   ├── Dockerfile / nginx.conf
├── plugins/
│   └── pytest-automation-reports/
├── tests/e2e/               # Playwright E2E tests
├── docs/
│   ├── UI_NAVIGATION.md     # detailed UI nav spec (companion to §6.7)
│   ├── reportportal-architecture.md
│   └── architecture-roadmap.md
├── docker-compose.yml
└── .env.example
```

> **Pages note:** `LaunchList`, `LaunchDetail`, `SuiteDetail`, and
> `TestDetail` are distinct page components. The hierarchy mirrors the
> URL hierarchy in §6.7. SuiteDetail is technically a polymorphic
> rendering of TestItem at suite level — same data shape, different
> children.

---

## 12. ReportStack vs ReportPortal

| Concern | ReportPortal | ReportStack |
|---|---|---|
| Architecture | 7 microservices | Monolith (single FastAPI backend + React UI) |
| Backend language | Java (Spring Boot) | Python (FastAPI) |
| Frontend | React + TS | React + TS |
| Database | PostgreSQL | PostgreSQL |
| Messaging | RabbitMQ | None — direct calls + FastAPI BackgroundTasks |
| Search/ML index | OpenSearch | None (DB queries only) |
| Object storage | MinIO (default) | MinIO in dev / Local disk on twd00030 (via Storage abstraction) |
| Gateway | Traefik | nginx (frontend container) |
| Auth | OAuth2 server (UAT) — multiple backends | JWT + API keys, single backend |
| Plugin system | PF4J — hot-loadable JARs | None — integrations are first-class endpoints |
| AI failure analysis | Python service + OpenSearch similarity + supervised ML | Ollama (local LLM, mistral:7b) via prompt classification |
| BTS integrations | Jira, ADO, Rally, Monday, GitHub | Settings page placeholders only (Jira used via `pytest-jira` marker, not in-app) |
| Background jobs | service-jobs (separate process) | retention daemon TBD (`services/retention.py`) |
| Quality Gates | Yes — feed pass/fail to CI | No |
| Real-time UI updates | WebSocket / long-poll | Polling |
| Deploy footprint | 8-12 GB RAM | 1-2 GB RAM (without Ollama) |

**What ReportStack borrowed:** the launch → test item → log/attachment data
model; the DefectType taxonomy (PB, AB, SI, ND, TI); the
AI-suggested-with-manual-override triage workflow; the settings page tab
structure; the **drill-down navigation pattern** documented in §6.7.

**What ReportStack deliberately skipped:** microservices, RabbitMQ,
OpenSearch, PF4J, OAuth2/SSO.

---

## 13. Conventions

- **Backend:** Follow existing pattern — router in `api/`, model in
  `models/`, schema in `schemas/`. All models exported from
  `models/__init__.py`. Routers registered in `main.py`.
- **Frontend:** Components in `src/components/`, pages in `src/pages/`,
  API clients in `src/api/`. All types in `src/types/index.ts`. Use
  design system CSS classes, not inline styles.
- **Settings page:** Uses `ps-*` prefixed CSS classes from
  `project-settings.css`.
- **Migrations:** Sequential numbering `001_`, `002_`, etc. in
  `migrations/versions/`.
- **AI analysis:** Runs locally through Ollama on the Docker network. No
  external API calls. Gated behind `AI_ANALYSIS_ENABLED` for prod.
- **File storage:** Always go through the `storage` singleton from
  `services/storage.py`. No code outside that module should import
  `minio` or write to disk directly.
- **Navigation:** Follow §6.7 / `docs/UI_NAVIGATION.md` for any new pages
  in the drill-down hierarchy. Always include a breadcrumb. Always show
  the standard PB/AB/SI/ND/TI status strip on detail headers.

---

## 14. Source Material / Cross-References

- `docs/reportportal-architecture.md` — architecture reference for the
  upstream system this is modeled on.
- `docs/UI_NAVIGATION.md` — detailed UI navigation spec (companion to §6.7).
- `ROUTER.md` — top-level routing across the four project skills + the
  blocker list.
- `cicd-skill.md` — twd00030 host, Jenkins, Docker Compose deploy ops.
- `automation-architect-skill.md` — the TNC pytest framework that is
  ReportStack's primary client.
- `device-lab-skill.md` — radio device lab feeding the framework.

---

## 15. When to consult this doc

Read it when:
- Adding a new endpoint, model, schema, or migration to the backend
- Adding a frontend component, page, or settings tab
- Implementing or modifying drill-down navigation (cross-reference §6.7
  and `docs/UI_NAVIGATION.md`)
- Debugging a behavior in ReportStack's running system
- Onboarding someone to the codebase
- Deciding whether a request is best served by ReportStack as-is or by
  borrowing a pattern from upstream RP — §12 is the relevant input

Don't read it when:
- Working on the TNC pytest framework — `automation-architect-skill.md`
- Working on twd00030 host infrastructure — `cicd-skill.md`
- Working on the device lab — `device-lab-skill.md`
- Curious about ReportPortal itself — `docs/reportportal-architecture.md`

---

## 16. Current State (May 6, 2026)

> Snapshot of what's deployed/working today, separate from §1–§15 which
> describe steady-state architecture. Update this section when major
> changes land.

**twd00030 (production-ish host):**
- 4 services running: `backend`, `db`, `frontend`, `minio` (all healthy)
- Disk: 27% used, 162 GB free
- RAM: 5.3 GiB used of 15 GiB (comfortable)
- Bot service removed (was crash-looping with disabled tokens, never functional)
- Ollama profile-gated in compose (image and volume removed)

**Recent commits on `fix/relative-api-url-v2`:**
- `88df46c` — feat(ui): show screenshot alongside stack trace on failed tests
- `1d6e9d9` — Update CLAUDE.md to mirror ReportPortal architecture reference
- `c48e1cf` — Remove bot/ source directory (service decommissioned)
- `590b807` — Remove bot service, profile-gate ollama, align with twd00030 prod plan

**Open deploy blockers (from ROUTER.md):**

1. **`Storage` abstraction** in `services/storage.py` — MinIO-only today; twd00030 needs `LocalDiskStorage`. **TOP PRIORITY.**
2. **CI auth story** for `AR_TOKEN` — undefined; need API-key table or expiry bump.
3. **Pin `COMPOSE_PROJECT_NAME=reports-app`** in `.env.example`.
4. **Frontend healthcheck** — backend has one, frontend doesn't.
5. **Retention daemon ops model** — `services/retention.py` exists; how it runs in prod undecided.
6. **§6.7 navigation flow** — documented as of today; verify current pages match (LaunchList, LaunchDetail, SuiteDetail, TestDetail) and fill any gaps.
