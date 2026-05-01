from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project_settings import ProjectSettings
from app.schemas.project_settings import ProjectSettingsUpdate, ProjectSettingsResponse

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


def _get_or_create(db: Session) -> ProjectSettings:
    settings = db.query(ProjectSettings).first()
    if not settings:
        settings = ProjectSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/", response_model=ProjectSettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("/", response_model=ProjectSettingsResponse)
def update_settings(data: ProjectSettingsUpdate, db: Session = Depends(get_db)):
    settings = _get_or_create(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings
