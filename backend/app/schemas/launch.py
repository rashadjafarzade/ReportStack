from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.launch import LaunchStatus


class LaunchCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tags: Optional[list[str]] = None


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
    tags: Optional[list[str]] = None

    model_config = {"from_attributes": True}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        if hasattr(obj, "tags_list"):
            # Convert the JSON text field to a list for the response
            obj_dict = {
                "id": obj.id,
                "name": obj.name,
                "description": obj.description,
                "status": obj.status,
                "start_time": obj.start_time,
                "end_time": obj.end_time,
                "total": obj.total,
                "passed": obj.passed,
                "failed": obj.failed,
                "skipped": obj.skipped,
                "tags": obj.tags_list,
            }
            return super().model_validate(obj_dict, *args, **kwargs)
        return super().model_validate(obj, *args, **kwargs)


class LaunchListResponse(BaseModel):
    items: list[LaunchResponse]
    total: int
    page: int
    page_size: int
