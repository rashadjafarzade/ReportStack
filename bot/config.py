import os
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
AR_BACKEND_URL = os.getenv("AR_BACKEND_URL", "http://localhost:8000/api/v1")
AR_FRONTEND_URL = os.getenv("AR_FRONTEND_URL", "http://localhost:3000")
MAX_HISTORY = int(os.getenv("MAX_HISTORY", "20"))

_allowed = os.getenv("ALLOWED_USER_IDS", "").strip()
ALLOWED_USER_IDS: set[int] = set(int(x) for x in _allowed.split(",") if x.strip()) if _allowed else set()
