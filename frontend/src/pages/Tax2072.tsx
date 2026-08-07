import { useEffect, useState } from 'react';
import { FileText, Printer, AlertTriangle, ShieldCheck, Download } from 'lucide-react';
import { fiscalYearsApi, sciApi } from '../api';
import type { FiscalYear, Tax2072Summary, SCI } from '../types';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function Tax2072() {
  const [sci, setSci] = useState<SCI | null>(null);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [selectedFyId, setSelectedFyId] = useState<number | null>(null);
  const [taxSummary, setTaxSummary] = useState<Tax2072Summary | null>(null);
  const [loading, setLoading] = useState(true);

  function loadData(selectId?: number) {
    setLoading(true);
    Promise.all([
      sciApi.get().catch(() => null),
      fiscalYearsApi.list(),
    ])
      .then(([s, years]) => {
        setSci(s);
        setFiscalYears(years);
        if (years.length > 0) {
          const targetId = selectId || selectedFyId || years[0].id;
          setSelectedFyId(targetId);
          loadTaxSummary(targetId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadTaxSummary(fyId: number) {
    fiscalYearsApi
      .tax2072(fyId)
      .then(setTaxSummary)
      .catch(() => setTaxSummary(null));
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleSelectFy(id: number) {
    setSelectedFyId(id);
    loadTaxSummary(id);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      {/* ─── VUE ÉCRAN NORMAL ───────────────────────────────────────── */}
      <div className="space-y-6 animate-fade-in screen-only">
        {/* En-tête principal */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </span>
                <h1 className="text-2xl font-extrabold text-slate-900">Fiscalité & Régime Foncier</h1>
              </div>

              <div className="flex items-center space-x-3 mt-3">
                <span className="text-xs text-slate-500 font-medium">Exercice fiscal :</span>
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
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md self-start md:self-auto"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>Imprimer la synthèse fiscale (PDF)</span>
            </button>
          </div>
        </div>

        {taxSummary ? (
          <>
            {/* Tableau 1 : Récapitulatif des cases officielles Cerfa 2072 */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base">Cases officielles Déclaration Cerfa 2072-S</h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Montants déductibles regroupés par rubriques officielles à reporter sur la déclaration de la SCI.
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
                                    : 'text-rose-600 text-base'
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

          </>
        ) : null}
      </div>

      {/* ─── VUE PDF IMPRESSION A4 (SYNTHÈSE FISCALE OFFICIELLE 1 PAGE) ─────────── */}
      {taxSummary && (
        <div className="print-only font-sans text-slate-900 space-y-4">
          <div className="border-b-2 border-indigo-600 pb-3 flex justify-between items-end">
            <div>
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-0.5">Société Civile Immobilière (Impôt sur le Revenu)</span>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-none">
                {taxSummary.sci_name}
              </h1>
              {taxSummary.sci_siren && <p className="text-[10px] text-slate-500 font-mono mt-1">SIREN : {taxSummary.sci_siren}</p>}
            </div>
            <div className="text-right">
              <div className="inline-block bg-slate-900 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider mb-1">
                AIDE À LA DÉCLARATION 2072 — {taxSummary.fiscal_year.label}
              </div>
              <p className="text-[10px] text-slate-600 font-mono">
                Période du {new Date(taxSummary.fiscal_year.start_date).toLocaleDateString('fr-FR')} au {new Date(taxSummary.fiscal_year.end_date).toLocaleDateString('fr-FR')}
              </p>
          </div>

          {/* Tableau Cerfa 2072 */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="px-3.5 py-2 bg-slate-900 text-white font-extrabold text-[11px] uppercase tracking-wider">
              Synthèse des cases Cerfa 2072-S
            </div>
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-extrabold text-[10px] uppercase border-b border-slate-200">
                <tr>
                  <th className="py-1.5 px-3 text-left w-24">Ligne Cerfa</th>
                  <th className="py-1.5 px-3 text-left">Rubrique Fiscale</th>
                  <th className="py-1.5 px-3 text-right w-32 whitespace-nowrap">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {taxSummary.cerfa_lines.map((line) => {
                  const isResult = line.line_number === '260';
                  return (
                    <tr key={line.line_number} className={isResult ? 'bg-slate-50 font-extrabold' : ''}>
                      <td className="py-1.5 px-3 font-mono font-bold text-[11px]">Ligne {line.line_number}</td>
                      <td className="py-1.5 px-3 font-medium text-slate-900 text-[11px]">{line.label}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap text-[11px]">
                        {line.amount >= 0 ? `+${fmt(line.amount)}` : fmt(line.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          </div>

          {/* Footer PDF */}
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
    </>
  );
}
