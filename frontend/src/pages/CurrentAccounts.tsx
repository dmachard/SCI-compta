import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { currentAccountsApi, associatesApi } from '../api';
import type { CurrentAccountBalance, Associate } from '../types';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function CurrentAccounts() {
  const [balances, setBalances] = useState<CurrentAccountBalance[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    associate_id: 0,
    movement_date: new Date().toISOString().split('T')[0],
    movement_type: 'versement',
    amount: 0,
    reason: '',
  });

  function loadData() {
    Promise.all([currentAccountsApi.balances(), associatesApi.list()])
      .then(([b, a]) => {
        setBalances(b);
        setAssociates(a);
        if (a.length > 0 && form.associate_id === 0) {
          setForm((f) => ({ ...f, associate_id: a[0].id }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await currentAccountsApi.create(form);
      setShowForm(false);
      setForm((f) => ({ ...f, amount: 0, reason: '' }));
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  const inputClass =
    'w-full px-4 py-2.5 bg-bg-input border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Comptes courants d'associés</h1>
          <p className="text-text-secondary mt-1">
            Total des comptes courants : <span className="font-semibold text-text-primary">{fmt(totalBalance)}</span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all duration-200 shadow-lg shadow-accent/25"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Annuler' : 'Nouveau mouvement'}
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-bg-card border border-border rounded-2xl p-6 space-y-4 animate-fade-in"
        >
          <h2 className="font-semibold text-text-primary">Nouveau mouvement</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Associé</label>
              <select
                className={inputClass}
                value={form.associate_id}
                onChange={(e) => setForm({ ...form, associate_id: parseInt(e.target.value) })}
                required
              >
                {associates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.first_name} {a.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Type</label>
              <select
                className={inputClass}
                value={form.movement_type}
                onChange={(e) => setForm({ ...form, movement_type: e.target.value })}
              >
                <option value="versement">Versement</option>
                <option value="remboursement">Remboursement</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Montant (€)</label>
              <input
                type="number"
                className={inputClass}
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                step="0.01"
                min="0.01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Date</label>
              <input
                type="date"
                className={inputClass}
                value={form.movement_date}
                onChange={(e) => setForm({ ...form, movement_date: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Motif</label>
            <input
              className={inputClass}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ex : Financement acquisition bien"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {/* Tableau */}
      {balances.length > 0 ? (
        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Associé
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Versements
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Remboursements
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                    Solde
                  </th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr
                    key={b.associate_id}
                    className="border-b border-border/50 hover:bg-bg-hover/50 transition-colors"
                  >
                    <td className="px-6 py-3 text-text-primary font-medium">
                      {b.first_name} {b.last_name}
                    </td>
                    <td className="px-6 py-3 text-right text-success">{fmt(b.total_paid)}</td>
                    <td className="px-6 py-3 text-right text-warning">{fmt(b.total_refunded)}</td>
                    <td className="px-6 py-3 text-right font-bold text-text-primary">
                      {fmt(b.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-bg-hover/30">
                  <td className="px-6 py-3 font-semibold text-text-primary">Total</td>
                  <td className="px-6 py-3 text-right font-semibold text-success">
                    {fmt(balances.reduce((s, b) => s + b.total_paid, 0))}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-warning">
                    {fmt(balances.reduce((s, b) => s + b.total_refunded, 0))}
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-text-primary">
                    {fmt(totalBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 text-text-muted text-sm">
          Aucun mouvement de compte courant enregistré
        </div>
      )}
    </div>
  );
}
