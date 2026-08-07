import { useEffect, useState } from 'react';
import { Plus, X, CalendarRange, Lock, Unlock, ArrowUpRight, ArrowDownRight, PieChart, Printer, FileCheck, FileText } from 'lucide-react';
import { fiscalYearsApi, sciApi, bankApi } from '../api';
import type { FiscalYear, FiscalYearSummary, Tax2072Summary, SCI, BankAccount } from '../types';
import AGOPvView from '../components/AGOPvView';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function FiscalYears() {
  const [sci, setSci] = useState<SCI | null>(null);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<number | null>(null);
  const [summary, setSummary] = useState<FiscalYearSummary | null>(null);
  const [taxSummary, setTaxSummary] = useState<Tax2072Summary | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'pv' | 'tax'>('summary');
  
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    label: `Exercice ${currentYear}`,
    start_date: `${currentYear}-01-01`,
    end_date: `${currentYear}-12-31`,
  });

  function loadData(selectId?: number) {
    setLoading(true);
    Promise.all([
      sciApi.get().catch(() => null),
      fiscalYearsApi.list(),
      bankApi.getAccounts().catch(() => []),
    ]).then(([s, years, accounts]) => {
      setSci(s);
      setFiscalYears(years);
      setBankAccounts(accounts);
      if (years.length > 0) {
        const targetId = selectId || selectedFyId || years[0].id;
        setSelectedFyId(targetId);
        loadSummary(targetId);
      }
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }

  function loadSummary(fyId: number) {
    setSummaryLoading(true);
    Promise.all([
      fiscalYearsApi.summary(fyId),
      fiscalYearsApi.tax2072(fyId).catch(() => null),
    ])
      .then(([sum, tax]) => {
        setSummary(sum);
        setTaxSummary(tax);
      })
      .catch(() => {
        setSummary(null);
        setTaxSummary(null);
      })
      .finally(() => setSummaryLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleSelectFy(id: number) {
    setSelectedFyId(id);
    loadSummary(id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await fiscalYearsApi.create(form);
      setShowForm(false);
      loadData(created.id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  }

  async function handleCloseFy() {
    if (!selectedFyId || !summary) return;
    if (!confirm(`Voulez-vous vraiment clôturer l'${summary.fiscal_year.label} ? Les opérations de cet exercice seront verrouillées.`)) {
      return;
    }
    try {
      await fiscalYearsApi.close(selectedFyId);
      loadData(selectedFyId);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la clôture');
    }
  }

  async function handleReopenFy() {
    if (!selectedFyId || !summary) return;
    try {
      await fiscalYearsApi.reopen(selectedFyId);
      loadData(selectedFyId);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la réouverture');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const currentFy = summary?.fiscal_year;
  const isClosed = currentFy?.status === 'cloture';

  const inputClass =
    'w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium';

  return (
    <>
      {/* ─── VUE ÉCRAN (ECRAN NORMAL) ───────────────────────────────── */}
      <div className="space-y-6 animate-fade-in screen-only">
        {/* En-tête principal épuré et moderne */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Titre & Sélecteur */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <CalendarRange className="w-6 h-6" />
                </span>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900">Bilan annuel</h1>
                  <p className="text-xs text-slate-500 font-medium mt-1">Bilan annuel & synthèse de gestion</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <select
                  value={selectedFyId || ''}
                  onChange={(e) => handleSelectFy(Number(e.target.value))}
                  className="bg-slate-50 text-slate-900 text-sm font-extrabold rounded-xl px-3.5 py-2 border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                >
                  {fiscalYears.map((fy) => (
                    <option key={fy.id} value={fy.id}>
                      {fy.label} ({new Date(fy.start_date).getFullYear()})
                    </option>
                  ))}
                </select>

                {currentFy && (
                  <span
                    className={`text-xs px-3 py-1.5 rounded-full font-bold inline-flex items-center gap-1.5 ${
                      isClosed
                        ? 'bg-slate-100 text-slate-700 border border-slate-300'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {isClosed ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    {isClosed ? 'Année Clôturée' : 'Année en cours'}
                  </span>
                )}
              </div>
            </div>

            {/* Actions principales */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold shadow-sm transition-all"
                title="Imprimer le bilan"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimer Bilan</span>
              </button>

              {currentFy && (
                isClosed ? (
                  <button
                    onClick={handleReopenFy}
                    className="flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    <Unlock className="w-4 h-4 text-slate-500" />
                    <span>Rouvrir</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCloseFy}
                    className="flex items-center space-x-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <Lock className="w-4 h-4 text-indigo-400" />
                    <span>Clôturer</span>
                  </button>
                )
              )}

              <button
                onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-sm"
              >
                {showForm ? <X size={15} /> : <Plus size={15} />}
                <span>{showForm ? 'Fermer' : 'Nouvelle année'}</span>
              </button>
            </div>
          </div> 

          {/* Sous-navigation par Onglets épurés */}
          <div className="flex items-center space-x-1 border-t border-slate-100 pt-4">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'summary'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              <span>Bilan de l'année</span>
            </button>
            <button
              onClick={() => setActiveTab('pv')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'pv'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Procès-Verbal d'AG</span>
            </button>
            <button
              onClick={() => setActiveTab('tax')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                activeTab === 'tax'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Fiscalité (Cerfa 2072)</span>
            </button>
          </div>
        </div>

        {/* Formulaire Nouvelle Année */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm animate-fade-in"
          >
            <h2 className="font-extrabold text-slate-900 text-base">Ouvrir une nouvelle année</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom de l'année / exercice</label>
                <input
                  className={inputClass}
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date de début</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Date de fin</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  required
                />
              </div>
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
                {saving ? "Création..." : "Créer l'année"}
              </button>
            </div>
          </form>
        )}

        {/* CONTENU ONGLET 1 : SYNTHÈSE DE L'ANNÉE */}
        {activeTab === 'summary' ? (
          summaryLoading ? (
            <div className="p-12 text-center text-slate-500 font-medium">Calcul du bilan de l'année...</div>
          ) : summary ? (
            <>
            <div className="space-y-6">
              {/* 1. Résultat de l'exercice */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="font-extrabold text-slate-900 text-base">Résultat de l'exercice</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50/50 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="py-3.5 px-6"></th>
                        <th className="py-3.5 px-6 text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-6 font-bold text-slate-800 text-sm">Loyers & recettes</td>
                        <td className="py-3.5 px-6 text-right font-mono font-bold text-sm text-emerald-600">
                          {fmt(summary.total_income)}
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-6 font-bold text-slate-800 text-sm">Dépenses courantes</td>
                        <td className="py-3.5 px-6 text-right font-mono font-bold text-sm text-slate-800">
                          {fmt(summary.total_expenses)}
                        </td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-4 px-6 font-black text-slate-900 text-sm uppercase">Résultat de l'exercice</td>
                        <td className="py-4 px-6 text-right font-mono font-black text-sm">
                          {summary.net_result > 0 ? `+${fmt(summary.net_result)}` : fmt(summary.net_result)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Répartition du résultat et comptes courants */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm space-y-0">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="font-extrabold text-slate-900 text-base">Répartition du résultat et comptes courants</h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Répartition du résultat selon la quote-part de parts sociales et situation des comptes courants d'associés.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50/50 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-100">
                      <tr>
                        <th className="py-3.5 px-6">Associé</th>
                        <th className="py-3.5 px-6 text-right">Parts</th>
                        <th className="py-3.5 px-6 text-right">Quote-part</th>
                        <th className="py-3.5 px-6 text-right">Capital versé</th>
                        <th className="py-3.5 px-6 text-right">Résultat de l'année</th>
                        <th className="py-3.5 px-6 text-right text-indigo-700">Compte courant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.associate_results.map((res) => (
                        <tr key={res.associate_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6 font-extrabold text-slate-900 text-sm">
                            {res.first_name} {res.last_name}
                          </td>
                          <td className="py-4 px-6 text-right font-bold text-slate-800">{res.shares}</td>
                          <td className="py-4 px-6 text-right font-bold text-slate-600">{res.quote_part} %</td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-sm text-slate-700">
                            {fmt(res.capital_paid || 0)}
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-sm">
                            <span className={res.result_share >= 0 ? 'text-emerald-600' : 'text-slate-800'}>
                              {res.result_share > 0 ? `+${fmt(res.result_share)}` : fmt(res.result_share)}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-extrabold text-sm text-indigo-900">
                            {fmt(res.cca_balance || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Situation financière */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h2 className="font-extrabold text-slate-900 text-base mb-4 border-b border-slate-100 pb-2">Situation financière</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700">Trésorerie en banque :</span>
                    <span className="font-mono font-extrabold text-slate-900">{fmt(bankAccounts.reduce((acc, b) => acc + (Number(b.current_balance) || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700">Capital social :</span>
                    <span className="font-mono font-extrabold text-slate-900">{fmt(summary.associate_results.reduce((acc, a) => acc + (a.capital_paid || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700">Comptes courants d'associés :</span>
                    <span className="font-mono font-extrabold text-slate-900">{fmt(summary.associate_results.reduce((acc, a) => acc + (a.cca_balance || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-700">Valeur d'acquisition du bien :</span>
                    <span className="font-mono font-extrabold text-slate-900">{fmt(summary.total_immobilisations)}</span>
                  </div>
                </div>
              </div>

            </div>
          </>
        ) : null) : activeTab === 'tax' && taxSummary ? (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-slate-900 text-base">Cases officielles Déclaration Cerfa 2072-S</h2>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Régime fiscal des revenus fonciers (Imposition à l'Impôt sur le Revenu).
                </p>
              </div>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-extrabold border border-slate-200">
                Régime Réel (IR)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50/50 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-6">Case Cerfa</th>
                    <th className="py-3.5 px-6">Rubrique officielle</th>
                    <th className="py-3.5 px-6">Explications / Détail des frais</th>
                    <th className="py-3.5 px-6 text-right">Montant à reporter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taxSummary.cerfa_lines.map((line) => {
                    const isResult = line.line_number === '260';
                    return (
                      <tr
                        key={line.line_number}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isResult ? 'bg-indigo-50/30 font-black' : ''
                        }`}
                      >
                        <td className="py-4 px-6">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md text-xs font-black font-mono ${
                              isResult
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-900 text-white'
                            }`}
                          >
                            Ligne {line.line_number}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-bold text-slate-900 text-sm">{line.label}</td>
                        <td className="py-4 px-6 text-xs text-slate-500 font-medium max-w-md">
                          {line.description}
                        </td>
                        <td className="py-4 px-6 text-right font-mono font-extrabold text-sm">
                          <span
                            className={
                              isResult
                                ? line.amount >= 0
                                  ? 'text-emerald-600 text-base'
                                  : 'text-slate-900 text-base'
                                : 'text-slate-900'
                            }
                          >
                            {line.amount >= 0 ? `+${fmt(line.amount)}` : fmt(line.amount)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      {/* ─── VUE PDF IMPRESSION (DESIGN CORPORATE HAUT DE GAMME 1 PAGE) ─────────────── */}
      {summary && activeTab === 'summary' && (
        <div className="print-only font-sans text-slate-900 space-y-4">
          {/* En-tête professionnel haut de gamme */}
          <div className="border-b-2 border-indigo-600 pb-3 flex justify-between items-end">
            <div>
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-0.5">Société Civile Immobilière</span>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
                {sci?.name || 'S.C.I. LA GUERMONDERIE'}
              </h1>
              {sci?.siren && <p className="text-[10px] text-slate-500 font-mono mt-1">SIREN : {sci.siren}</p>}
            </div>
            <div className="text-right">
              <div className="inline-block bg-slate-900 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider mb-1">
                BILAN ANNUEL {summary.fiscal_year.label}
              </div>
              <p className="text-[10px] text-slate-600 font-mono">
                Période du {new Date(summary.fiscal_year.start_date).toLocaleDateString('fr-FR')} au {new Date(summary.fiscal_year.end_date).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          {/* Tableau 1 : Résultat de l'exercice */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-3.5 py-2 bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
              1. Résultat de l'exercice
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="py-2 px-3.5 font-bold text-slate-900 text-[11px]">Loyers & recettes</td>
                  <td className="py-2 px-3.5 text-right font-mono font-extrabold text-emerald-600 whitespace-nowrap text-[11px]">
                    {fmt(summary.total_income)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-slate-900 text-[11px]">Dépenses de gestion</td>
                  <td className="py-2 px-3.5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap text-[11px]">
                    {fmt(summary.total_expenses)}
                  </td>
                </tr>
                <tr className="bg-slate-50/80">
                  <td className="py-2.5 px-3.5 font-black text-slate-900 text-[11px] uppercase">Résultat net de l'exercice</td>
                  <td className={`py-2.5 px-3.5 text-right font-mono font-black whitespace-nowrap text-[12px] ${summary.net_result >= 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {summary.net_result > 0 ? `+${fmt(summary.net_result)}` : fmt(summary.net_result)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tableau 2 : Détail des dépenses de gestion */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-3.5 py-2 bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
              2. Détail des dépenses de gestion de l'année
            </div>
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3.5 text-left">Catégorie</th>
                  <th className="py-2 px-3.5 text-left">Type de dépense</th>
                  <th className="py-2 px-3.5 text-right whitespace-nowrap">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {summary.category_breakdown
                  .filter(cat => !cat.category.toLowerCase().includes("acquisition") && !cat.category.toLowerCase().includes("notaire"))
                  .map((cat) => (
                    <tr key={cat.category}>
                      <td className="py-2 px-3.5 font-bold text-slate-900 text-[11px]">{cat.category}</td>
                      <td className="py-2 px-3.5 text-[11px] text-slate-600">
                        Dépense courante
                      </td>
                      <td className="py-2 px-3.5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap text-[11px]">
                        {fmt(cat.total_amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Tableau 3 : Situation des associés & Apports */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-3.5 py-2 bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
              3. Situation des associés & apports en compte courant
            </div>
            <table className="w-full text-xs border-collapse table-fixed">
              <thead className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-1.5 px-2 text-left w-[24%] whitespace-nowrap">Associé</th>
                  <th className="py-1.5 px-2 text-right w-[10%] whitespace-nowrap">Parts</th>
                  <th className="py-1.5 px-2 text-right w-[12%] whitespace-nowrap">Quote-part</th>
                  <th className="py-1.5 px-2 text-right w-[15%] whitespace-nowrap">Capital</th>
                  <th className="py-1.5 px-2 text-right w-[17%] whitespace-nowrap">Résultat</th>
                  <th className="py-1.5 px-2 text-right w-[22%] whitespace-nowrap text-indigo-700">Compte courant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {summary.associate_results.map((res) => (
                  <tr key={res.associate_id}>
                    <td className="py-1.5 px-2.5 font-bold text-slate-900 truncate text-[11px]">{res.first_name} {res.last_name}</td>
                    <td className="py-1.5 px-2.5 text-right font-medium text-slate-700 whitespace-nowrap text-[11px]">{res.shares} parts</td>
                    <td className="py-1.5 px-2.5 text-right font-medium text-slate-700 whitespace-nowrap text-[11px]">{res.quote_part} %</td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-700 whitespace-nowrap text-[11px]">
                      {fmt(res.capital_paid || 0)}
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-bold whitespace-nowrap text-[11px]">
                      <span className={res.result_share >= 0 ? 'text-emerald-700' : 'text-slate-800'}>
                        {res.result_share > 0 ? `+${fmt(res.result_share)}` : fmt(res.result_share)}
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 text-right font-mono font-black text-indigo-900 whitespace-nowrap text-[11px]">
                      {fmt(res.cca_balance || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tableau 4 : Situation financière */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs mt-4 mb-8">
            <div className="px-3.5 py-2 bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
              4. Situation financière
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="py-2 px-3.5 font-bold text-slate-900 text-[11px]">Trésorerie en banque</td>
                  <td className="py-2 px-3.5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap text-[11px]">
                    {fmt(bankAccounts.reduce((acc, b) => acc + (Number(b.current_balance) || 0), 0))}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-slate-900 text-[11px]">Capital social</td>
                  <td className="py-2 px-3.5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap text-[11px]">
                    {fmt(summary.associate_results.reduce((acc, a) => acc + (a.capital_paid || 0), 0))}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-3.5 font-bold text-slate-900 text-[11px]">Comptes courants d'associés</td>
                  <td className="py-2 px-3.5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap text-[11px]">
                    {fmt(summary.associate_results.reduce((acc, a) => acc + (a.cca_balance || 0), 0))}
                  </td>
                </tr>
                <tr className="bg-slate-50/80">
                  <td className="py-2 px-3.5 font-bold text-slate-900 text-[11px]">Valeur d'acquisition du bien</td>
                  <td className="py-2 px-3.5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap text-[11px]">
                    {fmt(summary.total_immobilisations)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Pied de page & signature d'expert */}
          <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-500">
            <div>
              <p className="text-[10px] text-slate-500 font-medium">Document édité le {new Date().toLocaleDateString('fr-FR')}</p>
            </div>
            <div className="border border-slate-300 rounded-lg p-2.5 text-right bg-slate-50/80 w-60">
              <p className="text-[10px] font-extrabold text-slate-900">Signature du Gérant :</p>
              <div className="h-8"></div>
            </div>
          </div>
        </div>
      )}

      {/* VUE PV AG */}
      {activeTab === 'pv' && summary && (
        <div className="mt-8">
          <AGOPvView
            sci={sci}
            summary={summary}
            bankBalance={bankAccounts.reduce((sum, b) => sum + (b.current_balance || 0), 0)}
          />
        </div>
      )}
    </>
  );
}
