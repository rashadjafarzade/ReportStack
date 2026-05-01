from sqlalchemy import Column, Integer, String, Boolean, Text
from app.database import Base


class ProjectSettings(Base):
    __tablename__ = "project_settings"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(255), nullable=False, default="ReportStack")
    description = Column(Text, nullable=False, default="")
    default_launch_mode = Column(String(50), nullable=False, default="DEFAULT")
    auto_analysis_enabled = Column(Boolean, nullable=False, default=True)
    ai_model = Column(String(100), nullable=False, default="mistral:7b")
    notifications_enabled = Column(Boolean, nullable=False, default=False)
    retention_days = Column(Integer, nullable=False, default=90)
    max_attachment_size_mb = Column(Integer, nullable=False, default=20)
