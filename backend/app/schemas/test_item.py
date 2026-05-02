from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.test_item import TestStatus
from app.schemas.defect import DefectCreate


class TestItemCreate(BaseModel):
    name: str
    suite: Optional[str] = None
    status: TestStatus
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None
    stack_trace: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    retry_of: Optional[int] = None


class TestItemBatchCreate(BaseModel):
    items: list[TestItemCreate]


class BulkStatusUpdate(BaseModel):
    item_ids: list[int]
    status: TestStatus


class BulkDefectAssign(BaseModel):
    item_ids: list[int]
    defect: DefectCreate


class BulkAnalyze(BaseModel):
    item_ids: list[int]


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
    retry_of: Optional[int] = None

    model_config = {"from_attributes": True}


class TestHistoryEntry(BaseModel):
    id: int
    launch_id: int
    launch_name: str
    launch_number: int
    status: TestStatus
    duration_ms: Optional[int]
    error_message: Optional[str]
    defect_type: Optional[str] = None
    start_time: datetime
