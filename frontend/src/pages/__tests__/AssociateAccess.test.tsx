import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Layout from '../../components/Layout';
import type { User } from '../../types';

describe('Layout component with associate role', () => {
  const associateUser: User = {
    id: 2,
    email: 'user1',
    full_name: 'User One',
    role: 'associe',
    is_active: true,
    associate_id: 1,
  };

  const gerantUser: User = {
    id: 1,
    email: 'admin',
    full_name: 'Gérant Admin',
    role: 'gerant',
    is_active: true,
  };

  it('renders Lecture seule badge and hides Configuration menu for associate role', () => {
    render(
      <MemoryRouter>
        <Layout user={associateUser} onLogout={vi.fn()}>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByText('User One')).toBeInTheDocument();
    expect(screen.getByText('Lecture seule')).toBeInTheDocument();
    expect(screen.queryByText('Configuration')).not.toBeInTheDocument();
  });

  it('renders Gérant badge and displays Configuration menu for gerant role', () => {
    render(
      <MemoryRouter>
        <Layout user={gerantUser} onLogout={vi.fn()}>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByText('Gérant Admin')).toBeInTheDocument();
    expect(screen.getByText('Gérant')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
  });
});
