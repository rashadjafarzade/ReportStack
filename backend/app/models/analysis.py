from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Enum as SAEnum, Index
from datetime import datetime, timezone
import enum

from app.database import Base


class DefectType(str, enum.Enum):
    PRODUCT_BUG = "PRODUCT_BUG"
    AUTOMATION_BUG = "AUTOMATION_BUG"
    SYSTEM_ISSUE = "SYSTEM_ISSUE"
    NO_DEFECT = "NO_DEFECT"
    TO_INVESTIGATE = "TO_INVESTIGATE"


class AnalysisSource(str, enum.Enum):
    AI_AUTO = "AI_AUTO"
    MANUAL = "MANUAL"


class FailureAnalysis(Base):
    __tablename__ = "failure_analyses"

    id = Column(Integer, primary_key=True, index=True)
    test_item_id = Column(Integer, ForeignKey("test_items.id"), nullable=False)
    defect_type = Column(SAEnum(DefectType), nullable=False, default=DefectType.TO_INVESTIGATE)
    confidence = Column(Float, nullable=False, default=0.0)
    reasoning = Column(Text, nullable=True)
    source = Column(SAEnum(AnalysisSource), nullable=False, default=AnalysisSource.AI_AUTO)
    model_name = Column(String(128), nullable=True)
    prompt_version = Column(String(32), nullable=True, default="v1")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    overridden_by = Column(Integer, ForeignKey("failure_analyses.id"), nullable=True)

    __table_args__ = (
        Index("ix_failure_analyses_test_item", "test_item_id"),
    )
