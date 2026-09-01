from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_manager
from app.database import get_db
from app.models import (
    Associate,
    BankAccount,
    BankTransaction,
    CurrentAccountMovement,
    FiscalYear,
    FundCall,
    FundCallLine,
    SCI,
    User,
)
from app.schemas import (
    BankAccountCreate,
    BankAccountResponse,
    BankAccountUpdate,
    BankTransactionResponse,
    ImportCSVResponse,
    ReconcileRequest,
)
from app.services.csv_parser import parse_bank_csv

router = APIRouter(prefix="/api/bank", tags=["bank"])


def get_default_sci_id(db: Session) -> int:
    sci = db.query(SCI).first()
    if not sci:
        raise HTTPException(400, "Aucune SCI n'a été configurée")
    return sci.id


@router.get("/accounts", response_model=list[BankAccountResponse])
def list_bank_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sci_id = get_default_sci_id(db)
    accounts = db.query(BankAccount).filter(BankAccount.sci_id == sci_id).all()

    # Si aucun compte bancaire n'existe, on en crée un par défaut
    if not accounts:
        default_acc = BankAccount(
            sci_id=sci_id,
            label="Compte principal",
            bank_name="Banque",
            initial_balance=0.0,
        )
        db.add(default_acc)
        db.commit()
        db.refresh(default_acc)
        accounts = [default_acc]

    result = []
    for acc in accounts:
        total_tx = (
            db.query(func.coalesce(func.sum(BankTransaction.amount), 0.0))
            .filter(BankTransaction.bank_account_id == acc.id)
            .scalar()
        )
        current_balance = float(acc.initial_balance or 0.0) + float(total_tx or 0.0)

        res = BankAccountResponse.model_validate(acc)
        res.current_balance = round(current_balance, 2)
        result.append(res)

    return result


@router.post("/accounts", response_model=BankAccountResponse)
def create_bank_account(
    req: BankAccountCreate,
    db: Session = Depends(get_db),
    _ = Depends(require_manager),
):
    sci_id = get_default_sci_id(db)
    acc = BankAccount(
        sci_id=sci_id,
        bank_name=req.bank_name,
        iban=req.iban,
        bic=req.bic,
        label=req.label,
        initial_balance=req.initial_balance,
        initial_balance_date=req.initial_balance_date,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)

    res = BankAccountResponse.model_validate(acc)
    res.current_balance = req.initial_balance
    return res


@router.put("/accounts/{account_id}", response_model=BankAccountResponse)
def update_bank_account(
    account_id: int,
    req: BankAccountUpdate,
    db: Session = Depends(get_db),
    _ = Depends(require_manager),
):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(440, "Compte bancaire introuvable")

    if req.bank_name is not None:
        acc.bank_name = req.bank_name
    if req.iban is not None:
        acc.iban = req.iban
    if req.bic is not None:
        acc.bic = req.bic
    if req.label is not None:
        acc.label = req.label
    if req.initial_balance is not None:
        acc.initial_balance = req.initial_balance
    if req.initial_balance_date is not None:
        acc.initial_balance_date = req.initial_balance_date

    db.commit()
    db.refresh(acc)

    total_tx = (
        db.query(func.coalesce(func.sum(BankTransaction.amount), 0.0))
        .filter(BankTransaction.bank_account_id == acc.id)
        .scalar()
    )
    res = BankAccountResponse.model_validate(acc)
    res.current_balance = round(float(acc.initial_balance or 0.0) + float(total_tx or 0.0), 2)
    return res


@router.get("/transactions", response_model=list[BankTransactionResponse])
def list_transactions(
    account_id: int | None = None,
    status: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sci_id = get_default_sci_id(db)

    query = (
        db.query(BankTransaction)
        .join(BankAccount)
        .filter(BankAccount.sci_id == sci_id)
    )

    if account_id:
        query = query.filter(BankTransaction.bank_account_id == account_id)
    if status:
        query = query.filter(BankTransaction.reconciliation_status == status)
    if search:
        query = query.filter(BankTransaction.original_label.ilike(f"%{search}%"))

    transactions = query.order_by(
        BankTransaction.transaction_date.desc(), BankTransaction.id.desc()
    ).all()

    return [BankTransactionResponse.model_validate(t) for t in transactions]


@router.post("/import-csv", response_model=ImportCSVResponse)
async def import_bank_csv(
    file: UploadFile = File(...),
    account_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _ = Depends(require_manager),
):
    sci_id = get_default_sci_id(db)

    if not account_id:
        acc = db.query(BankAccount).filter(BankAccount.sci_id == sci_id).first()
        if not acc:
            acc = BankAccount(sci_id=sci_id, label="Compte principal", bank_name="Banque")
            db.add(acc)
            db.commit()
            db.refresh(acc)
        account_id = acc.id
    else:
        acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
        if not acc:
            raise HTTPException(400, "Compte bancaire spécifié inexistant")

    content = await file.read()
    parsed_txs = parse_bank_csv(content)

    if not parsed_txs:
        raise HTTPException(400, "Aucune transaction valide n'a pu être extraite du fichier CSV")

    # Récupérer les associés pour l'auto-détection
    associates = db.query(Associate).filter(Associate.sci_id == sci_id).all()

    # Récupérer les exercices comptables
    fiscal_years = db.query(FiscalYear).filter(FiscalYear.sci_id == sci_id).all()

    imported_count = 0
    skipped_count = 0

    for p_tx in parsed_txs:
        # Vérifier si l'hash existe déjà pour ce compte
        existing = (
            db.query(BankTransaction)
            .filter(
                BankTransaction.bank_account_id == account_id,
                BankTransaction.import_hash == p_tx["import_hash"],
            )
            .first()
        )
        if existing:
            skipped_count += 1
            continue

        tx_date = date.fromisoformat(p_tx["transaction_date"])

        # Trouver l'exercice comptable correspondant
        fy_id = None
        for fy in fiscal_years:
            if fy.start_date <= tx_date <= fy.end_date:
                fy_id = fy.id
                break

        # Auto-détection de l'associé dans le libellé
        matched_associate_id = None
        category = ""
        movement_type = ""
        rec_status = "a_traiter"

        label_upper = p_tx["original_label"].upper()

        # 1. Chercher un match prénom + nom
        for assoc in associates:
            first_upper = assoc.first_name.strip().upper()
            last_upper = assoc.last_name.strip().upper()

            if first_upper and len(first_upper) >= 3 and first_upper in label_upper:
                matched_associate_id = assoc.id
                break

        # 2. Si pas trouvé par prénom, tenter par nom seulement SI le nom est unique parmi les associés
        if not matched_associate_id:
            last_names = [a.last_name.strip().upper() for a in associates]
            for assoc in associates:
                last_upper = assoc.last_name.strip().upper()
                if last_upper and len(last_upper) >= 4 and last_upper in label_upper:
                    # Ne matcher que si ce nom de famille est unique parmi les associés
                    if last_names.count(last_upper) == 1:
                        matched_associate_id = assoc.id
                        break

        if matched_associate_id:
            if "CAPITAL" in label_upper:
                category = "Apport au capital"
            elif any(k in label_upper for k in ["APPEL", "CHARGES", "COTISATION"]):
                category = "Règlement appel de fonds"
            else:
                category = "Compte courant d'associé"
            movement_type = "versement" if p_tx["amount"] > 0 else "remboursement"
            rec_status = "rapprochee"

        tx = BankTransaction(
            bank_account_id=account_id,
            fiscal_year_id=fy_id,
            transaction_date=tx_date,
            original_label=p_tx["original_label"],
            amount=p_tx["amount"],
            import_hash=p_tx["import_hash"],
            associate_id=matched_associate_id,
            category=category,
            movement_type=movement_type,
            reconciliation_status=rec_status,
        )
        db.add(tx)
        db.flush()

        # Si rapproché automatiquement vers un associé en Compte courant d'associé : créer le mouvement CCA
        if matched_associate_id and rec_status == "rapprochee" and category == "Compte courant d'associé":
            cca = CurrentAccountMovement(
                associate_id=matched_associate_id,
                fiscal_year_id=fy_id,
                movement_date=tx_date,
                movement_type=movement_type,
                amount=abs(p_tx["amount"]),
                reason=f"Import bancaire: {p_tx['original_label'][:100]}",
                bank_transaction_id=tx.id,
            )
            db.add(cca)
        # Si règlement d'appel de fonds : pointer automatiquement la ligne d'appel UNIQUEMENT s'il y a correspondance certaine et unique (1 seule ligne en attente)
        elif matched_associate_id and category == "Règlement appel de fonds":
            candidate_lines = (
                db.query(FundCallLine)
                .join(FundCall)
                .filter(
                    FundCallLine.associate_id == matched_associate_id,
                    FundCallLine.amount_due == abs(float(p_tx["amount"])),
                    FundCallLine.bank_transaction_id.is_(None),
                )
                .all()
            )
            if len(candidate_lines) == 1:
                pending_line = candidate_lines[0]
                pending_line.bank_transaction_id = tx.id
                pending_line.amount_paid = min(float(pending_line.amount_due), float(pending_line.amount_paid or 0) + abs(float(p_tx["amount"])))
                pending_line.payment_date = tx_date
                call = pending_line.fund_call
                total_due = float(call.total_amount)
                total_paid = sum(float(l.amount_paid or 0) for l in call.lines)
                call.status = "solde" if total_paid >= total_due else ("partiel" if total_paid > 0 else "en_attente")
            else:
                # Ambiguïté : plusieurs lignes ou aucune ligne de ce montant -> laisser à traiter
                tx.reconciliation_status = "a_traiter"

        imported_count += 1

    db.commit()

    return ImportCSVResponse(
        imported_count=imported_count,
        skipped_count=skipped_count,
        total_count=len(parsed_txs),
    )


@router.put("/transactions/{tx_id}/reconcile", response_model=BankTransactionResponse)
def reconcile_transaction(
    tx_id: int,
    req: ReconcileRequest,
    db: Session = Depends(get_db),
    _ = Depends(require_manager),
):
    tx = db.query(BankTransaction).filter(BankTransaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transaction introuvable")

    if req.category is not None:
        tx.category = req.category
    if req.movement_type is not None:
        tx.movement_type = req.movement_type
    if req.third_party is not None:
        tx.third_party = req.third_party
    if req.notes is not None:
        tx.notes = req.notes
    if req.reconciliation_status is not None:
        tx.reconciliation_status = req.reconciliation_status

    # Mise à jour de l'associé
    if req.associate_id is not None:
        tx.associate_id = req.associate_id if req.associate_id > 0 else None

    # Mise à jour du poste budgétaire
    if req.budget_item_id is not None:
        tx.budget_item_id = req.budget_item_id if req.budget_item_id > 0 else None

    # Rattachement / dissociation éventuelle d'une ligne d'appel de fonds
    if req.fund_call_line_id is not None:
        if req.fund_call_line_id > 0:
            fc_line = db.query(FundCallLine).filter(FundCallLine.id == req.fund_call_line_id).first()
            if fc_line:
                fc_line.bank_transaction_id = tx.id
                fc_line.amount_paid = abs(float(tx.amount))
                fc_line.payment_date = tx.transaction_date
                call = fc_line.fund_call
                total_due = float(call.total_amount)
                total_paid = sum(float(l.amount_paid or 0) for l in call.lines)
                call.status = "solde" if total_paid >= total_due else ("partiel" if total_paid > 0 else "en_attente")
                tx.category = "Règlement appel de fonds"
                tx.associate_id = fc_line.associate_id
        else:
            # Dissocier les lignes d'appel de fonds précédemment associées
            linked_lines = db.query(FundCallLine).filter(FundCallLine.bank_transaction_id == tx.id).all()
            for l in linked_lines:
                l.bank_transaction_id = None
                l.amount_paid = 0.0
                l.payment_date = None
                call = l.fund_call
                total_due = float(call.total_amount)
                total_paid = sum(float(x.amount_paid or 0) for x in call.lines)
                call.status = "solde" if total_paid >= total_due else ("partiel" if total_paid > 0 else "en_attente")

    # Vérifier si un mouvement CCA existe déjà pour cette transaction
    existing_cca = (
        db.query(CurrentAccountMovement)
        .filter(CurrentAccountMovement.bank_transaction_id == tx.id)
        .first()
    )

    # Gérer la synchronisation avec le compte courant d'associé :
    # STRICTEMENT ET UNIQUEMENT si la catégorie est "Compte courant d'associé" !
    # Les appels de fonds pour charges ou apports au capital NE doivent JAMAIS créer de CCA.
    if tx.associate_id and tx.reconciliation_status == "rapprochee" and tx.category == "Compte courant d'associé":
        mvt_type = tx.movement_type or ("versement" if tx.amount > 0 else "remboursement")
        if existing_cca:
            existing_cca.associate_id = tx.associate_id
            existing_cca.movement_date = tx.transaction_date
            existing_cca.movement_type = mvt_type
            existing_cca.amount = abs(tx.amount)
        else:
            new_cca = CurrentAccountMovement(
                associate_id=tx.associate_id,
                fiscal_year_id=tx.fiscal_year_id,
                movement_date=tx.transaction_date,
                movement_type=mvt_type,
                amount=abs(tx.amount),
                reason=f"Transaction bancaire: {tx.original_label[:100]}",
                bank_transaction_id=tx.id,
            )
            db.add(new_cca)
    else:
        # Si la transaction n'est pas/plus un Compte courant d'associé ou plus rapprochée, supprimer le mouvement CCA lié !
        if existing_cca:
            db.delete(existing_cca)

    db.commit()
    db.refresh(tx)
    return BankTransactionResponse.model_validate(tx)


@router.delete("/transactions/{tx_id}")
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    _ = Depends(require_manager),
):
    tx = db.query(BankTransaction).filter(BankTransaction.id == tx_id).first()
    if not tx:
        raise HTTPException(404, "Transaction introuvable")

    # Supprimer également le mouvement CCA lié si existant
    cca = (
        db.query(CurrentAccountMovement)
        .filter(CurrentAccountMovement.bank_transaction_id == tx.id)
        .first()
    )
    if cca:
        db.delete(cca)

    db.delete(tx)
    db.commit()
    return {"message": "Transaction supprimée"}


@router.delete("/transactions/purge/all")
def purge_all_transactions(
    db: Session = Depends(get_db),
    _ = Depends(require_manager),
):
    sci_id = get_default_sci_id(db)

    # 1. Supprimer tous les mouvements CCA liés aux transactions bancaires
    db.query(CurrentAccountMovement).filter(
        CurrentAccountMovement.bank_transaction_id.isnot(None)
    ).delete(synchronize_session=False)

    # 2. Supprimer toutes les transactions bancaires de la SCI
    accounts = db.query(BankAccount).filter(BankAccount.sci_id == sci_id).all()
    account_ids = [acc.id for acc in accounts]

    deleted_count = 0
    if account_ids:
        deleted_count = (
            db.query(BankTransaction)
            .filter(BankTransaction.bank_account_id.in_(account_ids))
            .delete(synchronize_session=False)
        )

    db.commit()
    return {"message": f"{deleted_count} transaction(s) bancaire(s) purgée(s)"}

