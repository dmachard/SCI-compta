"""create document_categories table

Revision ID: 005_document_categories
Revises: 004_document_folder_year
Create Date: 2026-08-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '005_document_categories'
down_revision: Union[str, None] = '004_document_folder_year'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    table = op.create_table(
        'document_categories',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index('ix_document_categories_name', 'document_categories', ['name'], unique=True)

    # Seule catégorie universelle par défaut
    default_categories = [
        'Autres',
    ]
    op.bulk_insert(
        table,
        [{'name': name} for name in default_categories]
    )


def downgrade() -> None:
    op.drop_index('ix_document_categories_name', table_name='document_categories')
    op.drop_table('document_categories')
