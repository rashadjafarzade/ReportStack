from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.launch import Launch
from app.models.test_item import TestItem, TestStatus
from app.schemas.test_item import TestItemCreate, TestItemBatchCreate, TestItemResponse

router = APIRouter(prefix="/api/v1/launches/{launch_id}/items", tags=["test_items"])


def _get_launch(launch_id: int, db: Session) -> Launch:
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    return launch


def _update_launch_stats(launch: Launch, db: Session):
    items = db.query(TestItem).filter(TestItem.launch_id == launch.id).all()
    launch.total = len(items)
    launch.passed = sum(1 for i in items if i.status == TestStatus.PASSED)
    launch.failed = sum(1 for i in items if i.status in (TestStatus.FAILED, TestStatus.ERROR))
    launch.skipped = sum(1 for i in items if i.status == TestStatus.SKIPPED)


@router.post("/", response_model=TestItemResponse, status_code=201)
def create_test_item(launch_id: int, data: TestItemCreate, db: Session = Depends(get_db)):
    launch = _get_launch(launch_id, db)
    item = TestItem(launch_id=launch.id, **data.model_dump())
    db.add(item)
    db.flush()
    _update_launch_stats(launch, db)
    db.commit()
    db.refresh(item)
    return item


@router.post("/batch", response_model=list[TestItemResponse], status_code=201)
def create_test_items_batch(launch_id: int, data: TestItemBatchCreate, db: Session = Depends(get_db)):
    launch = _get_launch(launch_id, db)
    items = []
    for item_data in data.items:
        item = TestItem(launch_id=launch.id, **item_data.model_dump())
        db.add(item)
        items.append(item)
    db.flush()
    _update_launch_stats(launch, db)
    db.commit()
    for item in items:
        db.refresh(item)
    return items


@router.get("/", response_model=list[TestItemResponse])
def list_test_items(
    launch_id: int,
    status: TestStatus | None = None,
    suite: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    _get_launch(launch_id, db)
    query = db.query(TestItem).filter(TestItem.launch_id == launch_id)
    if status:
        query = query.filter(TestItem.status == status)
    if suite:
        query = query.filter(TestItem.suite == suite)
    return query.offset((page - 1) * page_size).limit(page_size).all()


@router.get("/{item_id}", response_model=TestItemResponse)
def get_test_item(launch_id: int, item_id: int, db: Session = Depends(get_db)):
    _get_launch(launch_id, db)
    item = db.query(TestItem).filter(TestItem.id == item_id, TestItem.launch_id == launch_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Test item not found")
    return item
