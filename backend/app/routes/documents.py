import os
import uuid
from datetime import date
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_manager
from app.config import settings
from app.database import get_db
from app.models import Document
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


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    category: str | None = None,
    fiscal_year_id: int | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(Document)
    if category and category != "Toutes":
        query = query.filter(Document.category == category)
    if fiscal_year_id:
        query = query.filter(Document.fiscal_year_id == fiscal_year_id)
    if search:
        query = query.filter(
            (Document.original_filename.ilike(f"%{search}%"))
            | (Document.supplier.ilike(f"%{search}%"))
            | (Document.notes.ilike(f"%{search}%"))
        )

    documents = query.order_by(Document.created_at.desc()).all()
    return documents


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("administratif"),
    category: str = Form("Autre"),
    supplier: str = Form(""),
    document_date: str | None = Form(None),
    notes: str = Form(""),
    fiscal_year_id: int | None = Form(None),
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    ext = os.path.splitext(file.filename or "")[1]
    saved_filename = f"{uuid.uuid4().hex}{ext}"
    upload_dir = get_upload_dir()
    file_path = os.path.join(upload_dir, saved_filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    doc_date = None
    if document_date:
        try:
            doc_date = date.fromisoformat(document_date)
        except ValueError:
            doc_date = None

    doc = Document(
        document_type=document_type,
        category=category,
        supplier=supplier,
        original_filename=file.filename or "fichier",
        file_path=file_path,
        document_date=doc_date,
        notes=notes,
        fiscal_year_id=fiscal_year_id,
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

    if req.category is not None:
        doc.category = req.category
    if req.supplier is not None:
        doc.supplier = req.supplier
    if req.document_date is not None:
        doc.document_date = req.document_date
    if req.notes is not None:
        doc.notes = req.notes

    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(404, "Document introuvable")

    if not os.path.exists(doc.file_path):
        raise HTTPException(404, "Fichier physique non trouvé sur le serveur")

    return FileResponse(
        path=doc.file_path,
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

    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass

    db.delete(doc)
    db.commit()
    return {"message": "Document supprimé"}
