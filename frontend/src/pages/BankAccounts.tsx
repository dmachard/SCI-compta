import { useEffect, useState } from 'react';
import { Upload, CheckCircle2, Clock, Trash2, Filter, Search, ArrowUpRight, ArrowDownRight, CreditCard, UserCheck, X } from 'lucide-react';
import { bankApi, associatesApi, authApi, budgetApi } from '../api';
import type { BankAccount, BankTransaction, Associate, ImportCSVResponse, User, BudgetTableItem } from '../types';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const COMMON_CATEGORIES = [
  "Acquisition bien / Notaire",
  "Loyer perçu",
  "Virement Associé (Apport / Retrait)",
  "Charges, Eau & Électricité",
  "Travaux & Réparations",
  "Impôts & Taxes (Foncière, CFE)",
  "Assurances",
  "Frais bancaires & Emprunt",
  "Autre dépense / recette",
];

export default function BankAccounts() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetTableItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Import CSV state
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportCSVResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Modal de classement
  const [reconcilingTx, setReconcilingTx] = useState<BankTransaction | null>(null);
  const [reconcileForm, setReconcileForm] = useState({
    category: '',
    associate_id: 0,
    budget_item_id: 0,
    movement_type: 'versement',
    third_party: '',
    notes: '',
  });

  function loadData() {
    setLoading(true);
    Promise.all([
      bankApi.getAccounts(),
      bankApi.getTransactions({ status: statusFilter || undefined, search: searchFilter || undefined }),
      associatesApi.list(),
      authApi.me().catch(() => null),
      budgetApi.getSummary(new Date().getFullYear()).catch(() => null),
    ])
      .then(([accs, txs, assocs, me, bSummary]) => {
        setAccounts(accs);
        setTransactions(txs);
        setAssociates(assocs);
        setCurrentUser(me);
        if (bSummary) {
          setBudgetItems(bSummary.items);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadData();
  }

  async function handleFileUpload(file: File) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Veuillez sélectionner un fichier CSV bancaire.');
      return;
    }
    setUploading(true);
    setImportResult(null);
    try {
      const res = await bankApi.importCsv(file);
      setImportResult(res);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de l'importation du fichier CSV");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  }

  function openReconcileModal(tx: BankTransaction) {
    setReconcilingTx(tx);
    setReconcileForm({
      category: tx.category || (tx.associate_id ? "Compte courant d'associé" : ''),
      associate_id: tx.associate_id || 0,
      budget_item_id: tx.budget_item_id || 0,
      movement_type: tx.movement_type || (tx.amount > 0 ? 'versement' : 'remboursement'),
      third_party: tx.third_party || '',
      notes: tx.notes || '',
    });
  }

  async function handleReconcileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reconcilingTx) return;

    try {
      await bankApi.reconcileTransaction(reconcilingTx.id, {
        category: reconcileForm.category,
        associate_id: reconcileForm.associate_id > 0 ? reconcileForm.associate_id : null,
        budget_item_id: reconcileForm.budget_item_id > 0 ? reconcileForm.budget_item_id : null,
        movement_type: reconcileForm.movement_type,
        third_party: reconcileForm.third_party,
        notes: reconcileForm.notes,
        reconciliation_status: 'rapprochee',
      });
      setReconcilingTx(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors du classement');
    }
  }

  async function handleDeleteTx(txId: number) {
    if (!confirm('Supprimer cette transaction bancaire ?')) return;
    try {
      await bankApi.deleteTransaction(txId);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la suppression');
    }
  }



  const primaryAccount = accounts[0];
  const classifiedCount = transactions.filter(t => t.reconciliation_status === 'rapprochee').length;
  const pendingCount = transactions.filter(t => t.reconciliation_status !== 'rapprochee').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Input fichier CSV masqué */}
      <input
        type="file"
        accept=".csv"
        id="csv-upload-input"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
          }
        }}
      />

      {/* 1 Seul bloc d'en-tête unifié et harmonieux */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`bg-white p-6 rounded-2xl border transition-all shadow-sm ${
          dragOver ? 'border-indigo-500 bg-indigo-50/50' : 'border-slate-200'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <CreditCard className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">Compte courant</h1>
            </div>
            
            {/* Solde & Compteur intégré */}
            <div className="flex items-baseline space-x-4 mt-3">
              <span className={`text-3xl font-black tracking-tight ${primaryAccount && primaryAccount.current_balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {fmt(primaryAccount?.current_balance || 0)}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {transactions.length} opération(s) ({classifiedCount} classées{pendingCount > 0 ? `, ${pendingCount} à traiter` : ''})
              </span>
            </div>
          </div>

          {/* Boutons d'action principaux */}
          {currentUser?.role === 'gerant' && (
            <div className="flex items-center space-x-3">
              <label htmlFor="csv-upload-input" className="cursor-pointer flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md">
                <Upload className="w-4 h-4" />
                <span>{uploading ? "Importation..." : "Importer un relevé CSV"}</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Notification de résultat d'import */}
      {importResult && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm">Importation terminée !</p>
              <p className="text-xs text-emerald-700 font-medium">
                {importResult.imported_count} nouvelle(s) opération(s) ajoutée(s). {importResult.skipped_count} déjà présente(s) ignorée(s).
              </p>
            </div>
          </div>
          <button
            onClick={() => setImportResult(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Carte du Tableau avec barre de recherche et filtres intégrée */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Barre de recherche intégrée dans la carte */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2 flex-1">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher une opération..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-white text-slate-900 text-xs rounded-xl pl-9 pr-4 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition-all"
            >
              Rechercher
            </button>
          </form>

          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white text-slate-800 text-xs font-bold rounded-xl px-3 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Toutes les opérations</option>
              <option value="a_traiter">À traiter</option>
              <option value="rapprochee">Classées</option>
            </select>
          </div>
        </div>

        {/* Tableau épuré sans surcharge de badges */}
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">Chargement des opérations...</div>
        ) : transactions.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-bold text-slate-800">Aucune opération bancaire</p>
            <p className="text-xs text-slate-500 mt-1">
              Cliquez sur "Importer un relevé CSV" ci-dessus pour charger votre fichier.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50/50 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Libellé d'origine</th>
                  <th className="py-3 px-5">Catégorie</th>
                  <th className="py-3 px-5 text-right">Montant</th>
                  <th className="py-3 px-5">Affectation / Statut</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((tx) => {
                  const isCredit = tx.amount >= 0;
                  const associateMatch = associates.find(a => a.id === tx.associate_id);
                  const isClassified = tx.reconciliation_status === 'rapprochee';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Date */}
                      <td className="py-3.5 px-5 whitespace-nowrap text-slate-500 font-mono text-xs">
                        {new Date(tx.transaction_date).toLocaleDateString('fr-FR')}
                      </td>

                      {/* Libellé */}
                      <td className="py-3.5 px-5 max-w-sm md:max-w-md">
                        <p className="text-slate-900 font-medium text-xs leading-relaxed" title={tx.original_label}>
                          {tx.original_label}
                        </p>
                      </td>

                      {/* Catégorie */}
                      <td className="py-3.5 px-5 whitespace-nowrap text-xs">
                        {tx.category ? (
                          <span className="text-slate-700 font-medium bg-slate-100 px-2.5 py-1 rounded-md text-[11px]">
                            {tx.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Non catégorisé</span>
                        )}
                      </td>

                      {/* Montant (Texte épuré sans fond rose/vert) */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap font-mono font-extrabold text-sm">
                        <span className={isCredit ? 'text-emerald-600' : 'text-rose-600'}>
                          {isCredit ? `+${fmt(tx.amount)}` : fmt(tx.amount)}
                        </span>
                      </td>

                      {/* Affectation / Statut */}
                      <td className="py-3.5 px-5 whitespace-nowrap text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          {associateMatch && (
                            <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md font-bold text-[11px]">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                              {associateMatch.first_name} {associateMatch.last_name}
                            </span>
                          )}
                          {tx.budget_item_id && (
                            <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-semibold text-[10px]">
                              <span>{budgetItems.find((b) => b.id === tx.budget_item_id)?.icon || '⚡'}</span>
                              <span>{budgetItems.find((b) => b.id === tx.budget_item_id)?.name || 'Poste budgétaire'}</span>
                            </span>
                          )}
                          {!tx.category && !associateMatch && !tx.budget_item_id && (
                            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-bold">
                              À traiter
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-5 text-right whitespace-nowrap space-x-2">
                        {currentUser?.role === 'gerant' ? (
                          <>
                            <button
                              onClick={() => openReconcileModal(tx)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                isClassified
                                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                              }`}
                            >
                              {isClassified ? 'Modifier' : 'Classer'}
                            </button>
                            <button
                              onClick={() => handleDeleteTx(tx.id)}
                              className="p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Lecture seule</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Classement (Stripe style) */}
      {reconcilingTx && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-base text-slate-900">Classer l'opération</h3>
              <button
                onClick={() => setReconcilingTx(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="p-6 space-y-5">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-1.5 font-mono text-xs">
                  <span className="text-slate-500 font-medium">{new Date(reconcilingTx.transaction_date).toLocaleDateString('fr-FR')}</span>
                  <span className={`font-black text-sm ${reconcilingTx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {reconcilingTx.amount >= 0 ? `+${fmt(reconcilingTx.amount)}` : fmt(reconcilingTx.amount)}
                  </span>
                </div>
                <p className="text-slate-900 font-bold text-xs leading-relaxed">{reconcilingTx.original_label}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Type d'opération
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setReconcileForm(f => ({ ...f, associate_id: associates[0]?.id || 0, category: "Compte courant d'associé" }))}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                      reconcileForm.associate_id > 0
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Associé</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReconcileForm(f => ({ ...f, associate_id: 0, category: COMMON_CATEGORIES[0] }))}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                      reconcileForm.associate_id === 0
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Dépense / Recette</span>
                  </button>
                </div>
              </div>

              {reconcileForm.associate_id > 0 ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Sélectionner l'associé
                    </label>
                    <select
                      value={reconcileForm.associate_id}
                      onChange={(e) => setReconcileForm(f => ({ ...f, associate_id: Number(e.target.value) }))}
                      className="w-full bg-white text-slate-900 text-sm font-semibold rounded-xl px-3.5 py-2.5 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                    >
                      {associates.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.first_name} {a.last_name} ({a.shares} parts)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Type d'apport / versement
                    </label>
                    <select
                      value={reconcileForm.category}
                      onChange={(e) => setReconcileForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full bg-white text-slate-900 text-sm font-semibold rounded-xl px-3.5 py-2.5 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Compte courant d'associé">Compte courant d'associé</option>
                      <option value="Apport au capital">Apport au capital</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Catégorie
                  </label>
                  <select
                    value={reconcileForm.category}
                    onChange={(e) => setReconcileForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white text-slate-900 text-sm font-semibold rounded-xl px-3.5 py-2.5 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- Choisir une catégorie --</option>
                    {COMMON_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Poste budgétaire optionnel */}
              {budgetItems.length > 0 && reconcileForm.associate_id === 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Poste budgétaire (Optionnel)
                  </label>
                  <select
                    value={reconcileForm.budget_item_id}
                    onChange={(e) =>
                      setReconcileForm((f) => ({
                        ...f,
                        budget_item_id: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-white text-slate-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={0}>-- Aucun poste budgétaire rattaché --</option>
                    {budgetItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.icon} {it.name} ({fmt(it.forecast)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tiers (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Notaire, EDF..."
                    value={reconcileForm.third_party}
                    onChange={(e) => setReconcileForm(f => ({ ...f, third_party: e.target.value }))}
                    className="w-full bg-white text-slate-900 text-xs font-medium rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Note (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Achat maison..."
                    value={reconcileForm.notes}
                    onChange={(e) => setReconcileForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full bg-slate-50 text-slate-900 text-xs font-medium rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReconcilingTx(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-extrabold hover:bg-indigo-700 shadow-md transition-all"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
