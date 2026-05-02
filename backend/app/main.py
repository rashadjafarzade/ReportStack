from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import launches, test_items, logs, attachments, analyses, comments, defects, members, project_settings, dashboards, test_history
from app.database import engine, Base
from app.services.storage import ensure_bucket

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Automation Reports",
    description="Test automation reporting platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(launches.router)
app.include_router(test_items.router)
app.include_router(logs.router)
app.include_router(attachments.router)
app.include_router(analyses.router)
app.include_router(comments.router)
app.include_router(defects.router)
app.include_router(members.router)
app.include_router(project_settings.router)
app.include_router(dashboards.router)
app.include_router(test_history.router)


@app.on_event("startup")
def on_startup():
    ensure_bucket()
    _start_retention_scheduler()


def _start_retention_scheduler():
    """Run data retention cleanup on startup and every 24 hours."""
    import threading
    from app.services.retention import run_retention_cleanup

    def _loop():
        import time
        while True:
            run_retention_cleanup()
            time.sleep(86400)  # 24 hours

    t = threading.Thread(target=_loop, daemon=True)
    t.start()


@app.get("/api/v1/health")
def health_check():
    from sqlalchemy import text
    from app.database import SessionLocal
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        db_ok = False
    status = "ok" if db_ok else "degraded"
    return {"status": status, "database": "connected" if db_ok else "unreachable"}
