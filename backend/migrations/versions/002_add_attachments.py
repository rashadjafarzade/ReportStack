"""add attachments table

Revision ID: 002_add_attachments
Revises: 001_add_test_logs
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = "002_add_attachments"
down_revision = "001_add_test_logs"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("test_item_id", sa.Integer(), sa.ForeignKey("test_items.id"), nullable=True),
        sa.Column("launch_id", sa.Integer(), sa.ForeignKey("launches.id"), nullable=False),
        sa.Column("file_name", sa.String(512), nullable=False),
        sa.Column("file_path", sa.String(1024), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("content_type", sa.String(128), nullable=False),
        sa.Column(
            "attachment_type",
            sa.Enum("SCREENSHOT", "LOG_FILE", "VIDEO", "OTHER", name="attachmenttype"),
            nullable=False,
            server_default="OTHER",
        ),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_attachments_launch_item", "attachments", ["launch_id", "test_item_id"])
    op.create_index("ix_attachments_id", "attachments", ["id"])


def downgrade():
    op.drop_index("ix_attachments_id")
    op.drop_index("ix_attachments_launch_item")
    op.drop_table("attachments")
    op.execute("DROP TYPE IF EXISTS attachmenttype")
