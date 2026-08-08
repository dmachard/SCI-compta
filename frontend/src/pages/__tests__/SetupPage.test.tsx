import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SetupPage from '../SetupPage';

describe('SetupPage Component', () => {
  it('renders initial setup form with name, email, and password inputs', () => {
    const handleSetup = vi.fn();
    render(<SetupPage onSetup={handleSetup} />);

    expect(screen.getByText(/Configuration initiale/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ex: admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configurer l'application/i })).toBeInTheDocument();
  });
});
