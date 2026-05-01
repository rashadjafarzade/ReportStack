import enum
from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, DateTime, Text, Enum as SAEnum, ForeignKey, Table
from sqlalchemy.orm import relationship

from app.database import Base


class WidgetType(str, enum.Enum):
    LAUNCH_STATS = "LAUNCH_STATS"
    PASS_RATE_TREND = "PASS_RATE_TREND"
    DEFECT_BREAKDOWN = "DEFECT_BREAKDOWN"
    DURATION_TREND = "DURATION_TREND"
    FAILURE_TABLE = "FAILURE_TABLE"
    SUITE_BREAKDOWN = "SUITE_BREAKDOWN"


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    owner = Column(String(255), nullable=False, default="admin")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    widgets = relationship("Widget", backref="dashboard", cascade="all, delete-orphan", order_by="Widget.order_index")


class Widget(Base):
    __tablename__ = "widgets"

    id = Column(Integer, primary_key=True, index=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    widget_type = Column(SAEnum(WidgetType), nullable=False)
    title = Column(String(255), nullable=False)
    config = Column(Text, nullable=True)  # JSON string for widget-specific config
    order_index = Column(Integer, default=0)
    width = Column(Integer, default=6)  # grid columns (1-12)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
