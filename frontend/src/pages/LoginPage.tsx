import { useState } from 'react';
import { authApi } from '../api';
import logoUrl from '../assets/logo.svg';

interface Props {
  onLogin: (token: string) => void;
  onNavigateSetup?: () => void;
}

export default function LoginPage({ onLogin, onNavigateSetup }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      onLogin(res.access_token);
    } catch {
      setError('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8 flex flex-col items-center">
          <img src={logoUrl} alt="Gestion SCI Logo" className="w-20 h-20 object-contain mb-4" />
          <h1 className="text-3xl font-bold text-text-primary">Gestion SCI</h1>
          <p className="text-text-secondary mt-2">Connectez-vous pour accéder à la gestion de votre SCI</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-bg-card border border-border rounded-2xl p-8 space-y-5 shadow-xl"
        >
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Identifiant</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder="ex: admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg shadow-accent/25 hover:shadow-accent/40"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>

          {onNavigateSetup && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onNavigateSetup}
                className="text-sm text-text-secondary hover:text-accent transition-colors underline"
              >
                Première connexion ? Configurer le compte gérant
              </button>
            </div>
          )}
        </form>

        <p className="text-center text-xs text-text-muted mt-6 font-mono">
          {__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
