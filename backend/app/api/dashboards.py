from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dashboard import Dashboard, Widget
from app.schemas.dashboard import (
    DashboardCreate, DashboardUpdate, DashboardResponse,
    DashboardListResponse, WidgetCreate, WidgetResponse,
)

router = APIRouter(prefix="/api/v1/dashboards", tags=["dashboards"])


@router.post("/", response_model=DashboardResponse, status_code=201)
def create_dashboard(data: DashboardCreate, db: Session = Depends(get_db)):
    dashboard = Dashboard(**data.model_dump())
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return dashboard


@router.get("/", response_model=DashboardListResponse)
def list_dashboards(db: Session = Depends(get_db)):
    dashboards = db.query(Dashboard).order_by(Dashboard.updated_at.desc()).all()
    return DashboardListResponse(items=dashboards, total=len(dashboards))


@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(dashboard_id: int, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(404, "Dashboard not found")
    return d


@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(dashboard_id: int, data: DashboardUpdate, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(404, "Dashboard not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(d, k, v)
    db.commit()
    db.refresh(d)
    return d


@router.delete("/{dashboard_id}", status_code=204)
def delete_dashboard(dashboard_id: int, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(404, "Dashboard not found")
    db.delete(d)
    db.commit()


# --- Widgets ---
@router.post("/{dashboard_id}/widgets/", response_model=WidgetResponse, status_code=201)
def add_widget(dashboard_id: int, data: WidgetCreate, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(404, "Dashboard not found")
    widget = Widget(dashboard_id=dashboard_id, **data.model_dump())
    db.add(widget)
    db.commit()
    db.refresh(widget)
    return widget


@router.delete("/{dashboard_id}/widgets/{widget_id}", status_code=204)
def remove_widget(dashboard_id: int, widget_id: int, db: Session = Depends(get_db)):
    w = db.query(Widget).filter(Widget.id == widget_id, Widget.dashboard_id == dashboard_id).first()
    if not w:
        raise HTTPException(404, "Widget not found")
    db.delete(w)
    db.commit()
