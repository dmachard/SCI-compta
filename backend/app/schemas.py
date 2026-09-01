from datetime import date, datetime

from pydantic import BaseModel, EmailStr


# ─── Auth ──────────────────────────────────────────────────────


class SetupRequest(BaseModel):
    email: str
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    is_active: bool
    associate_id: int | None = None

    model_config = {"from_attributes": True}


# ─── SCI ───────────────────────────────────────────────────────


class SCIUpdate(BaseModel):
    name: str | None = None
    siren: str | None = None
    siret: str | None = None
    rcs: str | None = None
    address: str | None = None
    creation_date: date | None = None
    tax_regime: str | None = None
    fiscal_year_end_month: int | None = None
    fiscal_year_end_day: int | None = None
    share_capital: float | None = None
    total_shares: int | None = None
    share_nominal_value: float | None = None
    currency: str | None = None


class SCIResponse(BaseModel):
    id: int
    name: str
    siren: str
    siret: str = ""
    rcs: str
    address: str
    creation_date: date | None
    tax_regime: str
    fiscal_year_end_month: int
    fiscal_year_end_day: int
    share_capital: float
    total_shares: int
    share_nominal_value: float
    currency: str

    model_config = {"from_attributes": True}


# ─── Associé ──────────────────────────────────────────────────


class AssociateCreate(BaseModel):
    last_name: str
    first_name: str
    address: str = ""
    email: str = ""
    shares: int = 0
    entry_date: date | None = None
    is_manager: bool = False


class AssociateUpdate(BaseModel):
    last_name: str | None = None
    first_name: str | None = None
    address: str | None = None
    email: str | None = None
    shares: int | None = None
    entry_date: date | None = None
    is_active: bool | None = None
    is_manager: bool | None = None


class AssociateAccountCreate(BaseModel):
    password: str
    username: str | None = None


class AssociateResponse(BaseModel):
    id: int
    last_name: str
    first_name: str
    address: str
    email: str
    shares: int
    entry_date: date | None
    is_active: bool
    is_manager: bool
    quote_part: float = 0.0  # calculée
    has_account: bool = False

    model_config = {"from_attributes": True}


class AssociateSummary(BaseModel):
    id: int
    last_name: str
    first_name: str
    shares: int
    quote_part: float
    capital_amount: float
    total_paid_current_account: float
    total_refunded_current_account: float
    current_account_balance: float
    total_fund_calls_due: float
    total_fund_calls_paid: float
    fund_calls_remaining: float


# ─── Capital ──────────────────────────────────────────────────


class CapitalEntry(BaseModel):
    associate_id: int
    last_name: str
    first_name: str
    shares: int
    quote_part: float
    capital_amount: float


class CapitalRegister(BaseModel):
    total_capital: float
    total_shares: int
    share_nominal_value: float
    entries: list[CapitalEntry]


# ─── Compte courant ───────────────────────────────────────────


class CurrentAccountMovementCreate(BaseModel):
    associate_id: int
    movement_date: date
    movement_type: str  # versement | remboursement
    amount: float
    reason: str = ""
    fiscal_year_id: int | None = None
    bank_transaction_id: int | None = None


class CurrentAccountMovementResponse(BaseModel):
    id: int
    associate_id: int
    movement_date: date
    movement_type: str
    amount: float
    reason: str
    fiscal_year_id: int | None
    bank_transaction_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CurrentAccountBalance(BaseModel):
    associate_id: int
    last_name: str
    first_name: str
    total_paid: float
    total_refunded: float
    balance: float
    capital_paid: float = 0.0


# ─── Exercice comptable ───────────────────────────────────────


class FiscalYearCreate(BaseModel):
    label: str
    start_date: date
    end_date: date


class FiscalYearUpdate(BaseModel):
    label: str | None = None
    status: str | None = None


class FiscalYearResponse(BaseModel):
    id: int
    label: str
    start_date: date
    end_date: date
    status: str
    closed_at: datetime | None

    model_config = {"from_attributes": True}


class CategorySummary(BaseModel):
    category: str
    total_amount: float
    is_income: bool


class AssociateResultShare(BaseModel):
    associate_id: int
    first_name: str
    last_name: str
    shares: int
    quote_part: float
    result_share: float
    cca_balance: float = 0.0
    capital_paid: float = 0.0


class FiscalYearSummaryResponse(BaseModel):
    fiscal_year: FiscalYearResponse
    total_income: float
    total_expenses: float
    net_result: float
    total_immobilisations: float
    total_associate_contributions: float
    category_breakdown: list[CategorySummary]
    associate_results: list[AssociateResultShare]


class Cerfa2072Line(BaseModel):
    line_number: str
    label: str
    amount: float
    description: str


class AssociateTaxShare2042(BaseModel):
    associate_id: int
    first_name: str
    last_name: str
    shares: int
    quote_part: float
    net_tax_share: float
    form_2042_box: str


class Tax2072Response(BaseModel):
    fiscal_year: FiscalYearResponse
    sci_name: str
    sci_siren: str
    cerfa_lines: list[Cerfa2072Line]
    total_net_tax_result: float
    associate_tax_shares: list[AssociateTaxShare2042]
    disclaimer: str


# ─── Compte bancaire & Transactions ────────────────────────────


class BankAccountCreate(BaseModel):
    bank_name: str = ""
    iban: str = ""
    bic: str = ""
    label: str = "Compte principal"
    initial_balance: float = 0.0
    initial_balance_date: date | None = None


class BankAccountUpdate(BaseModel):
    bank_name: str | None = None
    iban: str | None = None
    bic: str | None = None
    label: str | None = None
    initial_balance: float | None = None
    initial_balance_date: date | None = None


class BankAccountResponse(BaseModel):
    id: int
    sci_id: int
    bank_name: str
    iban: str
    bic: str
    label: str
    initial_balance: float
    initial_balance_date: date | None
    current_balance: float = 0.0

    model_config = {"from_attributes": True}


class BankTransactionResponse(BaseModel):
    id: int
    bank_account_id: int
    fiscal_year_id: int | None
    transaction_date: date
    value_date: date | None
    original_label: str
    amount: float
    running_balance: float | None
    category: str
    movement_type: str
    associate_id: int | None
    third_party: str
    reconciliation_status: str
    notes: str
    imported_at: datetime
    budget_item_id: int | None = None
    fund_call_line_id: int | None = None

    model_config = {"from_attributes": True}


class ReconcileRequest(BaseModel):
    category: str | None = None
    movement_type: str | None = None
    associate_id: int | None = None
    third_party: str | None = None
    notes: str | None = None
    reconciliation_status: str | None = "rapprochee"
    budget_item_id: int | None = None
    fund_call_line_id: int | None = None


class ImportCSVResponse(BaseModel):
    imported_count: int
    skipped_count: int
    total_count: int


# ─── Documents ────────────────────────────────────────────────


class DocumentCategoryCreate(BaseModel):
    name: str


class DocumentCategoryResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class DocumentResponse(BaseModel):
    id: int
    fiscal_year_id: int | None = None
    document_type: str
    folder_year: int | None = None
    original_filename: str
    supplier: str
    document_date: date | None = None
    amount_ht: float | None = None
    tva: float | None = None
    amount_ttc: float | None = None
    category: str
    bank_transaction_id: int | None = None
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentUpdateRequest(BaseModel):
    document_type: str | None = None
    folder_year: int | None = None
    category: str | None = None
    supplier: str | None = None
    document_date: date | None = None
    amount_ht: float | None = None
    tva: float | None = None
    amount_ttc: float | None = None
    notes: str | None = None


# ─── Budget & Postes budgétaires ──────────────────────────────


class BudgetItemCreate(BaseModel):
    name: str
    icon: str = "⚡"
    supplier: str = ""
    amount: float = 0.0
    periodicity: str = "annuelle"  # annuelle | mensuelle | trimestrielle | ponctuelle


class BudgetItemUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    supplier: str | None = None
    amount: float | None = None
    periodicity: str | None = None


class BudgetItemResponse(BaseModel):
    id: int
    budget_id: int
    name: str
    icon: str
    supplier: str
    amount: float
    periodicity: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BudgetTableItemResponse(BaseModel):
    id: int
    name: str
    icon: str
    supplier: str
    periodicity: str
    forecast: float
    real: float
    variance: float
    consumption_rate: float


class BudgetSummaryResponse(BaseModel):
    year: int
    budget_id: int | None = None
    total_forecast: float
    total_real: float
    total_variance: float
    consumption_rate: float
    items: list[BudgetTableItemResponse]


class BudgetYearCreate(BaseModel):
    copy_from_year: int | None = None


class ExpenseCreate(BaseModel):
    label: str
    amount: float
    date: date
    budget_item_id: int
    third_party: str = ""
    notes: str = ""


# ─── Appels de fonds ───────────────────────────────────────────


class FundCallCreate(BaseModel):
    year: int
    call_number: str | None = None
    call_date: date
    due_date: date | None = None
    purpose: str = "Financement des charges et dépenses courantes de la SCI"
    call_type: str = "charges"
    selected_item_ids: list[int]


class FundCallBudgetItemResponse(BaseModel):
    id: int
    budget_item_id: int
    name: str
    icon: str
    amount: float

    model_config = {"from_attributes": True}


class FundCallLineResponse(BaseModel):
    id: int
    associate_id: int
    associate_name: str
    shares: int
    quote_part: float
    amount_due: float
    amount_paid: float
    is_paid: bool
    payment_date: date | None = None
    bank_transaction_id: int | None = None

    model_config = {"from_attributes": True}


class FundCallResponse(BaseModel):
    id: int
    call_number: str
    call_date: date
    due_date: date | None
    purpose: str
    call_type: str = "charges"
    total_amount: float
    amount_paid: float
    amount_remaining: float
    status: str  # en_attente | partiel | solde
    budget_items: list[FundCallBudgetItemResponse]
    lines: list[FundCallLineResponse]

    model_config = {"from_attributes": True}


class FundCallLineUpdate(BaseModel):
    amount_paid: float | None = None
    payment_date: date | None = None
    is_paid: bool | None = None
    bank_transaction_id: int | None = None


