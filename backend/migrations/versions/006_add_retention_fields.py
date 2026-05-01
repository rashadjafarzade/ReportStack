"""Add granular retention fields to project_settings

Revision ID: 006
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"


def upgrade():
    op.add_column("project_settings", sa.Column("inactivity_timeout", sa.String(50), nullable=False, server_default="1 day"))
    op.add_column("project_settings", sa.Column("keep_launches", sa.String(50), nullable=False, server_default="90 days"))
    op.add_column("project_settings", sa.Column("keep_logs", sa.String(50), nullable=False, server_default="90 days"))
    op.add_column("project_settings", sa.Column("keep_attachments", sa.String(50), nullable=False, server_default="14 days"))


def downgrade():
    op.drop_column("project_settings", "keep_attachments")
    op.drop_column("project_settings", "keep_logs")
    op.drop_column("project_settings", "keep_launches")
    op.drop_column("project_settings", "inactivity_timeout")
