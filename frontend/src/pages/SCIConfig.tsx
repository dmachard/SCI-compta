import { useEffect, useState } from 'react';
import { Save, Check, Trash2, ShieldAlert } from 'lucide-react';
import { sciApi, authApi } from '../api';
import type { SCI, User } from '../types';

export default function SCIConfig() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sci, setSci] = useState<SCI | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    siren: '',
    rcs: '',
    address: '',
    creation_date: '',
    tax_regime: 'IR',
    fiscal_year_end_month: 12,
    fiscal_year_end_day: 31,
    share_capital: 0,
    total_shares: 0,
    share_nominal_value: 0,
    currency: 'EUR',
  });

  useEffect(() => {
    Promise.all([
      sciApi.get(),
      authApi.me().catch(() => null),
    ])
      .then(([s, me]) => {
        setSci(s);
        setCurrentUser(me);
        setForm({
          name: s.name,
          siren: s.siren,
          rcs: s.rcs,
          address: s.address,
          creation_date: s.creation_date || '',
          tax_regime: s.tax_regime,
          fiscal_year_end_month: s.fiscal_year_end_month,
          fiscal_year_end_day: s.fiscal_year_end_day,
          share_capital: s.share_capital,
          total_shares: s.total_shares,
          share_nominal_value: s.share_nominal_value,
          currency: s.currency,
        });
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  function update(field: string, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await sciApi.update(form);
      setSci(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("⚠️ ATTENTION ⚠️\nÊtes-vous sûr de vouloir tout effacer (écritures, comptes, exercices, associés, propriétés) ?\nSeule la configuration de base de la SCI sera conservée.\nCette action est IRREVERSIBLE.")) {
      return;
    }

    setResetting(true);
    try {
      await sciApi.reset();
      alert("La base de données a été réinitialisée avec succès.");
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Une erreur est survenue lors de la réinitialisation.");
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (currentUser && currentUser.role !== 'gerant') {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm my-8">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl w-fit mx-auto border border-amber-200">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900">Accès restreint</h2>
        <p className="text-sm text-slate-600">
          La modification de la configuration de la SCI est réservée au gérant. Vous êtes actuellement connecté avec un compte associé (lecture seule).
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full px-4 py-2.5 bg-bg-input border border-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors text-sm';
  const labelClass = 'block text-sm font-medium text-text-secondary mb-1.5';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Configuration de la SCI</h1>
        <p className="text-text-secondary mt-1">Informations générales de la société</p>
      </div>

      <form
        onSubmit={handleSave}
        className="bg-bg-card border border-border rounded-2xl p-6 space-y-6"
      >
        {/* Identité */}
        <div>
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Identité
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Raison sociale</label>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="MA SCI"
              />
            </div>
            <div>
              <label className={labelClass}>SIREN</label>
              <input
                className={inputClass}
                value={form.siren}
                onChange={(e) => update('siren', e.target.value)}
                placeholder="123 456 789"
              />
            </div>
            <div>
              <label className={labelClass}>Date de création</label>
              <input
                type="date"
                className={inputClass}
                value={form.creation_date}
                onChange={(e) => update('creation_date', e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Adresse du siège</label>
              <input
                className={inputClass}
                value={form.address}
                onChange={(e) => update('address', e.target.value)}
                placeholder="1 rue de la Paix, 35000 Rennes"
              />
            </div>
          </div>
        </div>

        {/* Capital */}
        <div>
          <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">
            Capital social
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Capital social (€)</label>
              <input
                type="number"
                className={inputClass}
                value={form.share_capital}
                onChange={(e) => update('share_capital', parseFloat(e.target.value))}
                step="0.01"
              />
            </div>
            <div>
              <label className={labelClass}>Nombre total de parts</label>
              <input
                type="number"
                className={inputClass}
                value={form.total_shares}
                onChange={(e) => update('total_shares', parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className={labelClass}>Valeur nominale (€)</label>
              <input
                type="number"
                className={inputClass}
                value={form.share_nominal_value}
                onChange={(e) => update('share_nominal_value', parseFloat(e.target.value))}
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 shadow-lg shadow-accent/25"
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saving ? 'Sauvegarde...' : saved ? 'Enregistré !' : 'Enregistrer'}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="mt-12 pt-8 border-t border-red-200">
        <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Trash2 size={16} /> Zone de danger
        </h2>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-red-900 mb-1">Réinitialiser les données</h3>
            <p className="text-sm text-red-700/80">
              Supprime tous les associés, comptes bancaires, opérations, exercices et documents. La configuration de la SCI sera conservée.
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="shrink-0 px-5 py-2.5 bg-red-100 hover:bg-red-600 text-red-700 hover:text-white font-bold rounded-xl transition-all duration-200"
          >
            {resetting ? 'Effacement...' : 'Tout réinitialiser'}
          </button>
        </div>
      </div>
    </div>
  );
}
