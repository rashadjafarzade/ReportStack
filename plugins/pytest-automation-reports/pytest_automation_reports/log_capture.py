from __future__ import annotations

import logging
from datetime import datetime, timezone


class LogCaptureHandler(logging.Handler):
    """Captures log records during a test for submission to automation-reports."""

    LEVEL_MAP = {
        logging.DEBUG: "DEBUG",
        logging.INFO: "INFO",
        logging.WARNING: "WARN",
        logging.ERROR: "ERROR",
        logging.CRITICAL: "ERROR",
    }

    def __init__(self):
        super().__init__()
        self.records: list[dict] = []
        self._index = 0

    def emit(self, record: logging.LogRecord):
        level = self.LEVEL_MAP.get(record.levelno, "INFO")
        self.records.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "message": self.format(record),
            "step_name": getattr(record, "step_name", None),
            "order_index": self._index,
        })
        self._index += 1

    def reset(self):
        self.records = []
        self._index = 0

    def get_records(self) -> list[dict]:
        return list(self.records)
