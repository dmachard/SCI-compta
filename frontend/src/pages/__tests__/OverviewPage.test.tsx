import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Overview from '../Overview';
import * as api from '../../api';

describe('Overview Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(api.authApi, 'me').mockResolvedValue({
      id: 1,
      email: 'admin@sci.fr',
      full_name: 'Gérant Admin',
      role: 'gerant',
      is_active: true,
    });

    vi.spyOn(api.sciApi, 'get').mockResolvedValue({
      id: 1,
      name: 'SCI Immobilière Test',
      siren: '123456789',
      siret: '12345678900012',
      rcs: 'Paris',
      address: '10 Rue de Paris, 75001 Paris',
      creation_date: '2023-01-01',
      tax_regime: 'ir',
      fiscal_year_end_month: 12,
      fiscal_year_end_day: 31,
      share_capital: 1000,
      total_shares: 100,
      share_nominal_value: 10,
      currency: 'EUR',
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

    vi.spyOn(api.bankApi, 'getTransactions').mockResolvedValue([
      {
        id: 1,
        bank_account_id: 1,
        fiscal_year_id: 1,
        transaction_date: '2026-08-15',
        value_date: '2026-08-15',
        original_label: 'VIR Assurance PNO',
        amount: -150.0,
        running_balance: 3450.5,
        category: 'assurance',
        movement_type: 'depense',
        associate_id: null,
        third_party: 'Assurance Immo',
        reconciliation_status: 'a_traiter',
        notes: '',
        imported_at: '2026-08-15T10:00:00',
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

    vi.spyOn(api.currentAccountsApi, 'balances').mockResolvedValue([
      {
        associate_id: 1,
        last_name: 'Dupont',
        first_name: 'Jean',
        total_paid: 2000,
        total_refunded: 0,
        balance: 2000,
        capital_paid: 600,
      },
    ]);

    vi.spyOn(api.fiscalYearsApi, 'list').mockResolvedValue([
      {
        id: 1,
        label: 'Exercice 2026',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        status: 'ouvert',
        closed_at: null,
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
          id: 1,
          name: 'Assurance',
          icon: 'shield',
          supplier: 'AXA',
          periodicity: 'annuelle',
          forecast: 5000,
          real: 1500,
          variance: -3500,
          consumption_rate: 30,
        },
      ],
    });

    vi.spyOn(api.budgetApi, 'getFundCalls').mockResolvedValue([]);
    vi.spyOn(api.documentsApi, 'list').mockResolvedValue([]);
  });

  it('renders "Ce qui est à faire" and lists individual operations and missing receipts', async () => {
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    );

    expect(screen.getByText('Ce qui est à faire')).toBeInTheDocument();

    await waitFor(() => {
      // Vérifier le groupe d'opérations et l'opération précise
      expect(screen.getByText(/Opérations bancaires à catégoriser/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Assurance Immo/i).length).toBeGreaterThanOrEqual(1);

      // Vérifier le groupe de factures et la facture précise manquante
      expect(screen.getByText(/Factures \/ Justificatifs à ajouter/i)).toBeInTheDocument();

      // Vérifier les autres actions
      expect(screen.getAllByText(/appel de fonds/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('opens direct reconcile modal when clicking Catégoriser', async () => {
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Assurance Immo/i).length).toBeGreaterThanOrEqual(1);
    });

    const categorizeButtons = screen.getAllByRole('button', { name: /Catégoriser/i });
    expect(categorizeButtons.length).toBeGreaterThan(0);
    fireEvent.click(categorizeButtons[0]);

    expect(screen.getByText("Classer l'opération")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Valider le classement/i })).toBeInTheDocument();
  });

  it('shows distinct CCA and Règlement appel de fonds options when associate is selected', async () => {
    render(
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Assurance Immo/i).length).toBeGreaterThanOrEqual(1);
    });

    const categorizeButtons = screen.getAllByRole('button', { name: /Catégoriser/i });
    fireEvent.click(categorizeButtons[0]);

    // Cliquer sur le bouton "Associé"
    const assocButton = screen.getByRole('button', { name: /Associé/i });
    fireEvent.click(assocButton);

    // Vérifier les options de la liste déroulante d'affectation
    expect(screen.getByText(/Compte courant d'associé \(Avance remboursable\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Règlement appel de fonds \(Charges courantes\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Apport au capital social/i)).toBeInTheDocument();
  });
});

