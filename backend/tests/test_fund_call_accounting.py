from datetime import date


def _setup_sci_and_associate(client):
    # 1. Setup initial gérant & SCI
    setup_res = client.post("/api/auth/setup", json={
        "full_name": "Denis Machard",
        "email": "denis@example.com",
        "password": "Password123"
    })
    token = setup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    assocs = client.get("/api/associates", headers=headers).json()
    mgr_id = assocs[0]["id"]
    client.put(f"/api/associates/{mgr_id}", headers=headers, json={"shares": 100})

    # Récupérer le compte bancaire par défaut
    bank_accs = client.get("/api/bank/accounts", headers=headers).json()
    bank_id = bank_accs[0]["id"]

    return headers, mgr_id, bank_id


def test_fund_call_accounting_workflow(client):
    headers, mgr_id, bank_id = _setup_sci_and_associate(client)

    # =========================================================================
    # CAS 1 — CCA : Avance initiale de 18 000 € pour l'acquisition du bien
    # =========================================================================
    # Création du versement CCA
    cca_res = client.post("/api/current-accounts", headers=headers, json={
        "associate_id": mgr_id,
        "movement_date": "2026-01-10",
        "movement_type": "versement",
        "amount": 18000.0,
        "reason": "Apport avance pour acquisition bien immobilier"
    })
    assert cca_res.status_code == 200

    # Vérification du solde CCA : doit être exactement 18 000 €
    balances = client.get("/api/current-accounts", headers=headers).json()
    mgr_balance = next(b for b in balances if b["associate_id"] == mgr_id)
    assert mgr_balance["balance"] == 18000.0
    assert mgr_balance["total_paid"] == 18000.0

    summary = client.get(f"/api/associates/{mgr_id}/summary", headers=headers).json()
    assert summary["current_account_balance"] == 18000.0
    assert summary["total_paid_current_account"] == 18000.0

    # =========================================================================
    # CAS 2 — Appel de fonds : Création d'un appel de fonds pour charges (700 €)
    # =========================================================================
    # Création d'un poste budgétaire pour les charges courantes
    item_res = client.post("/api/budget/2026/items", headers=headers, json={
        "name": "Charges d'entretien et électricité",
        "icon": "⚡",
        "supplier": "Fournisseurs",
        "amount": 700.0,
        "periodicity": "annuelle"
    })
    assert item_res.status_code == 200
    item_id = item_res.json()["id"]

    # Création de l'appel de fonds
    fc_res = client.post("/api/budget/fund-calls", headers=headers, json={
        "year": 2026,
        "call_date": "2026-02-01",
        "due_date": "2026-02-28",
        "purpose": "Appel de fonds pour charges courantes",
        "call_type": "charges",
        "selected_item_ids": [item_id]
    })
    assert fc_res.status_code == 200
    fc_data = fc_res.json()
    assert fc_data["total_amount"] == 700.0
    assert fc_data["call_type"] == "charges"
    assert len(fc_data["lines"]) == 1
    fc_line = fc_data["lines"][0]
    assert fc_line["amount_due"] == 700.0
    assert fc_line["amount_paid"] == 0.0
    assert fc_line["is_paid"] is False

    # Le solde CCA doit être STRICTEMENT INCHANGÉ : toujours 18 000 €
    balances = client.get("/api/current-accounts", headers=headers).json()
    mgr_balance = next(b for b in balances if b["associate_id"] == mgr_id)
    assert mgr_balance["balance"] == 18000.0

    summary = client.get(f"/api/associates/{mgr_id}/summary", headers=headers).json()
    assert summary["current_account_balance"] == 18000.0
    assert summary["total_fund_calls_due"] == 700.0
    assert summary["total_fund_calls_paid"] == 0.0
    assert summary["fund_calls_remaining"] == 700.0

    # =========================================================================
    # CAS 3 — Paiement de l'appel de fonds : 700 € réglés par l'associé
    # =========================================================================
    # Le virement arrive sur le compte bancaire (via rapprochement bancaire)
    # L'opération est classée comme "Règlement appel de fonds" rattachée à la ligne d'appel
    pay_res = client.put(f"/api/budget/fund-calls/{fc_data['id']}/lines/{fc_line['id']}", headers=headers, json={
        "amount_paid": 700.0,
        "is_paid": True,
        "payment_date": "2026-02-15"
    })
    assert pay_res.status_code == 200
    updated_fc = pay_res.json()
    assert updated_fc["status"] == "solde"
    assert updated_fc["amount_paid"] == 700.0
    assert updated_fc["amount_remaining"] == 0.0

    # Résultat attendu :
    # CCA après paiement : toujours 18 000 € (le paiement ne doit pas augmenter le CCA !)
    # Appel restant dû : 0 €
    balances = client.get("/api/current-accounts", headers=headers).json()
    mgr_balance = next(b for b in balances if b["associate_id"] == mgr_id)
    assert mgr_balance["balance"] == 18000.0

    summary = client.get(f"/api/associates/{mgr_id}/summary", headers=headers).json()
    assert summary["current_account_balance"] == 18000.0
    assert summary["total_fund_calls_paid"] == 700.0
    assert summary["fund_calls_remaining"] == 0.0

    # =========================================================================
    # CAS 4 — Ne pas casser les vrais CCA : Nouvel apport CCA explicite de 1 000 €
    # =========================================================================
    cca_res2 = client.post("/api/current-accounts", headers=headers, json={
        "associate_id": mgr_id,
        "movement_date": "2026-03-01",
        "movement_type": "versement",
        "amount": 1000.0,
        "reason": "Nouvelle avance trésorerie CCA"
    })
    assert cca_res2.status_code == 200

    # CCA attendu : 18 000 + 1 000 = 19 000 €
    balances = client.get("/api/current-accounts", headers=headers).json()
    mgr_balance = next(b for b in balances if b["associate_id"] == mgr_id)
    assert mgr_balance["balance"] == 19000.0
    assert mgr_balance["total_paid"] == 19000.0

    summary = client.get(f"/api/associates/{mgr_id}/summary", headers=headers).json()
    assert summary["current_account_balance"] == 19000.0
    assert summary["fund_calls_remaining"] == 0.0


def test_bank_transaction_reconcile_fund_call_does_not_create_cca(client):
    headers, mgr_id, bank_id = _setup_sci_and_associate(client)

    # 1. Créer un appel de fonds
    item_res = client.post("/api/budget/2026/items", headers=headers, json={
        "name": "Assurance PNO",
        "icon": "🛡️",
        "supplier": "MAIF",
        "amount": 500.0
    })
    item_id = item_res.json()["id"]

    fc_res = client.post("/api/budget/fund-calls", headers=headers, json={
        "year": 2026,
        "call_date": "2026-04-01",
        "purpose": "Assurance PNO",
        "selected_item_ids": [item_id]
    })
    fc_data = fc_res.json()
    fc_line_id = fc_data["lines"][0]["id"]

    # 2. Importer une transaction bancaire représentant le versement de l'appel de fonds
    csv_content = b"Date;Libelle;Montant;Date valeur\n05/04/2026;VIR SEPA DENIS APPEL DE FONDS CHARGES;500,00;05/04/2026"
    import_res = client.post(
        f"/api/bank/import-csv?account_id={bank_id}",
        files={"file": ("releve.csv", csv_content, "text/csv")},
        headers=headers,
    )
    assert import_res.status_code == 200

    txs = client.get("/api/bank/transactions", headers=headers).json()
    tx = next(t for t in txs if t["original_label"] == "VIR SEPA DENIS APPEL DE FONDS CHARGES")
    assert tx["category"] == "Règlement appel de fonds"

    # Vérifier qu'AUCUN mouvement CCA n'a été créé
    balances = client.get("/api/current-accounts", headers=headers).json()
    mgr_balance = next(b for b in balances if b["associate_id"] == mgr_id)
    assert mgr_balance["balance"] == 0.0

    # 3. Rapprocher explicitement la transaction avec la ligne d'appel de fonds
    rec_res = client.put(f"/api/bank/transactions/{tx['id']}/reconcile", headers=headers, json={
        "category": "Règlement appel de fonds",
        "associate_id": mgr_id,
        "fund_call_line_id": fc_line_id,
        "reconciliation_status": "rapprochee"
    })
    assert rec_res.status_code == 200

    # Le solde CCA doit toujours être à 0.0
    balances = client.get("/api/current-accounts", headers=headers).json()
    mgr_balance = next(b for b in balances if b["associate_id"] == mgr_id)
    assert mgr_balance["balance"] == 0.0

    # La ligne d'appel de fonds doit être marquée comme payée
    fc_updated = client.get("/api/budget/fund-calls?year=2026", headers=headers).json()[0]
    assert fc_updated["status"] == "solde"
    assert fc_updated["lines"][0]["is_paid"] is True
    assert fc_updated["lines"][0]["bank_transaction_id"] == tx["id"]

    # 4. Si la transaction est requalifiée par l'utilisateur en véritable CCA :
    rec_cca = client.put(f"/api/bank/transactions/{tx['id']}/reconcile", headers=headers, json={
        "category": "Compte courant d'associé",
        "associate_id": mgr_id,
        "fund_call_line_id": 0,  # dissocié
        "reconciliation_status": "rapprochee"
    })
    assert rec_cca.status_code == 200
    balances = client.get("/api/current-accounts", headers=headers).json()
    mgr_balance = next(b for b in balances if b["associate_id"] == mgr_id)
    assert mgr_balance["balance"] == 500.0  # Maintenant c'est devenu un CCA

    # 5. Et si on la re-requalifie en Règlement appel de fonds :
    rec_back = client.put(f"/api/bank/transactions/{tx['id']}/reconcile", headers=headers, json={
        "category": "Règlement appel de fonds",
        "associate_id": mgr_id,
        "fund_call_line_id": fc_line_id,
        "reconciliation_status": "rapprochee"
    })
    assert rec_back.status_code == 200
    balances = client.get("/api/current-accounts", headers=headers).json()
    mgr_balance = next(b for b in balances if b["associate_id"] == mgr_id)
    assert mgr_balance["balance"] == 0.0  # Le CCA est immédiatement purgé !
