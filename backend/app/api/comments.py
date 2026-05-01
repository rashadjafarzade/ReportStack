from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.launch import Launch
from app.models.test_item import TestItem
from app.models.comment import Comment
from app.schemas.comment import CommentCreate, CommentUpdate, CommentResponse

router = APIRouter(prefix="/api/v1", tags=["comments"])


def _get_launch(launch_id: int, db: Session) -> Launch:
    launch = db.query(Launch).filter(Launch.id == launch_id).first()
    if not launch:
        raise HTTPException(status_code=404, detail="Launch not found")
    return launch


# Item-level comments
@router.post("/launches/{launch_id}/items/{item_id}/comments", response_model=CommentResponse, status_code=201)
def create_item_comment(launch_id: int, item_id: int, data: CommentCreate, db: Session = Depends(get_db)):
    _get_launch(launch_id, db)
    item = db.query(TestItem).filter(TestItem.id == item_id, TestItem.launch_id == launch_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Test item not found")
    comment = Comment(launch_id=launch_id, test_item_id=item_id, **data.model_dump())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/launches/{launch_id}/items/{item_id}/comments", response_model=list[CommentResponse])
def list_item_comments(launch_id: int, item_id: int, db: Session = Depends(get_db)):
    _get_launch(launch_id, db)
    return db.query(Comment).filter(
        Comment.launch_id == launch_id, Comment.test_item_id == item_id
    ).order_by(Comment.created_at.desc()).all()


# Launch-level comments
@router.post("/launches/{launch_id}/comments", response_model=CommentResponse, status_code=201)
def create_launch_comment(launch_id: int, data: CommentCreate, db: Session = Depends(get_db)):
    _get_launch(launch_id, db)
    comment = Comment(launch_id=launch_id, test_item_id=None, **data.model_dump())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.get("/launches/{launch_id}/comments", response_model=list[CommentResponse])
def list_launch_comments(launch_id: int, db: Session = Depends(get_db)):
    _get_launch(launch_id, db)
    return db.query(Comment).filter(
        Comment.launch_id == launch_id, Comment.test_item_id == None
    ).order_by(Comment.created_at.desc()).all()


# Update/Delete
@router.put("/comments/{comment_id}", response_model=CommentResponse)
def update_comment(comment_id: int, data: CommentUpdate, db: Session = Depends(get_db)):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.text = data.text
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
