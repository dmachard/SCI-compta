from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func as sql_func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_manager
from app.database import get_db
from app.models import (
    SCI,
    Associate,
    CurrentAccountMovement,
    FundCallLine,
)
from app.schemas import (
    AssociateCreate,
    AssociateResponse,
    AssociateSummary,
    AssociateUpdate,
)

router = APIRouter(prefix="/api/associates", tags=["associés"])


def _get_total_shares(db: Session) -> int:
    result = db.query(sql_func.sum(Associate.shares)).filter(Associate.is_active).scalar()
    return result or 0


def _enrich_response(associate: Associate, total_shares: int) -> AssociateResponse:
    quote_part = (associate.shares / total_shares * 100) if total_shares > 0 else 0
    resp = AssociateResponse.model_validate(associate)
    resp.quote_part = round(quote_part, 2)
    return resp


@router.get("", response_model=list[AssociateResponse])
def list_associates(
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    associates = db.query(Associate).filter(Associate.is_active).all()
    total = _get_total_shares(db)
    return [_enrich_response(a, total) for a in associates]


@router.post("", response_model=AssociateResponse)
def create_associate(
    data: AssociateCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    sci = db.query(SCI).first()
    if not sci:
        raise HTTPException(400, "SCI non configurée")
    associate = Associate(sci_id=sci.id, **data.model_dump())
    db.add(associate)
    db.commit()
    db.refresh(associate)
    total = _get_total_shares(db)
    return _enrich_response(associate, total)


@router.get("/{associate_id}", response_model=AssociateResponse)
def get_associate(
    associate_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    associate = db.query(Associate).filter(Associate.id == associate_id).first()
    if not associate:
        raise HTTPException(404, "Associé non trouvé")
    total = _get_total_shares(db)
    return _enrich_response(associate, total)


@router.put("/{associate_id}", response_model=AssociateResponse)
def update_associate(
    associate_id: int,
    data: AssociateUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    associate = db.query(Associate).filter(Associate.id == associate_id).first()
    if not associate:
        raise HTTPException(404, "Associé non trouvé")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(associate, field, value)
    db.commit()
    db.refresh(associate)
    total = _get_total_shares(db)
    return _enrich_response(associate, total)


@router.get("/{associate_id}/summary", response_model=AssociateSummary)
def get_associate_summary(
    associate_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    associate = db.query(Associate).filter(Associate.id == associate_id).first()
    if not associate:
        raise HTTPException(404, "Associé non trouvé")

    total_shares = _get_total_shares(db)
    quote_part = (associate.shares / total_shares * 100) if total_shares > 0 else 0

    sci = db.query(SCI).first()
    share_value = sci.share_nominal_value if sci else 0
    capital_amount = associate.shares * share_value

    # Comptes courants
    movements = (
        db.query(CurrentAccountMovement)
        .filter(CurrentAccountMovement.associate_id == associate_id)
        .all()
    )
    total_paid = sum(m.amount for m in movements if m.movement_type == "versement")
    total_refunded = sum(
        m.amount for m in movements if m.movement_type == "remboursement"
    )
    balance = total_paid - total_refunded

    # Appels de fonds
    fund_lines = (
        db.query(FundCallLine)
        .filter(FundCallLine.associate_id == associate_id)
        .all()
    )
    total_due = sum(fl.amount_due for fl in fund_lines)
    total_fc_paid = sum(fl.amount_paid for fl in fund_lines)

    return AssociateSummary(
        id=associate.id,
        last_name=associate.last_name,
        first_name=associate.first_name,
        shares=associate.shares,
        quote_part=round(quote_part, 2),
        capital_amount=capital_amount,
        total_paid_current_account=total_paid,
        total_refunded_current_account=total_refunded,
        current_account_balance=balance,
        total_fund_calls_due=total_due,
        total_fund_calls_paid=total_fc_paid,
        fund_calls_remaining=total_due - total_fc_paid,
    )
