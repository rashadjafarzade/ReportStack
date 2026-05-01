from pydantic import BaseModel
from typing import Optional


class ProjectSettingsUpdate(BaseModel):
    project_name: Optional[str] = None
    description: Optional[str] = None
    default_launch_mode: Optional[str] = None
    auto_analysis_enabled: Optional[bool] = None
    ai_model: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    retention_days: Optional[int] = None
    max_attachment_size_mb: Optional[int] = None
    inactivity_timeout: Optional[str] = None
    keep_launches: Optional[str] = None
    keep_logs: Optional[str] = None
    keep_attachments: Optional[str] = None


class ProjectSettingsResponse(BaseModel):
    project_name: str
    description: str
    default_launch_mode: str
    auto_analysis_enabled: bool
    ai_model: str
    notifications_enabled: bool
    retention_days: int
    max_attachment_size_mb: int
    inactivity_timeout: str
    keep_launches: str
    keep_logs: str
    keep_attachments: str

    model_config = {"from_attributes": True}
