"""Data retention cleanup service.

Reads retention settings from ProjectSettings and deletes expired data.
Runs on backend startup and every 24 hours via a daemon thread.
"""

import logging
import re
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_

from app.database import SessionLocal
from app.models.launch import Launch
from app.models.test_item import TestItem
from app.models.log import TestLog
from app.models.attachment import Attachment
from app.models.project_settings import ProjectSettings
from app.services.storage import delete_file

logger = logging.getLogger(__name__)


def _parse_retention(value: str) -> timedelta | None:
    """Parse retention string like '90 days', '14 days', '0' into timedelta.
    Returns None if retention is disabled (0 or empty).
    """
    if not value or value.strip() == "0":
        return None
    match = re.match(r"(\d+)\s*(day|days|d)", value.strip().lower())
    if match:
        return timedelta(days=int(match.group(1)))
    # Try plain number as days
    try:
        days = int(value.strip())
        return timedelta(days=days) if days > 0 else None
    except ValueError:
        return None


def run_retention_cleanup():
    """Execute retention cleanup based on ProjectSettings."""
    db = SessionLocal()
    try:
        settings = db.query(ProjectSettings).first()
        if not settings:
            logger.debug("No ProjectSettings found, skipping retention cleanup")
            return

        now = datetime.now(timezone.utc)

        # Clean up old launches
        launch_retention = _parse_retention(settings.keep_launches)
        if launch_retention:
            cutoff = now - launch_retention
            old_launches = (
                db.query(Launch)
                .filter(Launch.start_time < cutoff)
                .all()
            )
            if old_launches:
                logger.info("Retention: deleting %d launches older than %s", len(old_launches), cutoff.isoformat())
                for launch in old_launches:
                    db.delete(launch)
                db.commit()

        # Clean up old logs (independent of launch deletion)
        log_retention = _parse_retention(settings.keep_logs)
        if log_retention:
            cutoff = now - log_retention
            deleted = (
                db.query(TestLog)
                .filter(TestLog.timestamp < cutoff)
                .delete(synchronize_session=False)
            )
            if deleted:
                logger.info("Retention: deleted %d logs older than %s", deleted, cutoff.isoformat())
                db.commit()

        # Clean up old attachments
        attach_retention = _parse_retention(settings.keep_attachments)
        if attach_retention:
            cutoff = now - attach_retention
            old_attachments = (
                db.query(Attachment)
                .filter(Attachment.uploaded_at < cutoff)
                .all()
            )
            if old_attachments:
                logger.info("Retention: deleting %d attachments older than %s", len(old_attachments), cutoff.isoformat())
                for att in old_attachments:
                    try:
                        delete_file(att.file_path)
                    except Exception:
                        logger.warning("Failed to delete attachment file: %s", att.file_path)
                    db.delete(att)
                db.commit()

        logger.debug("Retention cleanup completed")
    except Exception:
        logger.exception("Retention cleanup failed")
        db.rollback()
    finally:
        db.close()
