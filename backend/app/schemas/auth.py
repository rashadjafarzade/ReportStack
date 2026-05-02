from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.member import MemberRole


class RegisterRequest(BaseModel):
    email: str
    name: str
    password: str
    role: MemberRole = MemberRole.MEMBER


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: MemberRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[MemberRole] = None
    is_active: Optional[bool] = None
