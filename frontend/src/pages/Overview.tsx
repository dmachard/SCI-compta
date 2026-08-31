import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload,
  ArrowRight,
  Building2,
  Tag,
  Receipt,
  Users,
  CalendarCheck,
  CreditCard,
  CheckCheck,
  X,
  UserCheck
} from 'lucide-react';
import {
  bankApi,
  associatesApi,
  currentAccountsApi,
  fiscalYearsApi,
  budgetApi,
  documentsApi,
  sciApi
} from '../api';
import type {
  BankAccount,
  BankTransaction,
  Associate,
  CurrentAccountBalance,
  FiscalYear,
  BudgetSummary,
  FundCall,
  FundCallLine,
  DocumentItem,
  SCI
} from '../types';

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

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
    }).format(d);
  } catch {
    return iso;
  }
}

export default function Overview() {
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);

  // Données de la SCI
  const [sci, setSci] = useState<SCI | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [ccaBalances, setCcaBalances] = useState<CurrentAccountBalance[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null);
  const [fundCalls, setFundCalls] = useState<FundCall[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Modal de classement direct d'une opération
  const [reconcilingTx, setReconcilingTx] = useState<BankTransaction | null>(null);
  const [reconcileForm, setReconcileForm] = useState({
    associate_id: 0,
    category: '',
    third_party: '',
    notes: '',
  });
  const [savingReconcile, setSavingReconcile] = useState(false);

  // Modal de confirmation de réception de virement d'appel de fonds
  const [pointingLine, setPointingLine] = useState<{
    callId: number;
    callNumber: string;
    line: FundCallLine;
  } | null>(null);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [savingPayment, setSavingPayment] = useState(false);

  // Upload rapide de facture attaché à une dépense
  const [uploadingTxId, setUploadingTxId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedTxForUpload = useRef<BankTransaction | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const [
        sciRes,
        accountsRes,
        txsRes,
        assocsRes,
        ccaRes,
        fyRes,
        budgetRes,
        fundsRes,
        docsRes
      ] = await Promise.all([
        sciApi.get().catch(() => null),
        bankApi.getAccounts().catch(() => []),
        bankApi.getTransactions().catch(() => []),
        associatesApi.list().catch(() => []),
        currentAccountsApi.balances().catch(() => []),
        fiscalYearsApi.list().catch(() => []),
        budgetApi.getSummary(currentYear).catch(() => null),
        budgetApi.getFundCalls(currentYear).catch(() => []),
        documentsApi.list().catch(() => [])
      ]);

      setSci(sciRes);
      setBankAccounts(accountsRes);
      setTransactions(txsRes);
      setAssociates(assocsRes);
      setCcaBalances(ccaRes);
      setFiscalYears(fyRes);
      setBudgetSummary(budgetRes);
      setFundCalls(fundsRes);
      setDocuments(docsRes);
    } catch (e) {
      console.error('Erreur chargement données:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. Liste précise des opérations bancaires à catégoriser
  const txsToReconcile = useMemo(() => {
    return transactions.filter(
      (tx) => tx.reconciliation_status === 'a_traiter' || !tx.category
    );
  }, [transactions]);

  // 2. Liste précise des dépenses sans facture/justificatif
  const expensesMissingDocs = useMemo(() => {
    const docTxIds = new Set(
      documents.filter((d) => d.bank_transaction_id).map((d) => d.bank_transaction_id)
    );
    return transactions.filter((tx) => Number(tx.amount) < 0 && !docTxIds.has(tx.id));
  }, [transactions, documents]);

  // 3. Liste des virements d'appels de fonds attendus par associé
  const unpaidFundCallLines = useMemo(() => {
    const lines: Array<{
      callId: number;
      callNumber: string;
      line: FundCallLine;
    }> = [];

    for (const call of fundCalls) {
      if (call.lines) {
        for (const line of call.lines) {
          if (!line.is_paid) {
            lines.push({
              callId: call.id,
              callNumber: call.call_number || 'Appel de fonds',
              line,
            });
          }
        }
      }
    }
    return lines;
  }, [fundCalls]);

  // 4. Liste des comptes courants d'associés débiteurs
  const negativeCcaList = useMemo(() => {
    return ccaBalances.filter((c) => Number(c.balance) < 0);
  }, [ccaBalances]);

  // 5. Autres actions globales (configuration SCI, associés, clôture d'exercice, budget...)
  const globalActions = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      desc: string;
      url: string;
      btn: string;
    }> = [];

    // Configuration légale de la SCI incomplète
    if (sci && (!sci.siren || !sci.address)) {
      list.push({
        id: 'global-sci-config',
        title: 'Compléter la configuration de la SCI (SIREN, adresse)',
        desc: 'Renseignez les informations légales et l’adresse du siège.',
        url: '/sci',
        btn: 'Configurer la SCI',
      });
    }

    // Aucun associé enregistré
    if (associates.length === 0) {
      list.push({
        id: 'global-associates-needed',
        title: 'Enregistrer les associés de la SCI',
        desc: 'Déclarez les associés et la répartition des parts du capital.',
        url: '/associes',
        btn: 'Ajouter les associés',
      });
    }

    // Aucun exercice comptable pour l'année en cours
    const currentFy = fiscalYears.find((fy) =>
      fy.label.includes(String(currentYear)) ||
      (fy.start_date && fy.start_date.startsWith(String(currentYear)))
    );
    if (!currentFy) {
      list.push({
        id: 'global-fy-needed',
        title: `Ouvrir l'exercice comptable de l'année ${currentYear}`,
        desc: `Créez l’exercice ${currentYear} pour enregistrer les opérations de cette année.`,
        url: '/exercices',
        btn: 'Créer l’exercice',
      });
    }

    // Aucun compte bancaire configuré
    if (bankAccounts.length === 0) {
      list.push({
        id: 'global-no-account',
        title: 'Ajouter le compte bancaire de la SCI',
        desc: 'Indiquez le compte bancaire pour démarrer le suivi.',
        url: '/banque',
        btn: 'Ajouter le compte',
      });
    } else if (transactions.length === 0) {
      list.push({
        id: 'global-import-first',
        title: 'Importer votre premier relevé bancaire (CSV)',
        desc: 'Téléversez le relevé de votre banque.',
        url: '/banque',
        btn: 'Importer relevé',
      });
    } else {
      const sorted = [...transactions].sort(
        (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
      );
      const lastDate = new Date(sorted[0].transaction_date);
      const diffDays = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 3600 * 24));
      if (diffDays > 30) {
        list.push({
          id: 'global-import-recent',
          title: `Mettre à jour le relevé bancaire (dernier mouvement il y a ${diffDays} jours)`,
          desc: 'Intégrez les dernières lignes bancaires.',
          url: '/banque',
          btn: 'Importer relevé',
        });
      }
    }

    // Budget prévisionnel de l'année en cours non créé
    if (!budgetSummary || !budgetSummary.items || budgetSummary.items.length === 0) {
      list.push({
        id: 'global-budget-needed',
        title: `Établir le budget prévisionnel de l'année ${currentYear}`,
        desc: 'Prévoyez les dépenses de l’année pour calculer les quotes-parts.',
        url: '/budget',
        btn: 'Créer le budget',
      });
    } else if (fundCalls.length === 0) {
      list.push({
        id: 'global-fundcall-needed',
        title: `Lancer l'appel de fonds pour l'année ${currentYear}`,
        desc: 'Un budget est configuré mais aucun appel de fonds n’a encore été émis.',
        url: '/budget',
        btn: 'Faire l’appel',
      });
    }

    // Clôture des exercices passés et bilan d'AG
    const pastOpenFys = fiscalYears.filter((fy) =>
      fy.status !== 'clos' && (
        (fy.end_date && new Date(fy.end_date) < new Date()) ||
        (fy.label && parseInt(fy.label.match(/\d{4}/)?.[0] || '9999') < currentYear)
      )
    );
    for (const pastFy of pastOpenFys) {
      list.push({
        id: `global-close-fy-${pastFy.id}`,
        title: `Faire le bilan d'AG et clôturer l'exercice ${pastFy.label}`,
        desc: 'L’exercice est terminé : préparez les comptes annuels et le procès-verbal d’Assemblée Générale.',
        url: '/exercices',
        btn: 'Faire le bilan',
      });
    }

    return list;
  }, [sci, associates, bankAccounts, transactions, budgetSummary, fundCalls, fiscalYears, currentYear]);

  // Ouverture de la modale de classement direct pour une opération
  const openReconcileModal = (tx: BankTransaction) => {
    setReconcilingTx(tx);

    const labelLower = (tx.original_label || '').toLowerCase();
    const matchedAssoc = associates.find(
      (a) =>
        labelLower.includes(a.first_name.toLowerCase()) ||
        labelLower.includes(a.last_name.toLowerCase())
    );

    const isAssociateKeyword =
      labelLower.includes('apport') ||
      labelLower.includes('appel') ||
      labelLower.includes('compte courant') ||
      labelLower.includes('virement en votre faveur');

    const defaultAssocId = matchedAssoc ? matchedAssoc.id : (isAssociateKeyword && associates.length > 0 ? associates[0].id : 0);

    setReconcileForm({
      associate_id: defaultAssocId,
      category: defaultAssocId > 0 ? "Compte courant d'associé" : (COMMON_CATEGORIES[0] || ''),
      third_party: tx.third_party || tx.original_label,
      notes: tx.notes || '',
    });
  };

  // Validation du classement direct -> valide et supprime automatiquement de la liste
  const handleSaveReconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reconcilingTx) return;

    setSavingReconcile(true);
    try {
      const isAssoc = reconcileForm.associate_id > 0;
      await bankApi.reconcileTransaction(reconcilingTx.id, {
        category: reconcileForm.category,
        associate_id: isAssoc ? reconcileForm.associate_id : null,
        movement_type: isAssoc ? 'versement' : (Number(reconcilingTx.amount) >= 0 ? 'recette' : 'depense'),
        third_party: isAssoc
          ? associates.find((a) => a.id === reconcileForm.associate_id)?.last_name || reconcilingTx.third_party
          : reconcileForm.third_party,
        notes: reconcileForm.notes,
        reconciliation_status: 'categorisee',
      });

      setReconcilingTx(null);
      await loadData(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors du classement de l’opération');
    } finally {
      setSavingReconcile(false);
    }
  };

  // Ouverture de la modale de confirmation de virement
  const openPointingModal = (item: { callId: number; callNumber: string; line: FundCallLine }) => {
    setPointingLine(item);
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentAmount(item.line.amount_due - (item.line.amount_paid || 0));
  };

  // Validation de la réception -> valide et supprime automatiquement de la liste
  const handleSavePointing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pointingLine) return;

    setSavingPayment(true);
    try {
      await budgetApi.updateFundCallLine(pointingLine.callId, pointingLine.line.id, {
        is_paid: true,
        amount_paid: Number(paymentAmount),
        payment_date: paymentDate,
      });

      setPointingLine(null);
      await loadData(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la validation du règlement');
    } finally {
      setSavingPayment(false);
    }
  };

  // Upload direct d'une facture -> rattache et supprime automatiquement de la liste
  const handleDirectUploadClick = (tx: BankTransaction) => {
    selectedTxForUpload.current = tx;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const tx = selectedTxForUpload.current;
    if (!file || !tx) return;

    setUploadingTxId(tx.id);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', 'facture');
      formData.append('folder_year', String(new Date(tx.transaction_date).getFullYear()));
      formData.append('supplier', tx.third_party || tx.original_label);
      formData.append('amount_ttc', String(Math.abs(Number(tx.amount))));
      formData.append('document_date', tx.transaction_date);
      formData.append('bank_transaction_id', String(tx.id));
      if (tx.category) {
        formData.append('category', tx.category);
      }

      await documentsApi.upload(formData);
      await loadData(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de l'envoi de la facture");
    } finally {
      setUploadingTxId(null);
      selectedTxForUpload.current = null;
    }
  };

  const totalPending =
    txsToReconcile.length +
    expensesMissingDocs.length +
    unpaidFundCallLines.length +
    negativeCcaList.length +
    globalActions.length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-8 animate-fade-in">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
      />

      {/* En-tête épuré */}
      <div className="pb-6 border-b border-border">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Ce qui est à faire
        </h1>
        <p className="text-sm text-slate-500 mt-1.5">
          {totalPending === 0
            ? 'Toutes les écritures et formalités sont à jour.'
            : `${totalPending} action${totalPending > 1 ? 's' : ''} à faire. Cliquez sur le bouton d'une ligne pour la régler directement.`}
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm font-medium">Analyse des écritures en cours...</p>
        </div>
      ) : totalPending === 0 ? (
        <div className="p-10 text-center bg-white border border-emerald-200 rounded-3xl shadow-xs space-y-3">
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs">
            <CheckCheck className="w-7 h-7 stroke-[2.5]" />
          </div>
          <h2 className="text-lg font-black text-slate-900">
            Rien à faire, tout est à jour !
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
            Vos opérations sont classées, vos justificatifs sont attachés et vos virements sont validés.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. OPÉRATIONS BANCAIRES À CATÉGORISER (LIGNE PAR LIGNE) */}
          {txsToReconcile.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Tag className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                    Opérations bancaires à catégoriser
                  </h2>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {txsToReconcile.length}
                  </span>
                </div>

                <Link
                  to="/banque"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  <span>Ouvrir la banque</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden divide-y divide-slate-100">
                {txsToReconcile.map((tx) => {
                  const isCredit = Number(tx.amount) > 0;

                  return (
                    <div
                      key={tx.id}
                      className="group flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50/80 transition-colors"
                    >
                      <span className="text-xs font-bold text-slate-400 w-14 shrink-0">
                        {formatDate(tx.transaction_date)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate" title={tx.original_label}>
                          {tx.third_party || tx.original_label}
                        </p>
                      </div>

                      <span
                        className={`text-sm font-black tabular-nums shrink-0 px-2.5 py-0.5 rounded-lg ${
                          isCredit ? 'text-emerald-700 bg-emerald-50/60' : 'text-slate-800 bg-slate-50'
                        }`}
                      >
                        {isCredit ? `+${fmt(Number(tx.amount))}` : fmt(Number(tx.amount))}
                      </span>

                      <button
                        type="button"
                        onClick={() => openReconcileModal(tx)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-lg transition-all shrink-0 cursor-pointer shadow-2xs"
                      >
                        <span>Catégoriser</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. VIREMENTS D'APPELS DE FONDS ATTENDUS (LIGNE PAR LIGNE PAR ASSOCIÉ) */}
          {unpaidFundCallLines.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                    Virements d'associés attendus (appels de fonds)
                  </h2>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {unpaidFundCallLines.length}
                  </span>
                </div>

                <Link
                  to="/budget"
                  className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 transition-colors"
                >
                  <span>Voir le budget</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden divide-y divide-slate-100">
                {unpaidFundCallLines.map(({ callId, callNumber, line }) => {
                  const remaining = line.amount_due - (line.amount_paid || 0);

                  return (
                    <div
                      key={`fundcall-${callId}-${line.id}`}
                      className="group flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50/80 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {line.associate_name}
                          </p>
                          <span className="text-[11px] font-semibold text-slate-400">
                            ({callNumber})
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Quote-part appelée : {fmt(line.amount_due)}
                        </p>
                      </div>

                      <span className="text-sm font-black text-amber-700 tabular-nums shrink-0 px-2.5 py-0.5 rounded-lg bg-amber-50/60">
                        {fmt(remaining)}
                      </span>

                      <button
                        type="button"
                        onClick={() => openPointingModal({ callId, callNumber, line })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-600 hover:text-white rounded-lg transition-all shrink-0 cursor-pointer shadow-2xs"
                      >
                        <span>Marquer comme reçu</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. JUSTIFICATIFS / FACTURES MANQUANTES (LIGNE PAR LIGNE) */}
          {expensesMissingDocs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                    Factures / Justificatifs à ajouter
                  </h2>
                  <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    {expensesMissingDocs.length}
                  </span>
                </div>

                <Link
                  to="/documents"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                >
                  <span>Tous les documents</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden divide-y divide-slate-100">
                {expensesMissingDocs.map((tx) => {
                  const isUploading = uploadingTxId === tx.id;

                  return (
                    <div
                      key={tx.id}
                      className="group flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50/80 transition-colors"
                    >
                      <span className="text-xs font-bold text-slate-400 w-14 shrink-0">
                        {formatDate(tx.transaction_date)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate" title={tx.original_label}>
                          Facture pour <span className="font-bold text-slate-900">{tx.third_party || tx.original_label}</span>
                        </p>
                      </div>

                      <span className="text-sm font-black text-slate-800 tabular-nums shrink-0 px-2.5 py-0.5 rounded-lg bg-slate-50">
                        {fmt(Math.abs(Number(tx.amount)))}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleDirectUploadClick(tx)}
                        disabled={isUploading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-lg transition-all shrink-0 cursor-pointer disabled:opacity-50 shadow-2xs"
                        title="Sélectionner le PDF de la facture"
                      >
                        {isUploading ? (
                          <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{isUploading ? 'Envoi...' : 'Joindre PDF'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. COMPTES COURANTS DÉBITEURS (LIGNE PAR LIGNE PAR ASSOCIÉ) */}
          {negativeCcaList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Comptes courants débiteurs à régulariser
                </h2>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                  {negativeCcaList.length}
                </span>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden divide-y divide-slate-100">
                {negativeCcaList.map((c) => (
                  <div
                    key={`cca-${c.associate_id}`}
                    className="group flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="text-xs text-rose-600 mt-0.5">
                        En SCI, un compte courant d'associé ne doit pas être négatif.
                      </p>
                    </div>

                    <span className="text-sm font-black text-rose-600 tabular-nums shrink-0 px-2.5 py-0.5 rounded-lg bg-rose-50">
                      {fmt(Number(c.balance))}
                    </span>

                    <Link
                      to={`/associes/${c.associate_id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-lg transition-all shrink-0 shadow-2xs"
                    >
                      <span>Voir associé</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. AUTRES ACTIONS PONCTUELLES (BILAN D'AG, BUDGET...) */}
          {globalActions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 px-1">
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Formalités annuelles
                </h2>
              </div>

              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden divide-y divide-slate-100">
                {globalActions.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3.5 px-4 py-3.5 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed truncate">
                        {item.desc}
                      </p>
                    </div>

                    <Link
                      to={item.url}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-600 hover:text-white rounded-lg transition-all shrink-0 shadow-2xs"
                    >
                      <span>{item.btn}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL DIRECTE DE CLASSEMENT D'OPÉRATION ─── */}
      {reconcilingTx && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-base text-slate-900">
                Classer l'opération
              </h3>
              <button
                onClick={() => setReconcilingTx(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReconcile} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between mb-1 text-xs">
                  <span className="text-slate-500 font-medium">{formatDate(reconcilingTx.transaction_date)}</span>
                  <span className={`font-black text-sm ${Number(reconcilingTx.amount) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {Number(reconcilingTx.amount) >= 0 ? `+${fmt(Number(reconcilingTx.amount))}` : fmt(Number(reconcilingTx.amount))}
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
                    onClick={() =>
                      setReconcileForm((f) => ({
                        ...f,
                        associate_id: associates[0]?.id || 1,
                        category: "Compte courant d'associé",
                      }))
                    }
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      reconcileForm.associate_id > 0
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Associé</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setReconcileForm((f) => ({
                        ...f,
                        associate_id: 0,
                        category: COMMON_CATEGORIES[0],
                      }))
                    }
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      reconcileForm.associate_id === 0
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Charge / Recette</span>
                  </button>
                </div>
              </div>

              {reconcileForm.associate_id > 0 ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sélectionner l'associé
                    </label>
                    <select
                      value={reconcileForm.associate_id}
                      onChange={(e) => setReconcileForm((f) => ({ ...f, associate_id: Number(e.target.value) }))}
                      className="w-full bg-white text-slate-900 text-sm font-semibold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                    >
                      {associates.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.first_name} {a.last_name} ({a.shares} parts)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Affectation
                    </label>
                    <select
                      value={reconcileForm.category}
                      onChange={(e) => setReconcileForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full bg-white text-slate-900 text-sm font-semibold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Compte courant d'associé">Compte courant d'associé</option>
                      <option value="Apport au capital">Apport au capital</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={reconcileForm.category}
                    onChange={(e) => setReconcileForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full bg-white text-slate-900 text-sm font-semibold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  >
                    {COMMON_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReconcilingTx(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingReconcile}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingReconcile ? 'Enregistrement...' : 'Valider le classement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DIRECTE DE POINTAGE D'APPEL DE FONDS ─── */}
      {pointingLine && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-base text-slate-900">
                Confirmer la réception du paiement
              </h3>
              <button
                onClick={() => setPointingLine(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePointing} className="p-6 space-y-4">
              <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-200/70">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  {pointingLine.callNumber}
                </p>
                <h4 className="text-sm font-black text-slate-900 mt-1">
                  Associé : {pointingLine.line.associate_name}
                </h4>
                <p className="text-xs text-slate-600 mt-1">
                  Montant dû : <strong className="text-slate-900">{fmt(pointingLine.line.amount_due)}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Montant encaissé (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full bg-white text-slate-900 text-sm font-bold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Date de réception du virement
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-white text-slate-900 text-sm font-semibold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPointingLine(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingPayment ? 'Validation...' : 'Confirmer la réception'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
