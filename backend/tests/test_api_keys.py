import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.api_key_service import APIKeyService


@pytest.mark.asyncio
async def test_api_key_lifecycle(client: AsyncClient, db_session: AsyncSession):
    # Register user & get default project
    reg_payload = {
        "email": "apikey_tester@tracepilot.dev",
        "password": "Password123!",
        "full_name": "API Key Tester",
    }
    reg_res = await client.post("/api/v1/auth/register", json=reg_payload)
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get default project ID
    orgs = (await client.get("/api/v1/organizations", headers=headers)).json()
    org_id = orgs[0]["id"]
    projects = (await client.get(f"/api/v1/organizations/{org_id}/projects", headers=headers)).json()
    project_id = projects[0]["id"]

    # 1. Create API key
    key_payload = {"name": "Production Ingestion Key", "expires_in_days": 30}
    create_res = await client.post(
        f"/api/v1/projects/{project_id}/api-keys",
        json=key_payload,
        headers=headers,
    )
    assert create_res.status_code == 201
    created_data = create_res.json()

    raw_key = created_data["raw_key"]
    key_prefix = created_data["key_prefix"]
    key_id = created_data["id"]

    # Verify key structure
    assert raw_key.startswith("tp_live_")
    assert key_prefix == raw_key[:12]
    assert created_data["name"] == "Production Ingestion Key"
    assert created_data["is_active"] is True

    # 2. List API keys (assert raw_key is NOT leaked)
    list_res = await client.get(f"/api/v1/projects/{project_id}/api-keys", headers=headers)
    assert list_res.status_code == 200
    keys_list = list_res.json()
    assert len(keys_list) == 1
    assert "raw_key" not in keys_list[0]
    assert "hashed_key" not in keys_list[0]
    assert keys_list[0]["key_prefix"] == key_prefix

    # 3. Validate raw key against APIKeyService
    validated_project = await APIKeyService.validate_api_key(db_session, raw_key)
    assert validated_project is not None
    assert str(validated_project.id) == project_id

    # 4. Revoke API key
    revoke_res = await client.delete(
        f"/api/v1/projects/{project_id}/api-keys/{key_id}",
        headers=headers,
    )
    assert revoke_res.status_code == 200
    revoked_data = revoke_res.json()
    assert revoked_data["revoked_at"] is not None
    assert revoked_data["is_active"] is False

    # 5. Verify revoked key fails validation
    post_revoke_val = await APIKeyService.validate_api_key(db_session, raw_key)
    assert post_revoke_val is None

