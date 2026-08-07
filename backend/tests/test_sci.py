def test_sci_crud_and_reset(client):
    # 1. Unconfigured SCI returns 404
    res_404 = client.get("/api/sci")
    assert res_404.status_code == 404

    # 2. Setup manager & SCI
    setup_res = client.post("/api/auth/setup", json={
        "full_name": "Marie Curie",
        "email": "marie@example.com",
        "password": "Password123"
    })
    token = setup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get SCI profile
    get_res = client.get("/api/sci")
    assert get_res.status_code == 200

    # 4. Update SCI profile
    update_res = client.put("/api/sci", headers=headers, json={
        "name": "SCI Immobilere Curie",
        "siren": "123456789",
        "address": "10 Rue de la Paix, 75002 Paris"
    })
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "SCI Immobilere Curie"
    assert updated_data["siren"] == "123456789"

    # 5. Reset database
    reset_res = client.delete("/api/sci/reset", headers=headers)
    assert reset_res.status_code == 200

    # Verify status is back to unconfigured
    status_res = client.get("/api/auth/status")
    assert status_res.json() == {"configured": False}
