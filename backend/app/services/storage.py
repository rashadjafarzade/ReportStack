"""Storage abstraction for attachments — MinIO (dev) or local disk (prod)."""

import io
import json
import logging
import os
from abc import ABC, abstractmethod
from pathlib import Path

logger = logging.getLogger(__name__)

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "minio")
ATTACHMENT_PATH = os.getenv("ATTACHMENT_STORAGE_PATH", "/data/attachments")


class Storage(ABC):
    @abstractmethod
    def put(self, key: str, data: bytes, content_type: str) -> None: ...

    @abstractmethod
    def get(self, key: str) -> tuple[bytes, str]: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    @abstractmethod
    def exists(self, key: str) -> bool: ...

    def ensure_ready(self) -> None:
        """Called at startup to verify the backend is reachable / writable."""


class MinIOStorage(Storage):
    def __init__(self):
        from minio import Minio

        self._endpoint = os.getenv("MINIO_ENDPOINT", "minio:9000")
        self._access_key = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
        self._secret_key = os.getenv("MINIO_SECRET_KEY", "minioadmin")
        self._bucket = os.getenv("MINIO_BUCKET", "attachments")
        self._secure = os.getenv("MINIO_SECURE", "false").lower() == "true"
        self._client = Minio(
            self._endpoint,
            access_key=self._access_key,
            secret_key=self._secret_key,
            secure=self._secure,
        )

    def ensure_ready(self) -> None:
        from minio.error import S3Error

        try:
            if not self._client.bucket_exists(self._bucket):
                self._client.make_bucket(self._bucket)
                logger.info("Created MinIO bucket: %s", self._bucket)
        except S3Error as e:
            logger.error("MinIO bucket check failed: %s", e)

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self._client.put_object(
            self._bucket,
            key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )

    def get(self, key: str) -> tuple[bytes, str]:
        response = self._client.get_object(self._bucket, key)
        try:
            data = response.read()
            content_type = response.headers.get("Content-Type", "application/octet-stream")
        finally:
            response.close()
            response.release_conn()
        return data, content_type

    def delete(self, key: str) -> None:
        from minio.error import S3Error

        try:
            self._client.remove_object(self._bucket, key)
        except S3Error as e:
            logger.warning("Failed to delete %s from MinIO: %s", key, e)

    def exists(self, key: str) -> bool:
        from minio.error import S3Error

        try:
            self._client.stat_object(self._bucket, key)
            return True
        except S3Error:
            return False


class LocalDiskStorage(Storage):
    def __init__(self, base_path: str):
        self._base = Path(base_path)

    def _resolve(self, key: str) -> Path:
        return self._base / key

    def _meta_path(self, key: str) -> Path:
        return self._base / (key + ".meta")

    def ensure_ready(self) -> None:
        self._base.mkdir(parents=True, exist_ok=True)
        logger.info("LocalDiskStorage ready at %s", self._base)

    def put(self, key: str, data: bytes, content_type: str) -> None:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        self._meta_path(key).write_text(json.dumps({"content_type": content_type}))

    def get(self, key: str) -> tuple[bytes, str]:
        path = self._resolve(key)
        if not path.is_file():
            raise FileNotFoundError(f"Attachment not found: {key}")
        data = path.read_bytes()
        meta = self._meta_path(key)
        if meta.is_file():
            content_type = json.loads(meta.read_text()).get("content_type", "application/octet-stream")
        else:
            content_type = "application/octet-stream"
        return data, content_type

    def delete(self, key: str) -> None:
        path = self._resolve(key)
        try:
            path.unlink(missing_ok=True)
            self._meta_path(key).unlink(missing_ok=True)
        except OSError as e:
            logger.warning("Failed to delete %s from disk: %s", key, e)

    def exists(self, key: str) -> bool:
        return self._resolve(key).is_file()


def _create_storage() -> Storage:
    if STORAGE_BACKEND == "local":
        return LocalDiskStorage(ATTACHMENT_PATH)
    return MinIOStorage()


storage = _create_storage()


# Backwards-compatible function API used by existing callers
def ensure_bucket() -> None:
    storage.ensure_ready()


def upload_file(object_key: str, data: bytes, content_type: str) -> None:
    storage.put(object_key, data, content_type)


def download_file(object_key: str) -> tuple[bytes, str]:
    return storage.get(object_key)


def delete_file(object_key: str) -> None:
    storage.delete(object_key)
