"""MinIO object storage service for attachments."""

import io
import logging
import os

from minio import Minio
from minio.error import S3Error

logger = logging.getLogger(__name__)

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "attachments")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"


def _get_client() -> Minio:
    return Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_SECURE,
    )


def ensure_bucket():
    """Create the attachments bucket if it doesn't exist."""
    client = _get_client()
    try:
        if not client.bucket_exists(MINIO_BUCKET):
            client.make_bucket(MINIO_BUCKET)
            logger.info("Created MinIO bucket: %s", MINIO_BUCKET)
    except S3Error as e:
        logger.error("MinIO bucket check failed: %s", e)


def upload_file(object_key: str, data: bytes, content_type: str) -> None:
    """Upload a file to MinIO."""
    client = _get_client()
    client.put_object(
        MINIO_BUCKET,
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )


def download_file(object_key: str) -> tuple[bytes, str]:
    """Download a file from MinIO. Returns (data, content_type)."""
    client = _get_client()
    response = client.get_object(MINIO_BUCKET, object_key)
    try:
        data = response.read()
        content_type = response.headers.get("Content-Type", "application/octet-stream")
    finally:
        response.close()
        response.release_conn()
    return data, content_type


def delete_file(object_key: str) -> None:
    """Delete a file from MinIO."""
    client = _get_client()
    try:
        client.remove_object(MINIO_BUCKET, object_key)
    except S3Error as e:
        logger.warning("Failed to delete %s from MinIO: %s", object_key, e)


def get_presigned_url(object_key: str, expires_hours: int = 1) -> str:
    """Get a presigned URL for direct download."""
    from datetime import timedelta
    client = _get_client()
    return client.presigned_get_object(
        MINIO_BUCKET,
        object_key,
        expires=timedelta(hours=expires_hours),
    )
