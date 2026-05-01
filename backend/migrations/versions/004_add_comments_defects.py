"""Add comments and defects tables

Revision ID: 004
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"


def upgrade():
    op.create_table(
        "comments",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("test_item_id", sa.Integer(), sa.ForeignKey("test_items.id"), nullable=True),
        sa.Column("launch_id", sa.Integer(), sa.ForeignKey("launches.id"), nullable=False),
        sa.Column("author", sa.String(255), nullable=False, server_default="Anonymous"),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_comments_launch_item", "comments", ["launch_id", "test_item_id"])

    op.create_table(
        "defects",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("test_item_id", sa.Integer(), sa.ForeignKey("test_items.id"), nullable=False),
        sa.Column("launch_id", sa.Integer(), sa.ForeignKey("launches.id"), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("external_url", sa.String(1024), nullable=True),
        sa.Column("summary", sa.String(512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.Enum("OPEN", "IN_PROGRESS", "FIXED", "WONT_FIX", "DUPLICATE", name="defectstatus"), nullable=False, server_default="OPEN"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_defects_launch_item", "defects", ["launch_id", "test_item_id"])


def downgrade():
    op.drop_index("ix_defects_launch_item")
    op.drop_table("defects")
    op.drop_index("ix_comments_launch_item")
    op.drop_table("comments")
