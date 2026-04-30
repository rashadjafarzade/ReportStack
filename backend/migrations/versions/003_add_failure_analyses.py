"""add failure_analyses table

Revision ID: 003_add_failure_analyses
Revises: 002_add_attachments
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = "003_add_failure_analyses"
down_revision = "002_add_attachments"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "failure_analyses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("test_item_id", sa.Integer(), sa.ForeignKey("test_items.id"), nullable=False),
        sa.Column(
            "defect_type",
            sa.Enum("PRODUCT_BUG", "AUTOMATION_BUG", "SYSTEM_ISSUE", "NO_DEFECT", "TO_INVESTIGATE", name="defecttype"),
            nullable=False,
            server_default="TO_INVESTIGATE",
        ),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column(
            "source",
            sa.Enum("AI_AUTO", "MANUAL", name="analysissource"),
            nullable=False,
            server_default="AI_AUTO",
        ),
        sa.Column("model_name", sa.String(128), nullable=True),
        sa.Column("prompt_version", sa.String(32), nullable=True, server_default="v1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("overridden_by", sa.Integer(), sa.ForeignKey("failure_analyses.id"), nullable=True),
    )
    op.create_index("ix_failure_analyses_test_item", "failure_analyses", ["test_item_id"])
    op.create_index("ix_failure_analyses_id", "failure_analyses", ["id"])


def downgrade():
    op.drop_index("ix_failure_analyses_id")
    op.drop_index("ix_failure_analyses_test_item")
    op.drop_table("failure_analyses")
    op.execute("DROP TYPE IF EXISTS defecttype")
    op.execute("DROP TYPE IF EXISTS analysissource")
