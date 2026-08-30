from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract, func as sql_func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_manager
from app.database import get_db
from app.models import (
    SCI,
    Associate,
    BankAccount,
    BankTransaction,
    Budget,
    BudgetItem,
    FiscalYear,
    FundCall,
    FundCallBudgetItem,
    FundCallLine,
)
from app.schemas import (
    BudgetItemCreate,
    BudgetItemResponse,
    BudgetItemUpdate,
    BudgetSummaryResponse,
    BudgetTableItemResponse,
    BudgetYearCreate,
    ExpenseCreate,
    FundCallBudgetItemResponse,
    FundCallCreate,
    FundCallLineResponse,
    FundCallLineUpdate,
    FundCallResponse,
)

router = APIRouter(prefix="/api/budget", tags=["budget"])


def _get_sci(db: Session) -> SCI:
    sci = db.query(SCI).first()
    if not sci:
        raise HTTPException(400, "SCI non configurée")
    return sci


# ─── 1. Routes Statiques & Dépenses ───────────────────────────


@router.get("/years", response_model=list[int])
def list_budget_years(db: Session = Depends(get_db), _=Depends(get_current_user)):
    years = [y[0] for y in db.query(Budget.year).distinct().order_by(Budget.year.desc()).all()]
    current_year = date.today().year
    if not years:
        years = [current_year]
    elif current_year not in years:
        years.insert(0, current_year)
        years.sort(reverse=True)
    return years


@router.post("/expenses")
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    item = db.query(BudgetItem).filter(BudgetItem.id == data.budget_item_id).first()
    if not item:
        raise HTTPException(404, "Poste budgétaire introuvable")

    account = db.query(BankAccount).first()
    if not account:
        sci = _get_sci(db)
        account = BankAccount(sci_id=sci.id, bank_name="Banque Principale", label="Compte principal")
        db.add(account)
        db.flush()

    fy = (
        db.query(FiscalYear)
        .filter(FiscalYear.start_date <= data.date, FiscalYear.end_date >= data.date)
        .first()
    )

    amount = -abs(data.amount)
    tx = BankTransaction(
        bank_account_id=account.id,
        fiscal_year_id=fy.id if fy else None,
        transaction_date=data.date,
        original_label=data.label,
        amount=amount,
        category="Charges, Eau & Électricité",
        third_party=data.third_party or item.supplier or "",
        notes=data.notes or "",
        reconciliation_status="rapprochee",
        budget_item_id=item.id,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return {"message": "Dépense enregistrée avec succès", "transaction_id": tx.id}


@router.put("/items/{item_id}", response_model=BudgetItemResponse)
def update_budget_item(
    item_id: int,
    data: BudgetItemUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Poste budgétaire introuvable")

    for field, val in data.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(item, field, val)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}")
def delete_budget_item(
    item_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    item = db.query(BudgetItem).filter(BudgetItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Poste budgétaire introuvable")

    db.query(BankTransaction).filter(BankTransaction.budget_item_id == item.id).update(
        {"budget_item_id": None}
    )
    db.delete(item)
    db.commit()
    return {"message": "Poste budgétaire supprimé avec succès"}


# ─── 2. Appels de fonds ───────────────────────────────────────


@router.get("/fund-calls", response_model=list[FundCallResponse])
def list_fund_calls(
    year: int = Query(..., description="Année de l'appel de fonds"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    calls = (
        db.query(FundCall)
        .filter(extract("year", FundCall.call_date) == year)
        .order_by(FundCall.call_date.desc(), FundCall.id.desc())
        .all()
    )

    all_assocs = db.query(Associate).filter(Associate.is_active).all()
    total_shares = sum(a.shares for a in all_assocs) or 1

    results: list[FundCallResponse] = []
    for call in calls:
        paid_amount = sum(float(line.amount_paid or 0) for line in call.lines)
        rem_amount = max(0.0, float(call.total_amount) - paid_amount)

        b_items_res: list[FundCallBudgetItemResponse] = []
        for bi in call.budget_items:
            b_items_res.append(
                FundCallBudgetItemResponse(
                    id=bi.id,
                    budget_item_id=bi.budget_item_id,
                    name=bi.budget_item.name if bi.budget_item else "Poste",
                    icon=bi.budget_item.icon if bi.budget_item else "⚡",
                    amount=float(bi.amount),
                )
            )

        lines_res: list[FundCallLineResponse] = []
        for line in call.lines:
            assoc = line.associate
            lines_res.append(
                FundCallLineResponse(
                    id=line.id,
                    associate_id=line.associate_id,
                    associate_name=f"{assoc.first_name} {assoc.last_name}" if assoc else "Associé",
                    shares=assoc.shares if assoc else 0,
                    quote_part=round(((assoc.shares if assoc else 0) / total_shares * 100), 2),
                    amount_due=float(line.amount_due),
                    amount_paid=float(line.amount_paid or 0),
                    is_paid=float(line.amount_paid or 0) >= float(line.amount_due),
                    payment_date=line.payment_date,
                    bank_transaction_id=line.bank_transaction_id,
                )
            )

        results.append(
            FundCallResponse(
                id=call.id,
                call_number=call.call_number or f"#{call.id:03d}",
                call_date=call.call_date,
                due_date=call.due_date,
                purpose=call.purpose,
                total_amount=float(call.total_amount),
                amount_paid=round(paid_amount, 2),
                amount_remaining=round(rem_amount, 2),
                status=call.status,
                budget_items=b_items_res,
                lines=lines_res,
            )
        )

    return results


@router.post("/fund-calls", response_model=FundCallResponse)
def create_fund_call(
    data: FundCallCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    associates = db.query(Associate).filter(Associate.is_active).all()
    if not associates:
        raise HTTPException(400, "Aucun associé actif trouvé pour répartir l'appel de fonds")

    total_shares = sum(a.shares for a in associates)
    if total_shares <= 0:
        raise HTTPException(400, "Le total des parts sociales est nul")

    items = (
        db.query(BudgetItem)
        .filter(BudgetItem.id.in_(data.selected_item_ids))
        .all()
    )
    if not items:
        raise HTTPException(400, "Veuillez sélectionner au moins un poste budgétaire")

    total_amount = sum(float(it.amount or 0) for it in items)
    if total_amount <= 0:
        raise HTTPException(400, "Le montant total des postes sélectionnés doit être supérieur à 0")

    if not data.call_number:
        count = (
            db.query(sql_func.count(FundCall.id))
            .filter(extract("year", FundCall.call_date) == data.year)
            .scalar()
            or 0
        )
        call_num = f"N° {data.year}-{count + 1:03d}"
    else:
        call_num = data.call_number

    fy = (
        db.query(FiscalYear)
        .filter(FiscalYear.start_date <= data.call_date, FiscalYear.end_date >= data.call_date)
        .first()
    )

    fund_call = FundCall(
        fiscal_year_id=fy.id if fy else None,
        call_number=call_num,
        call_date=data.call_date,
        due_date=data.due_date,
        purpose=data.purpose,
        total_amount=round(total_amount, 2),
        status="en_attente",
    )
    db.add(fund_call)
    db.flush()

    for item in items:
        fc_item = FundCallBudgetItem(
            fund_call_id=fund_call.id,
            budget_item_id=item.id,
            amount=item.amount,
        )
        db.add(fc_item)

    cumulated = 0.0
    for i, assoc in enumerate(associates):
        quote_part = assoc.shares / total_shares
        if i == len(associates) - 1:
            amount_due = round(total_amount - cumulated, 2)
        else:
            amount_due = round(total_amount * quote_part, 2)
            cumulated += amount_due

        line = FundCallLine(
            fund_call_id=fund_call.id,
            associate_id=assoc.id,
            amount_due=amount_due,
            amount_paid=0.0,
        )
        db.add(line)

    db.commit()
    db.refresh(fund_call)

    res_list = list_fund_calls(year=data.year, db=db)
    created = next((r for r in res_list if r.id == fund_call.id), None)
    if not created:
        raise HTTPException(500, "Erreur lors de la création de l'appel de fonds")
    return created


@router.put("/fund-calls/{call_id}/lines/{line_id}", response_model=FundCallResponse)
def update_fund_call_line(
    call_id: int,
    line_id: int,
    data: FundCallLineUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    call = db.query(FundCall).filter(FundCall.id == call_id).first()
    if not call:
        raise HTTPException(404, "Appel de fonds introuvable")

    line = (
        db.query(FundCallLine)
        .filter(FundCallLine.id == line_id, FundCallLine.fund_call_id == call_id)
        .first()
    )
    if not line:
        raise HTTPException(404, "Ligne d'appel de fonds introuvable")

    if data.is_paid is not None:
        if data.is_paid:
            line.amount_paid = line.amount_due
            line.payment_date = data.payment_date or date.today()
        else:
            line.amount_paid = 0.0
            line.payment_date = None

    if data.amount_paid is not None:
        line.amount_paid = data.amount_paid
        if data.payment_date:
            line.payment_date = data.payment_date
        elif line.amount_paid >= line.amount_due and not line.payment_date:
            line.payment_date = date.today()

    if data.bank_transaction_id is not None:
        line.bank_transaction_id = data.bank_transaction_id

    db.flush()
    total_due = float(call.total_amount)
    total_paid = sum(float(l.amount_paid or 0) for l in call.lines)

    if total_paid >= total_due:
        call.status = "solde"
    elif total_paid > 0:
        call.status = "partiel"
    else:
        call.status = "en_attente"

    db.commit()

    call_year = call.call_date.year
    res_list = list_fund_calls(year=call_year, db=db)
    updated = next((r for r in res_list if r.id == call.id), None)
    if not updated:
        raise HTTPException(500, "Erreur lors du rechargement de l'appel de fonds")
    return updated


@router.delete("/fund-calls/{call_id}")
def delete_fund_call(
    call_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    call = db.query(FundCall).filter(FundCall.id == call_id).first()
    if not call:
        raise HTTPException(404, "Appel de fonds introuvable")

    db.delete(call)
    db.commit()
    return {"message": "Appel de fonds supprimé avec succès"}


# ─── 3. Routes Paramétrées Année (/{year}) ────────────────────


@router.get("/{year}", response_model=BudgetSummaryResponse)
def get_budget_summary(
    year: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    sci = _get_sci(db)
    budget = db.query(Budget).filter(Budget.year == year).first()

    if not budget:
        return BudgetSummaryResponse(
            year=year,
            budget_id=0,
            total_forecast=0.0,
            total_real=0.0,
            total_variance=0.0,
            consumption_rate=0.0,
            items=[],
        )

    items = db.query(BudgetItem).filter(BudgetItem.budget_id == budget.id).order_by(BudgetItem.id).all()

    table_items: list[BudgetTableItemResponse] = []
    total_forecast = 0.0
    total_real = 0.0

    for item in items:
        forecast = float(item.amount or 0.0)

        txs = (
            db.query(BankTransaction)
            .filter(
                BankTransaction.budget_item_id == item.id,
                extract("year", BankTransaction.transaction_date) == year,
            )
            .all()
        )
        real = sum(abs(float(t.amount)) for t in txs if t.amount < 0)

        variance = round(real - forecast, 2)
        consumption = round((real / forecast * 100), 1) if forecast > 0 else 0.0

        total_forecast += forecast
        total_real += real

        table_items.append(
            BudgetTableItemResponse(
                id=item.id,
                name=item.name,
                icon=item.icon or "⚡",
                supplier=item.supplier or "",
                periodicity=item.periodicity or "annuelle",
                forecast=round(forecast, 2),
                real=round(real, 2),
                variance=variance,
                consumption_rate=consumption,
            )
        )

    total_variance = round(total_real - total_forecast, 2)
    overall_consumption = round((total_real / total_forecast * 100), 1) if total_forecast > 0 else 0.0

    return BudgetSummaryResponse(
        year=year,
        budget_id=budget.id,
        total_forecast=round(total_forecast, 2),
        total_real=round(total_real, 2),
        total_variance=total_variance,
        consumption_rate=overall_consumption,
        items=table_items,
    )


@router.post("/{year}", response_model=BudgetSummaryResponse)
def create_or_copy_budget(
    year: int,
    req: BudgetYearCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    sci = _get_sci(db)
    budget = db.query(Budget).filter(Budget.year == year).first()
    if not budget:
        budget = Budget(sci_id=sci.id, year=year)
        db.add(budget)
        db.flush()

    if req.copy_from_year:
        source_budget = db.query(Budget).filter(Budget.year == req.copy_from_year).first()
        if source_budget:
            db.query(BudgetItem).filter(BudgetItem.budget_id == budget.id).delete()
            for src_item in source_budget.items:
                new_item = BudgetItem(
                    budget_id=budget.id,
                    name=src_item.name,
                    icon=src_item.icon,
                    supplier=src_item.supplier,
                    amount=src_item.amount,
                    periodicity=src_item.periodicity,
                )
                db.add(new_item)
            db.commit()
            return get_budget_summary(year=year, db=db)

    db.commit()
    return get_budget_summary(year=year, db=db)


@router.post("/{year}/items", response_model=BudgetItemResponse)
def create_budget_item(
    year: int,
    data: BudgetItemCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    sci = _get_sci(db)
    budget = db.query(Budget).filter(Budget.year == year).first()
    if not budget:
        budget = Budget(sci_id=sci.id, year=year)
        db.add(budget)
        db.flush()

    item = BudgetItem(
        budget_id=budget.id,
        name=data.name,
        icon=data.icon or "⚡",
        supplier=data.supplier or "",
        amount=data.amount,
        periodicity=data.periodicity or "annuelle",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
