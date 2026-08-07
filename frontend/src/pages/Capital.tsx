import { useEffect, useState } from 'react';
import { capitalApi } from '../api';
import type { CapitalRegister } from '../types';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function Capital() {
  const [capital, setCapital] = useState<CapitalRegister | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    capitalApi
      .get()
      .then(setCapital)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!capital) {
    return (
      <div className="text-center py-16 text-text-muted">
        <p>Configurez d'abord la SCI et ajoutez des associés.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Capital social</h1>
        <p className="text-text-secondary mt-1">Registre du capital et répartition des parts</p>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-text-muted mb-1">Capital total</p>
          <p className="text-2xl font-bold text-text-primary">{fmt(capital.total_capital)}</p>
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-text-muted mb-1">Nombre de parts</p>
          <p className="text-2xl font-bold text-text-primary">{capital.total_shares}</p>
        </div>
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-text-muted mb-1">Valeur nominale</p>
          <p className="text-2xl font-bold text-text-primary">{fmt(capital.share_nominal_value)}</p>
        </div>
      </div>

      {/* Répartition */}
      <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">Répartition entre associés</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Associé
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Parts
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Quote-part
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                  Capital
                </th>
              </tr>
            </thead>
            <tbody>
              {capital.entries.map((e) => (
                <tr
                  key={e.associate_id}
                  className="border-b border-border/50 hover:bg-bg-hover/50 transition-colors"
                >
                  <td className="px-6 py-3 text-text-primary font-medium">
                    {e.first_name} {e.last_name}
                  </td>
                  <td className="px-6 py-3 text-right text-text-secondary">{e.shares}</td>
                  <td className="px-6 py-3 text-right text-text-secondary">{e.quote_part} %</td>
                  <td className="px-6 py-3 text-right font-medium text-text-primary">
                    {fmt(e.capital_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-bg-hover/30">
                <td className="px-6 py-3 font-semibold text-text-primary">Total</td>
                <td className="px-6 py-3 text-right font-semibold text-text-primary">
                  {capital.total_shares}
                </td>
                <td className="px-6 py-3 text-right font-semibold text-text-primary">100 %</td>
                <td className="px-6 py-3 text-right font-semibold text-text-primary">
                  {fmt(capital.total_capital)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Barre de répartition visuelle */}
        <div className="px-6 py-4 border-t border-border">
          <div className="flex rounded-full overflow-hidden h-3">
            {capital.entries.map((e, i) => {
              const colors = [
                'bg-accent',
                'bg-info',
                'bg-success',
                'bg-warning',
                'bg-danger',
                'bg-purple-500',
              ];
              return (
                <div
                  key={e.associate_id}
                  className={`${colors[i % colors.length]} transition-all duration-500`}
                  style={{ width: `${e.quote_part}%` }}
                  title={`${e.first_name} ${e.last_name}: ${e.quote_part}%`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            {capital.entries.map((e, i) => {
              const colors = [
                'bg-accent',
                'bg-info',
                'bg-success',
                'bg-warning',
                'bg-danger',
                'bg-purple-500',
              ];
              return (
                <div key={e.associate_id} className="flex items-center gap-2 text-xs text-text-secondary">
                  <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                  {e.first_name} {e.last_name} ({e.quote_part}%)
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
