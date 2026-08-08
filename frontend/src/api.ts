import axios from 'axios';
import type {
  Associate,
  AssociateSummary,
  BankAccount,
  BankTransaction,
  CapitalRegister,
  CurrentAccountBalance,
  CurrentAccountMovement,
  FiscalYear,
  FiscalYearSummary,
  Tax2072Summary,
  ImportCSVResponse,
  ReconcileRequest,
  SCI,
  TokenResponse,
  User,
} from './types';

const api = axios.create({ baseURL: '/api' });

// Intercepteur : ajouter le token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercepteur : rediriger si 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ──────────────────────────────────────────────────

export const authApi = {
  status: () => api.get<{ configured: boolean }>('/auth/status').then((r) => r.data),
  setup: (data: { email: string; password: string; full_name: string }) =>
    api.post<TokenResponse>('/auth/setup', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<TokenResponse>('/auth/login', data).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
};

// ─── SCI ───────────────────────────────────────────────────

export const sciApi = {
  get: () => api.get<SCI>('/sci').then((r) => r.data),
  update: (data: Partial<SCI>) => api.put<SCI>('/sci', data).then((r) => r.data),
  reset: () => api.delete<{message: string}>('/sci/reset').then((r) => r.data),
};

// ─── Associés ──────────────────────────────────────────────

export const associatesApi = {
  list: () => api.get<Associate[]>('/associates').then((r) => r.data),
  get: (id: number) => api.get<Associate>(`/associates/${id}`).then((r) => r.data),
  create: (data: Partial<Associate>) =>
    api.post<Associate>('/associates', data).then((r) => r.data),
  update: (id: number, data: Partial<Associate>) =>
    api.put<Associate>(`/associates/${id}`, data).then((r) => r.data),
  summary: (id: number) =>
    api.get<AssociateSummary>(`/associates/${id}/summary`).then((r) => r.data),
  createAccount: (associateId: number, data: { password: string; username?: string }) =>
    api.post<User>(`/associates/${associateId}/account`, data).then((r) => r.data),
  deleteAccount: (associateId: number) =>
    api.delete<{ message: string }>(`/associates/${associateId}/account`).then((r) => r.data),
};

// ─── Capital ───────────────────────────────────────────────

export const capitalApi = {
  get: () => api.get<CapitalRegister>('/capital').then((r) => r.data),
};

// ─── Comptes courants ──────────────────────────────────────

export const currentAccountsApi = {
  balances: () =>
    api.get<CurrentAccountBalance[]>('/current-accounts').then((r) => r.data),
  movements: (associateId: number) =>
    api
      .get<CurrentAccountMovement[]>(`/current-accounts/${associateId}/movements`)
      .then((r) => r.data),
  create: (data: {
    associate_id: number;
    movement_date: string;
    movement_type: string;
    amount: number;
    reason?: string;
  }) =>
    api
      .post<CurrentAccountMovement>('/current-accounts', data)
      .then((r) => r.data),
};

// ─── Exercices ─────────────────────────────────────────────

export const fiscalYearsApi = {
  list: () => api.get<FiscalYear[]>('/fiscal-years').then((r) => r.data),
  get: (id: number) => api.get<FiscalYear>(`/fiscal-years/${id}`).then((r) => r.data),
  summary: (id: number) => api.get<FiscalYearSummary>(`/fiscal-years/${id}/summary`).then((r) => r.data),
  tax2072: (id: number) => api.get<Tax2072Summary>(`/fiscal-years/${id}/tax-2072`).then((r) => r.data),
  create: (data: { label: string; start_date: string; end_date: string }) =>
    api.post<FiscalYear>('/fiscal-years', data).then((r) => r.data),
  close: (id: number) => api.post<FiscalYear>(`/fiscal-years/${id}/close`).then((r) => r.data),
  reopen: (id: number) => api.post<FiscalYear>(`/fiscal-years/${id}/reopen`).then((r) => r.data),
};

// ─── Banque & Transactions ─────────────────────────────────

export const bankApi = {
  getAccounts: () => api.get<BankAccount[]>('/bank/accounts').then((r) => r.data),
  createAccount: (data: Partial<BankAccount>) =>
    api.post<BankAccount>('/bank/accounts', data).then((r) => r.data),
  updateAccount: (id: number, data: Partial<BankAccount>) =>
    api.put<BankAccount>(`/bank/accounts/${id}`, data).then((r) => r.data),
  getTransactions: (params?: { account_id?: number; status?: string; search?: string }) =>
    api.get<BankTransaction[]>('/bank/transactions', { params }).then((r) => r.data),
  importCsv: (file: File, accountId?: number) => {
    const formData = new FormData();
    formData.append('file', file);
    return api
      .post<ImportCSVResponse>('/bank/import-csv', formData, {
        params: accountId ? { account_id: accountId } : undefined,
        headers: { 'Content-Type': 'multipart/form-bytes' },
      })
      .then((r) => r.data);
  },
  reconcileTransaction: (txId: number, data: ReconcileRequest) =>
    api.put<BankTransaction>(`/bank/transactions/${txId}/reconcile`, data).then((r) => r.data),
  deleteTransaction: (txId: number) =>
    api.delete(`/bank/transactions/${txId}`).then((r) => r.data),
  purgeTransactions: () =>
    api.delete<{ message: string }>('/bank/transactions/purge/all').then((r) => r.data),
};

// ─── Documents ─────────────────────────────────────────────

export const documentsApi = {
  list: (params?: { category?: string; search?: string }) =>
    api.get<DocumentItem[]>('/documents', { params }).then((r) => r.data),
  upload: (formData: FormData) =>
    api.post<DocumentItem>('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),
  delete: (id: number) =>
    api.delete<{ message: string }>(`/documents/${id}`).then((r) => r.data),
  update: (
    id: number,
    data: {
      category?: string;
      supplier?: string;
      document_date?: string | null;
      notes?: string;
    }
  ) => api.put<DocumentItem>(`/documents/${id}`, data).then((r) => r.data),
  downloadBlob: async (id: number, filename: string) => {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },
};

export default api;

