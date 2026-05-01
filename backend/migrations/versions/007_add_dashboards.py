"""Add dashboards and widgets tables

Revision ID: 007
"""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"


def upgrade():
    op.create_table(
        "dashboards",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner", sa.String(255), nullable=False, server_default="admin"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "widgets",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("dashboard_id", sa.Integer(), sa.ForeignKey("dashboards.id"), nullable=False),
        sa.Column("widget_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("config", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), server_default="0"),
        sa.Column("width", sa.Integer(), server_default="6"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("widgets")
    op.drop_table("dashboards")
