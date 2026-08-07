import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Wallet, Landmark, FileText, ArrowUpRight, ArrowDownRight, Pencil, Check, X as XIcon } from 'lucide-react';
import { associatesApi, currentAccountsApi } from '../api';
import type { AssociateSummary, CurrentAccountMovement } from '../types';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function AssociateDetail() {
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<AssociateSummary | null>(null);
  const [movements, setMovements] = useState<CurrentAccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', shares: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const aid = parseInt(id);
    Promise.all([
      associatesApi.summary(aid),
      currentAccountsApi.movements(aid).catch(() => []),
    ]).then(([s, m]) => {
      setSummary(s);
      setEditForm({ first_name: s.first_name, last_name: s.last_name, shares: s.shares });
      setMovements(m);
      setLoading(false);
    });
  }, [id]);

  if (loading || !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  async function handleSaveEdit() {
    if (!id || !summary) return;
    setSaving(true);
    try {
      await associatesApi.update(parseInt(id), editForm);
      const s = await associatesApi.summary(parseInt(id));
      setSummary(s);
      setIsEditing(false);
    } catch (e) {
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête de la fiche associé */}
      <div className="flex items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <Link
          to="/associes"
          className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        {isEditing ? (
          <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
            <input
              className={`${inputClass} w-full`}
              value={editForm.first_name}
              onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
              placeholder="Prénom"
            />
            <input
              className={`${inputClass} w-full`}
              value={editForm.last_name}
              onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
              placeholder="Nom"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-bold whitespace-nowrap">Parts:</span>
              <input
                type="number"
                className={`${inputClass} w-40 text-center`}
                value={editForm.shares}
                onChange={e => setEditForm({ ...editForm, shares: parseInt(e.target.value) || 0 })}
                min={0}
              />
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setIsEditing(false)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" disabled={saving}>
                <XIcon size={18} />
              </button>
              <button onClick={handleSaveEdit} className="p-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg" disabled={saving}>
                <Check size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                {summary.first_name} {summary.last_name}
              </h1>
              <p className="text-slate-600 text-sm mt-0.5 font-medium">
                {summary.shares} parts sociales · {summary.quote_part} % de la SCI
              </p>
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
              title="Modifier"
            >
              <Pencil size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Cartes de synthèse claires */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Landmark size={18} className="text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Parts & Capital</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{fmt(summary.capital_amount)}</p>
          <p className="text-xs text-slate-500 mt-1 font-medium">{summary.shares} parts ({summary.quote_part} %)</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Wallet size={18} className="text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Compte courant d'associé</span>
          </div>
          <p className="text-2xl font-black text-emerald-600">
            {fmt(summary.current_account_balance)}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Total versé : {fmt(summary.total_paid_current_account)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <FileText size={18} className="text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Appels de fonds</span>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {fmt(summary.total_fund_calls_paid)}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Régularisé auprès de la SCI
          </p>
        </div>
      </div>

      {/* Historique des apports et versements */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-extrabold text-slate-900 text-base">Historique des apports et versements de cet associé</h2>
        </div>
        {movements.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Type d'opération</th>
                  <th className="py-4 px-6 text-right">Montant</th>
                  <th className="py-4 px-6">Motif / Libellé bancaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((m) => {
                  const isVersement = m.movement_type === 'versement';
                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-6 py-4 text-xs font-mono font-medium text-slate-600">
                        {new Date(m.movement_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs px-3 py-1 rounded-full font-bold inline-flex items-center gap-1 ${
                            isVersement
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {isVersement ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {isVersement ? 'Apport / Versement (+)' : 'Remboursement (-)'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-extrabold text-sm text-slate-900">
                        {isVersement ? '+' : '-'}
                        {fmt(m.amount)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700 font-medium">{m.reason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-slate-500 text-sm font-medium">
            Aucun versement enregistré pour cet associé pour le moment.
          </div>
        )}
      </div>
    </div>
  );
}
