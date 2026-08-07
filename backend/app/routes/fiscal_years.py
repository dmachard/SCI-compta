from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_manager
from app.database import get_db
from app.models import SCI, FiscalYear, BankTransaction, Associate
from app.schemas import (
    FiscalYearCreate,
    FiscalYearResponse,
    FiscalYearUpdate,
    FiscalYearSummaryResponse,
    CategorySummary,
    AssociateResultShare,
    Cerfa2072Line,
    AssociateTaxShare2042,
    Tax2072Response,
)

router = APIRouter(prefix="/api/fiscal-years", tags=["exercices"])


@router.get("", response_model=list[FiscalYearResponse])
def list_fiscal_years(
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    return (
        db.query(FiscalYear)
        .order_by(FiscalYear.start_date.desc())
        .all()
    )


@router.post("", response_model=FiscalYearResponse)
def create_fiscal_year(
    data: FiscalYearCreate,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    sci = db.query(SCI).first()
    if not sci:
        raise HTTPException(400, "SCI non configurée")

    if data.start_date >= data.end_date:
        raise HTTPException(400, "La date de début doit être antérieure à la date de fin")

    existing = (
        db.query(FiscalYear)
        .filter(
            FiscalYear.start_date <= data.end_date,
            FiscalYear.end_date >= data.start_date,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            400, f"Chevauchement avec l'exercice existant : {existing.label}"
        )

    fy = FiscalYear(sci_id=sci.id, **data.model_dump())
    db.add(fy)
    db.commit()
    db.refresh(fy)
    return fy


@router.get("/{fy_id}", response_model=FiscalYearResponse)
def get_fiscal_year(
    fy_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    fy = db.query(FiscalYear).filter(FiscalYear.id == fy_id).first()
    if not fy:
        raise HTTPException(404, "Exercice non trouvé")
    return fy


@router.get("/{fy_id}/summary", response_model=FiscalYearSummaryResponse)
def get_fiscal_year_summary(
    fy_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    fy = db.query(FiscalYear).filter(FiscalYear.id == fy_id).first()
    if not fy:
        raise HTTPException(404, "Exercice non trouvé")

    # Transactions bancaires rapprochées de la période
    transactions = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.transaction_date >= fy.start_date,
            BankTransaction.transaction_date <= fy.end_date,
            BankTransaction.reconciliation_status == "rapprochee",
        )
        .all()
    )

    total_income = 0.0
    total_expenses = 0.0
    total_immobilisations = 0.0
    total_associate_contributions = 0.0

    category_map: dict[str, float] = {}

    for tx in transactions:
        category_name = tx.category or "Non catégorisé"
        amt = float(tx.amount)

        # 1. Traitement des Apports en Compte Courant d'Associés (Passif / Dette)
        if (tx.associate_id and tx.associate_id > 0) or category_name in ["Compte courant / Apport associé", "Compte courant d'associé", "Apport au capital", "Virement Associé (Apport / Retrait)"]:
            if amt > 0:
                total_associate_contributions += amt
            continue

        # 2. Traitement des Immobilisations & Notaire (Actif du bilan - EXCLUS des charges courantes!)
        if category_name in ["Acquisition bien / Notaire", "Acquisition immobilière (Achat bien / Notaire)", "Honoraires comptable/notaire"] or "notaire" in category_name.lower() or "acquisition" in category_name.lower():
            abs_amt = abs(amt)
            total_immobilisations += abs_amt
            category_map[category_name] = category_map.get(category_name, 0.0) + abs_amt
            continue

        # 3. Traitement des Charges Courantes Déductibles et des Produits d'exploitation
        if amt >= 0:
            total_income += amt
            category_map[category_name] = category_map.get(category_name, 0.0) + amt
        else:
            abs_amt = abs(amt)
            total_expenses += abs_amt
            category_map[category_name] = category_map.get(category_name, 0.0) + abs_amt

    # Le résultat foncier réel = Loyers perçus - Charges courantes déductibles (HORS Achat maison & HORS Apports)
    net_result = total_income - total_expenses

    category_breakdown = [
        CategorySummary(
            category=cat,
            total_amount=round(val, 2),
            is_income=(val >= 0 and cat in ["Loyer perçu", "Autre produit"]),
        )
        for cat, val in category_map.items()
    ]

    # Ventilation par associé (Quote-part %)
    associates = db.query(Associate).filter(Associate.is_active == True).all()
    total_shares = sum(a.shares for a in associates) or 1

    associate_results = []
    for a in associates:
        quote_part = round((a.shares / total_shares) * 100.0, 2)
        result_share = round(net_result * (quote_part / 100.0), 2)

        # Calcul des apports cumulés en Compte Courant d'Associé (CCA)
        cca_txs = db.query(BankTransaction).filter(
            BankTransaction.associate_id == a.id,
            BankTransaction.category == "Compte courant d'associé",
            BankTransaction.reconciliation_status == "rapprochee",
        ).all()
        cca_balance = sum(float(t.amount) for t in cca_txs)

        # Calcul du capital versé
        capital_txs = db.query(BankTransaction).filter(
            BankTransaction.associate_id == a.id,
            BankTransaction.category == "Apport au capital",
            BankTransaction.reconciliation_status == "rapprochee",
        ).all()
        capital_paid = sum(float(t.amount) for t in capital_txs)

        associate_results.append(
            AssociateResultShare(
                associate_id=a.id,
                first_name=a.first_name,
                last_name=a.last_name,
                shares=a.shares,
                quote_part=quote_part,
                result_share=result_share,
                cca_balance=round(cca_balance, 2),
                capital_paid=round(capital_paid, 2),
            )
        )

    return FiscalYearSummaryResponse(
        fiscal_year=fy,
        total_income=round(total_income, 2),
        total_expenses=round(total_expenses, 2),
        net_result=round(net_result, 2),
        total_immobilisations=round(total_immobilisations, 2),
        total_associate_contributions=round(total_associate_contributions, 2),
        category_breakdown=category_breakdown,
        associate_results=associate_results,
    )


@router.post("/{fy_id}/close", response_model=FiscalYearResponse)
def close_fiscal_year(
    fy_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    fy = db.query(FiscalYear).filter(FiscalYear.id == fy_id).first()
    if not fy:
        raise HTTPException(404, "Exercice non trouvé")
    
    fy.status = "cloture"
    fy.closed_at = datetime.now()
    db.commit()
    db.refresh(fy)
    return fy


@router.post("/{fy_id}/reopen", response_model=FiscalYearResponse)
def reopen_fiscal_year(
    fy_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_manager),
):
    fy = db.query(FiscalYear).filter(FiscalYear.id == fy_id).first()
    if not fy:
        raise HTTPException(404, "Exercice non trouvé")
    
    fy.status = "ouvert"
    fy.closed_at = None
    db.commit()
    db.refresh(fy)
    return fy


@router.get("/{fy_id}/tax-2072", response_model=Tax2072Response)
def get_fiscal_year_tax_2072(
    fy_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    fy = db.query(FiscalYear).filter(FiscalYear.id == fy_id).first()
    if not fy:
        raise HTTPException(404, "Exercice non trouvé")

    sci = db.query(SCI).first()
    sci_name = sci.name if sci else "S.C.I. LA GUERMONDERIE"
    sci_siren = sci.siren if sci else ""

    # Transactions validées de l'exercice
    txs = (
        db.query(BankTransaction)
        .filter(
            BankTransaction.transaction_date >= fy.start_date,
            BankTransaction.transaction_date <= fy.end_date,
            BankTransaction.reconciliation_status == "rapprochee",
        )
        .all()
    )

    # Accumulateurs des cases Cerfa 2072
    l211_loyers = 0.0      # Recettes brutes
    l221_frais_admin = 0.0 # Frais d'administration et de gestion
    l223_assurances = 0.0  # Primes d'assurance
    l224_entretien = 0.0   # Dépenses de réparation et d'entretien
    l227_impots = 0.0      # Taxes foncières

    for tx in txs:
        # On exclut les apports d'associés (Passif)
        if tx.associate_id and tx.associate_id > 0:
            continue

        cat = (tx.category or "").strip()
        cat_lower = cat.lower()

        # On exclut l'acquisition immobilière et notaire (Actif - Immobilisation)
        if "acquisition" in cat_lower or "notaire" in cat_lower:
            continue

        amt = float(tx.amount)

        if cat in ["Loyer perçu", "Autre produit"] or amt > 0:
            l211_loyers += amt
        elif cat == "Frais bancaires" or "frais" in cat_lower or "honoraires" in cat_lower:
            l221_frais_admin += abs(amt)
        elif cat == "Assurances" or "maif" in cat_lower or "assurance" in cat_lower:
            l223_assurances += abs(amt)
        elif cat in ["Électricité / Eau", "Travaux", "Entretien"] or "eau" in cat_lower or "edf" in cat_lower:
            l224_entretien += abs(amt)
        elif cat == "Taxe foncière" or "impôt" in cat_lower or "foncier" in cat_lower:
            l227_impots += abs(amt)
        else:
            # Défaut : dépense courante de gestion (Ligne 224)
            if amt < 0:
                l224_entretien += abs(amt)

    is_free_disposal = (l211_loyers == 0.0)

    if is_free_disposal:
        # En l'absence de loyer (CGI Art. 15-II), pas de déficit foncier déductible
        total_net_tax_result = 0.0
        disclaimer_text = (
            "SCI à disposition gratuite des associés (Sans loyer encaissé) : Conformément à l'Article 15-II du Code Général des Impôts (CGI), "
            "lorsqu'un bien est mis gratuitement à la disposition d'associés ou non loué à des tiers, les dépenses de gestion et d'entretien ne créent pas de déficit foncier déductible. "
            "La déclaration 2072 n'est pas requise auprès de la DGFiP et le montant à reporter sur la déclaration personnelle (2042) des associés est de 0,00 €."
        )
    else:
        total_net_tax_result = round(l211_loyers - total_charges_deductibles, 2)
        disclaimer_text = (
            "Ce récapitulatif est un document préparatoire généré automatiquement par SCI-Compta à partir des écritures comptables enregistrées. "
            "Il est destiné à aider le gérant et les associés à préparer leur déclaration fiscale annuelle (Cerfa 2072 et 2042-C-PRO) "
            "et doit être validé avant tout report ou dépôt officiel auprès de la Direction Générale des Finances Publiques (DGFiP)."
        )

    cerfa_lines = [
        Cerfa2072Line(
            line_number="211",
            label="Loyers et recettes brutes encaissés",
            amount=round(l211_loyers, 2),
            description="Total des loyers et produits d'exploitation perçus par la SCI hors charges.",
        ),
        Cerfa2072Line(
            line_number="221",
            label="Frais d'administration et de gestion",
            amount=round(l221_frais_admin, 2),
            description="Frais de tenue de compte bancaire, honoraires et gestion.",
        ),
        Cerfa2072Line(
            line_number="223",
            label="Primes d'assurance",
            amount=round(l223_assurances, 2),
            description="Cotisations d'assurance PNO (Propriétaire Non Occupant) et risques immobiliers.",
        ),
        Cerfa2072Line(
            line_number="224",
            label="Dépenses de réparation, d'entretien et d'amélioration",
            amount=round(l224_entretien, 2),
            description="Charges courantes d'entretien du bien (Eau, Électricité, menues réparations).",
        ),
        Cerfa2072Line(
            line_number="227",
            label="Taxes foncières et taxes annexes",
            amount=round(l227_impots, 2),
            description="Taxes foncières payées durant l'exercice (hors taxe d'enlèvement des ordures ménagères récupérable).",
        ),
        Cerfa2072Line(
            line_number="260",
            label="Résultat foncier net déductible",
            amount=total_net_tax_result,
            description="Résultat foncier déductible (ramené à 0 € en l'absence de loyers selon l'art. 15-II du CGI).",
        ),
    ]

    # Ventilation par associé (Cerfa 2072-S & Déclaration 2042-C-PRO)
    associates = db.query(Associate).filter(Associate.is_active == True).all()
    total_shares = sum(a.shares for a in associates) or 1

    associate_tax_shares = []
    for a in associates:
        quote_part = round((a.shares / total_shares) * 100.0, 2)
        if is_free_disposal:
            net_tax_share = 0.0
            box_label = "Aucun report (Bien non loué)"
        else:
            net_tax_share = round(total_net_tax_result * (quote_part / 100.0), 2)
            box_label = "Case 4BA (Déficit foncier)" if net_tax_share < 0 else "Case 4BA (Revenu foncier)"
        
        associate_tax_shares.append(
            AssociateTaxShare2042(
                associate_id=a.id,
                first_name=a.first_name,
                last_name=a.last_name,
                shares=a.shares,
                quote_part=quote_part,
                net_tax_share=net_tax_share,
                form_2042_box=box_label,
            )
        )

    disclaimer_text = (
        "Ce récapitulatif est un document préparatoire généré automatiquement par SCI-Compta à partir des écritures comptables enregistrées. "
        "Il est destiné à aider le gérant et les associés à préparer leur déclaration fiscale annuelle (Cerfa 2072 et 2042-C-PRO) "
        "et doit être validé avant tout report ou dépôt officiel auprès de la Direction Générale des Finances Publiques (DGFiP)."
    )

    return Tax2072Response(
        fiscal_year=fy,
        sci_name=sci_name,
        sci_siren=sci_siren,
        cerfa_lines=cerfa_lines,
        total_net_tax_result=total_net_tax_result,
        associate_tax_shares=associate_tax_shares,
        disclaimer=disclaimer_text,
    )
