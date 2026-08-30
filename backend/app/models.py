from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ─── Utilisateur ───────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="associe")  # gerant | associe
    associate_id: Mapped[int | None] = mapped_column(ForeignKey("associates.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ─── Configuration SCI ─────────────────────────────────────────


class SCI(Base):
    __tablename__ = "sci"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    siren: Mapped[str] = mapped_column(String(20), default="")
    siret: Mapped[str] = mapped_column(String(20), default="")
    rcs: Mapped[str] = mapped_column(String(100), default="")
    address: Mapped[str] = mapped_column(Text, default="")
    creation_date: Mapped[date | None] = mapped_column(Date)
    tax_regime: Mapped[str] = mapped_column(String(10), default="IR")
    fiscal_year_end_month: Mapped[int] = mapped_column(Integer, default=12)
    fiscal_year_end_day: Mapped[int] = mapped_column(Integer, default=31)
    share_capital: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    total_shares: Mapped[int] = mapped_column(Integer, default=0)
    share_nominal_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")

    associates: Mapped[list["Associate"]] = relationship(back_populates="sci")
    fiscal_years: Mapped[list["FiscalYear"]] = relationship(back_populates="sci")
    bank_accounts: Mapped[list["BankAccount"]] = relationship(back_populates="sci")
    properties: Mapped[list["Property"]] = relationship(back_populates="sci")


# ─── Associé ───────────────────────────────────────────────────


class Associate(Base):
    __tablename__ = "associates"

    id: Mapped[int] = mapped_column(primary_key=True)
    sci_id: Mapped[int] = mapped_column(ForeignKey("sci.id"))
    last_name: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(Text, default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    shares: Mapped[int] = mapped_column(Integer, default=0)
    entry_date: Mapped[date | None] = mapped_column(Date)
    exit_date: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_manager: Mapped[bool] = mapped_column(Boolean, default=False)

    sci: Mapped["SCI"] = relationship(back_populates="associates")
    current_account_movements: Mapped[list["CurrentAccountMovement"]] = relationship(
        back_populates="associate"
    )
    fund_call_lines: Mapped[list["FundCallLine"]] = relationship(
        back_populates="associate"
    )


# ─── Exercice comptable ───────────────────────────────────────


class FiscalYear(Base):
    __tablename__ = "fiscal_years"

    id: Mapped[int] = mapped_column(primary_key=True)
    sci_id: Mapped[int] = mapped_column(ForeignKey("sci.id"))
    label: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String(20), default="ouvert"
    )  # ouvert | cloture
    closed_at: Mapped[datetime | None] = mapped_column(DateTime)

    sci: Mapped["SCI"] = relationship(back_populates="fiscal_years")
    transactions: Mapped[list["BankTransaction"]] = relationship(
        back_populates="fiscal_year"
    )
    fund_calls: Mapped[list["FundCall"]] = relationship(back_populates="fiscal_year")
    accounting_entries: Mapped[list["AccountingEntry"]] = relationship(
        back_populates="fiscal_year"
    )


# ─── Compte bancaire ──────────────────────────────────────────


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    sci_id: Mapped[int] = mapped_column(ForeignKey("sci.id"))
    bank_name: Mapped[str] = mapped_column(String(255), default="")
    iban: Mapped[str] = mapped_column(String(34), default="")
    bic: Mapped[str] = mapped_column(String(11), default="")
    label: Mapped[str] = mapped_column(String(255), default="Compte principal")
    initial_balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    initial_balance_date: Mapped[date | None] = mapped_column(Date)

    sci: Mapped["SCI"] = relationship(back_populates="bank_accounts")
    transactions: Mapped[list["BankTransaction"]] = relationship(
        back_populates="bank_account"
    )


# ─── Transaction bancaire ─────────────────────────────────────


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    bank_account_id: Mapped[int] = mapped_column(ForeignKey("bank_accounts.id"))
    fiscal_year_id: Mapped[int | None] = mapped_column(ForeignKey("fiscal_years.id"))
    transaction_date: Mapped[date] = mapped_column(Date)
    value_date: Mapped[date | None] = mapped_column(Date)
    original_label: Mapped[str] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    running_balance: Mapped[float | None] = mapped_column(Numeric(12, 2))
    category: Mapped[str] = mapped_column(String(100), default="")
    movement_type: Mapped[str] = mapped_column(String(100), default="")
    associate_id: Mapped[int | None] = mapped_column(ForeignKey("associates.id"))
    third_party: Mapped[str] = mapped_column(String(255), default="")
    reconciliation_status: Mapped[str] = mapped_column(
        String(20), default="a_traiter"
    )  # a_traiter | categorisee | rapprochee | verifiee
    notes: Mapped[str] = mapped_column(Text, default="")
    import_hash: Mapped[str] = mapped_column(String(64), default="", index=True)
    imported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    bank_account: Mapped["BankAccount"] = relationship(back_populates="transactions")
    fiscal_year: Mapped["FiscalYear | None"] = relationship(
        back_populates="transactions"
    )
    documents: Mapped[list["Document"]] = relationship(back_populates="transaction")
    budget_item_id: Mapped[int | None] = mapped_column(ForeignKey("budget_items.id"))
    budget_item: Mapped["BudgetItem | None"] = relationship(back_populates="transactions")


# ─── Compte courant d'associé ──────────────────────────────────


class CurrentAccountMovement(Base):
    __tablename__ = "current_account_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    associate_id: Mapped[int] = mapped_column(ForeignKey("associates.id"))
    fiscal_year_id: Mapped[int | None] = mapped_column(ForeignKey("fiscal_years.id"))
    movement_date: Mapped[date] = mapped_column(Date)
    movement_type: Mapped[str] = mapped_column(
        String(20)
    )  # versement | remboursement
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    reason: Mapped[str] = mapped_column(Text, default="")
    bank_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("bank_transactions.id")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    associate: Mapped["Associate"] = relationship(
        back_populates="current_account_movements"
    )


# ─── Appels de fonds ───────────────────────────────────────────


class FundCall(Base):
    __tablename__ = "fund_calls"

    id: Mapped[int] = mapped_column(primary_key=True)
    fiscal_year_id: Mapped[int | None] = mapped_column(ForeignKey("fiscal_years.id"), nullable=True)
    call_number: Mapped[str] = mapped_column(String(50), default="")
    call_date: Mapped[date] = mapped_column(Date)
    purpose: Mapped[str] = mapped_column(Text)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2))
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(
        String(20), default="en_attente"
    )  # en_attente | partiel | solde

    fiscal_year: Mapped["FiscalYear | None"] = relationship(back_populates="fund_calls")
    lines: Mapped[list["FundCallLine"]] = relationship(
        back_populates="fund_call", cascade="all, delete-orphan"
    )
    budget_items: Mapped[list["FundCallBudgetItem"]] = relationship(
        back_populates="fund_call", cascade="all, delete-orphan"
    )


class FundCallLine(Base):
    __tablename__ = "fund_call_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    fund_call_id: Mapped[int] = mapped_column(ForeignKey("fund_calls.id", ondelete="CASCADE"))
    associate_id: Mapped[int] = mapped_column(ForeignKey("associates.id"))
    amount_due: Mapped[float] = mapped_column(Numeric(12, 2))
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    payment_date: Mapped[date | None] = mapped_column(Date)
    bank_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("bank_transactions.id")
    )

    fund_call: Mapped["FundCall"] = relationship(back_populates="lines")
    associate: Mapped["Associate"] = relationship(back_populates="fund_call_lines")


class FundCallBudgetItem(Base):
    __tablename__ = "fund_call_budget_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    fund_call_id: Mapped[int] = mapped_column(ForeignKey("fund_calls.id", ondelete="CASCADE"))
    budget_item_id: Mapped[int] = mapped_column(ForeignKey("budget_items.id"))
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    fund_call: Mapped["FundCall"] = relationship(back_populates="budget_items")
    budget_item: Mapped["BudgetItem"] = relationship(back_populates="fund_call_items")


# ─── Plan comptable ────────────────────────────────────────────


class AccountingAccount(Base):
    __tablename__ = "accounting_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(255))
    account_type: Mapped[str] = mapped_column(
        String(50)
    )  # actif | passif | charge | produit

    lines: Mapped[list["AccountingLine"]] = relationship(back_populates="account")


# ─── Écriture comptable ───────────────────────────────────────


class AccountingEntry(Base):
    __tablename__ = "accounting_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    fiscal_year_id: Mapped[int] = mapped_column(ForeignKey("fiscal_years.id"))
    entry_number: Mapped[int] = mapped_column(Integer)
    entry_date: Mapped[date] = mapped_column(Date)
    journal: Mapped[str] = mapped_column(String(10), default="OD")
    label: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(20), default="brouillon"
    )  # brouillon | validee | annulee
    bank_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("bank_transactions.id")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    fiscal_year: Mapped["FiscalYear"] = relationship(
        back_populates="accounting_entries"
    )
    lines: Mapped[list["AccountingLine"]] = relationship(back_populates="entry")


class AccountingLine(Base):
    __tablename__ = "accounting_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("accounting_entries.id"))
    account_id: Mapped[int] = mapped_column(ForeignKey("accounting_accounts.id"))
    label: Mapped[str] = mapped_column(String(255), default="")
    debit: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    credit: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    entry: Mapped["AccountingEntry"] = relationship(back_populates="lines")
    account: Mapped["AccountingAccount"] = relationship(back_populates="lines")


# ─── Document / Justificatif ──────────────────────────────────


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    fiscal_year_id: Mapped[int | None] = mapped_column(ForeignKey("fiscal_years.id"))
    document_type: Mapped[str] = mapped_column(
        String(50), default="facture"
    )  # facture | justificatif
    file_path: Mapped[str] = mapped_column(String(500), default="")
    original_filename: Mapped[str] = mapped_column(String(255), default="")
    supplier: Mapped[str] = mapped_column(String(255), default="")
    document_date: Mapped[date | None] = mapped_column(Date)
    amount_ht: Mapped[float | None] = mapped_column(Numeric(12, 2))
    tva: Mapped[float | None] = mapped_column(Numeric(12, 2))
    amount_ttc: Mapped[float | None] = mapped_column(Numeric(12, 2))
    category: Mapped[str] = mapped_column(String(100), default="")
    bank_transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("bank_transactions.id")
    )
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    transaction: Mapped["BankTransaction | None"] = relationship(
        back_populates="documents"
    )


# ─── Bien immobilier ──────────────────────────────────────────


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    sci_id: Mapped[int] = mapped_column(ForeignKey("sci.id"))
    address: Mapped[str] = mapped_column(Text)
    acquisition_date: Mapped[date | None] = mapped_column(Date)
    acquisition_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    acquisition_fees: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    description: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    sci: Mapped["SCI"] = relationship(back_populates="properties")


# ─── Budget & Postes budgétaires ──────────────────────────────


class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(primary_key=True)
    sci_id: Mapped[int] = mapped_column(ForeignKey("sci.id"))
    year: Mapped[int] = mapped_column(Integer, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    items: Mapped[list["BudgetItem"]] = relationship(
        back_populates="budget", cascade="all, delete-orphan"
    )


class BudgetItem(Base):
    __tablename__ = "budget_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    icon: Mapped[str] = mapped_column(String(50), default="⚡")
    supplier: Mapped[str] = mapped_column(String(255), default="")
    amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    periodicity: Mapped[str] = mapped_column(
        String(50), default="annuelle"
    )  # annuelle | mensuelle | trimestrielle | ponctuelle
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    budget: Mapped["Budget"] = relationship(back_populates="items")
    transactions: Mapped[list["BankTransaction"]] = relationship(back_populates="budget_item")
    fund_call_items: Mapped[list["FundCallBudgetItem"]] = relationship(back_populates="budget_item")

