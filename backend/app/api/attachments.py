import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.launch import Launch
from app.models.test_item import TestItem
from app.models.attachment import Attachment, AttachmentType
from app.schemas.attachment import AttachmentResponse
from app.services.storage import upload_file, download_file, delete_file

router = APIRouter(prefix="/api/v1", tags=["attachments"])

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

MIME_TO_TYPE = {
    "image/png": AttachmentType.SCREENSHOT,
    "image/jpeg": AttachmentType.SCREENSHOT,
    "image/gif": AttachmentType.SCREENSHOT,
    "image/webp": AttachmentType.SCREENSHOT,
    "video/mp4": AttachmentType.VIDEO,
    "video/webm": AttachmentType.VIDEO,
    "text/plain": AttachmentType.LOG_FILE,
}


def _get_launch(launch_id: int, db: Session) -> Launch:
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    return launch


def _get_test_item(launch_id: int, item_id: int, db: Session) -> TestItem:
    _get_launch(launch_id, db)
    item = db.query(TestItem).filter(TestItem.id == item_id, TestItem.launch_id == launch_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Test item not found")
    return item


async def _save_upload(
    file: UploadFile,
    launch_id: int,
    item_id: int | None,
    db: Session,
) -> Attachment:
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large (max 20MB)")

    filename = file.filename or "unnamed"
    unique_name = f"{uuid.uuid4()}_{filename}"
    content_type = file.content_type or "application/octet-stream"

    if item_id:
        object_key = f"{launch_id}/{item_id}/{unique_name}"
    else:
        object_key = f"{launch_id}/_launch/{unique_name}"

    upload_file(object_key, content, content_type)

    attachment_type = MIME_TO_TYPE.get(content_type, AttachmentType.OTHER)

    attachment = Attachment(
        test_item_id=item_id,
        launch_id=launch_id,
        file_name=filename,
        file_path=object_key,
        file_size=len(content),
        content_type=content_type,
        attachment_type=attachment_type,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.post(
    "/launches/{launch_id}/items/{item_id}/attachments",
    response_model=AttachmentResponse,
    status_code=201,
)
async def upload_item_attachment(
    launch_id: int,
    item_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    _get_test_item(launch_id, item_id, db)
    return await _save_upload(file, launch_id, item_id, db)


@router.post(
    "/launches/{launch_id}/attachments",
    response_model=AttachmentResponse,
    status_code=201,
)
async def upload_launch_attachment(
    launch_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    _get_launch(launch_id, db)
    return await _save_upload(file, launch_id, None, db)


@router.get(
    "/launches/{launch_id}/items/{item_id}/attachments",
    response_model=list[AttachmentResponse],
)
def list_item_attachments(
    launch_id: int,
    item_id: int,
    db: Session = Depends(get_db),
):
    _get_test_item(launch_id, item_id, db)
    return (
        db.query(Attachment)
        .filter(Attachment.launch_id == launch_id, Attachment.test_item_id == item_id)
        .order_by(Attachment.uploaded_at.desc())
        .all()
    )


@router.get("/attachments/{attachment_id}/file")
def serve_attachment(attachment_id: int, db: Session = Depends(get_db)):
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    data, content_type = download_file(attachment.file_path)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{attachment.file_name}"'},
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)):
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    delete_file(attachment.file_path)
    db.delete(attachment)
    db.commit()
