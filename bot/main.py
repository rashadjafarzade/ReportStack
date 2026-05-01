#!/usr/bin/env python3
"""Automation Reports CEO Agent — Telegram Bot."""

import asyncio
import logging
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, filters

from config import TELEGRAM_BOT_TOKEN
from handlers import (
    start_command,
    status_command,
    launches_command,
    launch_command,
    failures_command,
    analyze_command,
    clear_command,
    handle_message,
)

logging.basicConfig(
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)


def main():
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set. See .env.example")
        return

    from config import ANTHROPIC_API_KEY
    if not ANTHROPIC_API_KEY:
        logger.error("ANTHROPIC_API_KEY is not set. See .env.example")
        return

    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()

    # Register command handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", start_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("launches", launches_command))
    app.add_handler(CommandHandler("launch", launch_command))
    app.add_handler(CommandHandler("failures", failures_command))
    app.add_handler(CommandHandler("analyze", analyze_command))
    app.add_handler(CommandHandler("clear", clear_command))

    # Free-text messages go to the Claude agent
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("CEO Agent bot starting...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    asyncio.set_event_loop(asyncio.new_event_loop())
    main()
