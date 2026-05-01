import random

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project_settings import ProjectSettings
from app.models.launch import Launch, LaunchStatus
from app.models.test_item import TestItem, TestStatus
from app.schemas.project_settings import ProjectSettingsUpdate, ProjectSettingsResponse

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


def _get_or_create(db: Session) -> ProjectSettings:
    settings = db.query(ProjectSettings).first()
    if not settings:
        settings = ProjectSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/", response_model=ProjectSettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.put("/", response_model=ProjectSettingsResponse)
def update_settings(data: ProjectSettingsUpdate, db: Session = Depends(get_db)):
    settings = _get_or_create(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.commit()
    db.refresh(settings)
    return settings


SUITES = ["auth", "checkout", "search", "profile", "api", "admin"]
TEST_NAMES = {
    "auth": ["test_login", "test_logout", "test_register", "test_password_reset", "test_2fa"],
    "checkout": ["test_add_to_cart", "test_remove_from_cart", "test_payment", "test_order_confirmation"],
    "search": ["test_basic_search", "test_filter", "test_pagination", "test_autocomplete"],
    "profile": ["test_update_name", "test_update_email", "test_avatar_upload"],
    "api": ["test_get_users", "test_create_user", "test_delete_user", "test_rate_limiting"],
    "admin": ["test_dashboard_load", "test_user_management", "test_settings_page"],
}


@router.post("/seed", status_code=201)
def generate_demo_data(db: Session = Depends(get_db)):
    created = []
    for i in range(5):
        launch = Launch(
            name=f"Demo Run #{i + 1}",
            description=f"Demo regression suite - build #{200 + i}",
        )
        db.add(launch)
        db.flush()

        items = []
        for suite in random.sample(SUITES, k=random.randint(3, 6)):
            for test in TEST_NAMES[suite]:
                status = random.choices(
                    [TestStatus.PASSED, TestStatus.FAILED, TestStatus.SKIPPED, TestStatus.ERROR],
                    weights=[75, 15, 8, 2],
                )[0]
                item = TestItem(
                    launch_id=launch.id,
                    name=test,
                    suite=suite,
                    status=status,
                    duration_ms=random.randint(50, 5000),
                )
                if status in (TestStatus.FAILED, TestStatus.ERROR):
                    item.error_message = f"AssertionError: Expected true but got false in {test}"
                    item.stack_trace = f"  at {test} (tests/{suite}/{test}.py:42)\n  at run_test (framework/runner.py:108)"
                db.add(item)
                items.append(item)

        db.flush()
        launch.total = len(items)
        launch.passed = sum(1 for it in items if it.status == TestStatus.PASSED)
        launch.failed = sum(1 for it in items if it.status in (TestStatus.FAILED, TestStatus.ERROR))
        launch.skipped = sum(1 for it in items if it.status == TestStatus.SKIPPED)

        if i < 4:
            has_failed = any(it.status in (TestStatus.FAILED, TestStatus.ERROR) for it in items)
            launch.status = LaunchStatus.FAILED if has_failed else LaunchStatus.PASSED
            from datetime import datetime, timezone
            launch.end_time = datetime.now(timezone.utc)

        created.append({"id": launch.id, "name": launch.name, "total": launch.total})

    db.commit()
    return {"message": f"Generated {len(created)} demo launches", "launches": created}
