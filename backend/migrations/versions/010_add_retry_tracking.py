"""Add retry_of column to test_items for retry tracking."""

import sqlalchemy as sa
from alembic import op

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "test_items",
        sa.Column("retry_of", sa.Integer(), sa.ForeignKey("test_items.id"), nullable=True),
    )


def downgrade():
    op.drop_column("test_items", "retry_of")
