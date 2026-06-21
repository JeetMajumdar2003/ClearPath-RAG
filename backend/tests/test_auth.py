"""Auth route smoke tests."""

from fastapi.testclient import TestClient


def test_register_creates_user(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "new@test.local",
            "password": "StrongPass1!",
            "full_name": "New User",
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["email"] == "new@test.local"
    assert data["role"] == "clinician"
    assert data["is_active"] is True


def test_register_duplicate_email_returns_400(client: TestClient):
    payload = {"email": "dup@test.local", "password": "StrongPass1!", "full_name": "Dup"}
    client.post("/api/v1/auth/register", json=payload)
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "already" in response.json()["detail"].lower()


def test_register_validates_password_length(client: TestClient):
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "weak@test.local", "password": "short", "full_name": "Weak"},
    )
    assert response.status_code == 422


def test_login_returns_token_and_user(client: TestClient, admin_user):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": admin_user.email, "password": "AdminPass1!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["token_type"] == "bearer"
    assert isinstance(data["access_token"], str) and len(data["access_token"]) > 20
    assert data["user"]["email"] == admin_user.email


def test_login_with_wrong_password_returns_401(client: TestClient, admin_user):
    response = client.post(
        "/api/v1/auth/login",
        data={"username": admin_user.email, "password": "wrong"},
    )
    assert response.status_code == 401


def test_me_returns_current_user(client: TestClient, auth_headers, admin_user):
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["email"] == admin_user.email


def test_me_without_token_returns_401(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token_returns_401(client: TestClient):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401