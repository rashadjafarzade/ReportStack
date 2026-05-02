from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum

from app.database import Base


class TestStatus(str, enum.Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    ERROR = "ERROR"


class TestItem(Base):
    __tablename__ = "test_items"

    id = Column(Integer, primary_key=True, index=True)
    launch_id = Column(Integer, ForeignKey("launches.id"), nullable=False)
    name = Column(String(512), nullable=False)
    suite = Column(String(255), nullable=True)
    status = Column(SAEnum(TestStatus), nullable=False)
    duration_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    stack_trace = Column(Text, nullable=True)
    start_time = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    end_time = Column(DateTime(timezone=True), nullable=True)
    retry_of = Column(Integer, ForeignKey("test_items.id"), nullable=True)

    launch = relationship("Launch", back_populates="test_items")
    retries = relationship("TestItem", backref="original", remote_side=[id])
    logs = relationship("TestLog", backref="test_item", cascade="all, delete-orphan")
    attachments = relationship("Attachment", backref="test_item", cascade="all, delete-orphan")
    analyses = relationship("FailureAnalysis", backref="test_item", cascade="all, delete-orphan")
    comments = relationship("Comment", backref="test_item", cascade="all, delete-orphan")
    defects = relationship("Defect", backref="test_item", cascade="all, delete-orphan")
