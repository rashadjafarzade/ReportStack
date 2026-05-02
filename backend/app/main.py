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


@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}
