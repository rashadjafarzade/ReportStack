import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional

from app.database import get_db
from app.models.launch import Launch, LaunchStatus
from app.schemas.launch import LaunchCreate, LaunchFinish, LaunchResponse, LaunchListResponse

router = APIRouter(prefix="/api/v1/launches", tags=["launches"])


def _launch_to_response(launch: Launch) -> dict:
    return {
        "id": launch.id,
        "name": launch.name,
        "description": launch.description,
        "status": launch.status,
        "start_time": launch.start_time,
        "end_time": launch.end_time,
        "total": launch.total,
        "passed": launch.passed,
        "failed": launch.failed,
        "skipped": launch.skipped,
        "tags": launch.tags_list,
    }


@router.post("/", response_model=LaunchResponse, status_code=201)
def create_launch(data: LaunchCreate, db: Session = Depends(get_db)):
    launch = Launch(
        name=data.name,
        description=data.description,
    )
    if data.tags:
        launch.tags_list = data.tags
    db.add(launch)
    db.commit()
    db.refresh(launch)
    return _launch_to_response(launch)


@router.get("/", response_model=LaunchListResponse)
def list_launches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[LaunchStatus] = None,
    tag: Optional[str] = None,
    name: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Launch)
    if status:
        query = query.filter(Launch.status == status)
    if name:
        query = query.filter(Launch.name.ilike(f"%{name}%"))
    if tag:
        query = query.filter(Launch.tags.ilike(f'%"{tag}"%'))
    total = query.count()
    items = (
        query.order_by(Launch.start_time.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return LaunchListResponse(
        items=[_launch_to_response(l) for l in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{launch_id}", response_model=LaunchResponse)
def get_launch(launch_id: int, db: Session = Depends(get_db)):
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    return _launch_to_response(launch)


@router.put("/{launch_id}/finish", response_model=LaunchResponse)
def finish_launch(launch_id: int, data: LaunchFinish, db: Session = Depends(get_db)):
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")

    launch.status = data.status
    launch.end_time = data.end_time or datetime.now(timezone.utc)
    db.commit()
    db.refresh(launch)
    return _launch_to_response(launch)


@router.delete("/{launch_id}", status_code=204)
def delete_launch(launch_id: int, db: Session = Depends(get_db)):
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    db.delete(launch)
    db.commit()
