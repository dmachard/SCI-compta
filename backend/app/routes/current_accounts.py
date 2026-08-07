from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_manager
from app.database import get_db
from app.models import Associate, CurrentAccountMovement, BankTransaction
from app.schemas import (
    CurrentAccountBalance,
    CurrentAccountMovementCreate,
    CurrentAccountMovementResponse,
)

router = APIRouter(prefix="/api/current-accounts", tags=["comptes courants"])


@router.get("", response_model=list[CurrentAccountBalance])
def get_all_balances(
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    associates = db.query(Associate).filter(Associate.is_active).all()
    result = []
    for a in associates:
        movements = (
            db.query(CurrentAccountMovement)
            .filter(CurrentAccountMovement.associate_id == a.id)
            .all()
        )
        total_paid = sum(m.amount for m in movements if m.movement_type == "versement")
        total_refunded = sum(
            m.amount for m in movements if m.movement_type == "remboursement"
        )
        capital_txs = (
            db.query(BankTransaction)
            .filter(BankTransaction.associate_id == a.id, BankTransaction.category == "Apport au capital", BankTransaction.reconciliation_status == "rapprochee")
            .all()
        )
        capital_paid = sum(float(t.amount) for t in capital_txs)
        
        result.append(
            CurrentAccountBalance(
                associate_id=a.id,
                last_name=a.last_name,
                first_name=a.first_name,
                total_paid=total_paid,
                total_refunded=total_refunded,
                balance=total_paid - total_refunded,
                capital_paid=capital_paid,
            )
        )
    return result


@router.get(
    "/{associate_id}/movements", response_model=list[CurrentAccountMovementResponse]
)
def get_movements(
    associate_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    movements = (
        db.query(CurrentAccountMovement)
        .filter(CurrentAccountMovement.associate_id == associate_id)
        .order_by(CurrentAccountMovement.movement_date.desc())
        .all()
    )
    return movements


@router.post("", response_model=CurrentAccountMovementResponse)
def create_movement(
    data: CurrentAccountMovementCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    # Vérifier que l'associé existe
    associate = db.query(Associate).filter(Associate.id == data.associate_id).first()
    if not associate:
        raise HTTPException(404, "Associé non trouvé")

    if data.movement_type not in ("versement", "remboursement"):
        raise HTTPException(400, "Type de mouvement invalide (versement ou remboursement)")

    if data.amount <= 0:
        raise HTTPException(400, "Le montant doit être positif")

    movement = CurrentAccountMovement(**data.model_dump())
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement
