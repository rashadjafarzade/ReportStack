from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.database import get_db
from app.models.launch import Launch, LaunchStatus
from app.schemas.launch import LaunchCreate, LaunchFinish, LaunchResponse, LaunchListResponse

router = APIRouter(prefix="/api/v1/launches", tags=["launches"])


@router.post("/", response_model=LaunchResponse, status_code=201)
def create_launch(data: LaunchCreate, db: Session = Depends(get_db)):
    launch = Launch(name=data.name, description=data.description)
    db.add(launch)
    db.commit()
    db.refresh(launch)
    return launch


@router.get("/", response_model=LaunchListResponse)
def list_launches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    total = db.query(Launch).count()
    items = (
        db.query(Launch)
        .order_by(Launch.start_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return LaunchListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{launch_id}", response_model=LaunchResponse)
def get_launch(launch_id: int, db: Session = Depends(get_db)):
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    return launch


@router.put("/{launch_id}/finish", response_model=LaunchResponse)
def finish_launch(launch_id: int, data: LaunchFinish, db: Session = Depends(get_db)):
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")

    launch.status = data.status
    launch.end_time = data.end_time or datetime.now(timezone.utc)
    db.commit()
    db.refresh(launch)
    return launch


@router.delete("/{launch_id}", status_code=204)
def delete_launch(launch_id: int, db: Session = Depends(get_db)):
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    db.delete(launch)
    db.commit()
