from pydantic import BaseModel, computed_field
from datetime import datetime
from typing import Optional
from app.models.attachment import AttachmentType


class AttachmentResponse(BaseModel):
    id: int
    test_item_id: Optional[int]
    launch_id: int
    file_name: str
    file_path: str
    file_size: int
    content_type: str
    attachment_type: AttachmentType
    uploaded_at: datetime

    @computed_field
    @property
    def url(self) -> str:
        return f"/api/v1/attachments/{self.id}/file"

    model_config = {"from_attributes": True}
