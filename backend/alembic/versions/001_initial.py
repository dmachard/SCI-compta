"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-08-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SCI
    op.create_table(
        'sci',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), server_default=''),
        sa.Column('siren', sa.String(20), server_default=''),
        sa.Column('rcs', sa.String(100), server_default=''),
        sa.Column('address', sa.Text(), server_default=''),
        sa.Column('creation_date', sa.Date(), nullable=True),
        sa.Column('tax_regime', sa.String(10), server_default='IR'),
        sa.Column('fiscal_year_end_month', sa.Integer(), server_default='12'),
        sa.Column('fiscal_year_end_day', sa.Integer(), server_default='31'),
        sa.Column('share_capital', sa.Numeric(12, 2), server_default='0'),
        sa.Column('total_shares', sa.Integer(), server_default='0'),
        sa.Column('share_nominal_value', sa.Numeric(12, 2), server_default='0'),
        sa.Column('currency', sa.String(3), server_default='EUR'),
    )

    # Users
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, index=True, nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), server_default='associe'),
        sa.Column('associate_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Associates
    op.create_table(
        'associates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sci_id', sa.Integer(), sa.ForeignKey('sci.id'), nullable=False),
        sa.Column('last_name', sa.String(255), nullable=False),
        sa.Column('first_name', sa.String(255), nullable=False),
        sa.Column('address', sa.Text(), server_default=''),
        sa.Column('email', sa.String(255), server_default=''),
        sa.Column('shares', sa.Integer(), server_default='0'),
        sa.Column('entry_date', sa.Date(), nullable=True),
        sa.Column('exit_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_manager', sa.Boolean(), server_default='false'),
    )

    # Fiscal Years
    op.create_table(
        'fiscal_years',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sci_id', sa.Integer(), sa.ForeignKey('sci.id'), nullable=False),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), server_default='ouvert'),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
    )

    # Bank Accounts
    op.create_table(
        'bank_accounts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sci_id', sa.Integer(), sa.ForeignKey('sci.id'), nullable=False),
        sa.Column('bank_name', sa.String(255), server_default=''),
        sa.Column('iban', sa.String(34), server_default=''),
        sa.Column('bic', sa.String(11), server_default=''),
        sa.Column('label', sa.String(255), server_default='Compte principal'),
        sa.Column('initial_balance', sa.Numeric(12, 2), server_default='0'),
        sa.Column('initial_balance_date', sa.Date(), nullable=True),
    )

    # Bank Transactions
    op.create_table(
        'bank_transactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('bank_account_id', sa.Integer(), sa.ForeignKey('bank_accounts.id'), nullable=False),
        sa.Column('fiscal_year_id', sa.Integer(), sa.ForeignKey('fiscal_years.id'), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('value_date', sa.Date(), nullable=True),
        sa.Column('original_label', sa.Text(), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('running_balance', sa.Numeric(12, 2), nullable=True),
        sa.Column('category', sa.String(100), server_default=''),
        sa.Column('movement_type', sa.String(100), server_default=''),
        sa.Column('associate_id', sa.Integer(), sa.ForeignKey('associates.id'), nullable=True),
        sa.Column('third_party', sa.String(255), server_default=''),
        sa.Column('reconciliation_status', sa.String(20), server_default='a_traiter'),
        sa.Column('notes', sa.Text(), server_default=''),
        sa.Column('import_hash', sa.String(64), server_default='', index=True),
        sa.Column('imported_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Current Account Movements
    op.create_table(
        'current_account_movements',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('associate_id', sa.Integer(), sa.ForeignKey('associates.id'), nullable=False),
        sa.Column('fiscal_year_id', sa.Integer(), sa.ForeignKey('fiscal_years.id'), nullable=True),
        sa.Column('movement_date', sa.Date(), nullable=False),
        sa.Column('movement_type', sa.String(20), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('reason', sa.Text(), server_default=''),
        sa.Column('bank_transaction_id', sa.Integer(), sa.ForeignKey('bank_transactions.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Fund Calls
    op.create_table(
        'fund_calls',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('fiscal_year_id', sa.Integer(), sa.ForeignKey('fiscal_years.id'), nullable=False),
        sa.Column('call_date', sa.Date(), nullable=False),
        sa.Column('purpose', sa.Text(), nullable=False),
        sa.Column('total_amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(20), server_default='en_attente'),
    )

    # Fund Call Lines
    op.create_table(
        'fund_call_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('fund_call_id', sa.Integer(), sa.ForeignKey('fund_calls.id'), nullable=False),
        sa.Column('associate_id', sa.Integer(), sa.ForeignKey('associates.id'), nullable=False),
        sa.Column('amount_due', sa.Numeric(12, 2), nullable=False),
        sa.Column('amount_paid', sa.Numeric(12, 2), server_default='0'),
        sa.Column('payment_date', sa.Date(), nullable=True),
        sa.Column('bank_transaction_id', sa.Integer(), sa.ForeignKey('bank_transactions.id'), nullable=True),
    )

    # Accounting Accounts
    op.create_table(
        'accounting_accounts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('number', sa.String(10), unique=True, index=True, nullable=False),
        sa.Column('label', sa.String(255), nullable=False),
        sa.Column('account_type', sa.String(50), nullable=False),
    )

    # Accounting Entries
    op.create_table(
        'accounting_entries',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('fiscal_year_id', sa.Integer(), sa.ForeignKey('fiscal_years.id'), nullable=False),
        sa.Column('entry_number', sa.Integer(), nullable=False),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('journal', sa.String(10), server_default='OD'),
        sa.Column('label', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), server_default='brouillon'),
        sa.Column('bank_transaction_id', sa.Integer(), sa.ForeignKey('bank_transactions.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Accounting Lines
    op.create_table(
        'accounting_lines',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('entry_id', sa.Integer(), sa.ForeignKey('accounting_entries.id'), nullable=False),
        sa.Column('account_id', sa.Integer(), sa.ForeignKey('accounting_accounts.id'), nullable=False),
        sa.Column('label', sa.String(255), server_default=''),
        sa.Column('debit', sa.Numeric(12, 2), server_default='0'),
        sa.Column('credit', sa.Numeric(12, 2), server_default='0'),
    )

    # Documents
    op.create_table(
        'documents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('fiscal_year_id', sa.Integer(), sa.ForeignKey('fiscal_years.id'), nullable=True),
        sa.Column('document_type', sa.String(50), server_default='facture'),
        sa.Column('file_path', sa.String(500), server_default=''),
        sa.Column('original_filename', sa.String(255), server_default=''),
        sa.Column('supplier', sa.String(255), server_default=''),
        sa.Column('document_date', sa.Date(), nullable=True),
        sa.Column('amount_ht', sa.Numeric(12, 2), nullable=True),
        sa.Column('tva', sa.Numeric(12, 2), nullable=True),
        sa.Column('amount_ttc', sa.Numeric(12, 2), nullable=True),
        sa.Column('category', sa.String(100), server_default=''),
        sa.Column('bank_transaction_id', sa.Integer(), sa.ForeignKey('bank_transactions.id'), nullable=True),
        sa.Column('notes', sa.Text(), server_default=''),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Properties
    op.create_table(
        'properties',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('sci_id', sa.Integer(), sa.ForeignKey('sci.id'), nullable=False),
        sa.Column('address', sa.Text(), nullable=False),
        sa.Column('acquisition_date', sa.Date(), nullable=True),
        sa.Column('acquisition_price', sa.Numeric(12, 2), server_default='0'),
        sa.Column('acquisition_fees', sa.Numeric(12, 2), server_default='0'),
        sa.Column('description', sa.Text(), server_default=''),
        sa.Column('notes', sa.Text(), server_default=''),
    )

    # Seed default accounting accounts
    op.execute("""
        INSERT INTO accounting_accounts (number, label, account_type) VALUES
        ('101000', 'Capital social', 'passif'),
        ('106000', 'Réserves', 'passif'),
        ('110000', 'Report à nouveau (créditeur)', 'passif'),
        ('119000', 'Report à nouveau (débiteur)', 'actif'),
        ('120000', 'Résultat de l''exercice (bénéfice)', 'passif'),
        ('129000', 'Résultat de l''exercice (perte)', 'actif'),
        ('164000', 'Emprunts bancaires', 'passif'),
        ('211000', 'Terrains', 'actif'),
        ('213000', 'Constructions', 'actif'),
        ('213100', 'Bâtiments', 'actif'),
        ('218100', 'Installations, agencements', 'actif'),
        ('401000', 'Fournisseurs', 'passif'),
        ('455000', 'Comptes courants d''associés', 'passif'),
        ('467000', 'Autres débiteurs / créditeurs', 'passif'),
        ('512000', 'Banque', 'actif'),
        ('606100', 'Eau', 'charge'),
        ('606200', 'Électricité', 'charge'),
        ('606300', 'Gaz', 'charge'),
        ('615000', 'Entretien et réparations', 'charge'),
        ('615200', 'Travaux', 'charge'),
        ('616000', 'Assurances', 'charge'),
        ('616200', 'Assurance emprunteur', 'charge'),
        ('622000', 'Honoraires', 'charge'),
        ('626100', 'Internet / Fibre', 'charge'),
        ('627000', 'Frais bancaires', 'charge'),
        ('635100', 'Taxe foncière', 'charge'),
        ('635200', 'CFE', 'charge'),
        ('661000', 'Intérêts d''emprunts', 'charge'),
        ('671000', 'Charges exceptionnelles', 'charge'),
        ('706100', 'Loyers', 'produit'),
        ('752000', 'Revenus des immeubles', 'produit'),
        ('771000', 'Produits exceptionnels', 'produit')
    """)


def downgrade() -> None:
    op.drop_table('documents')
    op.drop_table('properties')
    op.drop_table('accounting_lines')
    op.drop_table('accounting_entries')
    op.drop_table('accounting_accounts')
    op.drop_table('fund_call_lines')
    op.drop_table('fund_calls')
    op.drop_table('current_account_movements')
    op.drop_table('bank_transactions')
    op.drop_table('bank_accounts')
    op.drop_table('fiscal_years')
    op.drop_table('associates')
    op.drop_table('users')
    op.drop_table('sci')
