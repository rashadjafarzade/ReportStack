from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.log import LogLevel


class TestLogCreate(BaseModel):
    timestamp: Optional[datetime] = None
    level: LogLevel = LogLevel.INFO
    message: str
    step_name: Optional[str] = None
    order_index: int = 0


class TestLogBatchCreate(BaseModel):
    logs: list[TestLogCreate]


class TestLogResponse(BaseModel):
    id: int
    test_item_id: int
    timestamp: datetime
    level: LogLevel
    message: str
    step_name: Optional[str]
    order_index: int

    model_config = {"from_attributes": True}
