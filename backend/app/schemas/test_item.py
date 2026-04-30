from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.test_item import TestStatus


class TestItemCreate(BaseModel):
    name: str
    suite: Optional[str] = None
    status: TestStatus
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


class TestItemBatchCreate(BaseModel):
    items: list[TestItemCreate]


class TestItemResponse(BaseModel):
    id: int
    launch_id: int
    name: str
    suite: Optional[str]
    status: TestStatus
    duration_ms: Optional[int]
    error_message: Optional[str]
    stack_trace: Optional[str]
    start_time: datetime
    end_time: Optional[datetime]

    model_config = {"from_attributes": True}
