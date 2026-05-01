"""Add members and project_settings tables

Revision ID: 005
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"


def upgrade():
    op.create_table(
        "members",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("role", sa.Enum("ADMIN", "MANAGER", "MEMBER", "VIEWER", name="memberrole"), nullable=False, server_default="MEMBER"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "project_settings",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("project_name", sa.String(255), nullable=False, server_default="ReportStack"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("default_launch_mode", sa.String(50), nullable=False, server_default="DEFAULT"),
        sa.Column("auto_analysis_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("ai_model", sa.String(100), nullable=False, server_default="mistral:7b"),
        sa.Column("notifications_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("retention_days", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("max_attachment_size_mb", sa.Integer(), nullable=False, server_default="20"),
    )


def downgrade():
    op.drop_table("project_settings")
    op.drop_table("members")
