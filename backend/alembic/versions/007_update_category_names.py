"""update category names for charges and taxes

Revision ID: 007_update_category_names
Revises: 006_fund_call_accounting
Create Date: 2026-09-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '007_update_category_names'
down_revision: Union[str, None] = '006_fund_call_accounting'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Transactions bancaires
    conn.execute(sa.text("""
        UPDATE bank_transactions
        SET category = 'Charges, Eau, Électricité & Internet'
        WHERE category = 'Charges, Eau & Électricité';
    """))
    conn.execute(sa.text("""
        UPDATE bank_transactions
        SET category = 'Impôts & Taxes'
        WHERE category = 'Impôts & Taxes (Foncière, CFE)';
    """))

    # 2. Documents
    conn.execute(sa.text("""
        UPDATE documents
        SET category = 'Charges, Eau, Électricité & Internet'
        WHERE category = 'Charges, Eau & Électricité';
    """))
    conn.execute(sa.text("""
        UPDATE documents
        SET category = 'Impôts & Taxes'
        WHERE category = 'Impôts & Taxes (Foncière, CFE)';
    """))

    # 3. Tags / Catégories de documents
    conn.execute(sa.text("""
        DELETE FROM document_categories
        WHERE name = 'Charges, Eau & Électricité'
          AND EXISTS (SELECT 1 FROM document_categories WHERE name = 'Charges, Eau, Électricité & Internet');

        UPDATE document_categories
        SET name = 'Charges, Eau, Électricité & Internet'
        WHERE name = 'Charges, Eau & Électricité';

        DELETE FROM document_categories
        WHERE name = 'Impôts & Taxes (Foncière, CFE)'
          AND EXISTS (SELECT 1 FROM document_categories WHERE name = 'Impôts & Taxes');

        UPDATE document_categories
        SET name = 'Impôts & Taxes'
        WHERE name = 'Impôts & Taxes (Foncière, CFE)';
    """))


def downgrade() -> None:
    conn = op.get_bind()

    # 1. Transactions bancaires
    conn.execute(sa.text("""
        UPDATE bank_transactions
        SET category = 'Charges, Eau & Électricité'
        WHERE category = 'Charges, Eau, Électricité & Internet';
    """))
    conn.execute(sa.text("""
        UPDATE bank_transactions
        SET category = 'Impôts & Taxes (Foncière, CFE)'
        WHERE category = 'Impôts & Taxes';
    """))

    # 2. Documents
    conn.execute(sa.text("""
        UPDATE documents
        SET category = 'Charges, Eau & Électricité'
        WHERE category = 'Charges, Eau, Électricité & Internet';
    """))
    conn.execute(sa.text("""
        UPDATE documents
        SET category = 'Impôts & Taxes (Foncière, CFE)'
        WHERE category = 'Impôts & Taxes';
    """))

    # 3. Tags / Catégories de documents
    conn.execute(sa.text("""
        DELETE FROM document_categories
        WHERE name = 'Charges, Eau, Électricité & Internet'
          AND EXISTS (SELECT 1 FROM document_categories WHERE name = 'Charges, Eau & Électricité');

        UPDATE document_categories
        SET name = 'Charges, Eau & Électricité'
        WHERE name = 'Charges, Eau, Électricité & Internet';

        DELETE FROM document_categories
        WHERE name = 'Impôts & Taxes'
          AND EXISTS (SELECT 1 FROM document_categories WHERE name = 'Impôts & Taxes (Foncière, CFE)');

        UPDATE document_categories
        SET name = 'Impôts & Taxes (Foncière, CFE)'
        WHERE name = 'Impôts & Taxes';
    """))
