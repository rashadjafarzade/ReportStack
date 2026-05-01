from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum as SAEnum, Index
from datetime import datetime, timezone
import enum

from app.database import Base


class DefectStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    FIXED = "FIXED"
    WONT_FIX = "WONT_FIX"
    DUPLICATE = "DUPLICATE"


class Defect(Base):
    __tablename__ = "defects"

    id = Column(Integer, primary_key=True, index=True)
    test_item_id = Column(Integer, ForeignKey("test_items.id"), nullable=False)
    launch_id = Column(Integer, ForeignKey("launches.id"), nullable=False)
    external_id = Column(String(255), nullable=True)  # e.g. JIRA ticket
    external_url = Column(String(1024), nullable=True)
    summary = Column(String(512), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SAEnum(DefectStatus), default=DefectStatus.OPEN, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_defects_launch_item", "launch_id", "test_item_id"),
    )
