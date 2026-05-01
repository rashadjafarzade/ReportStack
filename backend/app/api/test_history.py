from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.test_item import TestItem
from app.models.launch import Launch
from app.models.analysis import FailureAnalysis
from app.schemas.test_item import TestHistoryEntry

router = APIRouter(prefix="/api/v1/items", tags=["test_history"])


@router.get("/history", response_model=list[TestHistoryEntry])
def get_test_history(
    name: str = Query(..., description="Test name to search history for"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(TestItem, Launch)
        .join(Launch, TestItem.launch_id == Launch.id)
        .filter(TestItem.name == name)
        .order_by(desc(TestItem.start_time))
        .limit(limit)
        .all()
    )

    results = []
    for item, launch in rows:
        analysis = (
            db.query(FailureAnalysis)
            .filter(FailureAnalysis.test_item_id == item.id)
            .order_by(desc(FailureAnalysis.created_at))
            .first()
        )
        results.append(TestHistoryEntry(
            id=item.id,
            launch_id=launch.id,
            launch_name=launch.name,
            launch_number=launch.id,
            status=item.status,
            duration_ms=item.duration_ms,
            error_message=item.error_message,
            defect_type=analysis.defect_type.value if analysis else None,
            start_time=item.start_time,
        ))

    return results
