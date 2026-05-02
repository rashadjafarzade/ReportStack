# Linux integration prerequisites — `twd00030`

Targeted for **Ubuntu 24.04.4 LTS** (the host described in `cicd-skill.md`).
Everything here was inventoried from `docker-compose.yml`, `tests/e2e/`, the
backend and frontend dependency manifests, and the bot.

Table legend:
- ✅ already installed on the host (per `cicd-skill.md`)
- ⬇ install needed
- 🟡 only if you want this capability

## 1. Host system tools

| Tool | Why we need it | Status |
|------|----------------|--------|
| Docker Engine ≥ 24 | Run every service except, optionally, the test runner | ✅ 29.4.1 |
| Docker Compose v2 (`docker compose`) | Orchestration | ✅ |
| `git` | Pull / push the repo | ✅ 2.43 |
| Python 3.12 | Matches `backend/requirements.txt`; needed if you ever run uvicorn outside Docker, or for `seed_data.py` | ✅ 3.12.3 |
| Node.js 18+ + npm | Frontend build, Playwright, pytest plugin install | ✅ Node 25.5, npm 11.8 |
| `curl`, `wget`, `jq`, `unzip` | Smoke checks, debugging | ✅ |
| Build tools (`gcc`, `make`) | Native deps when pip wheels miss (psycopg2 fallback, lxml, bcrypt) | ✅ |

> Don't install Java on the host — Jenkins ships its own JDK in its container.

## 2. Docker images we'll pull / build

These come up via `docker compose up -d --build`. The first run will download a
few GB; subsequent runs are diff-only.

| Image | Source | Approx size |
|-------|--------|-------------|
| `postgres:16-alpine` | Docker Hub | ~250 MB |
| `minio/minio:latest` | Docker Hub | ~200 MB |
| `ollama/ollama:latest` | Docker Hub | ~700 MB |
| `automation-reports_backend` | built from `backend/Dockerfile` | ~250 MB |
| `automation-reports_frontend` | built from `frontend/Dockerfile` (multi-stage Node → nginx) | ~50 MB |
| `automation-reports_bot` | built from `bot/Dockerfile` | ~180 MB |

After the stack is up, **pull the LLM weights once**:

```bash
docker compose exec ollama ollama pull mistral:7b
```

That's another ~4 GB on disk. Skip this only if you accept the analyzer's
TO_INVESTIGATE fallback for every failure (which the May 2026 fix in
`ai_analyzer.py` makes safe — no crashes, just less useful classifications).

## 3. NVIDIA GPU — optional, accelerates Ollama

🟡 Only if the box has a GPU and you want fast inference.

| Tool | Install command |
|------|-----------------|
| NVIDIA driver (matching kernel) | `sudo apt install nvidia-driver-550` |
| `nvidia-container-toolkit` | [link](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) |
| Restart Docker | `sudo systemctl restart docker` |

The `ollama` service block in `docker-compose.yml` already has the
`deploy.resources.reservations.devices` entry; remove it for CPU-only runs.

## 4. E2E test suite — extra deps

⬇ The Playwright browser (chromium-headless-shell) and its OS libraries.

```bash
cd tests/e2e
npm install                     # installs @playwright/test
npx playwright install chromium # downloads chromium-headless-shell (~100 MB)
npx playwright install-deps     # installs Linux libs (libnss3, libatk1.0-0, etc.)
```

If `install-deps` complains, the explicit list on Ubuntu 24.04:

```bash
sudo apt install -y \
  libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libxcomposite1 \
  libxdamage1 libxfixes3 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 \
  libcairo2 libasound2t64
```

🟡 If you ever want headed mode in CI (Xvfb-style):

```bash
sudo apt install -y xvfb
xvfb-run npm test    # in tests/e2e/
```

## 5. pytest plugin — for real test runs that report to ReportStack

Install once on every CI worker / dev box:

```bash
pip install -e plugins/pytest-automation-reports/
```

It depends on `pytest>=7.0`, `requests`, `Pillow` (screenshots).
Selenium / Playwright Python bindings are picked up at runtime if your tests
use them — the plugin doesn't pin them.

## 6. Telegram bot — env vars

The `bot/` container is in the compose file but won't start cleanly without:

| Env var | Where to get it |
|---------|-----------------|
| `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `CLAUDE_MODEL` | optional, default `claude-sonnet-4-20250514` |
| `ALLOWED_USER_IDS` | comma-separated Telegram numeric IDs; empty = open to all |
| `AR_BACKEND_URL` | `http://backend:8000/api/v1` (Docker DNS) |
| `AR_FRONTEND_URL` | external URL of the dashboard for clickable links |

Drop these in `.env` next to `docker-compose.yml`. The compose file already
references the names.

## 7. Secrets / config (every service)

| File / var | Purpose |
|------------|---------|
| `.env` (root) | Compose pulls this automatically |
| `JWT_SECRET` | Signs auth tokens. Generate `openssl rand -hex 32`. |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Default `minioadmin` works for internal-only deploys; rotate for anything internet-facing |
| `OLLAMA_BASE_URL` | `http://ollama:11434` inside the Docker network |
| `DATABASE_URL` | `postgresql://postgres:postgres@db:5432/automation_reports` |

Never commit `.env`. There's already an `.env.example` you can copy from.

## 8. Network ports the host will expose

| Port | Service |
|------|---------|
| 3000 | Frontend (nginx) |
| 8000 | Backend (FastAPI) |
| 5432 | Postgres (only bind to `127.0.0.1` if not internal) |
| 9000 / 9001 | MinIO (S3 + console) |
| 11434 | Ollama (only bind to `127.0.0.1`) |

If the company internal proxy fronts the dashboard, only 3000 needs to be
externally reachable; everything else stays on the loopback or Docker bridge.

## 9. (Optional) Jenkins integration

Already covered in `cicd-skill.md` — Jenkins runs in its own Docker container
with its own JDK. The CI prerequisites that touch ReportStack:

- A Jenkins **Secret text** credential `AR_TOKEN` (created via
  `POST /api/v1/auth/users` with an integration user).
- A Jenkins **Secret text** credential `AR_URL` set to the internal API URL.
- A pipeline shell step that installs the pytest plugin and passes
  `--ar-url=$AR_URL --ar-launch-name="$JOB_NAME #$BUILD_NUMBER" --ar-auto-analyze`.

See `ReportStack_User_Guide.docx` § Scenario 6 for a copy-pasteable Jenkinsfile
fragment.

## 10. Quick deploy (the happy path)

```bash
ssh user@twd00030
cd ~/automation-reports
git pull origin main

# secrets — edit values
cp .env.example .env
${EDITOR:-vim} .env

# build images and bring everything up
docker compose up -d --build
docker compose exec ollama ollama pull mistral:7b   # one-off

# run migrations (alembic is pinned in backend; this also auto-runs on startup
# via Base.metadata.create_all, but explicit is safer)
docker compose exec backend alembic upgrade head

# health check
curl -fsS http://localhost:8000/api/v1/launches/   # should return {"items":[]…}
curl -fsS http://localhost:3000/                   # should return the React shell

# (optional) run the e2e suite against the live stack
cd tests/e2e
npm install && npx playwright install chromium && npx playwright install-deps
RS_FRONTEND_URL=http://localhost:3000 \
  RS_API_URL=http://localhost:8000/api/v1 \
  npm test
```

If any of those curls fail, see `cicd-skill.md` § "Common operations" /
"Gotchas".
