import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AssociateDetail from '../AssociateDetail';
import * as api from '../../api';
import type { Associate, AssociateSummary } from '../../types';

const associate: Associate = {
  id: 1,
  last_name: 'Dupont',
  first_name: 'Jean',
  address: 'Paris',
  email: 'jean@test.com',
  shares: 100,
  entry_date: null,
  is_active: true,
  is_manager: false,
  quote_part: 100,
  has_account: false,
  account_is_admin: false,
};

const summary: AssociateSummary = {
  id: 1,
  last_name: 'Dupont',
  first_name: 'Jean',
  shares: 100,
  quote_part: 100,
  capital_amount: 100,
  total_paid_current_account: 0,
  total_refunded_current_account: 0,
  current_account_balance: 0,
  total_fund_calls_due: 0,
  total_fund_calls_paid: 0,
  fund_calls_remaining: 0,
};

describe('AssociateDetail account access', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api.associatesApi, 'get').mockResolvedValue(associate);
    vi.spyOn(api.associatesApi, 'summary').mockResolvedValue(summary);
    vi.spyOn(api.currentAccountsApi, 'movements').mockResolvedValue([]);
    vi.spyOn(api.authApi, 'me').mockResolvedValue({
      id: 1,
      email: 'admin@test.com',
      full_name: 'Gérant',
      role: 'gerant',
      is_active: true,
    });
    vi.spyOn(api.budgetApi, 'getFundCalls').mockResolvedValue([]);
  });

  it('creates a read-only account by default and sends admin mode when enabled', async () => {
    const createAccount = vi.spyOn(api.associatesApi, 'createAccount').mockResolvedValue({
      id: 2,
      email: 'jean@test.com',
      full_name: 'Jean Dupont',
      role: 'gerant',
      is_active: true,
      associate_id: 1,
    });

    render(
      <MemoryRouter initialEntries={['/associes/1']}>
        <Routes>
          <Route path="/associes/:id" element={<AssociateDetail />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Activer un accès' }));
    const adminCheckbox = screen.getByRole('checkbox', { name: /Mode admin/ });
    expect(adminCheckbox).not.toBeChecked();

    fireEvent.change(screen.getByPlaceholderText('ex: jean.dupont'), {
      target: { value: 'jean@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.click(adminCheckbox);
    fireEvent.click(screen.getByRole('button', { name: "Créer l'accès" }));

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith(1, {
        password: 'password123',
        username: 'jean@test.com',
        is_admin: true,
      });
    });
  });
});
