def _setup_manager_and_associates(client):
    # Setup manager
    setup_res = client.post("/api/auth/setup", json={
        "full_name": "Denis Machard",
        "email": "denis@example.com",
        "password": "Password123"
    })
    token = setup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Update existing manager associate shares to 50
    assocs = client.get("/api/associates", headers=headers).json()
    mgr_id = assocs[0]["id"]
    client.put(f"/api/associates/{mgr_id}", headers=headers, json={"shares": 50})

    # Add second associate with 50 shares
    client.post("/api/associates", headers=headers, json={
        "first_name": "Nicolas",
        "last_name": "Machard",
        "shares": 50,
        "is_manager": False
    })

    return headers


def test_budget_workflow(client):
    headers = _setup_manager_and_associates(client)

    # 1. Get budget for 2026 (starts clean and empty, no hardcoded items)
    res = client.get("/api/budget/2026", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["year"] == 2026
    assert len(data["items"]) == 0

    # Create budget items dynamically
    edf_res = client.post("/api/budget/2026/items", headers=headers, json={
        "name": "Électricité / EDF",
        "icon": "⚡",
        "supplier": "EDF",
        "amount": 1300.0,
        "periodicity": "mensuelle"
    })
    assert edf_res.status_code == 200
    edf_item = edf_res.json()

    eau_res = client.post("/api/budget/2026/items", headers=headers, json={
        "name": "Eau",
        "icon": "💧",
        "supplier": "Fournisseur d'eau",
        "amount": 300.0,
        "periodicity": "trimestrielle"
    })
    assert eau_res.status_code == 200
    eau_item = eau_res.json()

    res_after = client.get("/api/budget/2026", headers=headers)
    assert res_after.status_code == 200
    data = res_after.json()
    assert len(data["items"]) == 2

    # 2. Add an expense linked to EDF
    exp_res = client.post("/api/budget/expenses", headers=headers, json={
        "label": "Facture EDF juillet",
        "amount": 112.0,
        "date": "2026-07-31",
        "budget_item_id": edf_item["id"],
        "third_party": "EDF",
        "notes": "Facture électricité"
    })
    assert exp_res.status_code == 200, exp_res.json()

    # 3. Check that budget real & variance updated
    res2 = client.get("/api/budget/2026", headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    edf_updated = next(it for it in data2["items"] if it["id"] == edf_item["id"])
    assert edf_updated["real"] == 112.0
    assert edf_updated["variance"] == round(112.0 - 1300.0, 2)  # -1188.0

    # 4. Create an appel de fonds with EDF and Eau
    fc_res = client.post("/api/budget/fund-calls", headers=headers, json={
        "year": 2026,
        "call_date": "2026-08-30",
        "due_date": "2026-09-30",
        "purpose": "Financement électricité et eau",
        "selected_item_ids": [edf_item["id"], eau_item["id"]]
    })
    assert fc_res.status_code == 200
    fc_data = fc_res.json()
    assert fc_data["total_amount"] == 1600.0  # 1300 + 300
    assert len(fc_data["lines"]) == 2
    # 50% each: 800.0 € each
    for line in fc_data["lines"]:
        assert line["amount_due"] == 800.0
        assert line["is_paid"] is False

    # 5. Mark first line as paid
    first_line_id = fc_data["lines"][0]["id"]
    pay_res = client.put(f"/api/budget/fund-calls/{fc_data['id']}/lines/{first_line_id}", headers=headers, json={
        "is_paid": True
    })
    assert pay_res.status_code == 200
    updated_fc = pay_res.json()
    assert updated_fc["status"] == "partiel"
    assert updated_fc["amount_paid"] == 800.0
    assert updated_fc["amount_remaining"] == 800.0

    # 6. Copy budget to 2027
    copy_res = client.post("/api/budget/2027", headers=headers, json={
        "copy_from_year": 2026
    })
    assert copy_res.status_code == 200
    copy_data = copy_res.json()
    assert copy_data["year"] == 2027
    assert len(copy_data["items"]) == len(data2["items"])
