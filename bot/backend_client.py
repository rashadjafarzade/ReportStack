"""HTTP client that talks to the automation-reports backend API."""

import httpx
import logging
from config import AR_BACKEND_URL

logger = logging.getLogger(__name__)


class BackendClient:
    def __init__(self):
        self.base = AR_BACKEND_URL.rstrip("/")
        self.client = httpx.AsyncClient(timeout=15.0)

    async def health(self) -> dict:
        r = await self.client.get(f"{self.base}/health")
        r.raise_for_status()
        return r.json()

    async def get_launches(self, page: int = 1, page_size: int = 5) -> dict:
        r = await self.client.get(
            f"{self.base}/launches/",
            params={"page": page, "page_size": page_size},
        )
        r.raise_for_status()
        return r.json()

    async def get_launch(self, launch_id: int) -> dict:
        r = await self.client.get(f"{self.base}/launches/{launch_id}")
        r.raise_for_status()
        return r.json()

    async def get_test_items(self, launch_id: int, status: str | None = None) -> list:
        params = {}
        if status:
            params["status"] = status
        r = await self.client.get(f"{self.base}/launches/{launch_id}/items/", params=params)
        r.raise_for_status()
        return r.json()

    async def get_analysis_summary(self, launch_id: int) -> dict:
        r = await self.client.get(f"{self.base}/launches/{launch_id}/analysis-summary")
        r.raise_for_status()
        return r.json()

    async def trigger_analysis(self, launch_id: int) -> dict:
        r = await self.client.post(f"{self.base}/launches/{launch_id}/analyze")
        r.raise_for_status()
        return r.json()

    async def get_item_analyses(self, launch_id: int, item_id: int) -> list:
        r = await self.client.get(f"{self.base}/launches/{launch_id}/items/{item_id}/analyses")
        r.raise_for_status()
        return r.json()

    async def get_test_history(self, test_name: str, limit: int = 20) -> list:
        r = await self.client.get(
            f"{self.base}/items/history",
            params={"name": test_name, "limit": limit},
        )
        r.raise_for_status()
        return r.json()

    async def get_dashboards(self) -> dict:
        r = await self.client.get(f"{self.base}/dashboards/")
        r.raise_for_status()
        return r.json()

    async def get_members(self) -> list:
        r = await self.client.get(f"{self.base}/members/")
        r.raise_for_status()
        return r.json()

    async def get_settings(self) -> dict:
        r = await self.client.get(f"{self.base}/settings/")
        r.raise_for_status()
        return r.json()

    async def get_item_defects(self, launch_id: int, item_id: int) -> list:
        r = await self.client.get(f"{self.base}/launches/{launch_id}/items/{item_id}/defects/")
        r.raise_for_status()
        return r.json()

    async def get_test_logs(self, launch_id: int, item_id: int, level: str | None = None) -> list:
        params = {}
        if level:
            params["level"] = level
        r = await self.client.get(f"{self.base}/launches/{launch_id}/items/{item_id}/logs/", params=params)
        r.raise_for_status()
        return r.json()


backend = BackendClient()
