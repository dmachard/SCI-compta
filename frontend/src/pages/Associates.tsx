import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, UserCheck, Users } from 'lucide-react';
import { associatesApi, currentAccountsApi, sciApi } from '../api';
import type { Associate, CurrentAccountBalance, SCI } from '../types';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function Associates() {
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [balances, setBalances] = useState<CurrentAccountBalance[]>([]);
  const [sci, setSci] = useState<SCI | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    last_name: '',
    first_name: '',
    email: '',
    address: '',
    shares: 0,
    entry_date: '',
    is_manager: false,
  });

  function loadData() {
    setLoading(true);
    Promise.all([associatesApi.list(), currentAccountsApi.balances(), sciApi.get()])
      .then(([assocs, bals, sciData]) => {
        setAssociates(assocs);
        setBalances(bals);
        setSci(sciData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setForm({
      last_name: '',
      first_name: '',
      email: '',
      address: '',
      shares: 0,
      entry_date: '',
      is_manager: false,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await associatesApi.create({
        ...form,
        entry_date: form.entry_date || null,
      });
      resetForm();
      setShowForm(false);
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
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const totalShares = associates.reduce((s, a) => s + a.shares, 0);
  const totalCapital = balances.reduce((s, b) => s + (b.capital_paid || 0), 0);
  const totalCCABalance = balances.reduce((s, b) => s + b.balance, 0);

  const inputClass =
    'w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm font-medium';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1 Seul bloc d'en-tête unifié et harmonieux */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Users className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">Comptes courant associés</h1>
            </div>

            <div className="flex items-baseline space-x-4 mt-3">
              <span className="text-3xl font-black text-indigo-900 tracking-tight">
                {fmt(totalCCABalance)}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Total des apports versés · {associates.length} associé(s) · {totalShares} parts sociales
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md self-start sm:self-auto"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Annuler' : 'Ajouter un associé'}
          </button>
        </div>
      </div>

      {/* Formulaire Nouvel Associé */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm animate-fade-in"
        >
          <h2 className="font-extrabold text-slate-900 text-base">Nouvel associé</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nom</label>
              <input
                className={inputClass}
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Prénom</label>
              <input
                className={inputClass}
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre de parts
              </label>
              <input
                type="number"
                className={inputClass}
                value={form.shares}
                onChange={(e) => setForm({ ...form, shares: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date d'entrée
              </label>
              <input
                type="date"
                className={inputClass}
                value={form.entry_date}
                onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_manager}
                  onChange={(e) => setForm({ ...form, is_manager: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-bold text-slate-800">Gérant de la SCI</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Adresse</label>
            <input
              className={inputClass}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {/* Tableau épuré des Associés & Solde */}
      {associates.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50/50 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-6">Associé</th>
                  <th className="py-3.5 px-6 text-right">Parts sociales</th>
                  <th className="py-3.5 px-6 text-right">Quote-part</th>
                  <th className="py-3.5 px-6 text-right text-slate-700">Capital versé</th>
                  <th className="py-3.5 px-6 text-right text-indigo-700">Compte courant</th>
                  <th className="py-3.5 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {associates.map((a) => {
                  const bal = balances.find(b => b.associate_id === a.id);
                  const compteCourant = bal ? bal.balance : 0;
                  const capitalVersé = bal ? bal.capital_paid : 0;

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <Link
                          to={`/associes/${a.id}`}
                          className="text-slate-900 hover:text-indigo-600 font-extrabold text-sm transition-colors flex items-center gap-2"
                        >
                          <span>{a.first_name} {a.last_name}</span>
                          {a.is_manager && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-extrabold border border-indigo-100">
                              Gérant
                            </span>
                          )}
                        </Link>

                      </td>

                      <td className="py-4 px-6 text-right font-bold text-slate-800">{a.shares} parts</td>
                      <td className="py-4 px-6 text-right font-bold text-slate-600">{a.quote_part} %</td>

                      {/* Capital */}
                      <td className="py-4 px-6 text-right font-mono font-extrabold text-sm text-slate-700">
                        {fmt(capitalVersé)}
                      </td>

                      {/* Solde Compte Courant épuré */}
                      <td className="py-4 px-6 text-right font-mono font-extrabold text-sm text-emerald-600">
                        {compteCourant >= 0 ? `+${fmt(compteCourant)}` : fmt(compteCourant)}
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <Link
                          to={`/associes/${a.id}`}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all"
                        >
                          Historique →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 shadow-sm">
          <p className="text-lg font-bold text-slate-800">Aucun associé configuré</p>
          <p className="text-sm text-slate-500 mt-1">Cliquez sur "Ajouter un associé" pour configurer les membres de votre SCI.</p>
        </div>
      )}
    </div>
  );
}
