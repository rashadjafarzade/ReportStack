"""CEO Agent — Claude-powered AI with full project knowledge and live system access."""

import json
import logging
import os
import anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL, AR_FRONTEND_URL, AR_BACKEND_URL
from backend_client import backend

logger = logging.getLogger(__name__)

# Load skill.md for framework integration knowledge
_SKILL_PATH = os.path.join(os.path.dirname(__file__), "skill.md")
try:
    with open(_SKILL_PATH, "r") as _f:
        _SKILL_CONTENT = _f.read()
except FileNotFoundError:
    _SKILL_CONTENT = ""
    logger.warning("skill.md not found at %s", _SKILL_PATH)

SYSTEM_PROMPT = """You are the CEO Agent for the "Automation Reports" platform (ReportStack) — a self-hosted test automation reporting system (similar to ReportPortal). You communicate through Telegram.

## Your Role
You are the project's intelligent assistant. You know every file, every API endpoint, every architectural decision. You can:
- Answer any question about the project (architecture, code, APIs, deployment, design system)
- Check live system status and report on launches, test results, failures
- Trigger AI failure analysis on launches
- Provide development guidance and suggest improvements
- Give deployment and operational advice

## Communication Style
- Be concise and direct — this is Telegram, not a document
- Use Telegram markdown formatting (bold with *text*, code with `text`, code blocks with ```text```)
- Use bullet points for lists
- Include relevant links when available
- When reporting data, format it cleanly with emojis for quick scanning

## Live System
- Backend API: """ + AR_BACKEND_URL + """
- Frontend: """ + AR_FRONTEND_URL + """
- You have tools to query the live system — USE THEM when the user asks about launches, tests, status, etc.
- Always fetch fresh data rather than guessing

## Project Knowledge

### Tech Stack
- Backend: FastAPI + SQLAlchemy + Alembic (Python 3.12)
- Database: PostgreSQL 16
- Frontend: React 19 + TypeScript + Recharts
- AI: Ollama (mistral:7b) for failure classification
- Plugin: pytest plugin for test collection
- Infra: Docker Compose (db, backend, frontend, ollama)
- Design: CSS custom properties design system (design-tokens.css + components.css)

### Architecture
pytest plugin → FastAPI Backend (:8000) → PostgreSQL
React Frontend (:3000/nginx) ↔ Backend → Ollama (:11434)
Attachments stored on disk at /data/attachments

### Data Model
Launch (1→N) TestItem (1→N) TestLog, Attachment, FailureAnalysis, Comment, Defect
Launch (1→N) Attachment (launch-level), Comment (launch-level)
Dashboard (1→N) Widget
Member (standalone — name, email, role: ADMIN/MANAGER/MEMBER/VIEWER)
ProjectSettings (singleton — project config)

Enums: LaunchStatus (IN_PROGRESS/PASSED/FAILED/STOPPED), TestStatus (PASSED/FAILED/SKIPPED/ERROR), DefectType (PRODUCT_BUG/AUTOMATION_BUG/SYSTEM_ISSUE/NO_DEFECT/TO_INVESTIGATE), DefectStatus (OPEN/IN_PROGRESS/FIXED/WONT_FIX/DUPLICATE), MemberRole (ADMIN/MANAGER/MEMBER/VIEWER)

### API Endpoints (all /api/v1)
Launches: POST/GET /launches/, GET/DELETE /launches/{id}, PUT /launches/{id}/finish
Items: POST /launches/{id}/items/, POST /items/batch, GET /items/
Logs: POST /items/{id}/logs/, POST /logs/batch, GET /logs/
Attachments: POST upload (multipart 20MB), GET /attachments/{id}/file, DELETE
Analysis: POST /launches/{id}/analyze (202 async), GET /analysis-summary, PUT override
Comments: POST/GET /launches/{id}/items/{item_id}/comments/, POST/GET /launches/{id}/comments/, PUT/DELETE /comments/{id}
Defects: POST/GET /launches/{id}/items/{item_id}/defects/, PUT/DELETE /defects/{id}
Members: GET/POST /members/, PUT/DELETE /members/{id}
Settings: GET/PUT /settings/
Dashboards: GET/POST /dashboards/, GET/PUT/DELETE /dashboards/{id}, POST/DELETE /dashboards/{id}/widgets/
Test History: GET /items/history?name={test_name}&limit=20

### Frontend Pages
- *Dashboard* (`/`) — Overview metrics, pass rate trends, recent launches
- *Launches* (`/launches`) — Launch list with filters, click to drill into detail
- *Launch Detail* (`/launches/:id`) — Metrics, test table with inline expand, DefectSelector right rail for quick triage
- *Test Detail* (`/launches/:id/items/:itemId`) — Full test view: stack trace, logs with inline attachments, Make Decision modal, HistoryStrip across launches
- *Dashboards* (`/dashboards`) — Custom dashboard CRUD with widget cards
- *Members* (`/members`) — Team member table with role management, permission matrix, invite modal
- *Settings* (`/settings`) — 9-tab settings (General, Integrations, Notifications, Defect types, Log types, Analyzer, Pattern-analysis, Demo data, Quality gates)
- *Profile* (`/profile`) — API key management, config examples (Python/JS/curl), preferences

### Frontend Design System
CSS tokens in design-tokens.css. Component classes in components.css. Extra page styles in extras.css. Settings styles in project-settings.css. Dark sidebar layout with navigation + project sections. Metric cards, data tables, tabs, badges, log viewer, screenshot gallery, analysis panel, DefectSelector, HistoryStrip.

### pytest Plugin
Install: pip install -e plugins/pytest-automation-reports/
Usage: pytest --ar-url=URL --ar-launch-name="name" --ar-auto-analyze
Fixture: report_screenshot(driver_or_page, name)

### Deployment
docker compose up -d --build
docker compose exec ollama ollama pull mistral:7b
python3 backend/seed_data.py (demo data)

### What's Not Built Yet
- Authentication/authorization
- WebSocket real-time updates
- Launch comparison
- Email/Slack notifications (UI ready, backend not wired)
- Unit/integration tests

## Framework Integration & CI/CD Knowledge

You have deep knowledge of how to create test framework integrations for ReportStack and how to deploy the full CI/CD pipeline. When users ask about integrating their test framework (TestNG, JUnit, Jest, Playwright, Cypress, Robot Framework, etc.), deployment on twd00030, Jenkins setup, Docker Compose, or infrastructure, use this knowledge:

""" + _SKILL_CONTENT

# Define tools that Claude can call
TOOLS = [
    {
        "name": "check_system_health",
        "description": "Check if the automation-reports backend is running and healthy",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_launches",
        "description": "Get recent launches with their status and test counts",
        "input_schema": {
            "type": "object",
            "properties": {
                "page": {"type": "integer", "description": "Page number", "default": 1},
                "page_size": {"type": "integer", "description": "Items per page", "default": 5},
            },
            "required": [],
        },
    },
    {
        "name": "get_launch_detail",
        "description": "Get detailed info about a specific launch including test counts",
        "input_schema": {
            "type": "object",
            "properties": {
                "launch_id": {"type": "integer", "description": "Launch ID"},
            },
            "required": ["launch_id"],
        },
    },
    {
        "name": "get_failed_tests",
        "description": "Get failed/error test items for a launch",
        "input_schema": {
            "type": "object",
            "properties": {
                "launch_id": {"type": "integer", "description": "Launch ID"},
            },
            "required": ["launch_id"],
        },
    },
    {
        "name": "get_analysis_summary",
        "description": "Get AI failure analysis summary (defect type distribution) for a launch",
        "input_schema": {
            "type": "object",
            "properties": {
                "launch_id": {"type": "integer", "description": "Launch ID"},
            },
            "required": ["launch_id"],
        },
    },
    {
        "name": "trigger_analysis",
        "description": "Trigger AI failure analysis for all failed tests in a launch. Returns immediately (async processing).",
        "input_schema": {
            "type": "object",
            "properties": {
                "launch_id": {"type": "integer", "description": "Launch ID to analyze"},
            },
            "required": ["launch_id"],
        },
    },
    {
        "name": "get_test_history",
        "description": "Get history of a specific test across all launches (pass/fail trend). Useful for finding flaky tests.",
        "input_schema": {
            "type": "object",
            "properties": {
                "test_name": {"type": "string", "description": "Exact test name to look up"},
                "limit": {"type": "integer", "description": "Max entries to return", "default": 20},
            },
            "required": ["test_name"],
        },
    },
    {
        "name": "get_test_logs",
        "description": "Get log entries for a specific test item. Can filter by level (ERROR, WARN, INFO, DEBUG, TRACE).",
        "input_schema": {
            "type": "object",
            "properties": {
                "launch_id": {"type": "integer", "description": "Launch ID"},
                "item_id": {"type": "integer", "description": "Test item ID"},
                "level": {"type": "string", "description": "Filter by log level (ERROR/WARN/INFO/DEBUG/TRACE)"},
            },
            "required": ["launch_id", "item_id"],
        },
    },
    {
        "name": "get_item_defects",
        "description": "Get defects linked to a specific test item",
        "input_schema": {
            "type": "object",
            "properties": {
                "launch_id": {"type": "integer", "description": "Launch ID"},
                "item_id": {"type": "integer", "description": "Test item ID"},
            },
            "required": ["launch_id", "item_id"],
        },
    },
    {
        "name": "get_dashboards",
        "description": "List all custom dashboards",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_members",
        "description": "List all project team members with their roles",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "get_settings",
        "description": "Get current project settings (name, AI config, retention, etc.)",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
]


async def execute_tool(name: str, args: dict) -> str:
    """Execute a tool call and return the result as a string."""
    try:
        if name == "check_system_health":
            result = await backend.health()
            return json.dumps(result)

        elif name == "get_launches":
            result = await backend.get_launches(
                page=args.get("page", 1),
                page_size=args.get("page_size", 5),
            )
            return json.dumps(result)

        elif name == "get_launch_detail":
            result = await backend.get_launch(args["launch_id"])
            return json.dumps(result)

        elif name == "get_failed_tests":
            failed = await backend.get_test_items(args["launch_id"], status="FAILED")
            errors = await backend.get_test_items(args["launch_id"], status="ERROR")
            return json.dumps({"failed": failed, "errors": errors})

        elif name == "get_analysis_summary":
            result = await backend.get_analysis_summary(args["launch_id"])
            return json.dumps(result)

        elif name == "trigger_analysis":
            result = await backend.trigger_analysis(args["launch_id"])
            return json.dumps(result)

        elif name == "get_test_history":
            result = await backend.get_test_history(
                args["test_name"], args.get("limit", 20)
            )
            return json.dumps(result)

        elif name == "get_test_logs":
            result = await backend.get_test_logs(
                args["launch_id"], args["item_id"], args.get("level")
            )
            return json.dumps(result)

        elif name == "get_item_defects":
            result = await backend.get_item_defects(args["launch_id"], args["item_id"])
            return json.dumps(result)

        elif name == "get_dashboards":
            result = await backend.get_dashboards()
            return json.dumps(result)

        elif name == "get_members":
            result = await backend.get_members()
            return json.dumps(result)

        elif name == "get_settings":
            result = await backend.get_settings()
            return json.dumps(result)

        else:
            return json.dumps({"error": f"Unknown tool: {name}"})

    except Exception as e:
        return json.dumps({"error": str(e)})


CHAT_LOG_DIR = os.path.join(os.path.dirname(__file__), "chat_logs")
os.makedirs(CHAT_LOG_DIR, exist_ok=True)


class CEOAgent:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.conversations: dict[int, list] = {}  # user_id -> message history

    def _get_history(self, user_id: int) -> list:
        if user_id not in self.conversations:
            self.conversations[user_id] = []
        return self.conversations[user_id]

    def _save_chat(self, user_id: int, user_msg: str, bot_msg: str):
        """Persist every exchange to a JSON file per user."""
        import datetime
        path = os.path.join(CHAT_LOG_DIR, f"{user_id}.json")
        try:
            with open(path, "r") as f:
                log = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            log = []
        log.append({
            "timestamp": datetime.datetime.now().isoformat(),
            "user": user_msg,
            "bot": bot_msg,
        })
        with open(path, "w") as f:
            json.dump(log, f, indent=2, ensure_ascii=False)

    def clear_history(self, user_id: int):
        self.conversations[user_id] = []

    async def chat(self, user_id: int, message: str) -> str:
        history = self._get_history(user_id)
        history.append({"role": "user", "content": message})

        # Trim history to max length
        from config import MAX_HISTORY
        if len(history) > MAX_HISTORY * 2:
            history = history[-(MAX_HISTORY * 2):]
            self.conversations[user_id] = history

        # Call Claude with tools
        try:
            response = self.client.messages.create(
                model=CLAUDE_MODEL,
                max_tokens=2048,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=history,
            )
        except Exception as e:
            logger.error("Claude API error: %s %s", type(e).__name__, e)
            return f"AI service error: {type(e).__name__}: {e}"

        # Process tool calls in a loop
        while response.stop_reason == "tool_use":
            tool_results = []
            assistant_content = response.content

            for block in response.content:
                if block.type == "tool_use":
                    logger.info("Tool call: %s(%s)", block.name, block.input)
                    result = await execute_tool(block.name, block.input)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

            history.append({"role": "assistant", "content": assistant_content})
            history.append({"role": "user", "content": tool_results})

            try:
                response = self.client.messages.create(
                    model=CLAUDE_MODEL,
                    max_tokens=2048,
                    system=SYSTEM_PROMPT,
                    tools=TOOLS,
                    messages=history,
                )
            except anthropic.APIError as e:
                logger.error("Claude API error during tool loop: %s", e)
                return "Sorry, I lost connection to the AI service mid-conversation."

        # Extract final text response
        final_text = ""
        for block in response.content:
            if hasattr(block, "text"):
                final_text += block.text

        history.append({"role": "assistant", "content": response.content})

        result = final_text or "I processed your request but have nothing to add."
        self._save_chat(user_id, message, result)
        return result


agent = CEOAgent()
