"""add test_logs table

Revision ID: 001_add_test_logs
Revises:
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = "001_add_test_logs"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "test_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("test_item_id", sa.Integer(), sa.ForeignKey("test_items.id"), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("level", sa.Enum("TRACE", "DEBUG", "INFO", "WARN", "ERROR", name="loglevel"), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("step_name", sa.String(255), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_test_logs_item_order", "test_logs", ["test_item_id", "order_index"])
    op.create_index("ix_test_logs_id", "test_logs", ["id"])


def downgrade():
    op.drop_index("ix_test_logs_id")
    op.drop_index("ix_test_logs_item_order")
    op.drop_table("test_logs")
    op.execute("DROP TYPE IF EXISTS loglevel")
