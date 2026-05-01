from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CommentCreate(BaseModel):
    author: str = "Anonymous"
    text: str


class CommentUpdate(BaseModel):
    text: str


class CommentResponse(BaseModel):
    id: int
    test_item_id: Optional[int]
    launch_id: int
    author: str
    text: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
