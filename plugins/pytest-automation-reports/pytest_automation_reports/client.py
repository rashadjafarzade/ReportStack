import requests
import logging

logger = logging.getLogger("automation-reports")


class ARClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()

    def create_launch(self, name: str, description: str | None = None) -> dict:
        resp = self.session.post(
            f"{self.base_url}/launches/",
            json={"name": name, "description": description},
        )
        resp.raise_for_status()
        return resp.json()

    def finish_launch(self, launch_id: int, status: str) -> dict:
        resp = self.session.put(
            f"{self.base_url}/launches/{launch_id}/finish",
            json={"status": status},
        )
        resp.raise_for_status()
        return resp.json()

    def create_test_item(self, launch_id: int, data: dict) -> dict:
        resp = self.session.post(
            f"{self.base_url}/launches/{launch_id}/items/",
            json=data,
        )
        resp.raise_for_status()
        return resp.json()

    def batch_create_logs(self, launch_id: int, item_id: int, logs: list[dict]) -> list:
        if not logs:
            return []
        resp = self.session.post(
            f"{self.base_url}/launches/{launch_id}/items/{item_id}/logs/batch",
            json={"logs": logs},
        )
        resp.raise_for_status()
        return resp.json()

    def upload_attachment(self, launch_id: int, item_id: int, filepath: str, filename: str) -> dict:
        with open(filepath, "rb") as f:
            resp = self.session.post(
                f"{self.base_url}/launches/{launch_id}/items/{item_id}/attachments",
                files={"file": (filename, f)},
            )
        resp.raise_for_status()
        return resp.json()

    def trigger_analysis(self, launch_id: int):
        resp = self.session.post(f"{self.base_url}/launches/{launch_id}/analyze")
        resp.raise_for_status()
        return resp.json()
