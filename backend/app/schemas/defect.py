from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.defect import DefectStatus


class DefectCreate(BaseModel):
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    summary: str
    description: Optional[str] = None
    status: DefectStatus = DefectStatus.OPEN


class DefectUpdate(BaseModel):
    external_id: Optional[str] = None
    external_url: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    status: Optional[DefectStatus] = None


class DefectResponse(BaseModel):
    id: int
    test_item_id: int
    launch_id: int
    external_id: Optional[str]
    external_url: Optional[str]
    summary: str
    description: Optional[str]
    status: DefectStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
