"""normalize reconciliation_status from categorisee to rapprochee

Revision ID: 008_normalize_reconciliation_status
Revises: 007_update_category_names
Create Date: 2026-09-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '008_normalize_reconciliation_status'
down_revision: Union[str, None] = '007_update_category_names'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE bank_transactions
        SET reconciliation_status = 'rapprochee'
        WHERE reconciliation_status = 'categorisee';
    """))


def downgrade() -> None:
    pass
