from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SAEnum
from datetime import datetime, timezone

from app.database import Base
from app.models.member import MemberRole


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(MemberRole), default=MemberRole.MEMBER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
