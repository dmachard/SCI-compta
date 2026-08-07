from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import require_manager
from app.database import get_db
from app.models import SCI
from app.schemas import SCIResponse, SCIUpdate

router = APIRouter(prefix="/api/sci", tags=["sci"])


def get_sci_or_404(db: Session) -> SCI:
    sci = db.query(SCI).first()
    if not sci:
        raise HTTPException(404, "SCI non configurée")
    return sci


@router.get("", response_model=SCIResponse)
def get_sci(db: Session = Depends(get_db)):
    return get_sci_or_404(db)


@router.put("", response_model=SCIResponse)
def update_sci(
    data: SCIUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    sci = get_sci_or_404(db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sci, field, value)
    db.commit()
    db.refresh(sci)
    return sci


@router.delete("/reset")
def reset_database(
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    """
    Hard reset of the database (removes absolutely everything, including users and SCI).
    """
    from app.models import (
        BankTransaction,
        BankAccount,
        CurrentAccountMovement,
        Associate,
        FiscalYear,
        Document,
        Property,
        User,
        SCI
    )
    
    # Delete in correct order to respect foreign keys
    db.query(Document).delete()
    db.query(CurrentAccountMovement).delete()
    db.query(BankTransaction).delete()
    db.query(BankAccount).delete()
    db.query(User).delete()
    db.query(Associate).delete()
    db.query(Property).delete()
    db.query(FiscalYear).delete()
    db.query(SCI).delete()
    
    db.commit()
    return {"message": "Database tables have been successfully reset."}
