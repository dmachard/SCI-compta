from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import SCI, Associate
from app.schemas import CapitalEntry, CapitalRegister

router = APIRouter(prefix="/api/capital", tags=["capital"])


@router.get("", response_model=CapitalRegister)
def get_capital_register(
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    sci = db.query(SCI).first()
    associates = db.query(Associate).filter(Associate.is_active).all()

    total_shares = sum(a.shares for a in associates)
    share_value = sci.share_nominal_value if sci else 0
    total_capital = sci.share_capital if sci else 0

    entries = []
    for a in associates:
        qp = (a.shares / total_shares * 100) if total_shares > 0 else 0
        entries.append(
            CapitalEntry(
                associate_id=a.id,
                last_name=a.last_name,
                first_name=a.first_name,
                shares=a.shares,
                quote_part=round(qp, 2),
                capital_amount=a.shares * share_value,
            )
        )

    return CapitalRegister(
        total_capital=total_capital,
        total_shares=total_shares,
        share_nominal_value=share_value,
        entries=entries,
    )
