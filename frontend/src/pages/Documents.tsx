import { useEffect, useMemo, useState } from 'react';
import {
  FolderArchive,
  Upload,
  FileText,
  Download,
  Trash2,
  X,
  FileSpreadsheet,
  FileImage,
  File,
  UploadCloud,
  Pencil,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Archive,
  Building2,
  Calendar,
  Sparkles,
  PlusCircle,
  CheckCircle2,
  Zap,
  Droplets,
  Wifi,
  Shield,
  Receipt,
  Landmark,
  FileCheck,
  Scale,
  Activity,
  Coins,
} from 'lucide-react';
import { documentsApi, authApi, sciApi } from '../api';
import type { DocumentItem, User, SCI } from '../types';

export const INVOICE_SUBFOLDERS = [
  '01 - Banque',
  '02 - EDF',
  '03 - Eau',
  '04 - Fibre',
  '05 - Assurance',
  '06 - Impôts / Taxe foncière',
  '07 - Autres factures',
];

export const ADMIN_SUBFOLDERS = [
  'Statuts & Kbis',
  "PV d'AG",
  'Rapports & Diagnostics',
  'Appels de fonds',
  'Attestations & Actes',
  'Baux & Contrats',
  'Autres',
];

export function autoDetectFromFilename(fileName: string): {
  type: 'facture' | 'administratif';
  year: number;
  category: string;
} {
  const fn = fileName.toLowerCase();
  const yearMatch = fn.match(/\b(202\d)\b/);
  const detectedYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  if (/edf|electricite|électricité|engie|totalenergies/.test(fn)) {
    return { type: 'facture', year: detectedYear, category: '02 - EDF' };
  }
  if (/eau|veolia|suez|saur/.test(fn)) {
    return { type: 'facture', year: detectedYear, category: '03 - Eau' };
  }
  if (/fibre|orange|free|sfr|bouygues|telecom|télécom|internet/.test(fn)) {
    return { type: 'facture', year: detectedYear, category: '04 - Fibre' };
  }
  if (/assurance|assur|axa|allianz|macif|maif|matmut|generali|pno/.test(fn)) {
    return { type: 'facture', year: detectedYear, category: '05 - Assurance' };
  }
  if (/taxe|impot|impôt|foncier|fonciere|foncière|cfe/.test(fn)) {
    return { type: 'facture', year: detectedYear, category: '06 - Impôts / Taxe foncière' };
  }
  if (/banque|releve|relevé|agios|frais bancaires/.test(fn)) {
    return { type: 'facture', year: detectedYear, category: '01 - Banque' };
  }

  // Pièces administratives & juridiques
  if (/kbis|k-bis|extrait/.test(fn)) {
    return { type: 'administratif', year: detectedYear, category: 'Statuts & Kbis' };
  }
  if (/statut|statuts/.test(fn)) {
    return { type: 'administratif', year: detectedYear, category: 'Statuts & Kbis' };
  }
  if (/pv d'ag|pv ag|proces verbal|procès-verbal|assemblee|assemblée/.test(fn)) {
    return { type: 'administratif', year: detectedYear, category: "PV d'AG" };
  }
  if (/spanc|diagnostic|dpe|amiante|plomb|assainissement|rapport vente/.test(fn)) {
    return { type: 'administratif', year: detectedYear, category: 'Rapports & Diagnostics' };
  }
  if (/appel de fond|appel de fonds|appel_de_fond/.test(fn)) {
    return { type: 'administratif', year: detectedYear, category: 'Appels de fonds' };
  }
  if (/chiffre d affaires|chiffre d'affaires|attestation/.test(fn)) {
    return { type: 'administratif', year: detectedYear, category: 'Attestations & Actes' };
  }
  if (/bail|contrat/.test(fn)) {
    return { type: 'administratif', year: detectedYear, category: 'Baux & Contrats' };
  }

  return { type: 'facture', year: detectedYear, category: '07 - Autres factures' };
}

export default function DocumentsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sciInfo, setSciInfo] = useState<SCI | null>(null);
  const [allDocuments, setAllDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation dans l'arborescence
  const [selectedRoot, setSelectedRoot] = useState<'ALL' | 'FACTURES' | 'ADMIN'>('FACTURES');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);

  // Années personnalisées ajoutées par l'utilisateur
  const [customYears, setCustomYears] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('sci_custom_years');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYearInput, setNewYearInput] = useState<number>(new Date().getFullYear() - 1);

  // Arbre déployé
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({
    [new Date().getFullYear()]: true,
  });
  const [isAdminExpanded, setIsAdminExpanded] = useState(true);

  // Modales
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);

  // Drag & drop
  const [isPageDragging, setIsPageDragging] = useState(false);

  // Formulaire d'upload / édition
  const [file, setFile] = useState<File | null>(null);
  const [formType, setFormType] = useState<'facture' | 'administratif'>('facture');
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear());
  const [formCategory, setFormCategory] = useState<string>('07 - Autres factures');
  const [customCategory, setCustomCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [amountTtc, setAmountTtc] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [exportingZip, setExportingZip] = useState(false);
  const [error, setError] = useState('');
  const [detectionNotice, setDetectionNotice] = useState<string | null>(null);

  function loadData() {
    setLoading(true);
    Promise.all([
      documentsApi.list(),
      authApi.me().catch(() => null),
      sciApi.get().catch(() => null),
    ])
      .then(([docs, me, sci]) => {
        setAllDocuments(docs);
        setCurrentUser(me);
        setSciInfo(sci);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  const isManager = currentUser?.role === 'gerant';
  const sciName = sciInfo?.name?.trim() || 'SCI LA GUERMONDERIE';

  // Années disponibles pour les factures (extraites des docs + custom + année courante)
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([new Date().getFullYear(), ...customYears]);
    allDocuments.forEach((doc) => {
      if (doc.folder_year) {
        yearsSet.add(doc.folder_year);
      } else if (doc.document_date) {
        const y = new Date(doc.document_date).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [allDocuments, customYears]);

  // Initialisation de la première année
  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  // Ajout d'une nouvelle année
  function handleAddYear(yearToAdd: number) {
    if (!yearToAdd || isNaN(yearToAdd) || yearToAdd < 1990 || yearToAdd > 2100) return;
    if (!customYears.includes(yearToAdd)) {
      const updated = [...customYears, yearToAdd].sort((a, b) => b - a);
      setCustomYears(updated);
      try {
        localStorage.setItem('sci_custom_years', JSON.stringify(updated));
      } catch {}
    }
    setExpandedYears((prev) => ({ ...prev, [yearToAdd]: true }));
    setSelectedRoot('FACTURES');
    setSelectedYear(yearToAdd);
    setSelectedSubfolder(null);
    setShowAddYearModal(false);
  }

  // Compteurs pour chaque dossier
  const counts = useMemo(() => {
    const byYear: Record<number, number> = {};
    const byYearSubfolder: Record<string, number> = {};
    let adminTotal = 0;
    const byAdminSubfolder: Record<string, number> = {};

    availableYears.forEach((y) => {
      byYear[y] = 0;
      INVOICE_SUBFOLDERS.forEach((sub) => {
        byYearSubfolder[`${y}_${sub}`] = 0;
      });
    });
    ADMIN_SUBFOLDERS.forEach((sub) => {
      byAdminSubfolder[sub] = 0;
    });

    allDocuments.forEach((doc) => {
      if (doc.document_type === 'facture' || !doc.document_type) {
        const y = doc.folder_year || (doc.document_date ? new Date(doc.document_date).getFullYear() : selectedYear);
        byYear[y] = (byYear[y] || 0) + 1;
        const key = `${y}_${doc.category}`;
        byYearSubfolder[key] = (byYearSubfolder[key] || 0) + 1;
      } else {
        adminTotal += 1;
        byAdminSubfolder[doc.category] = (byAdminSubfolder[doc.category] || 0) + 1;
      }
    });

    return {
      all: allDocuments.length,
      byYear,
      byYearSubfolder,
      adminTotal,
      byAdminSubfolder,
    };
  }, [allDocuments, availableYears, selectedYear]);

  // Documents filtrés selon le dossier sélectionné
  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((doc) => {
      if (selectedRoot === 'FACTURES') {
        const isFacture = doc.document_type === 'facture' || !doc.document_type;
        if (!isFacture) return false;
        const y = doc.folder_year || (doc.document_date ? new Date(doc.document_date).getFullYear() : null);
        if (selectedYear && y !== selectedYear) return false;
        if (selectedSubfolder && doc.category !== selectedSubfolder) return false;
      } else if (selectedRoot === 'ADMIN') {
        if (doc.document_type !== 'administratif') return false;
        if (selectedSubfolder && doc.category !== selectedSubfolder) return false;
      }
      return true;
    });
  }, [allDocuments, selectedRoot, selectedYear, selectedSubfolder]);

  // Total TTC des factures affichées
  const totalAmountTtc = useMemo(() => {
    return filteredDocuments.reduce((acc, d) => acc + (d.amount_ttc ? Number(d.amount_ttc) : 0), 0);
  }, [filteredDocuments]);

  // Préparation du formulaire lors d'un nouveau dépôt
  function openUploadForCurrentFolder() {
    setError('');
    setFile(null);
    setDetectionNotice(null);
    setSupplier('');
    setDocumentDate('');
    setAmountTtc('');
    setNotes('');
    setCustomCategory('');

    if (selectedRoot === 'ADMIN') {
      setFormType('administratif');
      setFormCategory(selectedSubfolder || 'Statuts & Kbis');
    } else {
      setFormType('facture');
      setFormYear(selectedYear);
      setFormCategory(selectedSubfolder || '07 - Autres factures');
    }
    setShowUploadModal(true);
  }

  // Analyse intelligente quand un fichier est choisi
  function handleFileSelected(newFile: File) {
    setFile(newFile);
    const detection = autoDetectFromFilename(newFile.name);
    setFormType(detection.type);
    if (detection.year) setFormYear(detection.year);
    setFormCategory(detection.category);
    setDetectionNotice(
      `Dossier détecté automatiquement : ${
        detection.type === 'facture' ? `Factures ${detection.year} > ` : 'Juridique > '
      }${detection.category}`
    );
  }

  // Handlers pour le Glisser-Déposer global
  function handlePageDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (isManager && !isPageDragging) {
      setIsPageDragging(true);
    }
  }

  function handlePageDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.relatedTarget === null) {
      setIsPageDragging(false);
    }
  }

  function handlePageDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsPageDragging(false);
    if (!isManager) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelected(droppedFile);
      setError('');
      setShowUploadModal(true);
    }
  }

  // Upload d'un document
  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', formType);
    if (formType === 'facture') {
      formData.append('folder_year', String(formYear));
    }
    const cat = customCategory.trim() || formCategory;
    formData.append('category', cat);
    formData.append('supplier', supplier);
    if (documentDate) formData.append('document_date', documentDate);
    if (amountTtc) formData.append('amount_ttc', amountTtc);
    formData.append('notes', notes);

    try {
      await documentsApi.upload(formData);
      setShowUploadModal(false);
      setFile(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erreur lors de l'envoi du document");
    } finally {
      setUploading(false);
    }
  }

  // Ouverture de l'édition d'un document
  function openEditModal(doc: DocumentItem) {
    setEditingDoc(doc);
    setFormType((doc.document_type as any) || 'facture');
    setFormYear(doc.folder_year || new Date().getFullYear());
    setFormCategory(doc.category || '');
    setCustomCategory('');
    setSupplier(doc.supplier || '');
    setDocumentDate(doc.document_date || '');
    setAmountTtc(doc.amount_ttc !== null ? String(doc.amount_ttc) : '');
    setNotes(doc.notes || '');
    setError('');
  }

  // Sauvegarde des modifications d'un document
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDoc) return;

    setSavingEdit(true);
    setError('');

    const cat = customCategory.trim() || formCategory;

    try {
      await documentsApi.update(editingDoc.id, {
        document_type: formType,
        folder_year: formType === 'facture' ? formYear : null,
        category: cat,
        supplier: supplier,
        document_date: documentDate || null,
        amount_ttc: amountTtc ? parseFloat(amountTtc) : null,
        notes: notes,
      });
      setEditingDoc(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors de la modification');
    } finally {
      setSavingEdit(false);
    }
  }

  // Téléchargement d'un fichier
  async function handleDownload(doc: DocumentItem) {
    setDownloadingId(doc.id);
    try {
      await documentsApi.downloadBlob(doc.id, doc.original_filename);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors du téléchargement du fichier');
    } finally {
      setDownloadingId(null);
    }
  }

  // Export ZIP du dossier sélectionné
  async function handleExportZip() {
    setExportingZip(true);
    try {
      const params: any = {};
      let fallbackName = `${sciName}_Documents.zip`;

      if (selectedRoot === 'FACTURES') {
        params.document_type = 'facture';
        params.folder_year = selectedYear;
        fallbackName = `Factures_${selectedYear}_${sciName.replace(/\s+/g, '_')}.zip`;
        if (selectedSubfolder) {
          params.category = selectedSubfolder;
          fallbackName = `Factures_${selectedYear}_${selectedSubfolder}_${sciName.replace(/\s+/g, '_')}.zip`;
        }
      } else if (selectedRoot === 'ADMIN') {
        params.document_type = 'administratif';
        fallbackName = `Documents_Juridiques_${sciName.replace(/\s+/g, '_')}.zip`;
        if (selectedSubfolder) {
          params.category = selectedSubfolder;
          fallbackName = `Juridique_${selectedSubfolder}_${sciName.replace(/\s+/g, '_')}.zip`;
        }
      }

      await documentsApi.exportZip(params, fallbackName);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de la génération de l'archive ZIP");
    } finally {
      setExportingZip(false);
    }
  }

  // Suppression
  async function handleDelete(id: number) {
    if (!confirm('Voulez-vous vraiment supprimer ce document ?')) return;
    try {
      await documentsApi.delete(id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la suppression');
    }
  }

  // Icône par type de fichier
  function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-rose-500" />;
    if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext || ''))
      return <FileImage className="w-5 h-5 text-blue-500" />;
    if (['csv', 'xlsx', 'xls'].includes(ext || ''))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    return <File className="w-5 h-5 text-slate-400" />;
  }

  // Icône par catégorie de facture
  function getSubfolderIcon(name: string) {
    if (name.includes('Banque')) return <Landmark size={14} className="text-amber-600" />;
    if (name.includes('EDF')) return <Zap size={14} className="text-yellow-500" />;
    if (name.includes('Eau')) return <Droplets size={14} className="text-blue-500" />;
    if (name.includes('Fibre')) return <Wifi size={14} className="text-orange-500" />;
    if (name.includes('Assurance')) return <Shield size={14} className="text-indigo-500" />;
    if (name.includes('Impôts')) return <Receipt size={14} className="text-red-500" />;
    if (name.includes('Kbis') || name.includes('Statuts')) return <Scale size={14} className="text-purple-600" />;
    if (name.includes('PV')) return <FileCheck size={14} className="text-teal-600" />;
    if (name.includes('Rapports') || name.includes('SPANC')) return <Activity size={14} className="text-emerald-600" />;
    if (name.includes('Appels')) return <Coins size={14} className="text-blue-600" />;
    return <Folder size={14} className="text-slate-400" />;
  }

  // Titre convivial du dossier courant pour l'en-tête de droite
  const currentFolderTitle = useMemo(() => {
    if (selectedRoot === 'ALL') return 'Tous les documents';
    if (selectedRoot === 'FACTURES') {
      return selectedSubfolder ? `Factures ${selectedYear} › ${selectedSubfolder}` : `Factures ${selectedYear}`;
    }
    if (selectedRoot === 'ADMIN') {
      return selectedSubfolder ? `Juridique & Administratif › ${selectedSubfolder}` : 'Juridique & Administratif';
    }
    return '';
  }, [selectedRoot, selectedYear, selectedSubfolder]);

  return (
    <div
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
      className="space-y-5 animate-fade-in relative min-h-[600px]"
    >
      {/* Overlay glisser-déposer global */}
      {isPageDragging && (
        <div className="fixed inset-0 bg-indigo-950/70 z-50 backdrop-blur-xs flex items-center justify-center p-8 pointer-events-none">
          <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center space-y-4 border-2 border-indigo-400 shadow-2xl animate-bounce">
            <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <UploadCloud size={36} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Déposez votre document ici
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Le dossier sera automatiquement reconnu selon le nom du fichier
              </p>
            </div>
          </div>
        </div>
      )}

      {/* En-tête principal épuré */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">{sciName}</h1>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                Archivage & Documents
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Classement des factures d'exploitation et des pièces juridiques
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportZip}
            disabled={exportingZip || allDocuments.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all disabled:opacity-50"
            title="Télécharger l'arborescence sélectionnée en ZIP"
          >
            <Archive size={15} />
            <span>{exportingZip ? 'Génération...' : 'Télécharger en ZIP'}</span>
          </button>

          {isManager && (
            <button
              onClick={openUploadForCurrentFolder}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
            >
              <Upload size={15} />
              <span>Ajouter un document</span>
            </button>
          )}
        </div>
      </div>

      {/* Explorateur 2 Colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Colonne Gauche : Arbre des dossiers */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Dossiers
              </span>
              <button
                onClick={() => {
                  setSelectedRoot('ALL');
                  setSelectedSubfolder(null);
                }}
                className={`text-xs font-bold px-2 py-0.5 rounded-lg transition-colors ${
                  selectedRoot === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Tout voir ({counts.all})
              </button>
            </div>

            {/* Section 1 : FACTURES PAR ANNÉE */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-600" />
                  <span>Factures d'exploitation</span>
                </div>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewYearInput(new Date().getFullYear() - 1);
                      setShowAddYearModal(true);
                    }}
                    className="flex items-center gap-1 text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
                    title="Ajouter une nouvelle année (ex: 2025, 2024)"
                  >
                    <PlusCircle size={12} />
                    <span>+ Année</span>
                  </button>
                )}
              </div>

              {availableYears.map((year) => {
                const isYearSelected = selectedRoot === 'FACTURES' && selectedYear === year && !selectedSubfolder;
                const isExpanded = !!expandedYears[year];
                const yearCount = counts.byYear[year] || 0;

                return (
                  <div key={year} className="space-y-0.5">
                    {/* Ligne Dossier Année */}
                    <div
                      className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        isYearSelected
                          ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setSelectedRoot('FACTURES');
                        setSelectedYear(year);
                        setSelectedSubfolder(null);
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedYears((prev) => ({ ...prev, [year]: !prev[year] }));
                          }}
                          className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        {isExpanded ? (
                          <FolderOpen size={16} className="text-indigo-500 shrink-0" />
                        ) : (
                          <Folder size={16} className="text-indigo-500 shrink-0" />
                        )}
                        <span className="truncate">{year}</span>
                      </div>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {yearCount}
                      </span>
                    </div>

                    {/* Sous-dossiers de l'année */}
                    {isExpanded && (
                      <div className="pl-6 space-y-0.5 border-l-2 border-slate-100 ml-4 py-1">
                        {INVOICE_SUBFOLDERS.map((subfolder) => {
                          const isSubSelected =
                            selectedRoot === 'FACTURES' &&
                            selectedYear === year &&
                            selectedSubfolder === subfolder;
                          const subCount = counts.byYearSubfolder[`${year}_${subfolder}`] || 0;

                          return (
                            <div
                              key={subfolder}
                              onClick={() => {
                                setSelectedRoot('FACTURES');
                                setSelectedYear(year);
                                setSelectedSubfolder(subfolder);
                              }}
                              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                                isSubSelected
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:bg-slate-100/80'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {getSubfolderIcon(subfolder)}
                                <span className="truncate">{subfolder}</span>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-1.5 rounded-full ${
                                  isSubSelected
                                    ? 'bg-white/20 text-white'
                                    : subCount > 0
                                    ? 'bg-slate-100 text-slate-700 font-extrabold'
                                    : 'text-slate-400'
                                }`}
                              >
                                {subCount}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section 2 : JURIDIQUE & ADMINISTRATIF */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <div
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                  selectedRoot === 'ADMIN' && !selectedSubfolder
                    ? 'bg-indigo-50 text-indigo-700 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => {
                  setSelectedRoot('ADMIN');
                  setSelectedSubfolder(null);
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAdminExpanded(!isAdminExpanded);
                    }}
                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  >
                    {isAdminExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  {isAdminExpanded ? (
                    <FolderOpen size={16} className="text-teal-600 shrink-0" />
                  ) : (
                    <Folder size={16} className="text-teal-600 shrink-0" />
                  )}
                  <span className="truncate">Juridique & Administratif</span>
                </div>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700">
                  {counts.adminTotal}
                </span>
              </div>

              {/* Sous-dossiers Administratifs */}
              {isAdminExpanded && (
                <div className="pl-6 space-y-0.5 border-l-2 border-slate-100 ml-4 py-1">
                  {ADMIN_SUBFOLDERS.map((subfolder) => {
                    const isSubSelected =
                      selectedRoot === 'ADMIN' && selectedSubfolder === subfolder;
                    const subCount = counts.byAdminSubfolder[subfolder] || 0;

                    return (
                      <div
                        key={subfolder}
                        onClick={() => {
                          setSelectedRoot('ADMIN');
                          setSelectedSubfolder(subfolder);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                          isSubSelected
                            ? 'bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {getSubfolderIcon(subfolder)}
                          <span className="truncate">{subfolder}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 rounded-full ${
                            isSubSelected
                              ? 'bg-white/20 text-white'
                              : subCount > 0
                              ? 'bg-slate-100 text-slate-700 font-extrabold'
                              : 'text-slate-400'
                          }`}
                        >
                          {subCount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Colonne Droite : Vue directe et épurée des documents du dossier */}
        <div className="lg:col-span-8 space-y-4">
          {/* En-tête du dossier actif */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  {currentFolderTitle}
                </h2>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                  {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''}
                </span>
                {totalAmountTtc > 0 && selectedRoot === 'FACTURES' && (
                  <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                    Total: {totalAmountTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € TTC
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {selectedRoot === 'FACTURES'
                  ? `Factures pour l'exercice ${selectedYear}`
                  : selectedRoot === 'ADMIN'
                  ? 'Actes, statuts et pièces officielles de la SCI'
                  : 'Tous les documents confondus'}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {filteredDocuments.length > 0 && (
                <button
                  onClick={handleExportZip}
                  disabled={exportingZip}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                  title="Télécharger ce dossier en ZIP"
                >
                  <Archive size={14} />
                  <span>ZIP</span>
                </button>
              )}

              {isManager && (
                <button
                  onClick={openUploadForCurrentFolder}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                >
                  <Upload size={14} />
                  <span>Ajouter ici</span>
                </button>
              )}
            </div>
          </div>

          {/* Tableau direct des documents */}
          {loading ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-slate-200">
              <div className="animate-spin w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          ) : filteredDocuments.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Document & Fichier</th>
                      <th className="py-3 px-3">Dossier</th>
                      <th className="py-3 px-3">Montant TTC</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Nom du document et fichier */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-start gap-2.5">
                            <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl shrink-0 mt-0.5">
                              {getFileIcon(doc.original_filename)}
                            </div>
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-extrabold text-slate-900 text-xs break-words">
                                {doc.supplier || doc.original_filename}
                              </p>
                              <p className="font-mono text-[11px] text-slate-400 break-all">
                                {doc.original_filename}
                              </p>
                              {doc.notes && (
                                <p className="text-[11px] text-slate-500 italic mt-0.5">
                                  {doc.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Dossier / Catégorie */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                            {getSubfolderIcon(doc.category)}
                            <span>{doc.category || 'Non classé'}</span>
                          </span>
                        </td>

                        {/* Montant TTC */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {doc.amount_ttc !== null && doc.amount_ttc !== undefined ? (
                            <span className="font-extrabold text-slate-800 text-xs">
                              {Number(doc.amount_ttc).toLocaleString('fr-FR', {
                                minimumFractionDigits: 2,
                              })} €
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-500 font-medium">
                          {doc.document_date
                            ? new Date(doc.document_date).toLocaleDateString('fr-FR')
                            : new Date(doc.created_at).toLocaleDateString('fr-FR')}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                            title="Télécharger / Consulter"
                          >
                            <Download size={13} />
                            <span>{downloadingId === doc.id ? '...' : 'Consulter'}</span>
                          </button>

                          {isManager && (
                            <>
                              <button
                                onClick={() => openEditModal(doc)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-block"
                                title="Déplacer de dossier ou modifier"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDelete(doc.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-block"
                                title="Supprimer"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
                <FolderOpen size={24} />
              </div>
              <div>
                <p className="font-extrabold text-slate-700 text-sm">Ce dossier est vide</p>
                <p className="text-xs text-slate-400 mt-1">
                  Glissez-déposez un fichier ou cliquez ci-dessous pour ajouter un document.
                </p>
              </div>
              {isManager && (
                <button
                  onClick={openUploadForCurrentFolder}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs"
                >
                  <Upload size={14} />
                  <span>Déposer un document ici</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modale d'Ajout d'une nouvelle année */}
      {showAddYearModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Ajouter une année
              </h3>
              <button
                onClick={() => setShowAddYearModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Indiquez l'année à créer pour les factures d'exploitation (ex: 2025, 2024, 2027). Les 7 sous-dossiers seront créés automatiquement.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddYear(newYearInput);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Année
                </label>
                <input
                  type="number"
                  min={1990}
                  max={2100}
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddYearModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Créer l'année
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'Upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Upload size={18} />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Ajouter une pièce / facture
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              {/* Sélecteur de fichier */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fichier PDF ou Image <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.csv,.xlsx"
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl p-1"
                />
              </div>

              {/* Notice détection auto */}
              {detectionNotice && (
                <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs font-bold">
                  <Sparkles size={16} className="text-amber-600 shrink-0" />
                  <span>{detectionNotice}</span>
                </div>
              )}

              {/* Type : Facture vs Juridique */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormType('facture');
                    setFormCategory('07 - Autres factures');
                  }}
                  className={`p-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                    formType === 'facture'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Facture d'exploitation
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormType('administratif');
                    setFormCategory('Statuts & Kbis');
                  }}
                  className={`p-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                    formType === 'administratif'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Juridique & Administratif
                </button>
              </div>

              {/* Si Facture : Année et sous-dossier */}
              {formType === 'facture' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Année (Exercice)
                    </label>
                    <input
                      type="number"
                      value={formYear}
                      onChange={(e) => setFormYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Dossier Facture
                    </label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      {INVOICE_SUBFOLDERS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Catégorie Administrative
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    {ADMIN_SUBFOLDERS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Fournisseur & Montant TTC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Fournisseur / Titre
                  </label>
                  <input
                    type="text"
                    placeholder="ex: EDF, Orange, Notaire..."
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Date de la pièce
                  </label>
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                  />
                </div>
              </div>

              {formType === 'facture' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Montant TTC (€) (optionnel)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amountTtc}
                    onChange={(e) => setAmountTtc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Notes / Observations
                </label>
                <input
                  type="text"
                  placeholder="ex: Échéancier annuel, réclamation..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <span>Envoi en cours...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Classer le document</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'Édition / Déplacement */}
      {editingDoc && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Modifier ou déplacer le document
              </h3>
              <button
                onClick={() => setEditingDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] font-extrabold text-slate-500 uppercase">Fichier</p>
                <p className="font-mono text-xs text-slate-800 break-all font-bold mt-0.5">
                  {editingDoc.original_filename}
                </p>
              </div>

              {/* Type */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormType('facture')}
                  className={`p-2 rounded-xl text-xs font-extrabold border ${
                    formType === 'facture'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  Facture
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('administratif')}
                  className={`p-2 rounded-xl text-xs font-extrabold border ${
                    formType === 'administratif'
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  Juridique
                </button>
              </div>

              {/* Destination */}
              {formType === 'facture' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Année</label>
                    <input
                      type="number"
                      value={formYear}
                      onChange={(e) => setFormYear(parseInt(e.target.value, 10) || 2026)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Dossier</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    >
                      {INVOICE_SUBFOLDERS.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Catégorie</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    {ADMIN_SUBFOLDERS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Fournisseur / Nom
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              {formType === 'facture' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Montant TTC (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountTtc}
                    onChange={(e) => setAmountTtc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
