import httpx
import json
import os
import logging

from sqlalchemy.orm import Session
from app.models.test_item import TestItem, TestStatus
from app.models.log import TestLog
from app.models.analysis import FailureAnalysis, DefectType, AnalysisSource

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral:7b")
PROMPT_VERSION = "v1"

SYSTEM_PROMPT = """You are a test failure classifier. Given a test failure, classify it into exactly one category:

1. PRODUCT_BUG - The test found a real bug in the product/application
2. AUTOMATION_BUG - The test itself is broken (bad locator, wrong assertion, flaky test)
3. SYSTEM_ISSUE - Infrastructure/environment problem (timeout, connection refused, OOM)
4. NO_DEFECT - The test failure is expected or not a real issue
5. TO_INVESTIGATE - Cannot determine the cause with available information

Respond with JSON only:
{"defect_type": "CATEGORY", "confidence": 0.0-1.0, "reasoning": "brief explanation"}"""


def _build_user_prompt(item: TestItem, logs: list[TestLog]) -> str:
    parts = [
        f"Test: {item.name}",
        f"Suite: {item.suite or 'N/A'}",
        f"Status: {item.status.value}",
    ]
    if item.error_message:
        parts.append(f"Error: {item.error_message}")
    if item.stack_trace:
        trace_lines = item.stack_trace.strip().split("\n")
        parts.append(f"Stack trace (last 50 lines):\n" + "\n".join(trace_lines[-50:]))
    if logs:
        log_text = "\n".join(
            f"[{log.level.value}] {log.message}" for log in logs[-20:]
        )
        parts.append(f"Recent logs:\n{log_text}")
    return "\n\n".join(parts)


async def analyze_single_item(item: TestItem, db: Session) -> FailureAnalysis:
    logs = (
        db.query(TestLog)
        .filter(TestLog.test_item_id == item.id)
        .order_by(TestLog.order_index)
        .all()
    )

    user_prompt = _build_user_prompt(item, logs)

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": OLLAMA_MODEL,
                        "prompt": user_prompt,
                        "system": SYSTEM_PROMPT,
                        "stream": False,
                        "options": {
                            "temperature": 0.1,
                            "num_predict": 256,
                        },
                        "format": "json",
                    },
                )
                response.raise_for_status()
                result = response.json()
                parsed = json.loads(result["response"])

                defect_type = DefectType(parsed["defect_type"])
                confidence = float(parsed["confidence"])
                reasoning = parsed.get("reasoning", "")

                if confidence < 0.4:
                    defect_type = DefectType.TO_INVESTIGATE

                analysis = FailureAnalysis(
                    test_item_id=item.id,
                    defect_type=defect_type,
                    confidence=confidence,
                    reasoning=reasoning,
                    source=AnalysisSource.AI_AUTO,
                    model_name=OLLAMA_MODEL,
                    prompt_version=PROMPT_VERSION,
                )
                db.add(analysis)
                db.commit()
                db.refresh(analysis)
                return analysis

        except (json.JSONDecodeError, KeyError, ValueError) as e:
            if attempt == 0:
                logger.warning(f"JSON parse failure for item {item.id}, retrying: {e}")
                continue
            logger.error(f"Failed to parse AI response for item {item.id}: {e}")
            break
        except httpx.HTTPError as e:
            logger.error(f"Ollama unreachable for item {item.id}: {e}")
            break
        except Exception as e:
            # Catch-all so analyzer crashes can't swallow the BackgroundTask
            # silently — any error must still produce a TO_INVESTIGATE row so
            # the UI shows the failure was at least seen.
            logger.error(
                f"Unexpected analyzer error for item {item.id}: {e}",
                exc_info=True,
            )
            break

    # Fallback
    analysis = FailureAnalysis(
        test_item_id=item.id,
        defect_type=DefectType.TO_INVESTIGATE,
        confidence=0.0,
        reasoning="AI analysis unavailable - classified as TO_INVESTIGATE",
        source=AnalysisSource.AI_AUTO,
        model_name=OLLAMA_MODEL,
        prompt_version=PROMPT_VERSION,
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


async def analyze_launch_failures(launch_id: int, db: Session):
    failed_items = (
        db.query(TestItem)
        .filter(
            TestItem.launch_id == launch_id,
            TestItem.status.in_([TestStatus.FAILED, TestStatus.ERROR]),
        )
        .all()
    )

    for item in failed_items:
        existing = (
            db.query(FailureAnalysis)
            .filter(FailureAnalysis.test_item_id == item.id)
            .first()
        )
        if not existing:
            await analyze_single_item(item, db)
