import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BankAccounts from '../BankAccounts';
import * as api from '../../api';

describe('BankAccounts Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(api.authApi, 'me').mockResolvedValue({
      id: 1,
      email: 'admin@sci.fr',
      full_name: 'Gérant Admin',
      role: 'gerant',
      is_active: true,
    });

    vi.spyOn(api.bankApi, 'getAccounts').mockResolvedValue([
      {
        id: 1,
        sci_id: 1,
        bank_name: 'Banque Postale',
        iban: 'FR76...',
        bic: 'BPOFR',
        label: 'Compte Principal',
        initial_balance: 1000,
        initial_balance_date: '2024-01-01',
        current_balance: 3450.5,
      },
    ]);

    vi.spyOn(api.associatesApi, 'list').mockResolvedValue([
      {
        id: 1,
        last_name: 'Dupont',
        first_name: 'Jean',
        address: 'Paris',
        email: 'jean@test.com',
        shares: 60,
        entry_date: '2023-01-01',
        is_active: true,
        is_manager: true,
        quote_part: 60,
      },
    ]);

    vi.spyOn(api.budgetApi, 'getSummary').mockResolvedValue({
      year: 2026,
      budget_id: 1,
      total_forecast: 5000,
      total_real: 1500,
      total_variance: -3500,
      consumption_rate: 30,
      items: [
        {
          id: 10,
          name: 'Assurance Maison',
          icon: '🛡️',
          supplier: 'AXA',
          forecast_amount: 1200,
          real_amount: 449.25,
          variance: -750.75,
          notes: '',
        },
      ],
    });

    vi.spyOn(api.budgetApi, 'getFundCalls').mockResolvedValue([]);
    vi.spyOn(api.documentsApi, 'list').mockResolvedValue([]);
  });

  it('displays "Modifier" button (not "Classer") when transaction has category and affectation', async () => {
    // Transaction categorized from todo page with category, budget_item_id, and legacy 'categorisee' status
    vi.spyOn(api.bankApi, 'getTransactions').mockResolvedValue([
      {
        id: 1,
        bank_account_id: 1,
        fiscal_year_id: 1,
        transaction_date: '2026-09-23',
        value_date: '2026-09-23',
        original_label: 'Prélèvement AXA ASSURANCES IARD MUTUELLE',
        amount: -449.25,
        running_balance: 1000,
        category: 'Assurances',
        movement_type: 'depense',
        associate_id: null,
        budget_item_id: 10,
        third_party: 'AXA',
        reconciliation_status: 'categorisee',
        notes: '',
        imported_at: '2026-09-23T10:00:00',
      },
    ]);

    render(
      <MemoryRouter>
        <BankAccounts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Prélèvement AXA ASSURANCES IARD MUTUELLE').length).toBeGreaterThan(0);
    });

    // Verify category and affectation are displayed
    expect(screen.getAllByText('Assurances').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Assurance Maison').length).toBeGreaterThan(0);

    // Verify classified count in header
    expect(screen.getByText(/1 classées/i)).toBeInTheDocument();

    // Verify action button is "Modifier" and NOT "Classer"
    const modifierButtons = screen.getAllByRole('button', { name: 'Modifier' });
    expect(modifierButtons.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Classer' })).not.toBeInTheDocument();
  });

  it('displays "Classer" button only for unclassified transactions without category', async () => {
    vi.spyOn(api.bankApi, 'getTransactions').mockResolvedValue([
      {
        id: 2,
        bank_account_id: 1,
        fiscal_year_id: 1,
        transaction_date: '2026-09-23',
        value_date: '2026-09-23',
        original_label: 'Virement inconnu',
        amount: -50.0,
        running_balance: 950,
        category: '',
        movement_type: '',
        associate_id: null,
        budget_item_id: null,
        third_party: '',
        reconciliation_status: 'a_traiter',
        notes: '',
        imported_at: '2026-09-23T10:00:00',
      },
    ]);

    render(
      <MemoryRouter>
        <BankAccounts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Virement inconnu').length).toBeGreaterThan(0);
    });

    // Verify pending count in header
    expect(screen.getByText(/1 à traiter/i)).toBeInTheDocument();

    const classerButtons = screen.getAllByRole('button', { name: 'Classer' });
    expect(classerButtons.length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Modifier' })).not.toBeInTheDocument();
  });
});
