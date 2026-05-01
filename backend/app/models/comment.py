from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Index
from datetime import datetime, timezone

from app.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    test_item_id = Column(Integer, ForeignKey("test_items.id"), nullable=True)
    launch_id = Column(Integer, ForeignKey("launches.id"), nullable=False)
    author = Column(String(255), nullable=False, default="Anonymous")
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_comments_launch_item", "launch_id", "test_item_id"),
    )
