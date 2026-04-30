"""Seed the database with sample launch data for demo purposes."""
import requests
import random

BASE = "http://localhost:8000/api/v1"

suites = ["auth", "checkout", "search", "profile", "api", "admin"]
test_names = {
    "auth": ["test_login", "test_logout", "test_register", "test_password_reset", "test_2fa"],
    "checkout": ["test_add_to_cart", "test_remove_from_cart", "test_payment", "test_order_confirmation"],
    "search": ["test_basic_search", "test_filter", "test_pagination", "test_autocomplete"],
    "profile": ["test_update_name", "test_update_email", "test_avatar_upload"],
    "api": ["test_get_users", "test_create_user", "test_delete_user", "test_rate_limiting"],
    "admin": ["test_dashboard_load", "test_user_management", "test_settings_page"],
}

for i in range(5):
    launch = requests.post(f"{BASE}/launches/", json={
        "name": f"Regression Run #{i + 1}",
        "description": f"Full regression test suite - build #{100 + i}",
    }).json()

    items = []
    for suite in random.sample(suites, k=random.randint(3, 6)):
        for test in test_names[suite]:
            status = random.choices(
                ["PASSED", "FAILED", "SKIPPED", "ERROR"],
                weights=[75, 15, 8, 2],
            )[0]
            item = {
                "name": test,
                "suite": suite,
                "status": status,
                "duration_ms": random.randint(50, 5000),
            }
            if status in ("FAILED", "ERROR"):
                item["error_message"] = f"AssertionError: Expected true but got false in {test}"
                item["stack_trace"] = f"  at {test} (tests/{suite}/{test}.py:42)\n  at run_test (framework/runner.py:108)"
            items.append(item)

    requests.post(f"{BASE}/launches/{launch['id']}/items/batch", json={"items": items})

    # Finish some launches
    if i < 4:
        has_failed = any(it["status"] in ("FAILED", "ERROR") for it in items)
        requests.put(f"{BASE}/launches/{launch['id']}/finish", json={
            "status": "FAILED" if has_failed else "PASSED",
        })

print("Seeded 5 launches with test data.")
