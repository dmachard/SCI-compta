import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileCheck } from 'lucide-react';
import type { FiscalYearSummary, SCI } from '../types';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

interface Props {
  sci: SCI | null;
  summary: FiscalYearSummary;
  bankBalance: number;
}

export default function AGOPvView({ sci, summary, bankBalance }: Props) {
  const fyYear = new Date(summary.fiscal_year.end_date).getFullYear();
  
  const [agDate, setAgDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  function getDefaultCity(addr?: string): string {
    if (!addr) return '';
    const parts = addr.split(',');
    const lastPart = parts[parts.length - 1].trim();
    // remove postal code if present (e.g. "35000 Rennes" -> "Rennes")
    return lastPart.replace(/^\d{5}\s*/, '').trim();
  }

  const [location, setLocation] = useState(() => getDefaultCity(sci?.address));
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (sci?.address && !location) {
      setLocation(getDefaultCity(sci.address));
    }
  }, [sci]);



  const allocationText = 'reporté à nouveau en totalité';

  const agDateFormatted = new Date(agDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const yearEndDateFormatted = new Date(summary.fiscal_year.end_date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Generer le texte brut du PV
  const pvText = `PROCÈS-VERBAL DE L’ASSEMBLÉE GÉNÉRALE ORDINAIRE ANNUELLE
SCI ${sci?.name || 'LA GUERMONDERIE'}

Le ${agDateFormatted}, les associés de la SCI ${sci?.name || 'LA GUERMONDERIE'} se sont réunis en assemblée générale ordinaire.

Ordre du jour :
1. Présentation de la situation financière de la SCI pour l'exercice clos le ${yearEndDateFormatted}
2. Approbation de la gestion du gérant
3. Décisions concernant l'affectation du résultat

Le gérant présente aux associés la situation de la SCI :
- Solde bancaire au ${yearEndDateFormatted} : ${fmt(bankBalance)}
- Total des dépenses de l'exercice : ${fmt(summary.total_expenses)}
- État des apports versés en compte courant d'associés :
${summary.associate_results.map(a => `  • ${a.first_name} ${a.last_name} : ${fmt(a.cca_balance || 0)}`).join('\n')}

Après présentation, les associés approuvent la gestion du gérant pour l'exercice écoulé.

Les associés décident que le résultat de l'exercice (${fmt(summary.net_result)}) sera ${allocationText}.

La résolution est adoptée à l'unanimité.

Fait à ${location}, le ${agDateFormatted}

Signatures des associés :
${summary.associate_results.map(a => `- ${a.first_name} ${a.last_name}`).join('\n')}`;

  function handleCopy() {
    navigator.clipboard.writeText(pvText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  const inputClass =
    'w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm font-medium focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full flex flex-col overflow-hidden mb-6">
      {/* En-tête Vue */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <FileCheck className="w-5 h-5" />
          </span>
          <div>
            <h2 className="font-extrabold text-slate-900 text-base">Générateur de Procès-Verbal (PV d'AG)</h2>
            <p className="text-xs text-slate-500 font-medium">Exercice clos le {yearEndDateFormatted}</p>
          </div>
        </div>
      </div>

      {/* Corps : Formulaire & Prévisualisation (Écran seulement) */}
      <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm screen-only">
        {/* Champs de saisie */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Date de l'AG</label>
            <input
              type="date"
              className={inputClass}
              value={agDate}
              onChange={(e) => setAgDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Fait à (Ville)</label>
            <input
              type="text"
              className={inputClass}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ville"
            />
          </div>
        </div>

        {/* Aperçu du PV */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Aperçu officiel du Procès-Verbal</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copié !' : 'Copier le texte'}</span>
            </button>
          </div>

          <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto border border-slate-800">
            {pvText}
          </pre>
        </div>
      </div>

      {/* Impression propre (PDF) */}
      <div className="print-only font-sans p-8">
        <pre className="whitespace-pre-wrap font-sans text-sm text-black leading-relaxed">
          {pvText}
        </pre>
      </div>

      {/* Pied */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end screen-only">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-all"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copié dans le presse-papier' : 'Copier le texte'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all"
          >
            <Printer size={16} />
            <span>Imprimer / Exporter le PV (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
