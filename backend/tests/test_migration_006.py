from datetime import date
from sqlalchemy import text
from app.models import Associate, BankAccount, BankTransaction, CurrentAccountMovement, FundCall, FundCallLine, SCI
from app.routes.budget import update_fund_call_line
from app.schemas import FundCallLineUpdate


def run_migration_006_logic(conn):
    """Exécute fidèlement la logique de résolution déterministe de la migration 006."""
    unlinked_lines = conn.execute(text("""
        SELECT fcl.id AS line_id, fcl.associate_id, fcl.amount_due, fc.id AS call_id, fc.call_date, fc.fiscal_year_id
        FROM fund_call_lines fcl
        JOIN fund_calls fc ON fc.id = fcl.fund_call_id
        WHERE fcl.bank_transaction_id IS NULL
    """)).mappings().all()

    for line in unlinked_lines:
        assoc_id = line["associate_id"]
        amount = line["amount_due"]
        call_date = line["call_date"]
        fy_id = line["fiscal_year_id"]

        candidates = conn.execute(text("""
            SELECT bt.id, bt.transaction_date, bt.fiscal_year_id
            FROM bank_transactions bt
            WHERE bt.associate_id = :assoc_id
              AND bt.amount = :amount
              AND bt.transaction_date >= :call_date
              AND (:fy_id IS NULL OR bt.fiscal_year_id IS NULL OR bt.fiscal_year_id = :fy_id)
              AND (UPPER(bt.original_label) LIKE '%APPEL%' OR UPPER(bt.category) LIKE '%APPEL%')
              AND NOT (
                  UPPER(bt.original_label) LIKE '%ACQUISITION%'
                  OR UPPER(bt.original_label) LIKE '%CAPITAL%'
                  OR UPPER(bt.original_label) LIKE '%NOTAIRE%'
              )
              AND bt.id NOT IN (
                  SELECT bank_transaction_id FROM fund_call_lines WHERE bank_transaction_id IS NOT NULL
              )
        """), {
            "assoc_id": assoc_id,
            "amount": amount,
            "call_date": call_date,
            "fy_id": fy_id,
        }).mappings().all()

        if len(candidates) == 1:
            candidate_tx = candidates[0]
            cand_tx_id = candidate_tx["id"]

            matching_lines = conn.execute(text("""
                SELECT fcl.id
                FROM fund_call_lines fcl
                JOIN fund_calls fc ON fc.id = fcl.fund_call_id
                WHERE fcl.bank_transaction_id IS NULL
                  AND fcl.associate_id = :assoc_id
                  AND fcl.amount_due = :amount
                  AND fc.call_date <= :tx_date
                  AND (:tx_fy_id IS NULL OR fc.fiscal_year_id IS NULL OR fc.fiscal_year_id = :tx_fy_id)
            """), {
                "assoc_id": assoc_id,
                "amount": amount,
                "tx_date": candidate_tx["transaction_date"],
                "tx_fy_id": candidate_tx["fiscal_year_id"],
            }).mappings().all()

            if len(matching_lines) == 1 and matching_lines[0]["id"] == line["line_id"]:
                conn.execute(text("""
                    UPDATE fund_call_lines
                    SET bank_transaction_id = :tx_id
                    WHERE id = :line_id
                """), {"tx_id": cand_tx_id, "line_id": line["line_id"]})

    conn.execute(text("""
        UPDATE bank_transactions
        SET category = 'Règlement appel de fonds'
        WHERE id IN (
            SELECT bank_transaction_id FROM fund_call_lines WHERE bank_transaction_id IS NOT NULL
        )
    """))

    conn.execute(text("""
        DELETE FROM current_account_movements
        WHERE bank_transaction_id IN (
            SELECT bank_transaction_id FROM fund_call_lines WHERE bank_transaction_id IS NOT NULL
        )
    """))
    conn.commit()


def setup_base_sci(db):
    sci = SCI(name="SCI Test", siren="123456789")
    db.add(sci)
    db.flush()

    bank_acc = BankAccount(sci_id=sci.id, bank_name="Banque Test", iban="FR7612345", initial_balance=50000.0)
    db.add(bank_acc)
    db.flush()

    assoc = Associate(sci_id=sci.id, first_name="Denis", last_name="Machard", shares=50, is_active=True)
    db.add(assoc)
    db.flush()

    # Avance en compte courant d'associé pour l'acquisition : 18 000 €
    tx_acq = BankTransaction(
        bank_account_id=bank_acc.id,
        transaction_date=date(2026, 1, 10),
        original_label="VIR SEPA DENIS APPORT CCA ACQUISITION MAISON",
        amount=18000.0,
        category="Compte courant d'associé",
        associate_id=assoc.id,
        reconciliation_status="rapprochee",
    )
    db.add(tx_acq)
    db.flush()

    cca_acq = CurrentAccountMovement(
        associate_id=assoc.id,
        movement_date=date(2026, 1, 10),
        movement_type="versement",
        amount=18000.0,
        reason="Apport avance pour acquisition bien immobilier",
        bank_transaction_id=tx_acq.id,
    )
    db.add(cca_acq)
    db.commit()

    return sci, bank_acc, assoc, tx_acq, cca_acq


# =============================================================================
# CAS A : CCA acquisition 18 000 € + Appel charges 700 € + Règlement 700 € -> CCA final = 18 000 €
# =============================================================================
def test_case_a_charges_fund_call(db_session):
    db = db_session
    sci, bank_acc, assoc, tx_acq, cca_acq = setup_base_sci(db)

    # Appel de fonds de charges de 700 €
    fc = FundCall(
        call_number="#001",
        call_date=date(2026, 2, 1),
        purpose="Charges courantes",
        total_amount=700.0,
        status="solde",
        call_type="charges",
    )
    db.add(fc)
    db.flush()

    fc_line = FundCallLine(
        fund_call_id=fc.id,
        associate_id=assoc.id,
        amount_due=700.0,
        amount_paid=700.0,
        payment_date=date(2026, 2, 15),
        bank_transaction_id=None,
    )
    db.add(fc_line)
    db.flush()

    # Règlement bancaire de 700 € avec mouvement CCA erroné préexistant
    tx_pay = BankTransaction(
        bank_account_id=bank_acc.id,
        transaction_date=date(2026, 2, 15),
        original_label="VIR SEPA DENIS APPEL DE FONDS CHARGES",
        amount=700.0,
        category="Compte courant d'associé",
        associate_id=assoc.id,
        reconciliation_status="rapprochee",
    )
    db.add(tx_pay)
    db.flush()

    cca_pay = CurrentAccountMovement(
        associate_id=assoc.id,
        movement_date=date(2026, 2, 15),
        movement_type="versement",
        amount=700.0,
        reason="Import tx",
        bank_transaction_id=tx_pay.id,
    )
    db.add(cca_pay)
    db.commit()

    # Exécution de la migration
    run_migration_006_logic(db)

    # CCA final doit être strictement 18 000 €
    movements = db.query(CurrentAccountMovement).filter(CurrentAccountMovement.associate_id == assoc.id).all()
    assert len(movements) == 1
    assert movements[0].amount == 18000.0
    assert movements[0].bank_transaction_id == tx_acq.id

    # La transaction de 700 € est requalifiée et liée
    db.refresh(tx_pay)
    db.refresh(fc_line)
    assert tx_pay.category == "Règlement appel de fonds"
    assert fc_line.bank_transaction_id == tx_pay.id


# =============================================================================
# CAS B : CCA acquisition 18 000 € + Appel travaux 5 000 € + Règlement 5 000 € -> CCA final = 18 000 €
# =============================================================================
def test_case_b_travaux_fund_call(db_session):
    db = db_session
    sci, bank_acc, assoc, tx_acq, cca_acq = setup_base_sci(db)

    # Appel de fonds pour TRAVAUX de 5 000 €
    fc = FundCall(
        call_number="#TRV-01",
        call_date=date(2026, 3, 1),
        purpose="Rénovation toiture et façade",
        total_amount=5000.0,
        status="solde",
        call_type="travaux",
    )
    db.add(fc)
    db.flush()

    fc_line = FundCallLine(
        fund_call_id=fc.id,
        associate_id=assoc.id,
        amount_due=5000.0,
        amount_paid=5000.0,
        payment_date=date(2026, 3, 10),
        bank_transaction_id=None,
    )
    db.add(fc_line)
    db.flush()

    # Règlement bancaire de 5 000 € avec mouvement CCA erroné préexistant
    tx_pay = BankTransaction(
        bank_account_id=bank_acc.id,
        transaction_date=date(2026, 3, 10),
        original_label="VIR SEPA DENIS APPEL DE FONDS TRAVAUX TOITURE",
        amount=5000.0,
        category="Compte courant d'associé",
        associate_id=assoc.id,
        reconciliation_status="rapprochee",
    )
    db.add(tx_pay)
    db.flush()

    cca_pay = CurrentAccountMovement(
        associate_id=assoc.id,
        movement_date=date(2026, 3, 10),
        movement_type="versement",
        amount=5000.0,
        reason="Import tx travaux",
        bank_transaction_id=tx_pay.id,
    )
    db.add(cca_pay)
    db.commit()

    run_migration_006_logic(db)

    # CCA final reste strictement 18 000 €
    movements = db.query(CurrentAccountMovement).filter(CurrentAccountMovement.associate_id == assoc.id).all()
    assert len(movements) == 1
    assert movements[0].amount == 18000.0
    assert movements[0].bank_transaction_id == tx_acq.id

    db.refresh(tx_pay)
    db.refresh(fc_line)
    assert tx_pay.category == "Règlement appel de fonds"
    assert fc_line.bank_transaction_id == tx_pay.id


# =============================================================================
# CAS C : CCA = 18 000 € + Appel 700 € + Aucune transaction certaine
# -> CCA 18 000 € impérativement intact, AUCUN rapprochement automatique
# =============================================================================
def test_case_c_no_certain_transaction_cca_intact(db_session):
    db = db_session
    sci, bank_acc, assoc, tx_acq, cca_acq = setup_base_sci(db)

    # Appel de fonds de 700 € en attente
    fc = FundCall(
        call_number="#002",
        call_date=date(2026, 4, 1),
        purpose="Charges copropriété",
        total_amount=700.0,
        status="en_attente",
        call_type="charges",
    )
    db.add(fc)
    db.flush()

    fc_line = FundCallLine(
        fund_call_id=fc.id,
        associate_id=assoc.id,
        amount_due=700.0,
        amount_paid=0.0,
        bank_transaction_id=None,
    )
    db.add(fc_line)
    db.commit()

    run_migration_006_logic(db)

    # CCA 18 000 € strictement intact
    movements = db.query(CurrentAccountMovement).filter(CurrentAccountMovement.associate_id == assoc.id).all()
    assert len(movements) == 1
    assert movements[0].amount == 18000.0

    # Aucun rapprochement effectué
    db.refresh(fc_line)
    assert fc_line.bank_transaction_id is None


# =============================================================================
# CAS D : CCA = 18 000 € + 2 appels de 700 € + 2 transactions de 700 €
# -> AUCUN rapprochement automatique car non certain
# =============================================================================
def test_case_d_ambiguous_two_calls_two_transactions_no_arbitrary_link(db_session):
    db = db_session
    sci, bank_acc, assoc, tx_acq, cca_acq = setup_base_sci(db)

    # Deux appels de 700 €
    fc1 = FundCall(call_number="#010", call_date=date(2026, 2, 1), purpose="Charges T1", total_amount=700.0, call_type="charges")
    fc2 = FundCall(call_number="#020", call_date=date(2026, 5, 1), purpose="Charges T2", total_amount=700.0, call_type="charges")
    db.add_all([fc1, fc2])
    db.flush()

    fcl1 = FundCallLine(fund_call_id=fc1.id, associate_id=assoc.id, amount_due=700.0, bank_transaction_id=None)
    fcl2 = FundCallLine(fund_call_id=fc2.id, associate_id=assoc.id, amount_due=700.0, bank_transaction_id=None)
    db.add_all([fcl1, fcl2])
    db.flush()

    # Deux transactions de 700 € avec libellé APPEL
    tx1 = BankTransaction(
        bank_account_id=bank_acc.id,
        transaction_date=date(2026, 5, 10),
        original_label="VIR SEPA DENIS APPEL DE FONDS #1",
        amount=700.0,
        category="Compte courant d'associé",
        associate_id=assoc.id,
        reconciliation_status="rapprochee",
    )
    tx2 = BankTransaction(
        bank_account_id=bank_acc.id,
        transaction_date=date(2026, 5, 20),
        original_label="VIR SEPA DENIS APPEL DE FONDS #2",
        amount=700.0,
        category="Compte courant d'associé",
        associate_id=assoc.id,
        reconciliation_status="rapprochee",
    )
    db.add_all([tx1, tx2])
    db.flush()

    cca1 = CurrentAccountMovement(associate_id=assoc.id, movement_date=date(2026, 5, 10), movement_type="versement", amount=700.0, bank_transaction_id=tx1.id)
    cca2 = CurrentAccountMovement(associate_id=assoc.id, movement_date=date(2026, 5, 20), movement_type="versement", amount=700.0, bank_transaction_id=tx2.id)
    db.add_all([cca1, cca2])
    db.commit()

    run_migration_006_logic(db)

    # AUCUN rapprochement arbitraire ne doit être fait
    db.refresh(fcl1)
    db.refresh(fcl2)
    assert fcl1.bank_transaction_id is None
    assert fcl2.bank_transaction_id is None

    # Le CCA d'acquisition 18 000 € est strictement intact
    cca_acq_found = db.query(CurrentAccountMovement).filter(CurrentAccountMovement.bank_transaction_id == tx_acq.id).first()
    assert cca_acq_found is not None
    assert cca_acq_found.amount == 18000.0


# =============================================================================
# CAS E : CCA acquisition = 18 000 € + Règlement appel = 700 € + Vrai CCA = 1 000 €
# -> CCA final = 19 000 € (jamais 19 700 €)
# =============================================================================
def test_case_e_true_subsequent_cca_advance(db_session):
    db = db_session
    sci, bank_acc, assoc, tx_acq, cca_acq = setup_base_sci(db)

    # Appel de fonds de 700 €
    fc = FundCall(call_number="#003", call_date=date(2026, 2, 1), purpose="Charges", total_amount=700.0, call_type="charges")
    db.add(fc)
    db.flush()

    fcl = FundCallLine(fund_call_id=fc.id, associate_id=assoc.id, amount_due=700.0, bank_transaction_id=None)
    db.add(fcl)
    db.flush()

    # Règlement de l'appel de fonds (700 €)
    tx_call = BankTransaction(
        bank_account_id=bank_acc.id,
        transaction_date=date(2026, 2, 15),
        original_label="VIR SEPA DENIS APPEL DE FONDS 700",
        amount=700.0,
        category="Compte courant d'associé",
        associate_id=assoc.id,
        reconciliation_status="rapprochee",
    )
    db.add(tx_call)
    db.flush()

    cca_call = CurrentAccountMovement(associate_id=assoc.id, movement_date=date(2026, 2, 15), movement_type="versement", amount=700.0, bank_transaction_id=tx_call.id)
    db.add(cca_call)

    # Vrai versement supplémentaire en CCA : 1 000 €
    tx_cca_extra = BankTransaction(
        bank_account_id=bank_acc.id,
        transaction_date=date(2026, 3, 1),
        original_label="VIR SEPA DENIS APPORT CCA TRESORERIE",
        amount=1000.0,
        category="Compte courant d'associé",
        associate_id=assoc.id,
        reconciliation_status="rapprochee",
    )
    db.add(tx_cca_extra)
    db.flush()

    cca_extra = CurrentAccountMovement(associate_id=assoc.id, movement_date=date(2026, 3, 1), movement_type="versement", amount=1000.0, reason="Avance trésorerie", bank_transaction_id=tx_cca_extra.id)
    db.add(cca_extra)
    db.commit()

    run_migration_006_logic(db)

    # Calcul du solde CCA : 18 000 € + 1 000 € = 19 000 € (JAMAIS 19 700 €)
    movements = db.query(CurrentAccountMovement).filter(CurrentAccountMovement.associate_id == assoc.id).all()
    total_cca = sum(m.amount for m in movements)
    assert total_cca == 19000.0
    assert len(movements) == 2


# =============================================================================
# CAS F : CCA acquisition 18 000 € + Appel travaux 5 000 € + Règlement travaux 5 000 €
# -> Vérifier que le règlement des travaux ne crée AUCUN CurrentAccountMovement
# =============================================================================
def test_case_f_travaux_settlement_creates_no_cca_movement(db_session):
    db = db_session
    sci, bank_acc, assoc, tx_acq, cca_acq = setup_base_sci(db)

    # 1. Création appel travaux
    fc = FundCall(call_number="#TRV-02", call_date=date(2026, 6, 1), purpose="Travaux toiture", total_amount=5000.0, call_type="travaux")
    db.add(fc)
    db.flush()

    fcl = FundCallLine(fund_call_id=fc.id, associate_id=assoc.id, amount_due=5000.0, bank_transaction_id=None)
    db.add(fcl)
    db.flush()

    # 2. Transaction bancaire de 5 000 €
    tx_travaux = BankTransaction(
        bank_account_id=bank_acc.id,
        transaction_date=date(2026, 6, 15),
        original_label="VIR SEPA DENIS REGLEMENT TRAVAUX TOITURE",
        amount=5000.0,
        category="Règlement appel de fonds",
        associate_id=assoc.id,
        reconciliation_status="a_traiter",
    )
    db.add(tx_travaux)
    db.commit()

    # 3. Règlement via pointage de l'appel de fonds avec la transaction
    update_fund_call_line(
        call_id=fc.id,
        line_id=fcl.id,
        data=FundCallLineUpdate(
            is_paid=True,
            amount_paid=5000.0,
            payment_date=date(2026, 6, 15),
            bank_transaction_id=tx_travaux.id,
        ),
        db=db,
        _=None,
    )

    # 4. Vérification formelle : AUCUN mouvement CCA n'a été créé pour ce règlement travaux
    movements = db.query(CurrentAccountMovement).filter(CurrentAccountMovement.associate_id == assoc.id).all()
    assert len(movements) == 1
    assert movements[0].amount == 18000.0
    assert movements[0].bank_transaction_id == tx_acq.id

    # La ligne d'appel est soldée
    db.refresh(fcl)
    assert fcl.amount_paid == 5000.0
    assert fcl.bank_transaction_id == tx_travaux.id

    # La transaction a bien la catégorie "Règlement appel de fonds"
    db.refresh(tx_travaux)
    assert tx_travaux.category == "Règlement appel de fonds"
