def test_associate_account_and_permissions(client):
    # 1. Setup gérant account
    setup_payload = {
        "full_name": "Gérant Admin",
        "email": "admin",
        "password": "ManagerPassword123!"
    }
    setup_res = client.post("/api/auth/setup", json=setup_payload)
    assert setup_res.status_code == 200
    gerant_token = setup_res.json()["access_token"]
    gerant_headers = {"Authorization": f"Bearer {gerant_token}"}

    # 2. Gérant creates an associate
    create_assoc_res = client.post(
        "/api/associates",
        json={
            "first_name": "Nicolas",
            "last_name": "Machard",
            "email": "nicolas",
            "shares": 50,
        },
        headers=gerant_headers,
    )
    assert create_assoc_res.status_code == 200
    assoc_data = create_assoc_res.json()
    assoc_id = assoc_data["id"]

    # 3. Gérant creates account credentials for the associate
    account_res = client.post(
        f"/api/associates/{assoc_id}/account",
        json={"username": "nicolas", "password": "AssociatePassword123!"},
        headers=gerant_headers,
    )
    assert account_res.status_code == 200
    account_user = account_res.json()
    assert account_user["role"] == "associe"
    assert account_user["email"] == "nicolas"

    # 4. Associate logs in
    assoc_login_res = client.post(
        "/api/auth/login",
        json={"email": "nicolas", "password": "AssociatePassword123!"},
    )
    assert assoc_login_res.status_code == 200
    assoc_token = assoc_login_res.json()["access_token"]
    assoc_headers = {"Authorization": f"Bearer {assoc_token}"}

    # 5. Check /api/auth/me for associate
    me_res = client.get("/api/auth/me", headers=assoc_headers)
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["role"] == "associe"
    assert me_data["associate_id"] == assoc_id

    # 6. Verify associate CAN access read endpoints
    assoc_list_res = client.get("/api/associates", headers=assoc_headers)
    assert assoc_list_res.status_code == 200

    fy_list_res = client.get("/api/fiscal-years", headers=assoc_headers)
    assert fy_list_res.status_code == 200

    # 7. Verify associate CANNOT access manager-only write endpoints (403 Forbidden)
    forbidden_create_assoc = client.post(
        "/api/associates",
        json={"first_name": "Hacker", "last_name": "Test"},
        headers=assoc_headers,
    )
    assert forbidden_create_assoc.status_code == 403

    forbidden_update_sci = client.put(
        "/api/sci",
        json={"name": "Pirated SCI"},
        headers=assoc_headers,
    )
    assert forbidden_update_sci.status_code == 403

    forbidden_create_fy = client.post(
        "/api/fiscal-years",
        json={"label": "Exercice 2026", "start_date": "2026-01-01", "end_date": "2026-12-31"},
        headers=assoc_headers,
    )
    assert forbidden_create_fy.status_code == 403
