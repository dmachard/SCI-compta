def test_auth_status_unconfigured(client):
    res = client.get("/api/auth/status")
    assert res.status_code == 200
    assert res.json() == {"configured": False}


def test_auth_setup_flow(client):
    setup_payload = {
        "full_name": "Jean Dupont",
        "email": "jean.dupont@example.com",
        "password": "SecretPassword123!"
    }
    
    # 1. Setup application
    res = client.post("/api/auth/setup", json=setup_payload)
    assert res.status_code == 200
    token_data = res.json()
    assert "access_token" in token_data

    # 2. Check status is now configured
    res_status = client.get("/api/auth/status")
    assert res_status.status_code == 200
    assert res_status.json() == {"configured": True}

    # 3. Setup again should fail
    res_double = client.post("/api/auth/setup", json=setup_payload)
    assert res_double.status_code == 400

    # 4. Login with correct credentials
    login_res = client.post("/api/auth/login", json={
        "email": "jean.dupont@example.com",
        "password": "SecretPassword123!"
    })
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # 5. Login with invalid password
    bad_login = client.post("/api/auth/login", json={
        "email": "jean.dupont@example.com",
        "password": "WrongPassword"
    })
    assert bad_login.status_code == 401

    # 6. Fetch /me profile with token
    token = token_data["access_token"]
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    user_info = me_res.json()
    assert user_info["email"] == "jean.dupont@example.com"
    assert user_info["full_name"] == "Jean Dupont"
