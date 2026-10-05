from datetime import date

from app.models import BankTransaction, EXPENSE_REFUND_MOVEMENT_TYPE


def _setup_accounting(client, db_session):
    setup = client.post(
        "/api/auth/setup",
        json={
            "full_name": "Gérant Test",
            "email": "manager@example.com",
            "password": "Password123",
        },
    )
    assert setup.status_code == 200
    headers = {"Authorization": f"Bearer {setup.json()['access_token']}"}
    associate_id = client.get("/api/associates", headers=headers).json()[0]["id"]
    bank_account_id = client.get("/api/bank/accounts", headers=headers).json()[0]["id"]

    fiscal_year = client.post(
        "/api/fiscal-years",
        headers=headers,
        json={
            "label": "Exercice 2026",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31",
        },
    )
    assert fiscal_year.status_code == 200

    item = client.post(
        "/api/budget/2026/items",
        headers=headers,
        json={"name": "Charges courantes", "amount": 2000},
    )
    assert item.status_code == 200

    def transaction(amount, category, movement_type="depense", associate=None, budget_item=None):
        row = BankTransaction(
            bank_account_id=bank_account_id,
            fiscal_year_id=fiscal_year.json()["id"],
            transaction_date=date(2026, 3, 15),
            original_label=f"Transaction test {amount} {category}",
            amount=amount,
            category=category,
            movement_type=movement_type,
            associate_id=associate,
            budget_item_id=budget_item,
            reconciliation_status="rapprochee",
            import_hash=f"test-{category}-{amount}-{db_session.query(BankTransaction).count()}",
        )
        db_session.add(row)
        db_session.commit()
        db_session.refresh(row)
        return row

    return {
        "headers": headers,
        "associate_id": associate_id,
        "fiscal_year_id": fiscal_year.json()["id"],
        "budget_item_id": item.json()["id"],
        "transaction": transaction,
    }


def _classify_refund(client, context, transaction, category, budget_item_id=None):
    response = client.put(
        f"/api/bank/transactions/{transaction.id}/reconcile",
        headers=context["headers"],
        json={
            "category": category,
            "movement_type": EXPENSE_REFUND_MOVEMENT_TYPE,
            "associate_id": None,
            "budget_item_id": budget_item_id,
            "fund_call_line_id": 0,
        },
    )
    assert response.status_code == 200
    return response.json()


def _summary(client, context):
    return client.get(
        f"/api/fiscal-years/{context['fiscal_year_id']}/summary",
        headers=context["headers"],
    ).json()


def test_partial_refund_reduces_expense_and_result_without_becoming_income(client, db_session):
    context = _setup_accounting(client, db_session)
    context["transaction"](
        -1000, "Assurances", budget_item=context["budget_item_id"]
    )
    refund = context["transaction"](150, "Assurances", "recette", budget_item=context["budget_item_id"])

    result = _classify_refund(
        client, context, refund, "Assurances", context["budget_item_id"]
    )
    assert result["movement_type"] == EXPENSE_REFUND_MOVEMENT_TYPE

    summary = _summary(client, context)
    assert summary["total_income"] == 0
    assert summary["total_expenses"] == 850
    assert summary["net_result"] == -850
    assert next(
        item["total_amount"]
        for item in summary["category_breakdown"]
        if item["category"] == "Assurances"
    ) == 850
    assert client.get("/api/budget/2026", headers=context["headers"]).json()["total_real"] == 850

    tax_report = client.get(
        f"/api/fiscal-years/{context['fiscal_year_id']}/tax-2072",
        headers=context["headers"],
    ).json()
    assert next(line["amount"] for line in tax_report["cerfa_lines"] if line["line_number"] == "223") == 850
    assert next(line["amount"] for line in tax_report["cerfa_lines"] if line["line_number"] == "211") == 0


def test_full_refund_reduces_expense_to_zero(client, db_session):
    context = _setup_accounting(client, db_session)
    context["transaction"](-500, "Électricité / Eau")
    refund = context["transaction"](500, "Électricité / Eau", "recette")
    _classify_refund(client, context, refund, "Électricité / Eau")

    summary = _summary(client, context)
    assert summary["total_income"] == 0
    assert summary["total_expenses"] == 0
    assert summary["net_result"] == 0
    assert next(
        item["total_amount"]
        for item in summary["category_breakdown"]
        if item["category"] == "Électricité / Eau"
    ) == 0


def test_multiple_refunds_in_one_category_are_accumulated(client, db_session):
    context = _setup_accounting(client, db_session)
    context["transaction"](-1000, "EDF")
    for amount in (100, 150, 250):
        refund = context["transaction"](amount, "EDF", "recette")
        _classify_refund(client, context, refund, "EDF")

    summary = _summary(client, context)
    assert summary["total_income"] == 0
    assert summary["total_expenses"] == 500
    assert summary["net_result"] == -500
    assert next(
        item["total_amount"]
        for item in summary["category_breakdown"]
        if item["category"] == "EDF"
    ) == 500


def test_genuine_rent_stays_income_and_refund_does_not(client, db_session):
    context = _setup_accounting(client, db_session)
    context["transaction"](-1000, "Assurances")
    refund = context["transaction"](200, "Assurances", "recette")
    _classify_refund(client, context, refund, "Assurances")
    context["transaction"](1200, "Loyer perçu", "recette")

    summary = _summary(client, context)
    assert summary["total_income"] == 1200
    assert summary["total_expenses"] == 800
    assert summary["net_result"] == 400
    assert any(
        item["category"] == "Loyer perçu"
        and item["total_amount"] == 1200
        and item["is_income"]
        for item in summary["category_breakdown"]
    )
    assert not any(
        item["category"] == "Assurances" and item["is_income"]
        for item in summary["category_breakdown"]
    )


def test_associate_current_account_movement_is_not_a_refund_or_income(client, db_session):
    context = _setup_accounting(client, db_session)
    movement = context["transaction"](
        300,
        "Compte courant d'associé",
        "versement",
        associate=context["associate_id"],
    )
    response = client.put(
        f"/api/bank/transactions/{movement.id}/reconcile",
        headers=context["headers"],
        json={
            "category": "Compte courant d'associé",
            "movement_type": "versement",
            "associate_id": context["associate_id"],
            "reconciliation_status": "rapprochee",
        },
    )
    assert response.status_code == 200

    summary = _summary(client, context)
    assert summary["total_income"] == 0
    assert summary["total_expenses"] == 0
    assert summary["total_associate_contributions"] == 300


def test_refund_requires_positive_transaction_and_expense_category(client, db_session):
    context = _setup_accounting(client, db_session)
    expense = context["transaction"](-100, "Assurances")
    refund = context["transaction"](100, "Assurances", "recette")
    invalid_expense = client.put(
        f"/api/bank/transactions/{expense.id}/reconcile",
        headers=context["headers"],
        json={
            "category": "Assurances",
            "movement_type": EXPENSE_REFUND_MOVEMENT_TYPE,
            "associate_id": None,
        },
    )
    assert invalid_expense.status_code == 400

    invalid_category = client.put(
        f"/api/bank/transactions/{refund.id}/reconcile",
        headers=context["headers"],
        json={
            "category": "Loyer perçu",
            "movement_type": EXPENSE_REFUND_MOVEMENT_TYPE,
            "associate_id": None,
        },
    )
    assert invalid_category.status_code == 400
