from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.launch import LaunchStatus


class LaunchCreate(BaseModel):
    name: str
    description: Optional[str] = None


class LaunchFinish(BaseModel):
    status: LaunchStatus
    end_time: Optional[datetime] = None


class LaunchResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: LaunchStatus
    start_time: datetime
    end_time: Optional[datetime]
    total: int
    passed: int
    failed: int
    skipped: int

    model_config = {"from_attributes": True}


class LaunchListResponse(BaseModel):
    items: list[LaunchResponse]
    total: int
    page: int
    page_size: int
