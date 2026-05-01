from pydantic import BaseModel
from datetime import datetime
from app.models.member import MemberRole


class MemberCreate(BaseModel):
    name: str
    email: str
    role: MemberRole = MemberRole.MEMBER


class MemberUpdate(BaseModel):
    role: MemberRole


class MemberResponse(BaseModel):
    id: int
    name: str
    email: str
    role: MemberRole
    created_at: datetime

    model_config = {"from_attributes": True}
