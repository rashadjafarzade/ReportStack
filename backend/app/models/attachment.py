from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum, Index
from datetime import datetime, timezone
import enum

from app.database import Base


class AttachmentType(str, enum.Enum):
    SCREENSHOT = "SCREENSHOT"
    LOG_FILE = "LOG_FILE"
    VIDEO = "VIDEO"
    OTHER = "OTHER"


class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    test_item_id = Column(Integer, ForeignKey("test_items.id"), nullable=True)
    launch_id = Column(Integer, ForeignKey("launches.id"), nullable=False)
    file_name = Column(String(512), nullable=False)
    file_path = Column(String(1024), nullable=False)
    file_size = Column(Integer, nullable=False)
    content_type = Column(String(128), nullable=False)
    attachment_type = Column(SAEnum(AttachmentType), default=AttachmentType.OTHER, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_attachments_launch_item", "launch_id", "test_item_id"),
    )
