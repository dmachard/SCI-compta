from app.models import BankTransaction
from datetime import date
from tests.test_fund_call_accounting import _setup_sci_and_associate


def test_reconcile_normalizes_categorisee_to_rapprochee(client, db_session):
    headers, mgr_id, bank_id = _setup_sci_and_associate(client)

    # Créer un exercice fiscal
    fy_create = client.post(
        "/api/fiscal-years",
        json={"label": "Exercice 2026", "start_date": "2026-01-01", "end_date": "2026-12-31"},
        headers=headers,
    )
    assert fy_create.status_code == 200
    fy_id = fy_create.json()["id"]

    # Créer une transaction non rapprochée
    tx = BankTransaction(
        bank_account_id=bank_id,
        fiscal_year_id=fy_id,
        transaction_date=date(2026, 9, 23),
        original_label="Prélèvement AXA ASSURANCES IARD MUTUELLE",
        amount=-449.25,
        category="",
        reconciliation_status="a_traiter",
        import_hash="hash_test_rec_1",
    )
    db_session.add(tx)
    db_session.commit()

    # 1. Reconcile avec reconciliation_status="categorisee" (comme envoyé depuis l'ancienne page todo)
    res = client.put(
        f"/api/bank/transactions/{tx.id}/reconcile",
        headers=headers,
        json={
            "category": "Assurances",
            "third_party": "AXA",
            "reconciliation_status": "categorisee",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["category"] == "Assurances"
    assert data["reconciliation_status"] == "rapprochee"  # Normalisé en rapprochee

    # 2. Filtrer par status=rapprochee
    list_res = client.get("/api/bank/transactions?status=rapprochee", headers=headers)
    assert list_res.status_code == 200
    tx_list = list_res.json()
    assert any(t["id"] == tx.id for t in tx_list)

    # 3. Vérifier la prise en compte dans le bilan de l'exercice fiscal
    fy_summary_res = client.get(f"/api/fiscal-years/{fy_id}/summary", headers=headers)
    assert fy_summary_res.status_code == 200
    fy_summary = fy_summary_res.json()
    assert fy_summary["total_expenses"] == 449.25
