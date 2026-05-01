"""Telegram bot command handlers."""

import logging
from telegram import Update
from telegram.ext import ContextTypes
from telegram.constants import ParseMode, ChatAction

from config import ALLOWED_USER_IDS, AR_FRONTEND_URL
from agent import agent
from backend_client import backend

logger = logging.getLogger(__name__)


def is_authorized(user_id: int) -> bool:
    if not ALLOWED_USER_IDS:
        return True
    return user_id in ALLOWED_USER_IDS


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update.effective_user.id):
        await update.message.reply_text("You are not authorized to use this bot.")
        return

    await update.message.reply_text(
        "*Welcome to Automation Reports CEO Agent* 🤖\n\n"
        "I'm your intelligent assistant for the Automation Reports platform. "
        "I know every file, API endpoint, and architectural decision in the project.\n\n"
        "*What I can do:*\n"
        "• Answer questions about the project\n"
        "• Check live system status\n"
        "• Show launch results and test failures\n"
        "• Trigger AI failure analysis\n"
        "• Give development and deployment guidance\n\n"
        "*Commands:*\n"
        "/status — System health check\n"
        "/launches — Recent launches overview\n"
        "/launch `<id>` — Launch details\n"
        "/failures `<launch_id>` — Failed tests\n"
        "/analyze `<launch_id>` — Trigger AI analysis\n"
        "/team — List team members\n"
        "/clear — Reset conversation history\n\n"
        "Or just ask me anything in plain text!",
        parse_mode=ParseMode.MARKDOWN,
    )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update.effective_user.id):
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        health = await backend.health()
        launches_data = await backend.get_launches(page=1, page_size=1)
        total_launches = launches_data.get("total", 0)

        await update.message.reply_text(
            "✅ *System Status*\n\n"
            f"• Backend: *Online* (`{health.get('status', 'ok')}`)\n"
            f"• Total launches: *{total_launches}*\n"
            f"• Frontend: [{AR_FRONTEND_URL}]({AR_FRONTEND_URL})",
            parse_mode=ParseMode.MARKDOWN,
        )
    except Exception as e:
        await update.message.reply_text(
            f"❌ *System Status*\n\nBackend unreachable: `{e}`",
            parse_mode=ParseMode.MARKDOWN,
        )


async def launches_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update.effective_user.id):
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        data = await backend.get_launches(page=1, page_size=8)
        launches = data.get("items", [])
        total = data.get("total", 0)

        if not launches:
            await update.message.reply_text("No launches found.")
            return

        lines = [f"📊 *Recent Launches* ({total} total)\n"]
        for l in launches:
            status_emoji = {
                "PASSED": "✅", "FAILED": "❌",
                "IN_PROGRESS": "🔄", "STOPPED": "⏹",
            }.get(l["status"], "❓")

            rate = f'{(l["passed"] / l["total"] * 100):.0f}%' if l["total"] > 0 else "N/A"
            lines.append(
                f"{status_emoji} *#{l['id']}* {l['name']}\n"
                f"    {l['passed']}✅ {l['failed']}❌ {l['skipped']}⏭ — {rate} pass rate"
            )

        lines.append(f"\n🔗 [Open Dashboard]({AR_FRONTEND_URL})")
        await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"❌ Error fetching launches: `{e}`", parse_mode=ParseMode.MARKDOWN)


async def launch_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update.effective_user.id):
        return

    if not context.args:
        await update.message.reply_text("Usage: /launch `<id>`", parse_mode=ParseMode.MARKDOWN)
        return

    try:
        launch_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("Invalid launch ID. Use a number.")
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        l = await backend.get_launch(launch_id)
        status_emoji = {
            "PASSED": "✅", "FAILED": "❌", "IN_PROGRESS": "🔄", "STOPPED": "⏹",
        }.get(l["status"], "❓")

        rate = f'{(l["passed"] / l["total"] * 100):.1f}%' if l["total"] > 0 else "N/A"

        text = (
            f"{status_emoji} *Launch #{l['id']}: {l['name']}*\n\n"
            f"📝 {l.get('description') or 'No description'}\n\n"
            f"*Results:*\n"
            f"  ✅ Passed: *{l['passed']}*\n"
            f"  ❌ Failed: *{l['failed']}*\n"
            f"  ⏭ Skipped: *{l['skipped']}*\n"
            f"  📊 Total: *{l['total']}* — {rate} pass rate\n\n"
            f"⏰ Started: `{l['start_time'][:19]}`\n"
        )
        if l.get("end_time"):
            text += f"🏁 Finished: `{l['end_time'][:19]}`\n"

        text += f"\n🔗 [Open in Dashboard]({AR_FRONTEND_URL}/launches/{l['id']})"

        # Also fetch analysis summary
        try:
            summary = await backend.get_analysis_summary(launch_id)
            if summary.get("total_analyzed", 0) > 0:
                text += (
                    f"\n\n🤖 *AI Analysis:*\n"
                    f"  🐛 Product Bug: *{summary['product_bug']}*\n"
                    f"  🔧 Automation Bug: *{summary['automation_bug']}*\n"
                    f"  ⚙️ System Issue: *{summary['system_issue']}*\n"
                    f"  ✅ No Defect: *{summary['no_defect']}*\n"
                    f"  🔍 To Investigate: *{summary['to_investigate']}*"
                )
        except Exception:
            pass

        await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"❌ Error: `{e}`", parse_mode=ParseMode.MARKDOWN)


async def failures_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update.effective_user.id):
        return

    if not context.args:
        await update.message.reply_text("Usage: /failures `<launch_id>`", parse_mode=ParseMode.MARKDOWN)
        return

    try:
        launch_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("Invalid launch ID.")
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        failed = await backend.get_test_items(launch_id, status="FAILED")
        errors = await backend.get_test_items(launch_id, status="ERROR")
        all_failures = failed + errors

        if not all_failures:
            await update.message.reply_text(f"✅ No failures in launch #{launch_id}!")
            return

        lines = [f"❌ *Failures in Launch #{launch_id}* ({len(all_failures)} tests)\n"]
        for item in all_failures[:15]:
            status = "❌" if item["status"] == "FAILED" else "💥"
            duration = f'{item["duration_ms"]}ms' if item.get("duration_ms") else "N/A"
            error_preview = ""
            if item.get("error_message"):
                error_preview = item["error_message"][:80]
                if len(item["error_message"]) > 80:
                    error_preview += "..."

            lines.append(f"{status} *{item['name']}* ({item.get('suite', 'N/A')}) `{duration}`")
            if error_preview:
                lines.append(f"    _{error_preview}_")

        if len(all_failures) > 15:
            lines.append(f"\n_...and {len(all_failures) - 15} more_")

        lines.append(f"\n🔗 [View Details]({AR_FRONTEND_URL}/launches/{launch_id})")
        await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"❌ Error: `{e}`", parse_mode=ParseMode.MARKDOWN)


async def analyze_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update.effective_user.id):
        return

    if not context.args:
        await update.message.reply_text("Usage: /analyze `<launch_id>`", parse_mode=ParseMode.MARKDOWN)
        return

    try:
        launch_id = int(context.args[0])
    except ValueError:
        await update.message.reply_text("Invalid launch ID.")
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        result = await backend.trigger_analysis(launch_id)
        await update.message.reply_text(
            f"🤖 *AI Analysis Triggered*\n\n"
            f"Analyzing failures in launch *#{launch_id}*...\n"
            f"This runs in the background. Check results in a minute with:\n"
            f"`/launch {launch_id}`",
            parse_mode=ParseMode.MARKDOWN,
        )
    except Exception as e:
        await update.message.reply_text(f"❌ Error triggering analysis: `{e}`", parse_mode=ParseMode.MARKDOWN)


async def team_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update.effective_user.id):
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        members = await backend.get_members()
        if not members:
            await update.message.reply_text("No team members found.")
            return

        role_emoji = {"ADMIN": "👑", "MANAGER": "🔧", "MEMBER": "👤", "VIEWER": "👁"}
        lines = [f"👥 *Team Members* ({len(members)} total)\n"]
        for m in members:
            emoji = role_emoji.get(m["role"], "👤")
            lines.append(f"{emoji} *{m['name']}* — {m['role']}\n    `{m['email']}`")

        lines.append(f"\n🔗 [Manage Team]({AR_FRONTEND_URL}/members)")
        await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"❌ Error: `{e}`", parse_mode=ParseMode.MARKDOWN)


async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_authorized(update.effective_user.id):
        return

    agent.clear_history(update.effective_user.id)
    await update.message.reply_text("🧹 Conversation history cleared.")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle free-text messages — route to the Claude CEO agent."""
    if not is_authorized(update.effective_user.id):
        return

    user_id = update.effective_user.id
    text = update.message.text

    if not text:
        return

    await update.message.chat.send_action(ChatAction.TYPING)

    try:
        response = await agent.chat(user_id, text)
    except Exception as e:
        logger.error("Error in agent chat: %s", e, exc_info=True)
        await update.message.reply_text(f"Error processing your message: {e}")
        return

    # Send response, falling back to plain text if markdown fails
    async def send(text):
        try:
            await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)
        except Exception:
            await update.message.reply_text(text)

    if len(response) > 4000:
        for i in range(0, len(response), 4000):
            await send(response[i:i + 4000])
    else:
        await send(response)
