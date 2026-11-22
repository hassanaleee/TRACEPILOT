import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    payload = {
        "email": "developer@tracepilot.dev",
        "password": "SecurePassword123!",
        "full_name": "Senior Engineer",
        "organization_name": "Acme AI Corp",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "developer@tracepilot.dev"
    assert data["user"]["full_name"] == "Senior Engineer"
    assert data["user"]["is_active"] is True


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = {
        "email": "duplicate@tracepilot.dev",
        "password": "SecurePassword123!",
        "full_name": "Dev One",
    }
    res1 = await client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Attempt to register identical email
    res2 = await client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_login_success_and_failure(client: AsyncClient):
    # Register user
    reg_payload = {
        "email": "login_test@tracepilot.dev",
        "password": "CorrectPassword123!",
        "full_name": "Login Tester",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    # Valid Login
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"email": "login_test@tracepilot.dev", "password": "CorrectPassword123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    assert token

    # Invalid Password Login
    bad_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "login_test@tracepilot.dev", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_me(client: AsyncClient):
    # Register and get token
    reg_payload = {
        "email": "me_test@tracepilot.dev",
        "password": "SecurePassword123!",
        "full_name": "Profile Tester",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    token = reg_res.json()["access_token"]

    # Call /auth/me with Bearer token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "me_test@tracepilot.dev"

    # Call /auth/me with invalid token
    bad_headers = {"Authorization": "Bearer invalid_garbage_token"}
    bad_res = await client.get("/api/v1/auth/me", headers=bad_headers)
    assert bad_res.status_code == 401

