"""Add tags column to launches table."""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("launches", sa.Column("tags", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("launches", "tags")
