from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.launch import Launch
from app.models.test_item import TestItem
from app.models.defect import Defect
from app.schemas.defect import DefectCreate, DefectUpdate, DefectResponse

router = APIRouter(prefix="/api/v1", tags=["defects"])


def _get_launch(launch_id: int, db: Session) -> Launch:
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    return launch


@router.post("/launches/{launch_id}/items/{item_id}/defects", response_model=DefectResponse, status_code=201)
def create_defect(launch_id: int, item_id: int, data: DefectCreate, db: Session = Depends(get_db)):
    _get_launch(launch_id, db)
    item = db.query(TestItem).filter(TestItem.id == item_id, TestItem.launch_id == launch_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Test item not found")
    defect = Defect(launch_id=launch_id, test_item_id=item_id, **data.model_dump())
    db.add(defect)
    db.commit()
    db.refresh(defect)
    return defect


@router.get("/launches/{launch_id}/items/{item_id}/defects", response_model=list[DefectResponse])
def list_item_defects(launch_id: int, item_id: int, db: Session = Depends(get_db)):
    _get_launch(launch_id, db)
    return db.query(Defect).filter(
        Defect.launch_id == launch_id, Defect.test_item_id == item_id
    ).order_by(Defect.created_at.desc()).all()


@router.get("/launches/{launch_id}/defects", response_model=list[DefectResponse])
def list_launch_defects(launch_id: int, db: Session = Depends(get_db)):
    _get_launch(launch_id, db)
    return db.query(Defect).filter(Defect.launch_id == launch_id).order_by(Defect.created_at.desc()).all()


@router.put("/defects/{defect_id}", response_model=DefectResponse)
def update_defect(defect_id: int, data: DefectUpdate, db: Session = Depends(get_db)):
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(defect, field, value)
    db.commit()
    db.refresh(defect)
    return defect


@router.delete("/defects/{defect_id}", status_code=204)
def delete_defect(defect_id: int, db: Session = Depends(get_db)):
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail="Defect not found")
    db.delete(defect)
    db.commit()
