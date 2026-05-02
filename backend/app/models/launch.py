from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
import json

from app.database import Base


class LaunchStatus(str, enum.Enum):
    IN_PROGRESS = "IN_PROGRESS"
    PASSED = "PASSED"
    FAILED = "FAILED"
    STOPPED = "STOPPED"


class Launch(Base):
    __tablename__ = "launches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String(1024), nullable=True)
    status = Column(SAEnum(LaunchStatus), default=LaunchStatus.IN_PROGRESS, nullable=False)
    start_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    end_time = Column(DateTime(timezone=True), nullable=True)
    total = Column(Integer, default=0)
    passed = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    tags = Column(Text, nullable=True)  # JSON array stored as text

    test_items = relationship("TestItem", back_populates="launch", cascade="all, delete-orphan")
    attachments = relationship("Attachment", backref="launch", cascade="all, delete-orphan")

    @property
    def tags_list(self) -> list[str]:
        if not self.tags:
            return []
        try:
            return json.loads(self.tags)
        except (json.JSONDecodeError, TypeError):
            return []

    @tags_list.setter
    def tags_list(self, value: list[str]):
        self.tags = json.dumps(value) if value else None
