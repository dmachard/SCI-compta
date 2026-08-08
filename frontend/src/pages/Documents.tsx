import { useEffect, useState } from 'react';
import {
  FolderArchive,
  Upload,
  Search,
  FileText,
  Download,
  Trash2,
  X,
  FileSpreadsheet,
  FileImage,
  File,
  UploadCloud,
  LayoutList,
  Grid,
  Pencil,
} from 'lucide-react';
import { documentsApi, authApi } from '../api';
import type { DocumentItem, User } from '../types';

export default function DocumentsPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allDocuments, setAllDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);

  // Drag & drop state
  const [isPageDragging, setIsPageDragging] = useState(false);
  const [isModalDragging, setIsModalDragging] = useState(false);

  // Upload Form State
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  function loadData() {
    setLoading(true);
    Promise.all([
      documentsApi.list(),
      authApi.me().catch(() => null),
    ])
      .then(([docs, me]) => {
        setAllDocuments(docs);
        setCurrentUser(me);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  const isManager = currentUser?.role === 'gerant';

  // Extraire dynamiquement les catégories uniques créées à la main
  const uniqueCategories = [
    'Tous',
    ...Array.from(
      new Set(allDocuments.map((d) => d.category.trim()).filter(Boolean))
    ),
  ];

  // Filtrage côté client pour réactivité instantanée
  const filteredDocuments = allDocuments.filter((doc) => {
    const matchesCategory =
      selectedCategory === 'Tous' || doc.category.trim() === selectedCategory;
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      doc.original_filename.toLowerCase().includes(searchLower) ||
      doc.supplier.toLowerCase().includes(searchLower) ||
      doc.notes.toLowerCase().includes(searchLower) ||
      doc.category.toLowerCase().includes(searchLower);

    return matchesCategory && matchesSearch;
  });

  // Handlers pour le Glisser-Déposer sur toute la page
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
      setFile(droppedFile);
      setError('');
      setShowUploadModal(true);
    }
  }

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
    formData.append('category', category.trim() || 'Autre');
    formData.append('supplier', supplier);
    if (documentDate) formData.append('document_date', documentDate);
    formData.append('notes', notes);

    try {
      await documentsApi.upload(formData);
      setShowUploadModal(false);
      setFile(null);
      setCategory('');
      setSupplier('');
      setDocumentDate('');
      setNotes('');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erreur lors de l'envoi du document");
    } finally {
      setUploading(false);
    }
  }

  function openEditModal(doc: DocumentItem) {
    setEditingDoc(doc);
    setCategory(doc.category || '');
    setSupplier(doc.supplier || '');
    setDocumentDate(doc.document_date || '');
    setNotes(doc.notes || '');
    setError('');
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDoc) return;

    setSavingEdit(true);
    setError('');

    try {
      await documentsApi.update(editingDoc.id, {
        category: category.trim() || 'Autre',
        supplier: supplier,
        document_date: documentDate || null,
        notes: notes,
      });
      setEditingDoc(null);
      setCategory('');
      setSupplier('');
      setDocumentDate('');
      setNotes('');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erreur lors de la modification');
    } finally {
      setSavingEdit(false);
    }
  }

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
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext || ''))
      return <FileImage className="w-5 h-5 text-blue-500" />;
    if (['csv', 'xlsx', 'xls'].includes(ext || ''))
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    return <File className="w-5 h-5 text-slate-400" />;
  }

  return (
    <div
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
      className="space-y-6 animate-fade-in relative min-h-[500px]"
    >
      {/* Overlay visuel de glisser-déposer global */}
      {isPageDragging && (
        <div className="fixed inset-0 bg-indigo-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-8 pointer-events-none">
          <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center space-y-4 border-2 border-indigo-400 shadow-2xl animate-bounce">
            <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <UploadCloud size={36} />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Déposez votre document ici
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Le formulaire d'envoi s'ouvrira automatiquement
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Bloc d'en-tête */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <FolderArchive className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-extrabold text-slate-900">
                Documents administratifs
              </h1>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Stockage & archivage des pièces officielles de la SCI (Baux, Statuts, Factures, Kbis...)
            </p>
          </div>

          {isManager && (
            <button
              onClick={() => {
                setError('');
                setCategory('');
                setSupplier('');
                setDocumentDate('');
                setNotes('');
                setFile(null);
                setShowUploadModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md self-start md:self-auto"
            >
              <Upload size={16} />
              <span>Ajouter un document</span>
            </button>
          )}
        </div>

        {/* Filtres par tags dynamiques, recherche & Sélecteur d'affichage */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            {uniqueCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            {/* Commutateur de mode d'affichage */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Affichage en liste / tableau (noms complets)"
              >
                <LayoutList size={16} />
                <span className="hidden sm:inline">Tableau</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Affichage en grille de cartes"
              >
                <Grid size={16} />
                <span className="hidden sm:inline">Grille</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des documents */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      ) : filteredDocuments.length > 0 ? (
        viewMode === 'table' ? (
          /* Mode Affichage Tableau (Sans aucun nom coupé) */
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Document & Fichier</th>
                    <th className="py-3.5 px-4">Tag / Catégorie</th>
                    <th className="py-3.5 px-4">Notes</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Document & Fichier */}
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl shrink-0 mt-0.5">
                            {getFileIcon(doc.original_filename)}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-extrabold text-slate-900 text-sm break-words">
                              {doc.supplier || doc.original_filename}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500 break-all">
                              {doc.original_filename}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Tag / Catégorie */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {doc.category ? (
                          <span className="inline-block text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg font-extrabold border border-indigo-100">
                            {doc.category}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-4 px-4 text-slate-600 max-w-xs break-words">
                        {doc.notes || <span className="text-slate-300 italic">Aucune note</span>}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-4 whitespace-nowrap text-slate-500 font-medium">
                        {doc.document_date
                          ? new Date(doc.document_date).toLocaleDateString('fr-FR')
                          : new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => handleDownload(doc)}
                          disabled={downloadingId === doc.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                          title="Télécharger / Consulter"
                        >
                          <Download size={14} />
                          <span>{downloadingId === doc.id ? 'Chargement...' : 'Consulter'}</span>
                        </button>

                        {isManager && (
                          <>
                            <button
                              onClick={() => openEditModal(doc)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-block"
                              title="Modifier le tag / document"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-block"
                              title="Supprimer"
                            >
                              <Trash2 size={16} />
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
          /* Mode Affichage Grille de cartes */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl shrink-0 mt-0.5">
                        {getFileIcon(doc.original_filename)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-sm text-slate-900 break-words leading-snug">
                          {doc.supplier || doc.original_filename}
                        </h3>
                        <p className="text-[11px] font-mono text-slate-500 break-all mt-0.5">
                          {doc.original_filename}
                        </p>
                      </div>
                    </div>

                    {doc.category && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-extrabold border border-indigo-100 shrink-0">
                        {doc.category}
                      </span>
                    )}
                  </div>

                  {doc.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 break-words">
                      {doc.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {doc.document_date
                      ? new Date(doc.document_date).toLocaleDateString('fr-FR')
                      : new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloadingId === doc.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                      title="Télécharger / Consulter"
                    >
                      <Download size={14} />
                      <span>{downloadingId === doc.id ? 'Chargement...' : 'Consulter'}</span>
                    </button>

                    {isManager && (
                      <>
                        <button
                          onClick={() => openEditModal(doc)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Modifier le tag / document"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center text-slate-500 shadow-sm space-y-3">
          <FolderArchive className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-base font-extrabold text-slate-800">Aucun document trouvé</p>
          <p className="text-xs text-slate-500">
            {isManager
              ? 'Glissez-déposez un fichier directement ici ou cliquez sur "Ajouter un document".'
              : 'Aucun document n\'a encore été partagé.'}
          </p>
        </div>
      )}

      {/* Modal d'Upload de document */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-fade-in border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  Déposer un document
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              {/* Dropzone interactif */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Fichier (PDF, Image, Document...) *
                </label>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsModalDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsModalDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsModalDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      setFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById('modal-file-input')?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                    isModalDragging
                      ? 'border-indigo-500 bg-indigo-50/80 scale-[1.01]'
                      : file
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/30'
                  }`}
                >
                  <input
                    id="modal-file-input"
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />

                  {file ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl shrink-0">
                          {getFileIcon(file.name)}
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 break-all">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-indigo-600 font-bold hover:underline shrink-0">
                        Changer
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                        <UploadCloud size={22} />
                      </div>
                      <div>
                        <p className="text-xs font-extrabold text-slate-800">
                          Glissez-déposez votre fichier ici
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                          ou cliquez pour parcourir vos dossiers
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tag / Catégorie personnalisé
                  </label>
                  <input
                    type="text"
                    list="existing-tags"
                    placeholder="ex: Baux, Statuts, Taxe 2026..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="existing-tags">
                    {uniqueCategories
                      .filter((c) => c !== 'Tous')
                      .map((c) => (
                        <option key={c} value={c} />
                      ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date du document
                  </label>
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Titre / Libellé explicatif
                </label>
                <input
                  type="text"
                  placeholder="ex: Bail d'habitation Appartement 1 - 2026"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes & Commentaires
                </label>
                <textarea
                  rows={2}
                  placeholder="Remarques complémentaires..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 font-medium resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all disabled:opacity-50"
                >
                  {uploading ? 'Envoi...' : 'Déposer le document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'Édition du Tag & informations d'un document */}
      {editingDoc && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-fade-in border border-slate-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-900 text-base">
                  Modifier le tag & les informations
                </h3>
              </div>
              <button
                onClick={() => setEditingDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-[11px] font-bold text-slate-500">Fichier associé :</p>
                <p className="text-xs font-mono text-slate-900 break-all mt-0.5">
                  {editingDoc.original_filename}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tag / Catégorie personnalisé
                  </label>
                  <input
                    type="text"
                    list="existing-tags-edit"
                    placeholder="ex: Baux, Statuts, Taxe 2026..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id="existing-tags-edit">
                    {uniqueCategories
                      .filter((c) => c !== 'Tous')
                      .map((c) => (
                        <option key={c} value={c} />
                      ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Date du document
                  </label>
                  <input
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Titre / Libellé explicatif
                </label>
                <input
                  type="text"
                  placeholder="ex: Bail d'habitation Appartement 1 - 2026"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes & Commentaires
                </label>
                <textarea
                  rows={2}
                  placeholder="Remarques complémentaires..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 font-medium resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all disabled:opacity-50"
                >
                  {savingEdit ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
