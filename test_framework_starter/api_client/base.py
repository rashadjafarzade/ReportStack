"""Base HTTP client — auth, retries, error wrapping.

Subclassed by domain-specific clients (RadioBackendClient and any other
backend you need to hit). The base layer is intentionally small so domain
clients stay readable.
"""
from __future__ import annotations

import time
from typing import Any, Mapping

import httpx


class APIError(RuntimeError):
    """Wraps non-2xx responses and connection failures with context."""

    def __init__(self, message: str, *, status: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status = status
        self.body = body


class BaseClient:
    """Thin wrapper around httpx.Client with retry on idempotent methods."""

    def __init__(
        self,
        *,
        base_url: str,
        token: str | None = None,
        timeout: float = 10.0,
        max_retries: int = 2,
    ) -> None:
        headers: dict[str, str] = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = httpx.Client(base_url=base_url, headers=headers, timeout=timeout)
        self._max_retries = max_retries

    # ---- lifecycle --------------------------------------------------------
    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "BaseClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    # ---- core requests ----------------------------------------------------
    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        params: Mapping[str, Any] | None = None,
        retry_idempotent: bool = True,
    ) -> httpx.Response:
        attempts = self._max_retries if (retry_idempotent and method.upper() in {"GET", "HEAD"}) else 0
        last_exc: Exception | None = None
        for attempt in range(attempts + 1):
            try:
                response = self._client.request(method, path, json=json, params=params)
                if response.status_code >= 500 and attempt < attempts:
                    time.sleep(0.2 * (attempt + 1))
                    continue
                if response.status_code >= 400:
                    raise APIError(
                        f"{method} {path} -> {response.status_code}",
                        status=response.status_code,
                        body=response.text,
                    )
                return response
            except httpx.HTTPError as e:
                last_exc = e
                if attempt < attempts:
                    time.sleep(0.2 * (attempt + 1))
                    continue
                raise APIError(f"{method} {path}: {e}") from e
        # Defensive: should be unreachable.
        raise APIError(f"{method} {path}: exhausted retries: {last_exc}")

    def get(self, path: str, *, params: Mapping[str, Any] | None = None) -> Any:
        return self._request("GET", path, params=params).json()

    def post(self, path: str, *, json: Any = None) -> Any:
        return self._request("POST", path, json=json, retry_idempotent=False).json()

    def put(self, path: str, *, json: Any = None) -> Any:
        return self._request("PUT", path, json=json, retry_idempotent=False).json()

    def delete(self, path: str) -> None:
        self._request("DELETE", path, retry_idempotent=False)
