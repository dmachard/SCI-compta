import io
import os
import re
import uuid
import zipfile
from datetime import date
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_manager
from app.config import settings
from app.database import get_db
from app.models import Document, SCI
from app.schemas import DocumentResponse, DocumentUpdateRequest

router = APIRouter(prefix="/api/documents", tags=["documents"])


def get_upload_dir() -> str:
    target_dir = getattr(settings, "UPLOAD_DIR", "uploads")
    try:
        os.makedirs(target_dir, exist_ok=True)
        return target_dir
    except OSError:
        fallback = os.path.join(os.getcwd(), "uploads")
        os.makedirs(fallback, exist_ok=True)
        return fallback


def get_safe_sci_folder(db: Session) -> str:
    sci = db.query(SCI).first()
    name = (sci.name if sci and sci.name else "SCI LA GUERMONDERIE").strip()
    safe = re.sub(r'[\\/*?:"<>|]', "_", name)
    return safe or "SCI"


def auto_detect_category(filename: str) -> tuple[str, str, int | None]:
    """
    Détecte automatiquement le type, la catégorie et éventuellement l'année
    à partir du nom du fichier pour faciliter le classement.
    """
    fn = filename.lower()

    # Détection de l'année (ex: 2024, 2025, 2026)
    year_match = re.search(r'\b(202\d)\b', fn)
    year = int(year_match.group(1)) if year_match else None

    # Factures courantes
    if any(k in fn for k in ["edf", "electricite", "électricité", "engie", "totalenergies"]):
        return "facture", "02 - EDF", year
    if any(k in fn for k in ["eau", "veolia", "suez", "saur"]):
        return "facture", "03 - Eau", year
    if any(k in fn for k in ["fibre", "orange", "free", "sfr", "bouygues", "internet"]):
        return "facture", "04 - Fibre", year
    if any(k in fn for k in ["assurance", "assur", "axa", "allianz", "macif", "maif", "matmut", "generali", "pno"]):
        return "facture", "05 - Assurance", year
    if any(k in fn for k in ["taxe", "impot", "impôt", "foncier", "fonciere", "foncière", "cfe"]):
        return "facture", "06 - Impôts / Taxe foncière", year
    if any(k in fn for k in ["banque", "releve", "relevé", "agios", "frais bancaires"]):
        return "facture", "01 - Banque", year

    # Pièces administratives & juridiques
    if any(k in fn for k in ["kbis", "k-bis", "extrait"]):
        return "administratif", "Statuts & Kbis", year
    if any(k in fn for k in ["statut", "statuts"]):
        return "administratif", "Statuts & Kbis", year
    if any(k in fn for k in ["pv d'ag", "pv ag", "proces verbal", "procès-verbal", "assemblee", "assemblée"]):
        return "administratif", "PV d'AG", year
    if any(k in fn for k in ["spanc", "diagnostic", "dpe", "amiante", "plomb", "assainissement", "rapport vente"]):
        return "administratif", "Rapports & Diagnostics", year
    if any(k in fn for k in ["appel de fond", "appel de fonds", "appel_de_fond"]):
        return "administratif", "Appels de fonds", year
    if any(k in fn for k in ["chiffre d affaires", "chiffre d'affaires", "attestation"]):
        return "administratif", "Attestations & Actes", year
    if any(k in fn for k in ["bail", "contrat"]):
        return "administratif", "Baux & Contrats", year

    return "facture", "07 - Autres factures", year


def find_actual_file_path(doc_path: str, filename: str) -> str | None:
    """Trouve le fichier physique même s'il a été déplacé ou est relatif."""
    if os.path.isabs(doc_path) and os.path.exists(doc_path):
        return doc_path
    upload_dir = get_upload_dir()
    candidate = os.path.join(upload_dir, os.path.basename(doc_path))
    if os.path.exists(candidate):
        return candidate
    candidate_file = os.path.join(upload_dir, filename)
    if os.path.exists(candidate_file):
        return candidate_file
    return None


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    document_type: str | None = None,
    folder_year: int | None = None,
    category: str | None = None,
    fiscal_year_id: int | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(Document)

    # Reclassement automatique transparent des documents qui étaient à l'origine classés sous 'Autre'
    legacy_others = db.query(Document).filter(
        (Document.category == "Autre") | (Document.category == "") | (Document.category.is_(None))
    ).all()
    if legacy_others:
        modified = False
        for doc in legacy_others:
            dtype, cat, y = auto_detect_category(doc.original_filename)
            doc.document_type = dtype
            doc.category = cat
            if not doc.folder_year and y:
                doc.folder_year = y
            modified = True
        if modified:
            db.commit()

    if document_type and document_type != "Tous":
        query = query.filter(Document.document_type == document_type)
    if folder_year:
        query = query.filter(Document.folder_year == folder_year)
    if category and category != "Toutes" and category != "Tous":
        query = query.filter(Document.category == category)
    if fiscal_year_id:
        query = query.filter(Document.fiscal_year_id == fiscal_year_id)
    if search:
        query = query.filter(
            (Document.original_filename.ilike(f"%{search}%"))
            | (Document.supplier.ilike(f"%{search}%"))
            | (Document.notes.ilike(f"%{search}%"))
            | (Document.category.ilike(f"%{search}%"))
        )

    documents = query.order_by(Document.created_at.desc()).all()
    return documents


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("facture"),
    folder_year: int | None = Form(None),
    category: str = Form(""),
    supplier: str = Form(""),
    document_date: str | None = Form(None),
    amount_ht: float | None = Form(None),
    tva: float | None = Form(None),
    amount_ttc: float | None = Form(None),
    notes: str = Form(""),
    fiscal_year_id: int | None = Form(None),
    bank_transaction_id: int | None = Form(None),
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    clean_filename = file.filename or "fichier"
    # Détection intelligente si les champs ne sont pas fournis
    suggested_type, suggested_cat, suggested_year = auto_detect_category(clean_filename)

    final_type = document_type or suggested_type or "facture"
    final_cat = category.strip() if category else suggested_cat

    doc_date = None
    if document_date:
        try:
            doc_date = date.fromisoformat(document_date)
        except ValueError:
            doc_date = None

    final_year = folder_year
    if final_year is None:
        if doc_date:
            final_year = doc_date.year
        elif suggested_year:
            final_year = suggested_year
        elif final_type == "facture":
            final_year = date.today().year

    # Création du chemin d'arborescence physique
    upload_dir = get_upload_dir()
    sci_folder = get_safe_sci_folder(db)

    if final_type == "facture":
        subpath = os.path.join(sci_folder, str(final_year), final_cat or "07 - Autres factures")
    else:
        subpath = os.path.join(sci_folder, "Juridique & Administratif", final_cat or "Autres")

    target_dir = os.path.join(upload_dir, subpath)
    os.makedirs(target_dir, exist_ok=True)

    ext = os.path.splitext(clean_filename)[1]
    saved_filename = f"{uuid.uuid4().hex[:8]}_{clean_filename}"
    file_path = os.path.join(target_dir, saved_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    doc = Document(
        document_type=final_type,
        folder_year=final_year,
        category=final_cat,
        supplier=supplier,
        original_filename=clean_filename,
        file_path=file_path,
        document_date=doc_date,
        amount_ht=amount_ht,
        tva=tva,
        amount_ttc=amount_ttc,
        notes=notes,
        fiscal_year_id=fiscal_year_id,
        bank_transaction_id=bank_transaction_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.put("/{doc_id}", response_model=DocumentResponse)
def update_document(
    doc_id: int,
    req: DocumentUpdateRequest,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document introuvable")

    if req.document_type is not None:
        doc.document_type = req.document_type
    if req.folder_year is not None:
        doc.folder_year = req.folder_year
    if req.category is not None:
        doc.category = req.category
    if req.supplier is not None:
        doc.supplier = req.supplier
    if req.document_date is not None:
        doc.document_date = req.document_date
    if req.amount_ht is not None:
        doc.amount_ht = req.amount_ht
    if req.tva is not None:
        doc.tva = req.tva
    if req.amount_ttc is not None:
        doc.amount_ttc = req.amount_ttc
    if req.notes is not None:
        doc.notes = req.notes

    db.commit()
    db.refresh(doc)
    return doc


@router.get("/export-zip")
def export_documents_zip(
    document_type: str | None = None,
    folder_year: int | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Génère à la volée une archive ZIP contenant l'arborescence sélectionnée
    (ex: toutes les factures 2026 avec les sous-dossiers 01 - Banque, 02 - EDF...).
    """
    query = db.query(Document)
    if document_type and document_type != "Tous":
        query = query.filter(Document.document_type == document_type)
    if folder_year:
        query = query.filter(Document.folder_year == folder_year)
    if category and category != "Toutes" and category != "Tous":
        query = query.filter(Document.category == category)

    docs = query.all()
    if not docs:
        raise HTTPException(404, "Aucun document à exporter pour cette sélection")

    sci = db.query(SCI).first()
    sci_name = (sci.name if sci and sci.name else "SCI LA GUERMONDERIE").strip()
    safe_sci = re.sub(r'[\\/*?:"<>|]', "_", sci_name)

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        seen_paths = set()
        for doc in docs:
            real_path = find_actual_file_path(doc.file_path, doc.original_filename)
            if not real_path or not os.path.exists(real_path):
                continue

            # Construction du chemin propre à l'intérieur du ZIP
            if doc.document_type == "facture":
                year_str = str(doc.folder_year or (doc.document_date.year if doc.document_date else "Factures"))
                cat_str = doc.category or "07 - Autres factures"
                rel_dir = os.path.join(year_str, cat_str)
            else:
                cat_str = doc.category or "Documents"
                rel_dir = os.path.join("Juridique & Administratif", cat_str)

            file_base = doc.original_filename or f"doc_{doc.id}.pdf"
            entry_name = os.path.join(rel_dir, file_base)

            # Éviter collisions de noms de fichiers identiques dans le même sous-dossier
            counter = 1
            name_part, ext_part = os.path.splitext(file_base)
            while entry_name in seen_paths:
                entry_name = os.path.join(rel_dir, f"{name_part}_{counter}{ext_part}")
                counter += 1
            seen_paths.add(entry_name)

            zip_file.write(real_path, arcname=entry_name)

    zip_buffer.seek(0)

    # Détermination du nom de fichier de téléchargement
    if folder_year and document_type == "facture":
        zip_filename = f"Factures_{folder_year}_{safe_sci}.zip"
    elif document_type == "administratif":
        zip_filename = f"Documents_Juridiques_{safe_sci}.zip"
    else:
        zip_filename = f"Archive_Documents_{safe_sci}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=utf-8''{quote(zip_filename)}"
        },
    )


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document introuvable")

    real_path = find_actual_file_path(doc.file_path, doc.original_filename)
    if not real_path or not os.path.exists(real_path):
        raise HTTPException(404, "Fichier physique non trouvé sur le serveur")

    return FileResponse(
        path=real_path,
        filename=doc.original_filename,
        media_type="application/octet-stream",
    )


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document introuvable")

    real_path = find_actual_file_path(doc.file_path, doc.original_filename)
    if real_path and os.path.exists(real_path):
        try:
            os.remove(real_path)
        except OSError:
            pass

    db.delete(doc)
    db.commit()
    return {"message": "Document supprimé"}
