import { useState } from 'react';
import { authApi } from '../api';
import { Building2 } from 'lucide-react';

interface Props {
  onSetup: (token: string) => void;
}

export default function SetupPage({ onSetup }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.setup({ email, password, full_name: fullName });
      onSetup(res.access_token);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors de la configuration');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
            <Building2 className="w-7 h-7 stroke-[1.75]" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Gestion SCI</h1>
          <p className="text-sm text-slate-500 mt-1.5">Configuration initiale — Créez le compte gérant</p>
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
            <label className="block text-sm font-medium text-text-secondary mb-2">Nom complet</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder="Jean Dupont"
            />
          </div>

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
              minLength={6}
              className="w-full px-4 py-3 bg-bg-input border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg shadow-accent/25 hover:shadow-accent/40"
          >
            {loading ? 'Configuration...' : 'Configurer l\'application'}
          </button>
        </form>
      </div>
    </div>
  );
}
