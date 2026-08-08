import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../LoginPage';

describe('LoginPage Component', () => {
  it('renders login form with title and input fields', () => {
    const handleLogin = vi.fn();
    render(<LoginPage onLogin={handleLogin} />);

    expect(screen.getByText('Gestion SCI')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ex: admin')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument();
  });

  it('does not render setup link when onNavigateSetup is not provided (app already configured)', () => {
    const handleLogin = vi.fn();
    render(<LoginPage onLogin={handleLogin} />);

    expect(
      screen.queryByRole('button', { name: /Première connexion \? Configurer le compte gérant/i })
    ).not.toBeInTheDocument();
  });

  it('renders initial setup link when onNavigateSetup is provided (app not configured)', () => {
    const handleLogin = vi.fn();
    const handleNavigateSetup = vi.fn();
    render(<LoginPage onLogin={handleLogin} onNavigateSetup={handleNavigateSetup} />);

    const setupButton = screen.getByRole('button', { name: /Première connexion \? Configurer le compte gérant/i });
    expect(setupButton).toBeInTheDocument();

    fireEvent.click(setupButton);
    expect(handleNavigateSetup).toHaveBeenCalledTimes(1);
  });
});
