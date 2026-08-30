import io

def test_documents_upload_download_permissions(client):
    # 1. Setup gérant
    setup_res = client.post(
        "/api/auth/setup",
        json={
            "full_name": "Gérant Admin",
            "email": "admin",
            "password": "ManagerPassword123!",
        },
    )
    assert setup_res.status_code == 200
    gerant_token = setup_res.json()["access_token"]
    gerant_headers = {"Authorization": f"Bearer {gerant_token}"}

    # 2. Setup associate
    create_assoc_res = client.post(
        "/api/associates",
        json={"first_name": "Nicolas", "last_name": "Machard", "email": "nicolas"},
        headers=gerant_headers,
    )
    assoc_id = create_assoc_res.json()["id"]

    client.post(
        f"/api/associates/{assoc_id}/account",
        json={"username": "nicolas", "password": "AssociatePassword123!"},
        headers=gerant_headers,
    )

    assoc_login = client.post(
        "/api/auth/login",
        json={"email": "nicolas", "password": "AssociatePassword123!"},
    )
    assoc_token = assoc_login.json()["access_token"]
    assoc_headers = {"Authorization": f"Bearer {assoc_token}"}

    # 3. Associate trying to upload document -> 403 Forbidden
    fake_file = ("statuts.pdf", io.BytesIO(b"Dummy PDF Content"), "application/pdf")
    forbidden_upload = client.post(
        "/api/documents/upload",
        files={"file": fake_file},
        data={"category": "Statuts & Kbis", "supplier": "Statuts SCI"},
        headers=assoc_headers,
    )
    assert forbidden_upload.status_code == 403

    # 4. Gérant uploading document -> 200 OK
    fake_file_gerant = ("statuts_sci.pdf", io.BytesIO(b"Real PDF Content"), "application/pdf")
    upload_res = client.post(
        "/api/documents/upload",
        files={"file": fake_file_gerant},
        data={
            "category": "Statuts & Kbis",
            "supplier": "Statuts Constitutifs",
            "notes": "Version signée 2026",
        },
        headers=gerant_headers,
    )
    assert upload_res.status_code == 200
    doc_data = upload_res.json()
    doc_id = doc_data["id"]
    assert doc_data["original_filename"] == "statuts_sci.pdf"
    assert doc_data["category"] == "Statuts & Kbis"

    # 5. Both Gérant and Associate listing documents -> 200 OK
    list_assoc = client.get("/api/documents", headers=assoc_headers)
    assert list_assoc.status_code == 200
    assert len(list_assoc.json()) == 1

    # 6. Both Gérant and Associate downloading document -> 200 OK
    download_assoc = client.get(f"/api/documents/{doc_id}/download", headers=assoc_headers)
    assert download_assoc.status_code == 200
    assert download_assoc.content == b"Real PDF Content"

    # 7. Associate trying to delete document -> 403 Forbidden
    forbidden_delete = client.delete(f"/api/documents/{doc_id}", headers=assoc_headers)
    assert forbidden_delete.status_code == 403

    # 8. Upload invoice for 2026 / 02 - EDF
    fake_invoice = ("Facture_EDF_Janvier_2026.pdf", io.BytesIO(b"Facture EDF 2026"), "application/pdf")
    inv_res = client.post(
        "/api/documents/upload",
        files={"file": fake_invoice},
        data={
            "document_type": "facture",
            "folder_year": 2026,
            "category": "02 - EDF",
            "supplier": "EDF",
            "amount_ttc": 142.50,
        },
        headers=gerant_headers,
    )
    assert inv_res.status_code == 200
    inv_data = inv_res.json()
    assert inv_data["document_type"] == "facture"
    assert inv_data["folder_year"] == 2026
    assert inv_data["category"] == "02 - EDF"

    # 9. Test export-zip endpoint
    zip_res = client.get("/api/documents/export-zip?folder_year=2026", headers=gerant_headers)
    assert zip_res.status_code == 200
    assert zip_res.headers["content-type"] == "application/zip"

    # 10. Gérant deleting documents
    delete_res = client.delete(f"/api/documents/{doc_id}", headers=gerant_headers)
    assert delete_res.status_code == 200
    delete_inv = client.delete(f"/api/documents/{inv_data['id']}", headers=gerant_headers)
    assert delete_inv.status_code == 200
