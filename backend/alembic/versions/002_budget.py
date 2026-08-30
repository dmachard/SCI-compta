"""add budget and fund call items

Revision ID: 002_budget
Revises: 001_initial
Create Date: 2026-08-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '002_budget'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Budgets
    op.create_table(
        'budgets',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sci_id', sa.Integer(), sa.ForeignKey('sci.id'), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # 2. Budget Items
    op.create_table(
        'budget_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('budget_id', sa.Integer(), sa.ForeignKey('budgets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('icon', sa.String(50), server_default='⚡'),
        sa.Column('supplier', sa.String(255), server_default=''),
        sa.Column('amount', sa.Numeric(12, 2), server_default='0'),
        sa.Column('periodicity', sa.String(50), server_default='annuelle'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # 3. Add budget_item_id to bank_transactions
    op.add_column('bank_transactions', sa.Column('budget_item_id', sa.Integer(), sa.ForeignKey('budget_items.id'), nullable=True))

    # 4. Add call_number to fund_calls and alter fiscal_year_id to nullable
    op.add_column('fund_calls', sa.Column('call_number', sa.String(50), server_default=''))
    op.alter_column('fund_calls', 'fiscal_year_id', existing_type=sa.Integer(), nullable=True)

    # 5. Fund Call Budget Items
    op.create_table(
        'fund_call_budget_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('fund_call_id', sa.Integer(), sa.ForeignKey('fund_calls.id', ondelete='CASCADE'), nullable=False),
        sa.Column('budget_item_id', sa.Integer(), sa.ForeignKey('budget_items.id'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), server_default='0'),
    )


def downgrade() -> None:
    op.drop_table('fund_call_budget_items')
    op.alter_column('fund_calls', 'fiscal_year_id', existing_type=sa.Integer(), nullable=False)
    op.drop_column('fund_calls', 'call_number')
    op.drop_column('bank_transactions', 'budget_item_id')
    op.drop_table('budget_items')
    op.drop_table('budgets')
