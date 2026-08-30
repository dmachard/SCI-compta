import React, { useEffect, useState } from 'react';
import {
  PiggyBank,
  Plus,
  Calendar,
  DollarSign,
  TrendingDown,
  TrendingUp,
  FileText,
  CheckCircle2,
  Clock,
  Trash2,
  Edit2,
  Copy,
  ChevronDown,
  AlertCircle,
  Eye,
  X,
  Building,
  Check,
} from 'lucide-react';
import { budgetApi, bankApi, sciApi, authApi, associatesApi } from '../api';
import type {
  BudgetSummary,
  BudgetTableItem,
  BudgetItem,
  FundCall,
  SCI,
  BankAccount,
  User,
  Associate,
} from '../types';
import FundCallPdfView from '../components/FundCallPdfView';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const COMMON_ICONS = ['⚡', '💧', '🏠', '🏡', '🛡️', '🌐', '🏦', '🔧', '🌱', '🧹', '📦'];

export default function BudgetPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [years, setYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'budget' | 'fund_calls' | 'items'>('budget');
  const [loading, setLoading] = useState(true);

  // Données
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [fundCalls, setFundCalls] = useState<FundCall[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [sci, setSci] = useState<SCI | null>(null);
  const [primaryAccount, setPrimaryAccount] = useState<BankAccount | null>(null);

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | BudgetTableItem | null>(null);
  const [showFundCallModal, setShowFundCallModal] = useState(false);
  const [showNewYearModal, setShowNewYearModal] = useState(false);
  const [pdfFundCall, setPdfFundCall] = useState<FundCall | null>(null);
  const [selectedFundCallDetail, setSelectedFundCallDetail] = useState<FundCall | null>(null);

  // Formulaires
  const [expenseForm, setExpenseForm] = useState({
    label: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    budget_item_id: 0,
    third_party: '',
    notes: '',
  });

  const [itemForm, setItemForm] = useState({
    name: '',
    icon: '⚡',
    supplier: '',
    amount: '',
    periodicity: 'annuelle',
  });

  const [fundCallForm, setFundCallForm] = useState({
    call_number: '',
    call_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    purpose: 'Financement des charges et dépenses courantes de la SCI',
    selected_item_ids: [] as number[],
  });

  const [newYearForm, setNewYearForm] = useState({
    year: new Date().getFullYear() + 1,
    copy_from_previous: true,
  });

  // Chargement initial
  useEffect(() => {
    loadInitialData();
  }, []);

  // Rechargement lors du changement d'année
  useEffect(() => {
    if (selectedYear) {
      loadYearData(selectedYear);
    }
  }, [selectedYear]);

  async function loadInitialData() {
    try {
      setLoading(true);
      const [yearList, me, sciData, accounts, assocs] = await Promise.all([
        budgetApi.getYears(),
        authApi.me().catch(() => null),
        sciApi.get().catch(() => null),
        bankApi.getAccounts().catch(() => []),
        associatesApi.list().catch(() => []),
      ]);

      setYears(yearList);
      setCurrentUser(me);
      setSci(sciData);
      setAssociates(assocs);
      if (accounts && accounts.length > 0) {
        setPrimaryAccount(accounts[0]);
      }

      const activeY = yearList.includes(selectedYear) ? selectedYear : yearList[0] || new Date().getFullYear();
      setSelectedYear(activeY);
      await loadYearData(activeY);
    } catch (err) {
      console.error('Erreur chargement données budget', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadYearData(year: number) {
    try {
      const [sum, calls] = await Promise.all([
        budgetApi.getSummary(year),
        budgetApi.getFundCalls(year),
      ]);
      setSummary(sum);
      setFundCalls(calls);
    } catch (err) {
      console.error('Erreur chargement année', err);
    }
  }

  const isManager = currentUser?.role === 'gerant';

  // Actions Dépense
  async function handleCreateExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expenseForm.budget_item_id || !expenseForm.amount) {
      alert('Veuillez sélectionner un poste budgétaire et saisir un montant');
      return;
    }
    try {
      await budgetApi.createExpense({
        label: expenseForm.label,
        amount: parseFloat(expenseForm.amount),
        date: expenseForm.date,
        budget_item_id: Number(expenseForm.budget_item_id),
        third_party: expenseForm.third_party,
        notes: expenseForm.notes,
      });
      setShowExpenseModal(false);
      setExpenseForm({
        label: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        budget_item_id: 0,
        third_party: '',
        notes: '',
      });
      loadYearData(selectedYear);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la création de la dépense');
    }
  }

  // Actions Poste budgétaire
  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemForm.name || !itemForm.amount) {
      alert('Veuillez renseigner le nom et le montant');
      return;
    }
    try {
      if (editingItem) {
        await budgetApi.updateItem(editingItem.id, {
          name: itemForm.name,
          icon: itemForm.icon,
          supplier: itemForm.supplier,
          amount: parseFloat(itemForm.amount),
          periodicity: itemForm.periodicity,
        });
      } else {
        await budgetApi.createItem(selectedYear, {
          name: itemForm.name,
          icon: itemForm.icon,
          supplier: itemForm.supplier,
          amount: parseFloat(itemForm.amount),
          periodicity: itemForm.periodicity,
        });
      }
      setShowItemModal(false);
      setEditingItem(null);
      setItemForm({
        name: '',
        icon: '⚡',
        supplier: '',
        amount: '',
        periodicity: 'annuelle',
      });
      loadYearData(selectedYear);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de l'enregistrement du poste");
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (!confirm('Supprimer ce poste budgétaire ? Les dépenses associées seront conservées mais détachées.')) {
      return;
    }
    try {
      await budgetApi.deleteItem(itemId);
      loadYearData(selectedYear);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la suppression');
    }
  }

  // Actions Appel de fonds
  function openNewFundCallModal() {
    // Par défaut, cocher tous les postes
    const allIds = summary ? summary.items.map((i) => i.id) : [];
    setFundCallForm({
      call_number: `N° ${selectedYear}-${String(fundCalls.length + 1).padStart(3, '0')}`,
      call_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      purpose: 'Financement des charges et dépenses courantes de la SCI',
      selected_item_ids: allIds,
    });
    setShowFundCallModal(true);
  }

  async function handleCreateFundCall(e: React.FormEvent) {
    e.preventDefault();
    if (fundCallForm.selected_item_ids.length === 0) {
      alert('Veuillez sélectionner au moins un poste budgétaire à financer');
      return;
    }
    try {
      const created = await budgetApi.createFundCall({
        year: selectedYear,
        call_number: fundCallForm.call_number,
        call_date: fundCallForm.call_date,
        due_date: fundCallForm.due_date,
        purpose: fundCallForm.purpose,
        selected_item_ids: fundCallForm.selected_item_ids,
      });
      setShowFundCallModal(false);
      await loadYearData(selectedYear);
      setPdfFundCall(created);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de la création de l'appel de fonds");
    }
  }

  async function handleToggleLinePayment(callId: number, lineId: number, currentPaid: boolean) {
    try {
      const updated = await budgetApi.updateFundCallLine(callId, lineId, {
        is_paid: !currentPaid,
      });
      setFundCalls((prev) => prev.map((c) => (c.id === callId ? updated : c)));
      if (selectedFundCallDetail && selectedFundCallDetail.id === callId) {
        setSelectedFundCallDetail(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la mise à jour du statut');
    }
  }

  async function handleDeleteFundCall(callId: number) {
    if (!confirm("Supprimer cet appel de fonds et l'historique de répartition associé ?")) {
      return;
    }
    try {
      await budgetApi.deleteFundCall(callId);
      if (selectedFundCallDetail && selectedFundCallDetail.id === callId) {
        setSelectedFundCallDetail(null);
      }
      loadYearData(selectedYear);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de la suppression de l'appel");
    }
  }

  // Création / Copie d'année
  async function handleCreateNewYear(e: React.FormEvent) {
    e.preventDefault();
    const y = Number(newYearForm.year);
    if (!y || y < 2000 || y > 2100) {
      alert('Veuillez saisir une année valide');
      return;
    }
    try {
      await budgetApi.createOrCopy(y, {
        copy_from_year: newYearForm.copy_from_previous ? selectedYear : undefined,
      });
      setShowNewYearModal(false);
      const newYears = Array.from(new Set([...years, y])).sort((a, b) => b - a);
      setYears(newYears);
      setSelectedYear(y);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de la création de l'année");
    }
  }

  // Calcul du montant total sélectionné dans la modale d'appel de fonds
  const selectedItemsTotal = summary
    ? summary.items
        .filter((it) => fundCallForm.selected_item_ids.includes(it.id))
        .reduce((acc, it) => acc + it.forecast, 0)
    : 0;

  const totalShares = associates.reduce((sum, a) => sum + (a.shares || 0), 0) || 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* ─── EN-TÊTE PRINCIPAL & SÉLECTEUR D'ANNÉE ──────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <PiggyBank className="w-7 h-7" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Budget {selectedYear}
              </h1>
              <div className="relative inline-block">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  aria-label="Sélectionner l'année budgétaire"
                  className="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold px-3 py-1.5 pr-7 rounded-xl border-none cursor-pointer focus:ring-2 focus:ring-indigo-500 transition-colors"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-2.5 pointer-events-none" />
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Prévisions des dépenses, suivi du réel et appels de fonds aux associés
            </p>
          </div>
        </div>

        {/* Actions d'en-tête */}
        {isManager && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowNewYearModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>Autre année / Copier</span>
            </button>

            <button
              onClick={() => {
                if (summary && summary.items.length > 0) {
                  setExpenseForm((f) => ({ ...f, budget_item_id: summary.items[0].id }));
                }
                setShowExpenseModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle dépense</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── ONGLETS DU MODULE ────────────────────────────────────────── */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('budget')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'budget'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>📊</span>
          <span>Budget {selectedYear}</span>
        </button>

        <button
          onClick={() => setActiveTab('fund_calls')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'fund_calls'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>💰</span>
          <span>Appels de fonds</span>
          {fundCalls.length > 0 && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'fund_calls' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {fundCalls.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'items'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>⚙️</span>
          <span>Postes ({summary?.items.length || 0})</span>
        </button>
      </div>

      {/* ─── ONGLET 1 : 📊 BUDGET (SYNTHÈSE ET COMPARAISON RÉEL) ────────── */}
      {activeTab === 'budget' && summary && (
        <div className="space-y-6 animate-fade-in">
          {summary.items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
              <span className="text-4xl block mb-3">⚙️</span>
              <p className="text-base font-bold text-slate-800">
                Aucun poste budgétaire configuré pour {selectedYear}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Commencez par ajouter vos postes de dépenses prévisionnelles dans l'onglet ⚙️ Postes ou copiez le budget d'une année précédente.
              </p>
              {isManager && (
                <div className="mt-5 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setItemForm({
                        name: '',
                        icon: '⚡',
                        supplier: '',
                        amount: '',
                        periodicity: 'annuelle',
                      });
                      setShowItemModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un premier poste</span>
                  </button>
                  <button
                    onClick={() => setShowNewYearModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copier d'une autre année</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Cartes métriques récapitulatives */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Total Prévisionnel
                  </span>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {fmt(summary.total_forecast)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Budget annuel voté</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Total Réel Dépensé
                  </span>
                  <div className="text-2xl font-black text-indigo-600 font-mono">
                    {fmt(summary.total_real)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">Calculé depuis la banque</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Écart (Réel - Prévision)
                  </span>
                  <div
                    className={`text-2xl font-black font-mono flex items-center gap-1.5 ${
                      summary.total_variance <= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {summary.total_variance <= 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                    <span>
                      {summary.total_variance > 0 ? `+${fmt(summary.total_variance)}` : fmt(summary.total_variance)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    {summary.total_variance <= 0 ? 'Sous le budget prévisionnel' : 'Dépassement de budget'}
                  </p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                    Consommation
                  </span>
                  <div className="text-2xl font-black text-slate-900 font-mono">
                    {summary.consumption_rate} %
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mt-2.5 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        summary.consumption_rate > 100
                          ? 'bg-rose-500'
                          : summary.consumption_rate > 80
                          ? 'bg-amber-500'
                          : 'bg-indigo-600'
                      }`}
                      style={{ width: `${Math.min(summary.consumption_rate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tableau synthétique dynamique */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Comparatif Prévisionnel vs Réel
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Les montants réels sont automatiquement mis à jour à chaque facture ou opération bancaire rattachée.
                    </p>
                  </div>
                  {isManager && (
                    <button
                      onClick={openNewFundCallModal}
                      className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
                    >
                      <span>💰</span>
                      <span>Préparer un appel de fonds</span>
                    </button>
                  )}
                </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-6">Poste de dépense</th>
                    <th className="py-3.5 px-4 text-center">Périodicité</th>
                    <th className="py-3.5 px-6 text-right">Prévision</th>
                    <th className="py-3.5 px-6 text-right">Réel</th>
                    <th className="py-3.5 px-6 text-right">Écart</th>
                    <th className="py-3.5 px-6 text-right w-40">Consommation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.items.map((item) => {
                    const isOver = item.variance > 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <span className="text-xl p-1.5 bg-slate-100 rounded-xl">{item.icon}</span>
                            <div>
                              <div className="font-extrabold text-slate-900 text-sm">{item.name}</div>
                              {item.supplier && (
                                <div className="text-xs text-slate-500 font-medium">{item.supplier}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 capitalize">
                            {item.periodicity}
                          </span>
                        </td>

                        <td className="py-4 px-6 text-right font-mono font-bold text-slate-800">
                          {fmt(item.forecast)}
                        </td>

                        <td className="py-4 px-6 text-right font-mono font-extrabold text-indigo-600">
                          {fmt(item.real)}
                        </td>

                        <td className="py-4 px-6 text-right font-mono font-extrabold">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs ${
                              isOver
                                ? 'bg-rose-50 text-rose-700 font-bold'
                                : 'bg-emerald-50 text-emerald-700 font-bold'
                            }`}
                          >
                            {item.variance > 0 ? `+${fmt(item.variance)}` : fmt(item.variance)}
                          </span>
                        </td>

                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${
                                  item.consumption_rate > 100
                                    ? 'bg-rose-500'
                                    : item.consumption_rate > 80
                                    ? 'bg-amber-500'
                                    : 'bg-indigo-600'
                                }`}
                                style={{ width: `${Math.min(item.consumption_rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-600 w-10 text-right">
                              {item.consumption_rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Ligne Total */}
                  <tr className="bg-slate-50 font-black text-slate-900 border-t-2 border-slate-200">
                    <td className="py-4 px-6 uppercase text-xs tracking-wider" colSpan={2}>
                      Total Budget {selectedYear}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-sm">
                      {fmt(summary.total_forecast)}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-sm text-indigo-700">
                      {fmt(summary.total_real)}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-sm">
                      <span
                        className={
                          summary.total_variance <= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }
                      >
                        {summary.total_variance > 0
                          ? `+${fmt(summary.total_variance)}`
                          : fmt(summary.total_variance)}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-xs text-slate-700">
                      {summary.consumption_rate} %
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )}

      {/* ─── ONGLET 2 : 💰 APPELS DE FONDS ────────────────────────────── */}
      {activeTab === 'fund_calls' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header onglet */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Appels de fonds de l'exercice {selectedYear}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Demandes de versement aux associés pour financer la trésorerie et les postes budgétaires.
              </p>
            </div>
            {isManager && (
              <button
                onClick={openNewFundCallModal}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Nouvel appel de fonds</span>
              </button>
            )}
          </div>

          {/* Liste des appels de fonds */}
          {fundCalls.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {fundCalls.map((call) => {
                const isSolde = call.status === 'solde';
                const isPartiel = call.status === 'partiel';
                const paidCount = call.lines.filter((l) => l.is_paid).length;
                const totalLines = call.lines.length;

                return (
                  <div
                    key={call.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-xs font-black font-mono text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                            {call.call_number}
                          </span>
                          <span className="text-xs text-slate-400 ml-2 font-medium">
                            {new Date(call.call_date).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            isSolde
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isPartiel
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {isSolde ? '🟢 Soldé' : isPartiel ? '🟡 Partiel' : '🟠 En attente'}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm mb-2 line-clamp-2">
                        {call.purpose}
                      </h3>

                      {/* Métriques */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 my-3 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Montant total appelé :</span>
                          <span className="font-mono font-black text-slate-900">
                            {fmt(call.total_amount)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500 font-medium">Reçu des associés :</span>
                          <span className="font-mono font-extrabold text-emerald-600">
                            {fmt(call.amount_paid)}
                          </span>
                        </div>
                        {call.amount_remaining > 0 && (
                          <div className="flex justify-between border-t border-slate-200 pt-1 text-rose-600">
                            <span className="font-medium">Reste à encaisser :</span>
                            <span className="font-mono font-bold">
                              {fmt(call.amount_remaining)}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Postes budgétaires concernés */}
                      <div className="mb-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                          Postes financés ({call.budget_items.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {call.budget_items.map((bi) => (
                            <span
                              key={bi.id}
                              className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                            >
                              {bi.icon} {bi.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Avancement associés */}
                      <div className="text-xs text-slate-600 font-medium flex items-center justify-between border-t border-slate-100 pt-3">
                        <span>Associés ayant réglé :</span>
                        <span className="font-bold text-slate-900">
                          {paidCount} / {totalLines}
                        </span>
                      </div>
                    </div>

                    {/* Actions de la carte */}
                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedFundCallDetail(call)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Suivi / Rapprocher</span>
                      </button>

                      <button
                        onClick={() => setPdfFundCall(call)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Générer PDF</span>
                      </button>

                      {isManager && (
                        <button
                          onClick={() => handleDeleteFundCall(call.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Supprimer l'appel de fonds"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
              <span className="text-4xl block mb-3">💰</span>
              <p className="text-base font-bold text-slate-800">
                Aucun appel de fonds pour l'année {selectedYear}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Créez un appel de fonds en sélectionnant les postes du budget à financer (EDF, Eau, Taxes, etc.). La répartition sera calculée automatiquement selon les parts de chaque associé.
              </p>
              {isManager && (
                <button
                  onClick={openNewFundCallModal}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer le premier appel de fonds</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── ONGLET 3 : ⚙️ POSTES BUDGÉTAIRES ──────────────────────────── */}
      {activeTab === 'items' && summary && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Postes de dépenses configurés pour {selectedYear}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Définissez les charges prévisionnelles de la SCI (montant annuel, périodicité, fournisseur).
              </p>
            </div>
            {isManager && (
              <button
                onClick={() => {
                  setEditingItem(null);
                  setItemForm({
                    name: '',
                    icon: '⚡',
                    supplier: '',
                    amount: '',
                    periodicity: 'annuelle',
                  });
                  setShowItemModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau poste</span>
              </button>
            )}
          </div>

          {summary.items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
              <span className="text-4xl block mb-3">⚡</span>
              <p className="text-base font-bold text-slate-800">
                Aucun poste budgétaire pour l'année {selectedYear}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Ajoutez vos postes de dépenses (électricité, eau, assurances, taxes...) pour définir votre budget prévisionnel.
              </p>
              {isManager && (
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setItemForm({
                      name: '',
                      icon: '⚡',
                      supplier: '',
                      amount: '',
                      periodicity: 'annuelle',
                    });
                    setShowItemModal(true);
                  }}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter un premier poste</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl p-2 bg-slate-100 rounded-xl">{item.icon}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 capitalize">
                        {item.periodicity}
                      </span>
                    </div>

                    <h3 className="font-black text-slate-900 text-base mb-1">{item.name}</h3>
                    <p className="text-xs text-slate-500 font-medium mb-3">
                      Fournisseur : {item.supplier || 'Non spécifié'}
                    </p>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                        Budget annuel voté
                      </span>
                      <div className="text-lg font-black font-mono text-slate-900">
                        {fmt(item.forecast)}
                      </div>
                    </div>
                  </div>

                  {isManager && (
                    <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setItemForm({
                            name: item.name,
                            icon: item.icon,
                            supplier: item.supplier,
                            amount: String(item.forecast),
                            periodicity: item.periodicity,
                          });
                          setShowItemModal(true);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Supprimer ce poste"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL : NOUVELLE DÉPENSE SUR POSTE BUDGÉTAIRE ────────────── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-base">
                Enregistrer une dépense
              </h3>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Poste budgétaire *</label>
                <select
                  value={expenseForm.budget_item_id}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, budget_item_id: Number(e.target.value) })
                  }
                  required
                  className="w-full bg-white text-slate-900 font-semibold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={0}>-- Choisir un poste budgétaire --</option>
                  {summary?.items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.icon} {it.name} ({fmt(it.forecast)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Libellé de la dépense *</label>
                <input
                  type="text"
                  placeholder="Ex: Facture EDF juillet"
                  value={expenseForm.label}
                  onChange={(e) => setExpenseForm({ ...expenseForm, label: e.target.value })}
                  required
                  className="w-full bg-white text-slate-900 font-medium rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Montant (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="112.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                    className="w-full bg-white text-slate-900 font-mono font-bold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                    required
                    className="w-full bg-white text-slate-900 font-medium rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tiers / Fournisseur</label>
                <input
                  type="text"
                  placeholder="Ex: EDF, Veolia..."
                  value={expenseForm.third_party}
                  onChange={(e) => setExpenseForm({ ...expenseForm, third_party: e.target.value })}
                  className="w-full bg-white text-slate-900 font-medium rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-xs transition-all"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL : CRÉATION / MODIFICATION D'UN POSTE BUDGÉTAIRE ─────── */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingItem ? 'Modifier le poste budgétaire' : 'Nouveau poste budgétaire'}
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Icône / Émoji</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {COMMON_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setItemForm({ ...itemForm, icon: ic })}
                      className={`text-lg p-1.5 rounded-lg border transition-all ${
                        itemForm.icon === ic
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nom du poste *</label>
                <input
                  type="text"
                  placeholder="Ex: Électricité / EDF"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  required
                  className="w-full bg-white text-slate-900 font-bold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Budget annuel (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1300.00"
                    value={itemForm.amount}
                    onChange={(e) => setItemForm({ ...itemForm, amount: e.target.value })}
                    required
                    className="w-full bg-white text-slate-900 font-mono font-bold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Périodicité</label>
                  <select
                    value={itemForm.periodicity}
                    onChange={(e) => setItemForm({ ...itemForm, periodicity: e.target.value })}
                    className="w-full bg-white text-slate-900 font-semibold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="mensuelle">Mensuelle</option>
                    <option value="trimestrielle">Trimestrielle</option>
                    <option value="annuelle">Annuelle</option>
                    <option value="ponctuelle">Ponctuelle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Fournisseur habituel</label>
                <input
                  type="text"
                  placeholder="Ex: EDF, TotalEnergies, Trésor Public..."
                  value={itemForm.supplier}
                  onChange={(e) => setItemForm({ ...itemForm, supplier: e.target.value })}
                  className="w-full bg-white text-slate-900 font-medium rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-xs transition-all"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL : CRÉER UN APPEL DE FONDS ───────────────────────────── */}
      {showFundCallModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-base">
                Créer un appel de fonds
              </h3>
              <button
                onClick={() => setShowFundCallModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateFundCall} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Numéro d'appel</label>
                  <input
                    type="text"
                    value={fundCallForm.call_number}
                    onChange={(e) =>
                      setFundCallForm({ ...fundCallForm, call_number: e.target.value })
                    }
                    placeholder={`N° ${selectedYear}-001`}
                    className="w-full bg-white text-slate-900 font-mono font-bold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date d'émission</label>
                  <input
                    type="date"
                    value={fundCallForm.call_date}
                    onChange={(e) =>
                      setFundCallForm({ ...fundCallForm, call_date: e.target.value })
                    }
                    required
                    className="w-full bg-white text-slate-900 font-medium rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date d'échéance (limite)</label>
                  <input
                    type="date"
                    value={fundCallForm.due_date}
                    onChange={(e) =>
                      setFundCallForm({ ...fundCallForm, due_date: e.target.value })
                    }
                    className="w-full bg-white text-slate-900 font-medium rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Motif</label>
                  <input
                    type="text"
                    value={fundCallForm.purpose}
                    onChange={(e) =>
                      setFundCallForm({ ...fundCallForm, purpose: e.target.value })
                    }
                    className="w-full bg-white text-slate-900 font-medium rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Sélection des postes budgétaires à financer */}
              <div>
                <label className="block font-black text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                  Cocher les postes budgétaires à financer :
                </label>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {summary?.items.map((item) => {
                    const isChecked = fundCallForm.selected_item_ids.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFundCallForm({
                                  ...fundCallForm,
                                  selected_item_ids: [...fundCallForm.selected_item_ids, item.id],
                                });
                              } else {
                                setFundCallForm({
                                  ...fundCallForm,
                                  selected_item_ids: fundCallForm.selected_item_ids.filter(
                                    (id) => id !== item.id
                                  ),
                                });
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-medium text-slate-800">
                            {item.icon} {item.name}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          {fmt(item.forecast)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Résumé et Répartition automatique par associé */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="font-black text-slate-900 uppercase text-[11px]">
                    Montant total de l'appel :
                  </span>
                  <span className="font-mono font-black text-base text-indigo-600">
                    {fmt(selectedItemsTotal)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                    Répartition automatique calculée selon le capital ({associates.length} associés) :
                  </span>
                  <div className="space-y-1">
                    {associates.map((a) => {
                      const sharePct = a.shares / totalShares;
                      const shareAmt = selectedItemsTotal * sharePct;
                      return (
                        <div key={a.id} className="flex justify-between text-xs font-medium">
                          <span className="text-slate-700">
                            {a.first_name} {a.last_name} ({a.shares} parts / {Math.round(sharePct * 100)}%)
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            {fmt(shareAmt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowFundCallModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-xs transition-all"
                >
                  Valider et créer l'appel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL : SUIVI DÉTAILLÉ D'UN APPEL DE FONDS (RAPPROCHEMENT) ─── */}
      {selectedFundCallDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Suivi des règlements : {selectedFundCallDetail.call_number}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Pointez les virements reçus des associés pour cet appel de fonds.
                </p>
              </div>
              <button
                onClick={() => setSelectedFundCallDetail(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block">Total demandé :</span>
                  <span className="font-mono font-black text-slate-900 text-sm">
                    {fmt(selectedFundCallDetail.total_amount)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total reçu :</span>
                  <span className="font-mono font-black text-emerald-600 text-sm">
                    {fmt(selectedFundCallDetail.amount_paid)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Reste à recevoir :</span>
                  <span className="font-mono font-black text-rose-600 text-sm">
                    {fmt(selectedFundCallDetail.amount_remaining)}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-black text-slate-900 uppercase tracking-wider text-[11px] mb-2">
                  État des versements des associés
                </h4>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {selectedFundCallDetail.lines.map((line) => (
                    <div
                      key={line.id}
                      className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">
                          {line.associate_name}
                        </div>
                        <div className="text-slate-500 text-[11px] font-medium">
                          {line.shares} parts ({line.quote_part} %) • Dû :{' '}
                          <span className="font-mono font-bold text-slate-800">
                            {fmt(line.amount_due)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {line.is_paid ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Réglé</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            <Clock className="w-4 h-4" />
                            <span>En attente</span>
                          </span>
                        )}

                        {isManager && (
                          <button
                            onClick={() =>
                              handleToggleLinePayment(
                                selectedFundCallDetail.id,
                                line.id,
                                line.is_paid
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              line.is_paid
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                            }`}
                          >
                            {line.is_paid ? 'Annuler pointage' : 'Marquer payé'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => {
                    const call = selectedFundCallDetail;
                    setSelectedFundCallDetail(null);
                    setPdfFundCall(call);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all"
                >
                  <FileText className="w-4 h-4" />
                  <span>Imprimer l'appel (PDF)</span>
                </button>

                <button
                  onClick={() => setSelectedFundCallDetail(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL : NOUVELLE ANNÉE / COPIER BUDGET N-1 ───────────────── */}
      {showNewYearModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-base">
                Créer une nouvelle année
              </h3>
              <button
                onClick={() => setShowNewYearModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewYear} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Année budgétaire</label>
                <input
                  type="number"
                  value={newYearForm.year}
                  onChange={(e) =>
                    setNewYearForm({ ...newYearForm, year: Number(e.target.value) })
                  }
                  required
                  className="w-full bg-white text-slate-900 font-mono font-bold rounded-xl px-3 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={newYearForm.copy_from_previous}
                  onChange={(e) =>
                    setNewYearForm({ ...newYearForm, copy_from_previous: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs font-semibold text-slate-800">
                  Copier le budget de l'année précédente ({selectedYear})
                </span>
              </label>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewYearModal(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-xs transition-all"
                >
                  Créer l'année
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL PDF OFFICIEL A4 D'APPEL DE FONDS ───────────────────── */}
      {pdfFundCall && (
        <FundCallPdfView
          fundCall={pdfFundCall}
          sci={sci}
          bankAccount={primaryAccount}
          onClose={() => setPdfFundCall(null)}
        />
      )}
    </div>
  );
}
