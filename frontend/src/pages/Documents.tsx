import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Download,
  Trash2,
  X,
  FileSpreadsheet,
  FileImage,
  File,
  UploadCloud,
  FolderOpen,
  Archive,
  Calendar,
  Zap,
  Droplets,
  Wifi,
  Shield,
  Receipt,
  Landmark,
  FileCheck,
  Scale,
  Coins,
  Loader2,
  FolderArchive,
  Tag,
  PlusCircle,
} from 'lucide-react';
import { documentsApi, authApi, sciApi } from '../api';
import type { DocumentItem, DocumentCategoryItem, User, SCI } from '../types';

export function cleanCategory(cat: string | null | undefined): string {
  if (!cat) return 'Autres';
  const clean = cat.replace(/^\d+\s*-\s*/, '').trim();
  if (['Autres factures', 'Autre', 'Attestations & Actes', 'Rapports & Diagnostics', 'Baux & Contrats', ''].includes(clean)) {
    return 'Autres';
  }
  return clean;
}

export function autoDetectFromFilename(fileName: string, availableCategories: string[] = []): {
  year: number;
  category: string;
} {
  const fn = fileName.toLowerCase();
  const yearMatch = fn.match(/\b(202\d)\b/);
  const detectedYear = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

  // Détection par correspondance directe avec les catégories existantes
  for (const cat of availableCategories) {
    const catLower = cat.toLowerCase();
    if (catLower !== 'autres' && fn.includes(catLower)) {
      return { year: detectedYear, category: cat };
    }
  }

  // Mots-clés courants en français pour le classement automatique
  const keywordMap: Record<string, string[]> = {
    'EDF': ['edf', 'electricite', 'électricité', 'engie', 'totalenergies'],
    'Eau': ['eau', 'veolia', 'suez', 'saur'],
    'Fibre': ['fibre', 'orange', 'free', 'sfr', 'bouygues', 'internet'],
    'Assurance': ['assurance', 'assur', 'axa', 'allianz', 'macif', 'maif', 'matmut', 'generali', 'pno'],
    'Impôts / Taxe foncière': ['taxe', 'impot', 'impôt', 'foncier', 'fonciere', 'foncière', 'cfe'],
    'Banque': ['banque', 'releve', 'relevé', 'agios', 'frais bancaires'],
    'Statuts & Kbis': ['kbis', 'k-bis', 'extrait', 'statut', 'statuts'],
    "PV d'AG": ["pv d'ag", 'pv ag', 'proces verbal', 'procès-verbal', 'assemblee', 'assemblée'],
    'Appels de fonds': ['appel de fond', 'appel de fonds', 'appel_de_fond'],
  };

  for (const [targetCat, keywords] of Object.entries(keywordMap)) {
    if (availableCategories.includes(targetCat) && keywords.some((k) => fn.includes(k))) {
      return { year: detectedYear, category: targetCat };
    }
  }

  return { year: detectedYear, category: 'Autres' };
}

export default function DocumentsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sciInfo, setSciInfo] = useState<SCI | null>(null);
  const [allDocuments, setAllDocuments] = useState<DocumentItem[]>([]);
  const [categories, setCategories] = useState<DocumentCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres horizontaux : Année sélectionnée + Tag sélectionné
  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>(new Date().getFullYear());
  const [selectedSubfolder, setSelectedSubfolder] = useState<string | null>(null);

  // Années personnalisées mémorisées
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

  // Nouveau Tag dynamique
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [savingTag, setSavingTag] = useState(false);

  // Upload direct
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [directUploading, setDirectUploading] = useState(false);
  const [directUploadCount, setDirectUploadCount] = useState<number | null>(null);
  const [isHoveringDropZone, setIsHoveringDropZone] = useState(false);

  // Téléchargements
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [exportingZip, setExportingZip] = useState(false);

  function loadData() {
    setLoading(true);
    Promise.all([
      documentsApi.list(),
      documentsApi.getCategories().catch(() => []),
      authApi.me().catch(() => null),
      sciApi.get().catch(() => null),
    ])
      .then(([docs, cats, me, sci]) => {
        setAllDocuments(docs);
        setCategories(cats);
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

  // Liste ordonnée de tous les noms de catégories disponibles
  const categoryNames = useMemo(() => {
    const names = categories.map((c) => c.name);
    // Assurer que les catégories présentes sur les documents sont bien dans la liste
    allDocuments.forEach((doc) => {
      const c = cleanCategory(doc.category);
      if (c && !names.includes(c)) {
        names.push(c);
      }
    });
    if (!names.includes('Autres')) {
      names.push('Autres');
    }
    return names;
  }, [categories, allDocuments]);

  // Années disponibles
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>([new Date().getFullYear(), ...customYears]);
    allDocuments.forEach((doc) => {
      const y = doc.folder_year || (doc.document_date ? new Date(doc.document_date).getFullYear() : null);
      if (y) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [allDocuments, customYears]);

  useEffect(() => {
    if (selectedYear !== 'ALL' && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [availableYears, selectedYear]);

  function handleAddYear(yearToAdd: number) {
    if (!yearToAdd || isNaN(yearToAdd) || yearToAdd < 1990 || yearToAdd > 2100) return;
    if (!customYears.includes(yearToAdd)) {
      const updated = [...customYears, yearToAdd].sort((a, b) => b - a);
      setCustomYears(updated);
      try {
        localStorage.setItem('sci_custom_years', JSON.stringify(updated));
      } catch {}
    }
    setSelectedYear(yearToAdd);
    setSelectedSubfolder(null);
    setShowAddYearModal(false);
  }

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    const clean = newTagInput.trim();
    if (!clean) return;

    setSavingTag(true);
    try {
      const created = await documentsApi.createCategory(clean);
      setCategories((prev) => {
        if (prev.some((c) => c.name.toLowerCase() === created.name.toLowerCase())) {
          return prev;
        }
        return [...prev, created];
      });
      setSelectedSubfolder(created.name);
      setShowAddTagModal(false);
      setNewTagInput('');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la création du tag');
    } finally {
      setSavingTag(false);
    }
  }

  async function handleDeleteCategory(catName: string) {
    if (catName === 'Autres') return;
    const catItem = categories.find((c) => c.name === catName);
    if (!catItem) return;

    const countUsing = allDocuments.filter((d) => cleanCategory(d.category) === catName).length;
    const message =
      countUsing > 0
        ? `Le tag « ${catName} » est utilisé par ${countUsing} document(s). Si vous le supprimez, ils seront reclassés sous « Autres ». Confirmer ?`
        : `Voulez-vous supprimer le tag « ${catName} » ?`;

    if (!confirm(message)) return;

    try {
      await documentsApi.deleteCategory(catItem.id);
      if (selectedSubfolder === catName) {
        setSelectedSubfolder(null);
      }
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la suppression du tag');
    }
  }

  // Compteurs par année et tag
  const counts = useMemo(() => {
    const byYear: Record<number, number> = {};
    const byYearSubfolder: Record<string, number> = {};

    availableYears.forEach((y) => {
      byYear[y] = 0;
      categoryNames.forEach((sub) => {
        byYearSubfolder[`${y}_${sub}`] = 0;
      });
    });

    allDocuments.forEach((doc) => {
      const y =
        doc.folder_year ||
        (doc.document_date
          ? new Date(doc.document_date).getFullYear()
          : selectedYear !== 'ALL'
          ? selectedYear
          : new Date().getFullYear());
      byYear[y] = (byYear[y] || 0) + 1;
      const cat = cleanCategory(doc.category);
      const key = `${y}_${cat}`;
      byYearSubfolder[key] = (byYearSubfolder[key] || 0) + 1;
    });

    return {
      all: allDocuments.length,
      byYear,
      byYearSubfolder,
    };
  }, [allDocuments, availableYears, categoryNames, selectedYear]);

  // Documents filtrés
  const filteredDocuments = useMemo(() => {
    return allDocuments.filter((doc) => {
      if (selectedYear !== 'ALL') {
        const y = doc.folder_year || (doc.document_date ? new Date(doc.document_date).getFullYear() : null);
        if (y && y !== selectedYear) return false;
      }
      if (selectedSubfolder) {
        const cat = cleanCategory(doc.category);
        if (cat !== selectedSubfolder) return false;
      }
      return true;
    });
  }, [allDocuments, selectedYear, selectedSubfolder]);

  // Libellé de la sélection courante pour la zone de dépôt
  const currentSelectionLabel = useMemo(() => {
    const yearLabel = selectedYear === 'ALL' ? 'Toutes les années' : String(selectedYear);
    return selectedSubfolder ? `${yearLabel} › ${selectedSubfolder}` : yearLabel;
  }, [selectedYear, selectedSubfolder]);

  // ─── UPLOAD DIRECT SANS FENÊTRE INTERMÉDIAIRE ─────────────
  async function handleDirectUpload(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    setDirectUploading(true);
    setDirectUploadCount(files.length);

    const targetYear = selectedYear === 'ALL' ? new Date().getFullYear() : selectedYear;

    for (let i = 0; i < files.length; i++) {
      const currentFile = files[i];
      const auto = autoDetectFromFilename(currentFile.name, categoryNames);

      const formData = new FormData();
      formData.append('file', currentFile);
      formData.append('folder_year', String(targetYear));
      formData.append('category', selectedSubfolder || auto.category || 'Autres');

      try {
        await documentsApi.upload(formData);
      } catch (err: any) {
        console.error('Erreur upload direct:', err);
        alert(`Erreur lors de l'ajout de ${currentFile.name}: ` + (err.response?.data?.detail || err.message));
      }
    }

    setDirectUploading(false);
    setDirectUploadCount(null);
    loadData();
  }

  async function handleDownload(doc: DocumentItem) {
    setDownloadingId(doc.id);
    try {
      await documentsApi.downloadBlob(doc.id, doc.original_filename);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors du téléchargement');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleExportZip() {
    setExportingZip(true);
    try {
      const params: any = {};
      let fallbackName = `${sciName}_Documents.zip`;

      if (selectedYear !== 'ALL') {
        params.folder_year = selectedYear;
        fallbackName = `Documents_${selectedYear}_${sciName.replace(/\s+/g, '_')}.zip`;
        if (selectedSubfolder) {
          params.category = selectedSubfolder;
          fallbackName = `${selectedYear}_${selectedSubfolder}_${sciName.replace(/\s+/g, '_')}.zip`;
        }
      }

      await documentsApi.exportZip(params, fallbackName);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Erreur lors de l'export ZIP");
    } finally {
      setExportingZip(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Voulez-vous vraiment supprimer ce document ?')) return;
    try {
      await documentsApi.delete(id);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erreur lors de la suppression');
    }
  }

  function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-rose-500" />;
    if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext || ''))
      return <FileImage className="w-5 h-5 text-blue-500" />;
    if (['csv', 'xlsx', 'xls'].includes(ext || ''))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    return <File className="w-5 h-5 text-slate-400" />;
  }

  function getSubfolderIcon(name: string) {
    if (name === 'Banque') return <Landmark size={14} className="text-amber-600" />;
    if (name === 'EDF') return <Zap size={14} className="text-yellow-500" />;
    if (name === 'Eau') return <Droplets size={14} className="text-blue-500" />;
    if (name === 'Fibre') return <Wifi size={14} className="text-orange-500" />;
    if (name === 'Assurance') return <Shield size={14} className="text-indigo-500" />;
    if (name.includes('Impôts')) return <Receipt size={14} className="text-red-500" />;
    if (name.includes('Kbis') || name.includes('Statuts')) return <Scale size={14} className="text-purple-600" />;
    if (name.includes('PV')) return <FileCheck size={14} className="text-teal-600" />;
    if (name.includes('Appels')) return <Coins size={14} className="text-blue-600" />;
    return <Tag size={13} className="text-slate-400" />;
  }

  return (
    <div className="space-y-4 animate-fade-in relative min-h-[600px]">
      {/* Input de fichier caché pour le clic sur la zone de dépôt */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleDirectUpload(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* En-tête de page épuré */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <FolderArchive className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Documents</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Classement et archivage des pièces justificatives de la SCI
            </p>
          </div>
        </div>

        {filteredDocuments.length > 0 && (
          <button
            onClick={handleExportZip}
            disabled={exportingZip}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all disabled:opacity-50 self-start md:self-auto"
            title="Télécharger la sélection en ZIP"
          >
            <Archive size={14} />
            <span>{exportingZip ? 'Génération...' : 'Télécharger en ZIP'}</span>
          </button>
        )}
      </div>

      {/* BARRE HORIZONTALE DE SÉLECTION : ANNÉE & FLAGS / TAGS DYNAMIQUES */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        {/* Ligne 1 : Année (Tags directs clairs + Bouton + Année sans doublon) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <Calendar size={14} className="text-indigo-600" />
              Année :
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  setSelectedYear('ALL');
                  setSelectedSubfolder(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                  selectedYear === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Toutes</span>
                <span
                  className={`text-[10px] px-1.5 rounded-full ${
                    selectedYear === 'ALL' ? 'bg-white/20 text-white' : 'bg-white text-slate-700 font-bold'
                  }`}
                >
                  {counts.all}
                </span>
              </button>

              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    setSelectedYear(y);
                    setSelectedSubfolder(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    selectedYear === y
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{y}</span>
                  <span
                    className={`text-[10px] px-1.5 rounded-full ${
                      selectedYear === y ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 font-bold'
                    }`}
                  >
                    {counts.byYear[y] || 0}
                  </span>
                </button>
              ))}

              {isManager && (
                <button
                  type="button"
                  onClick={() => {
                    setNewYearInput(new Date().getFullYear() - 1);
                    setShowAddYearModal(true);
                  }}
                  className="flex items-center gap-1 text-xs font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors border border-indigo-100"
                  title="Ajouter une nouvelle année"
                >
                  <span>+ Année</span>
                </button>
              )}
            </div>
          </div>

          <div className="text-xs font-bold text-slate-500">
            {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Ligne 2 : FLAGS / TAGS 100% Dynamiques avec flex-wrap (AUCUNE scrollbar, AUCUN tag en dur) */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setSelectedSubfolder(null)}
            className={`px-3 py-1.5 rounded-xl font-extrabold transition-all flex items-center gap-1.5 ${
              selectedSubfolder === null
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Tous les tags</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedSubfolder === null ? 'bg-white/20 text-white' : 'bg-white text-slate-700 font-bold'
              }`}
            >
              {selectedYear === 'ALL' ? counts.all : counts.byYear[selectedYear] || 0}
            </span>
          </button>

          {categoryNames.map((sub) => {
            const isSelected = selectedSubfolder === sub;
            const subCount =
              selectedYear === 'ALL'
                ? allDocuments.filter((d) => cleanCategory(d.category) === sub).length
                : counts.byYearSubfolder[`${selectedYear}_${sub}`] || 0;

            return (
              <div
                key={sub}
                onClick={() => setSelectedSubfolder(sub)}
                className={`group px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {getSubfolderIcon(sub)}
                <span>{sub}</span>
                <span
                  className={`text-[10px] px-1.5 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : subCount > 0
                      ? 'bg-slate-200 text-slate-800 font-extrabold'
                      : 'text-slate-400'
                  }`}
                >
                  {subCount}
                </span>

                {/* Croix de suppression proprement intégrée à l'intérieur du tag */}
                {isManager && sub !== 'Autres' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(sub);
                    }}
                    className={`opacity-0 group-hover:opacity-100 p-0.5 rounded-full transition-opacity ${
                      isSelected
                        ? 'text-white/70 hover:text-white hover:bg-white/20'
                        : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200'
                    }`}
                    title={`Supprimer le tag « ${sub} »`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}

          {/* Bouton + Tag pour ajouter dynamiquement n'importe quel tag */}
          {isManager && (
            <button
              type="button"
              onClick={() => {
                setNewTagInput('');
                setShowAddTagModal(true);
              }}
              className="flex items-center gap-1 text-xs font-extrabold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors border border-indigo-100"
              title="Créer un nouveau tag (ex: Travaux, Notaire, Syndic...)"
            >
              <PlusCircle size={13} />
              <span>+ Tag</span>
            </button>
          )}
        </div>
      </div>

      {/* ZONE DE GLISSER-DÉPOSER DIRECTE */}
      {isManager && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsHoveringDropZone(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsHoveringDropZone(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsHoveringDropZone(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleDirectUpload(e.dataTransfer.files);
            }
          }}
          onClick={() => {
            if (!directUploading) fileInputRef.current?.click();
          }}
          className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex items-center justify-center gap-3.5 ${
            isHoveringDropZone
              ? 'border-indigo-600 bg-indigo-50 scale-[1.01]'
              : 'border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/20'
          }`}
        >
          <div
            className={`p-2 rounded-xl transition-all ${
              directUploading
                ? 'bg-indigo-600 text-white animate-spin'
                : 'bg-white shadow-2xs text-indigo-600'
            }`}
          >
            {directUploading ? <Loader2 size={18} /> : <UploadCloud size={18} />}
          </div>
          <div className="text-left">
            {directUploading ? (
              <p className="text-xs font-extrabold text-indigo-700">
                Ajout en cours de {directUploadCount} fichier{directUploadCount && directUploadCount > 1 ? 's' : ''}...
              </p>
            ) : (
              <>
                <p className="text-xs font-extrabold text-slate-800">
                  Glissez vos fichiers ici (ou cliquez pour parcourir)
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  S'ajoute directement dans « {currentSelectionLabel} » sans aucune fenêtre
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* TABLEAU DES DOCUMENTS PLEINE LARGEUR (SANS MONTANT TTC, SANS ÉDITION) */}
      {loading ? (
        <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : filteredDocuments.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          {/* Tableau desktop / tablette */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Document & Fichier</th>
                  <th className="py-3 px-3">Année</th>
                  <th className="py-3 px-3">Tag / Catégorie</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
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
                            <p className="text-[11px] text-slate-500 italic mt-0.5">{doc.notes}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {doc.folder_year || (doc.document_date ? new Date(doc.document_date).getFullYear() : 2026)}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                        {getSubfolderIcon(cleanCategory(doc.category))}
                        <span>{cleanCategory(doc.category)}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap text-slate-500 font-medium">
                      {doc.document_date
                        ? new Date(doc.document_date).toLocaleDateString('fr-FR')
                        : new Date(doc.created_at).toLocaleDateString('fr-FR')}
                    </td>

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
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-block"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vue mobile : Liste sobre et nette délimitée par de fins séparateurs */}
          <div className="md:hidden divide-y divide-slate-200">
            {filteredDocuments.map((doc) => (
              <div key={doc.id} className="p-4 space-y-2.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg shrink-0 mt-0.5">
                    {getFileIcon(doc.original_filename)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-900 text-xs break-words leading-tight">
                      {doc.supplier || doc.original_filename}
                    </p>
                    <p className="font-mono text-[11px] text-slate-400 break-all mt-0.5">
                      {doc.original_filename}
                    </p>
                    {doc.notes && (
                      <p className="text-[11px] text-slate-500 italic mt-0.5">{doc.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                    {doc.folder_year || (doc.document_date ? new Date(doc.document_date).getFullYear() : 2026)}
                  </span>

                  <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                    {getSubfolderIcon(cleanCategory(doc.category))}
                    <span>{cleanCategory(doc.category)}</span>
                  </span>

                  <span className="text-[11px] text-slate-400 font-mono ml-auto">
                    {doc.document_date
                      ? new Date(doc.document_date).toLocaleDateString('fr-FR')
                      : new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingId === doc.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    <Download size={13} />
                    <span>{downloadingId === doc.id ? 'Chargement...' : 'Consulter'}</span>
                  </button>

                  {isManager && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
            <FolderOpen size={20} />
          </div>
          <p className="font-extrabold text-slate-700 text-xs">Aucun document trouvé</p>
          <p className="text-[11px] text-slate-400">
            Glissez un fichier dans la zone ci-dessus pour l'ajouter dans « {currentSelectionLabel} ».
          </p>
        </div>
      )}

      {/* Modale d'Ajout d'une nouvelle année */}
      {showAddYearModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Ajouter une année</h3>
              <button
                onClick={() => setShowAddYearModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">Indiquez l'année à créer (ex: 2025, 2024).</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddYear(newYearInput);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Année</label>
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

      {/* Modale d'Ajout d'un nouveau Tag dynamique */}
      {showAddTagModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">Nouveau Tag / Dossier</h3>
              <button
                onClick={() => setShowAddTagModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Indiquez le nom du tag à créer (ex: <strong>Travaux</strong>, <strong>Notaire</strong>, <strong>Syndic</strong>...).
            </p>
            <form onSubmit={handleAddTag} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom du tag</label>
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="ex: Travaux"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTagModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingTag || !newTagInput.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs disabled:opacity-50"
                >
                  {savingTag ? 'Création...' : 'Créer le tag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
