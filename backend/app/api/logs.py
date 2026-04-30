from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.launch import Launch
from app.models.test_item import TestItem
from app.models.log import TestLog, LogLevel
from app.schemas.log import TestLogCreate, TestLogBatchCreate, TestLogResponse

router = APIRouter(prefix="/api/v1/launches/{launch_id}/items/{item_id}/logs", tags=["logs"])


def _get_test_item(launch_id: int, item_id: int, db: Session) -> TestItem:
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    item = db.query(TestItem).filter(TestItem.id == item_id, TestItem.launch_id == launch_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Test item not found")
    return item


@router.post("/", response_model=TestLogResponse, status_code=201)
def create_log(launch_id: int, item_id: int, data: TestLogCreate, db: Session = Depends(get_db)):
    item = _get_test_item(launch_id, item_id, db)
    log = TestLog(test_item_id=item.id, **data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.post("/batch", response_model=list[TestLogResponse], status_code=201)
def create_logs_batch(launch_id: int, item_id: int, data: TestLogBatchCreate, db: Session = Depends(get_db)):
    item = _get_test_item(launch_id, item_id, db)
    logs = []
    for log_data in data.logs:
        log = TestLog(test_item_id=item.id, **log_data.model_dump())
        db.add(log)
        logs.append(log)
    db.commit()
    for log in logs:
        db.refresh(log)
    return logs


@router.get("/", response_model=list[TestLogResponse])
def list_logs(
    launch_id: int,
    item_id: int,
    level: LogLevel | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    _get_test_item(launch_id, item_id, db)
    query = db.query(TestLog).filter(TestLog.test_item_id == item_id)
    if level:
        query = query.filter(TestLog.level == level)
    return (
        query.order_by(TestLog.order_index)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
