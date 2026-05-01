from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel

from app.models.dashboard import WidgetType


class WidgetCreate(BaseModel):
    widget_type: WidgetType
    title: str
    config: Optional[str] = None
    order_index: int = 0
    width: int = 6


class WidgetResponse(BaseModel):
    id: int
    dashboard_id: int
    widget_type: WidgetType
    title: str
    config: Optional[str]
    order_index: int
    width: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DashboardCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner: str = "admin"


class DashboardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class DashboardResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner: str
    created_at: datetime
    updated_at: datetime
    widgets: List[WidgetResponse] = []

    model_config = {"from_attributes": True}


class DashboardListResponse(BaseModel):
    items: List[DashboardResponse]
    total: int
