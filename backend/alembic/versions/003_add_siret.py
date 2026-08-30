"""add siret to sci

Revision ID: 003_add_siret
Revises: 002_budget
Create Date: 2026-08-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '003_add_siret'
down_revision: Union[str, None] = '002_budget'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sci', sa.Column('siret', sa.String(20), server_default='', nullable=False))


def downgrade() -> None:
    op.drop_column('sci', 'siret')
