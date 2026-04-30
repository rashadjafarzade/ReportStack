import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.launch import Launch
from app.models.test_item import TestItem, TestStatus
from app.models.analysis import FailureAnalysis, DefectType, AnalysisSource
from app.schemas.analysis import FailureAnalysisResponse, AnalysisOverride, LaunchAnalysisSummary
from app.services.ai_analyzer import analyze_launch_failures, analyze_single_item

router = APIRouter(prefix="/api/v1", tags=["analyses"])


def _get_launch(launch_id: int, db: Session) -> Launch:
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    return launch


def _get_test_item(launch_id: int, item_id: int, db: Session) -> TestItem:
    _get_launch(launch_id, db)
    item = db.query(TestItem).filter(TestItem.id == item_id, TestItem.launch_id == launch_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Test item not found")
    return item


def _run_launch_analysis(launch_id: int):
    db = SessionLocal()
    try:
        asyncio.run(analyze_launch_failures(launch_id, db))
    finally:
        db.close()


def _run_item_analysis(item_id: int, launch_id: int):
    db = SessionLocal()
    try:
        item = db.query(TestItem).filter(TestItem.id == item_id).first()
        if item:
            asyncio.run(analyze_single_item(item, db))
    finally:
        db.close()


@router.post("/launches/{launch_id}/analyze", status_code=202)
def trigger_launch_analysis(
    launch_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    _get_launch(launch_id, db)
    background_tasks.add_task(_run_launch_analysis, launch_id)
    return {"message": "Analysis started", "launch_id": launch_id}


@router.post("/launches/{launch_id}/items/{item_id}/analyze", status_code=202)
def trigger_item_analysis(
    launch_id: int,
    item_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    item = _get_test_item(launch_id, item_id, db)
    background_tasks.add_task(_run_item_analysis, item.id, launch_id)
    return {"message": "Analysis started", "item_id": item_id}


@router.get(
    "/launches/{launch_id}/items/{item_id}/analyses",
    response_model=list[FailureAnalysisResponse],
)
def get_item_analyses(
    launch_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    _get_test_item(launch_id, item_id, db)
    return (
        db.query(FailureAnalysis)
        .filter(FailureAnalysis.test_item_id == item_id)
        .order_by(FailureAnalysis.created_at.desc())
        .all()
    )


@router.get("/launches/{launch_id}/analysis-summary", response_model=LaunchAnalysisSummary)
def get_analysis_summary(launch_id: int, db: Session = Depends(get_db)):
    _get_launch(launch_id, db)

    failed_item_ids = (
        db.query(TestItem.id)
        .filter(
            TestItem.launch_id == launch_id,
            TestItem.status.in_([TestStatus.FAILED, TestStatus.ERROR]),
        )
        .subquery()
    )

    analyses = (
        db.query(FailureAnalysis)
        .filter(FailureAnalysis.test_item_id.in_(failed_item_ids))
        .all()
    )

    # Use only the latest analysis per item (no overridden_by)
    latest = {}
    for a in analyses:
        if a.test_item_id not in latest or a.created_at > latest[a.test_item_id].created_at:
            latest[a.test_item_id] = a

    counts = {dt: 0 for dt in DefectType}
    for a in latest.values():
        counts[a.defect_type] += 1

    return LaunchAnalysisSummary(
        total_analyzed=len(latest),
        product_bug=counts[DefectType.PRODUCT_BUG],
        automation_bug=counts[DefectType.AUTOMATION_BUG],
        system_issue=counts[DefectType.SYSTEM_ISSUE],
        no_defect=counts[DefectType.NO_DEFECT],
        to_investigate=counts[DefectType.TO_INVESTIGATE],
    )


@router.put(
    "/launches/{launch_id}/items/{item_id}/analyses/{analysis_id}",
    response_model=FailureAnalysisResponse,
)
def override_analysis(
    launch_id: int,
    item_id: int,
    analysis_id: int,
    data: AnalysisOverride,
    db: Session = Depends(get_db),
):
    _get_test_item(launch_id, item_id, db)
    old_analysis = (
        db.query(FailureAnalysis)
        .filter(FailureAnalysis.id == analysis_id, FailureAnalysis.test_item_id == item_id)
        .first()
    )
    if not old_analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    new_analysis = FailureAnalysis(
        test_item_id=item_id,
        defect_type=data.defect_type,
        confidence=1.0,
        reasoning=data.reasoning or f"Manual override from {old_analysis.defect_type.value}",
        source=AnalysisSource.MANUAL,
    )
    db.add(new_analysis)
    db.flush()

    old_analysis.overridden_by = new_analysis.id
    db.commit()
    db.refresh(new_analysis)
    return new_analysis
