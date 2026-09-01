import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Wallet, Landmark, FileText, ArrowUpRight, ArrowDownRight, Pencil, Check, X as XIcon, Key, ShieldCheck, Trash2 } from 'lucide-react';
import { associatesApi, authApi, currentAccountsApi, budgetApi } from '../api';
import type { Associate, AssociateSummary, CurrentAccountMovement, User, FundCall } from '../types';

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [associate, setAssociate] = useState<Associate | null>(null);
  const [summary, setSummary] = useState<AssociateSummary | null>(null);
  const [movements, setMovements] = useState<CurrentAccountMovement[]>([]);
  const [fundCalls, setFundCalls] = useState<FundCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', email: '', shares: 0 });
  const [saving, setSaving] = useState(false);

  // Modal Accès Utilisateur
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState('');

  function loadData() {
    if (!id) return;
    const aid = parseInt(id);
    Promise.all([
      associatesApi.get(aid),
      associatesApi.summary(aid),
      currentAccountsApi.movements(aid).catch(() => []),
      authApi.me().catch(() => null),
      budgetApi.listFundCalls(new Date().getFullYear()).catch(() => []),
    ]).then(([assoc, s, m, me, fCalls]) => {
      setAssociate(assoc);
      setSummary(s);
      setEditForm({ first_name: s.first_name, last_name: s.last_name, email: assoc.email || '', shares: s.shares });
      setMovements(m);
      setCurrentUser(me);
      if (fCalls) setFundCalls(fCalls);
      setLoading(false);
    });
  }

  useEffect(() => {
    loadData();
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
      loadData();
      setIsEditing(false);
    } catch (e) {
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !accountPassword || !accountUsername) return;
    setAccountSaving(true);
    setAccountError('');
    try {
      await associatesApi.createAccount(parseInt(id), { password: accountPassword, username: accountUsername });
      setShowAccountModal(false);
      setAccountPassword('');
      loadData();
    } catch (err: any) {
      setAccountError(err.response?.data?.detail || "Erreur lors de la création de l'accès");
    } finally {
      setAccountSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (!id || !confirm("Voulez-vous vraiment désactiver l'accès de cet associé ?")) return;
    try {
      await associatesApi.deleteAccount(parseInt(id));
      setShowAccountModal(false);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de la suppression de l'accès");
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
            <input
              className={`${inputClass} w-full`}
              value={editForm.email}
              onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              placeholder="Identifiant (ex: jean.dupont)"
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
                {associate?.email && (
                  <span className="ml-2 text-xs font-mono text-slate-500 font-normal">({associate.email})</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {currentUser?.role === 'gerant' && (
                <button
                  onClick={() => {
                    setAccountError('');
                    setAccountPassword('');
                    setAccountUsername(associate?.email || '');
                    setShowAccountModal(true);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    associate?.has_account
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <Key size={14} />
                  {associate?.has_account ? 'Accès activé' : 'Activer un accès'}
                </button>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                title="Modifier"
              >
                <Pencil size={18} />
              </button>
            </div>
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
            <span className="text-xs font-bold uppercase tracking-wider">Compte courant d'associé (CCA)</span>
          </div>
          <p className="text-2xl font-black text-emerald-600">
            {fmt(summary.current_account_balance)}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Avances remboursables dues par la SCI
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <FileText size={18} className="text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Appels de fonds charges</span>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {fmt(summary.total_fund_calls_paid)}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {summary.fund_calls_remaining > 0 ? (
              <span className="text-amber-600 font-bold">Reste dû : {fmt(summary.fund_calls_remaining)}</span>
            ) : (
              <span className="text-emerald-600 font-medium">À jour des charges courantes</span>
            )}
          </p>
        </div>
      </div>

      {/* Historique des apports et versements */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-extrabold text-slate-900 text-base">Historique des apports et versements de cet associé</h2>
        </div>
        {movements.length > 0 ? (
          <>
            {/* Tableau desktop / tablette */}
            <div className="hidden md:block overflow-x-auto">
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

            {/* Vue mobile : Liste sobre et nette délimitée par de fins séparateurs */}
            <div className="md:hidden divide-y divide-slate-200">
              {movements.map((m) => {
                const isVersement = m.movement_type === 'versement';
                return (
                  <div key={m.id} className="p-4 space-y-2 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-medium text-slate-500">
                        {new Date(m.movement_date).toLocaleDateString('fr-FR')}
                      </span>
                      <span
                        className={`font-mono font-black text-sm ${
                          isVersement ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {isVersement ? '+' : '-'}
                        {fmt(m.amount)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold inline-flex items-center gap-1 ${
                          isVersement
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isVersement ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {isVersement ? 'Apport / Versement' : 'Remboursement'}
                      </span>
                    </div>

                    {m.reason && (
                      <p className="text-xs text-slate-600 font-medium pt-0.5">
                        {m.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="px-6 py-12 text-center text-slate-500 text-sm font-medium">
            Aucun versement enregistré pour cet associé pour le moment.
          </div>
        )}
      </div>

      {/* Historique des appels de fonds de l'associé */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-extrabold text-slate-900 text-base">Appels de fonds & Contributions aux charges courantes</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Ces versements participent au financement des charges de la SCI et ne constituent pas une avance remboursable (hors CCA).
          </p>
        </div>
        {(() => {
          const assocLines = fundCalls.flatMap(fc => {
            const line = fc.lines.find(l => l.associate_id === Number(id));
            if (!line) return [];
            return [{ call: fc, line }];
          });

          if (assocLines.length === 0) {
            return (
              <div className="px-6 py-12 text-center text-slate-500 text-sm font-medium">
                Aucun appel de fonds émis pour cet associé.
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-6">Date de l'appel</th>
                    <th className="py-3.5 px-6">N° / Objet</th>
                    <th className="py-3.5 px-6 text-right">Montant appelé</th>
                    <th className="py-3.5 px-6 text-right">Montant réglé</th>
                    <th className="py-3.5 px-6 text-center">Statut</th>
                    <th className="py-3.5 px-6 text-right">Date de règlement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assocLines.map(({ call, line }) => (
                    <tr key={line.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-6 text-slate-600 text-xs font-semibold">
                        {new Date(call.call_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="font-bold text-slate-900 block text-xs">{call.call_number || `Appel #${call.id}`}</span>
                        <span className="text-xs text-slate-500 font-medium">{call.purpose}</span>
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono font-bold text-slate-900 text-xs">
                        {fmt(line.amount_due)}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono font-bold text-emerald-600 text-xs">
                        {fmt(line.amount_paid)}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          line.is_paid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : line.amount_paid > 0
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {line.is_paid ? 'Soldé' : line.amount_paid > 0 ? 'Partiel' : 'En attente'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right text-xs text-slate-600 font-medium">
                        {line.payment_date ? new Date(line.payment_date).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Modal d'accès utilisateur pour l'associé */}
      {showAccountModal && associate && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-fade-in border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  {associate.has_account ? "Gestion de l'accès" : "Activer un accès associé"}
                </h3>
              </div>
              <button
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XIcon size={18} />
              </button>
            </div>

            {accountError && (
              <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-xs font-semibold">
                {accountError}
              </div>
            )}

            <div className="text-xs text-slate-600 space-y-1">
              <p>
                <span className="font-bold text-slate-800">Associé :</span> {associate.first_name} {associate.last_name}
              </p>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Identifiant de connexion
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                  placeholder="ex: jean.dupont"
                  value={accountUsername}
                  onChange={(e) => setAccountUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {associate.has_account ? 'Nouveau mot de passe' : 'Mot de passe initial'}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                  placeholder="••••••••"
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {associate.has_account ? (
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    Supprimer l'accès
                  </button>
                ) : <div />}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAccountModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={accountSaving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all disabled:opacity-50"
                  >
                    {accountSaving ? 'Enregistrement...' : associate.has_account ? 'Mettre à jour' : 'Créer l\'accès'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
