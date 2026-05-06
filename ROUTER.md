---
name: project-router
description: Top-level index for the TNC automation + ReportStack project. Read this FIRST on any question that could touch more than one of the four skills (automation-architect, cicd, device-lab, ReportStack/CLAUDE.md). Routes symptoms to the right skill, owns shared cross-skill facts, and tracks the deploy-blocking TODO list. Trigger on any project question where the right skill is not immediately obvious, or any question mentioning "the pipeline", "deploy", "blocker", or "what's left".
---

# Project Router

Four skills live under this project. They overlap. This file is the map.

| Skill | Owns | Lives at |
|---|---|---|
| `automation-architect` | TNC framework design (layers, Steps, locators, suites, Jama plugin) | `automation-architect-skill.md` |
| `cicd` | twd00030 host, Jenkins, Docker Compose, ReportStack deploy ops | `cicd-skill.md` |
| `device-lab` | Radios, RPis, switch, pre-flight, lab inventory | `device-lab-skill.md` |
| `reportstack` | The web app itself — backend, frontend, schema, API | `CLAUDE.md` |

---

## Routing table — symptom → skill

Read top-down. First match wins. If two skills are listed, load the first, then the second if the first doesn't resolve it.

| If the question is about... | Load |
|---|---|
| Adding/changing a test, page object, locator, fixture | `automation-architect` |
| Steps layer, BasePage, suite markers, NFR thresholds | `automation-architect` |
| Jama mapping, Jama plugin, test cycle creation | `automation-architect` |
| Jira marker / `pytest-jira` (defect tracking only) | `automation-architect` |
| ReportStack plugin CLI flags (`--ar-*`, `AR_URL`, `AR_TOKEN`) | `automation-architect` then `reportstack` |
| Jenkinsfile shape, stages, credentials | `cicd` then `automation-architect` |
| Docker Compose for ReportStack on twd00030 | `cicd` then `reportstack` |
| Backend code, schema, API endpoints, migrations | `reportstack` |
| Frontend code, design tokens, settings tabs, branding | `reportstack` |
| Storage abstraction (MinIO vs local disk) | `reportstack` then `cicd` |
| Ollama / AI analysis behavior | `reportstack` (code) and `cicd` (deploy decision) |
| Radio unreachable, RPi down, switch issue | `device-lab` then `cicd` (only if Docker networking) |
| Pre-flight check, lab inventory, firmware report | `device-lab` |
| Power cycle, smart PDU plans | `device-lab` |
| "The pipeline is broken" (ambiguous) | This file's **Triage** section below |
| Backup, restic, disk capacity, NFS mounts | `cicd` |
| Hostnames, IT requests, company proxy | `cicd` |
| Defect type enum (`PRODUCT_BUG` etc.) | `reportstack` (canonical) — `automation-architect` references it |

---

## Shared facts — single source of truth

Other skills must point here, not redefine these.

### Network contract
Test containers run with `--network host` so they can reach **both**:
- ReportStack backend at `http://localhost:8000`
- Radio devices on the LAN (via switch → RPi → radio)

Do not use a Compose-defined network for the test runner.

### ReportStack plugin CLI / env contract
| Mechanism | Name | Purpose |
|---|---|---|
| Env var | `AR_URL` | Backend base URL, e.g. `http://localhost:8000/api/v1` |
| Env var | `AR_TOKEN` | JWT for the Jenkins service-account user (see Auth note below) |
| CLI | `--ar-url` | Overrides `AR_URL` |
| CLI | `--ar-launch-name` | Launch label, see naming convention below |
| CLI | `--ar-launch-description` | Free text |
| CLI | `--ar-tags` | Comma-separated tags |
| CLI | `--ar-auto-analyze` | Trigger AI triage at launch close |

### Launch naming convention
`{waveform}-{tier}-{build_version}` — e.g. `TSM-Nightly-v6.2.1-build42`. Owned by `automation-architect`; reproduced here so the Jenkinsfile and the ReportStack UI agree.

### Compose project name
`COMPOSE_PROJECT_NAME=reports-app` must be pinned in `.env` on twd00030. The Jenkinsfile's `--network reports-app_default` depends on this. If the project name drifts (e.g. clone directory rename), the test container silently can't reach the backend.

### Defect type enum (canonical)
Defined in `reportstack` / `CLAUDE.md`. Five values, no others:
`PRODUCT_BUG`, `AUTOMATION_BUG`, `SYSTEM_ISSUE`, `NO_DEFECT`, `TO_INVESTIGATE`.
Radio hardware/firmware failures map to `SYSTEM_ISSUE`. There is no `RADIO_ISSUE`.

### Auth for CI
`AR_TOKEN` is a JWT for a registered ReportStack user (e.g. `jenkins@reportstack.local`). Created via `POST /auth/register`. Default expiry is `JWT_EXPIRE_MINUTES` (1440 = 24h) — too short for a Jenkins credential. Either bump the expiry for that user or build a real API-key table. **Currently undefined in code; see blockers.**

### Storage backends
ReportStack has two intended backends:
- **MinIO** (dev compose) — set `MINIO_ENDPOINT`
- **Local disk** (twd00030 prod) — set `ATTACHMENT_PATH`

The abstraction (`Storage` ABC + `MinIOStorage` + `LocalDiskStorage`) is **not yet implemented**. Today only the MinIO adapter exists. See blockers.

### Ollama is deferred
Ship with `AI_ANALYSIS_ENABLED=false`. The `/analyze` endpoint returns a "not configured" response. Hardware on twd00030 (15 GiB RAM) cannot run mistral:7b alongside Jenkins, Postgres, backend, frontend, and a test runner.

---

## Triage — "the pipeline is broken"

When the failure mode is unclear, walk this checklist in order. Each step points at the right skill once narrowed.

1. **Is Jenkins itself running?** `docker ps | grep jenkins` on twd00030. If no → `cicd`.
2. **Did the build start?** Jenkins UI → check job. If it never triggered → webhook/polling issue → `cicd`.
3. **Did the test container build?** Build stage logs. If image build failed → `automation-architect` (Dockerfile) or `cicd` (Docker daemon).
4. **Did pre-flight pass?** If pre-flight failed → radios or RPis down → `device-lab`.
5. **Did tests run but not report?** Check ReportStack UI for the launch.
   - No launch created → plugin can't reach backend → `cicd` (network) or `reportstack` (auth/token).
   - Launch created, no items → plugin error → `automation-architect`.
   - Items present, no AI analysis → Ollama deferred (expected) or `reportstack`.
6. **Did Jama publish fail?** Nightly only. → `automation-architect` (plugin) or external (Jama API down).
7. **Tests ran, all failed at the same step?** Likely a TNC UI change or radio config drift → `automation-architect` (locators) or `device-lab` (radio state).

---

## Deploy blockers — current state

Pulled from all four skills, deduplicated. Update this list as items close; don't let it drift back into the leaf files.

### Code — must land before first prod deploy
- [ ] **`Storage` abstraction in `services/storage.py`** — MinIO-only today; twd00030 needs local disk. Without this, attachment uploads crash on the host. `reportstack` has the target shape.
- [ ] **CI auth story for `AR_TOKEN`** — undefined. Either bump `JWT_EXPIRE_MINUTES` for the service user or build an API-key table. `reportstack` owns this.
- [ ] **Pin `COMPOSE_PROJECT_NAME=reports-app` in `.env.example`** — Jenkinsfile depends on the network name `reports-app_default`. `cicd` owns this.
- [ ] **Frontend healthcheck** — backend has one (Python urllib), frontend doesn't. `cicd` owns this.
- [ ] **Retention daemon ops model** — `services/retention.py` exists; how it runs in prod (separate container, cron, startup task) is undecided. `reportstack` owns this.
- [ ] **Drop `version: "3.8"` from `docker-compose.yml`** — ignored by modern Compose. `cicd` owns this.

### Doc — should land alongside code
- [ ] **Fix `CLAUDE.md` storage contradiction** — claims both backends are supported AND that only MinIO exists. Second statement is correct.
- [ ] **Commit logo source SVGs** — currently outside the repo. `reportstack` owns this.
- [ ] **Resolve User vs Member duplication** — known overlap, no FK. Decide: merge, or auto-sync. `reportstack` owns this.

### Infra — external dependencies
- [ ] **Investigate port 9090 on twd00030** — unknown service, not yet deployed against. `cicd`.
- [ ] **IT request for `jenkins.<company>.internal` and `reports.<company>.internal` hostnames + GitHub webhook reachability**. `cicd`.
- [ ] **Service-account user registered in ReportStack** — needed once the app is deployed; produces `AR_TOKEN` for Jenkins credentials. Step 11 of `cicd` deploy sequence.
- [ ] **restic backup schedule** for `jenkins_home`, `postgres_data`, `attachments` → `/misc/IT/backups`. `cicd`.

### Deferred (do not work on)
- Ollama deployment on twd00030 (RAM-constrained; flag-gated; documented in `cicd`).
- Smart PDU for the lab (manual power for now; documented in `device-lab`).
- Splitting Jenkins and ReportStack onto two boxes (acceptable single-host until RAM tightens).

---

## When NOT to consult this file

If the question is unambiguously inside one skill — "add a `@pytest.mark.smoke` to this test," "what does the dashboard widget table look like in Postgres," "how do I SSH into RPi #1" — go straight to that skill. The router is for ambiguous questions, cross-skill questions, and the blocker list.
