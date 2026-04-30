from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum as SAEnum, Index
from datetime import datetime, timezone
import enum

from app.database import Base


class LogLevel(str, enum.Enum):
    TRACE = "TRACE"
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"


class TestLog(Base):
    __tablename__ = "test_logs"

    id = Column(Integer, primary_key=True, index=True)
    test_item_id = Column(Integer, ForeignKey("test_items.id"), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    level = Column(SAEnum(LogLevel), nullable=False, default=LogLevel.INFO)
    message = Column(Text, nullable=False)
    step_name = Column(String(255), nullable=True)
    order_index = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        Index("ix_test_logs_item_order", "test_item_id", "order_index"),
    )
