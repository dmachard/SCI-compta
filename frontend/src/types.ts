// ─── Auth ──────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  associate_id?: number | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ─── SCI ───────────────────────────────────────────────────

export interface SCI {
  id: number;
  name: string;
  siren: string;
  rcs: string;
  address: string;
  creation_date: string | null;
  tax_regime: string;
  fiscal_year_end_month: number;
  fiscal_year_end_day: number;
  share_capital: number;
  total_shares: number;
  share_nominal_value: number;
  currency: string;
}

// ─── Associé ───────────────────────────────────────────────

export interface Associate {
  id: number;
  last_name: string;
  first_name: string;
  address: string;
  email: string;
  shares: number;
  entry_date: string | null;
  is_active: boolean;
  is_manager: boolean;
  quote_part: number;
  has_account?: boolean;
}

export interface AssociateSummary {
  id: number;
  last_name: string;
  first_name: string;
  shares: number;
  quote_part: number;
  capital_amount: number;
  total_paid_current_account: number;
  total_refunded_current_account: number;
  current_account_balance: number;
  total_fund_calls_due: number;
  total_fund_calls_paid: number;
  fund_calls_remaining: number;
}

// ─── Capital ───────────────────────────────────────────────

export interface CapitalEntry {
  associate_id: number;
  last_name: string;
  first_name: string;
  shares: number;
  quote_part: number;
  capital_amount: number;
}

export interface CapitalRegister {
  total_capital: number;
  total_shares: number;
  share_nominal_value: number;
  entries: CapitalEntry[];
}

// ─── Compte courant ────────────────────────────────────────

export interface CurrentAccountMovement {
  id: number;
  associate_id: number;
  movement_date: string;
  movement_type: string;
  amount: number;
  reason: string;
  fiscal_year_id: number | null;
  bank_transaction_id: number | null;
  created_at: string;
}

export interface CurrentAccountBalance {
  associate_id: number;
  last_name: string;
  first_name: string;
  total_paid: number;
  total_refunded: number;
  balance: number;
  capital_paid: number;
}

// ─── Exercice ──────────────────────────────────────────────

export interface FiscalYear {
  id: number;
  label: string;
  start_date: string;
  end_date: string;
  status: string;
  closed_at: string | null;
}

export interface CategorySummary {
  category: string;
  total_amount: number;
  is_income: boolean;
}

export interface AssociateResultShare {
  associate_id: number;
  first_name: string;
  last_name: string;
  shares: number;
  quote_part: number;
  result_share: number;
  cca_balance?: number;
  capital_paid: number;
}

export interface FiscalYearSummary {
  fiscal_year: FiscalYear;
  total_income: number;
  total_expenses: number;
  net_result: number;
  total_immobilisations: number;
  total_associate_contributions: number;
  category_breakdown: CategorySummary[];
  associate_results: AssociateResultShare[];
}

export interface Cerfa2072Line {
  line_number: string;
  label: string;
  amount: number;
  description: string;
}

export interface AssociateTaxShare2042 {
  associate_id: number;
  first_name: string;
  last_name: string;
  shares: number;
  quote_part: number;
  net_tax_share: number;
  form_2042_box: string;
}

export interface Tax2072Summary {
  fiscal_year: FiscalYear;
  sci_name: string;
  sci_siren: string;
  cerfa_lines: Cerfa2072Line[];
  total_net_tax_result: number;
  associate_tax_shares: AssociateTaxShare2042[];
  disclaimer: string;
}

// ─── Banque & Transactions ─────────────────────────────────

export interface BankAccount {
  id: number;
  sci_id: number;
  bank_name: string;
  iban: string;
  bic: string;
  label: string;
  initial_balance: number;
  initial_balance_date: string | null;
  current_balance: number;
}

export interface BankTransaction {
  id: number;
  bank_account_id: number;
  fiscal_year_id: number | null;
  transaction_date: string;
  value_date: string | null;
  original_label: string;
  amount: number;
  running_balance: number | null;
  category: string;
  movement_type: string;
  associate_id: number | null;
  third_party: string;
  reconciliation_status: 'a_traiter' | 'categorisee' | 'rapprochee' | 'verifiee';
  notes: string;
  imported_at: string;
}

export interface ReconcileRequest {
  category?: string;
  movement_type?: string;
  associate_id?: number | null;
  third_party?: string;
  notes?: string;
  reconciliation_status?: string;
}

export interface ImportCSVResponse {
  imported_count: number;
  skipped_count: number;
  total_count: number;
}

