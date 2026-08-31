import React, { useState } from 'react';
import { X, Printer, Copy, Check, FileText } from 'lucide-react';
import type { FundCall, SCI, BankAccount } from '../types';

function fmt(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

interface Props {
  fundCall: FundCall;
  sci: SCI | null;
  bankAccount: BankAccount | null;
  onClose: () => void;
}

export default function FundCallPdfView({ fundCall, sci, bankAccount, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const formattedCallDate = fundCall.call_date
    ? new Date(fundCall.call_date).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  const formattedDueDate = fundCall.due_date
    ? new Date(fundCall.due_date).toLocaleDateString('fr-FR')
    : 'À réception';

  const plainText = `${sci?.name || 'SCI'}
APPEL DE FONDS DES ASSOCIÉS
${fundCall.call_number}

Date d'émission : ${formattedCallDate}
Date limite de paiement : ${formattedDueDate}

Motif :
${fundCall.purpose}

Postes concernés :
${fundCall.budget_items.map((it) => `• ${it.name} : ${fmt(it.amount)}`).join('\n')}
──────────────────────────────
TOTAL À FINANCER : ${fmt(fundCall.total_amount)}

Répartition des associés :
${fundCall.lines.map((l) => `• ${l.associate_name} (${l.shares} parts - ${l.quote_part} %) : ${fmt(l.amount_due)}`).join('\n')}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = '';
    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    window.print();
    setTimeout(restoreTitle, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      {/* Conteneur écran */}
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] screen-only">
        {/* Header Modal */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Aperçu de l'appel de fonds {fundCall.call_number}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Document officiel prêt pour impression ou export PDF A4
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Corps d'aperçu stylisé */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-800 font-sans">
          {/* En-tête document */}
          <div className="border-b-2 border-indigo-600 pb-4 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-1">
                Société Civile Immobilière
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {sci?.name || 'SCI'}
              </h1>
              {sci?.address && <p className="text-xs text-slate-500 mt-1">{sci.address}</p>}
              {sci?.siret ? (
                <p className="text-[11px] text-slate-400 font-mono">SIRET : {sci.siret}</p>
              ) : sci?.siren ? (
                <p className="text-[11px] text-slate-400 font-mono">SIREN : {sci.siren}</p>
              ) : null}
            </div>
            <div className="text-right">
              <div className="inline-block bg-slate-900 text-white text-xs font-black px-3 py-1.5 rounded-lg tracking-wider mb-2">
                {fundCall.call_number}
              </div>
              <p className="text-xs text-slate-600">
                Date d'émission : <span className="font-bold text-slate-900">{formattedCallDate}</span>
              </p>
              <p className="text-xs text-slate-600">
                Échéance : <span className="font-bold text-rose-600">{formattedDueDate}</span>
              </p>
            </div>
          </div>

          {/* Titre & Motif */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
              Objet de l'appel de fonds
            </h3>
            <p className="text-sm font-semibold text-slate-900">{fundCall.purpose}</p>
          </div>

          {/* Table Postes budgétaires financés */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Postes budgétaires concernés
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Poste de dépense</th>
                    <th className="py-2.5 px-4 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {fundCall.budget_items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 px-4 font-medium flex items-center gap-2">
                        <span>{item.icon}</span>
                        <span>{item.name}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                        {fmt(item.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80 font-black text-slate-900 border-t border-slate-200">
                    <td className="py-3 px-4 uppercase text-[11px]">Total à financer</td>
                    <td className="py-3 px-4 text-right font-mono text-sm text-indigo-600">
                      {fmt(fundCall.total_amount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table Répartition associés */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Répartition selon les parts sociales des associés
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/75 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Associé</th>
                    <th className="py-2.5 px-4 text-right">Parts</th>
                    <th className="py-2.5 px-4 text-right">Quote-part</th>
                    <th className="py-2.5 px-4 text-right">Montant appelé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {fundCall.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{line.associate_name}</td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-600">{line.shares} parts</td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-600">{line.quote_part} %</td>
                      <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">
                        {fmt(line.amount_due)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pied modal écran */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-all"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Texte copié' : 'Copier le texte'}</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Fermer
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all"
            >
              <Printer size={16} />
              <span>Imprimer / Télécharger en PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── VUE IMPRESSION A4 OFFICIELLE ──────────────────────── */}
      <div className="print-only font-sans text-slate-900 p-8 space-y-6 w-full max-w-[210mm] mx-auto bg-white">
        <div className="border-b-2 border-indigo-600 pb-4 flex justify-between items-start">
          <div>
            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest block mb-1">
              Société Civile Immobilière
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {sci?.name || 'SCI'}
            </h1>
            {sci?.address && <p className="text-xs text-slate-600 mt-1">{sci.address}</p>}
            {sci?.siret ? (
              <p className="text-[11px] text-slate-500 font-mono">SIRET : {sci.siret}</p>
            ) : sci?.siren ? (
              <p className="text-[11px] text-slate-500 font-mono">SIREN : {sci.siren}</p>
            ) : null}
          </div>
          <div className="text-right">
            <div className="inline-block bg-slate-900 text-white text-xs font-black px-3 py-1.5 rounded-md tracking-wider mb-2">
              APPEL DE FONDS {fundCall.call_number}
            </div>
            <p className="text-xs text-slate-600">
              Date d'émission : <span className="font-bold text-slate-900">{formattedCallDate}</span>
            </p>
            <p className="text-xs text-slate-600">
              Échéance : <span className="font-bold text-slate-900">{formattedDueDate}</span>
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-300">
          <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-0.5">
            Objet de l'appel de fonds
          </h3>
          <p className="text-xs font-semibold text-slate-900">{fundCall.purpose}</p>
        </div>

        <div>
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2">
            Postes budgétaires financés
          </h3>
          <table className="w-full text-xs border border-slate-300 border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th className="py-2 px-3 text-left">Poste de dépense</th>
                <th className="py-2 px-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {fundCall.budget_items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1.5 px-3 font-medium">{item.icon} {item.name}</td>
                  <td className="py-1.5 px-3 text-right font-mono font-bold">{fmt(item.amount)}</td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-black border-t border-slate-300">
                <td className="py-2 px-3 uppercase text-[11px]">Total général</td>
                <td className="py-2 px-3 text-right font-mono text-sm">{fmt(fundCall.total_amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2">
            Répartition demandée aux associés
          </h3>
          <table className="w-full text-xs border border-slate-300 border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
              <tr>
                <th className="py-2 px-3 text-left">Associé</th>
                <th className="py-2 px-3 text-right">Parts</th>
                <th className="py-2 px-3 text-right">Quote-part</th>
                <th className="py-2 px-3 text-right">Montant à verser</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {fundCall.lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-1.5 px-3 font-bold">{line.associate_name}</td>
                  <td className="py-1.5 px-3 text-right">{line.shares} parts</td>
                  <td className="py-1.5 px-3 text-right">{line.quote_part} %</td>
                  <td className="py-1.5 px-3 text-right font-mono font-black">{fmt(line.amount_due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-6 flex justify-between items-end text-xs text-slate-500">
          <p>Édité le {new Date().toLocaleDateString('fr-FR')} par la gérance de la SCI.</p>
          <div className="border border-slate-300 rounded-lg p-3 text-right bg-slate-50/50 w-56">
            <p className="font-bold text-slate-900 mb-6">Signature de la gérance :</p>
            <div className="h-6"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
