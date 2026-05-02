from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.member import MemberRole
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, UserResponse, UserUpdate
from app.services.auth import (
    hash_password, verify_password, create_access_token,
    require_user, require_role,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # First user becomes ADMIN automatically
    user_count = db.query(User).count()
    role = MemberRole.ADMIN if user_count == 0 else data.role

    user = User(
        email=data.email,
        name=data.name,
        hashed_password=hash_password(data.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, user.role.value)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(user.id, user.email, user.role.value)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(require_user)):
    return user


@router.put("/me", response_model=UserResponse)
def update_me(data: UserUpdate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    if data.name is not None:
        user.name = data.name
    # Users cannot change their own role or active status
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserResponse])
def list_users(
    _admin: User = Depends(require_role(MemberRole.ADMIN)),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.created_at).all()


@router.put("/users/{user_id}", response_model=UserResponse)
def admin_update_user(
    user_id: int,
    data: UserUpdate,
    _admin: User = Depends(require_role(MemberRole.ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.name is not None:
        user.name = data.name
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return user
