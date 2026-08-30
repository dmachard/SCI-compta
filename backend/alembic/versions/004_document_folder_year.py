"""add folder_year to documents

Revision ID: 004_document_folder_year
Revises: 003_add_siret
Create Date: 2026-08-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '004_document_folder_year'
down_revision: Union[str, None] = '003_add_siret'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('documents', sa.Column('folder_year', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('documents', 'folder_year')
