import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.api_key_service import APIKeyService


@pytest.mark.asyncio
async def test_cross_tenant_isolation_enforcement(client: AsyncClient, db_session: AsyncSession):
    """
    Assert that User B (Tenant B) cannot view, modify, or manage
    resources belonging to User A (Tenant A), and vice versa.
    """
    # 1. Register Tenant A
    res_a = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "alice@tenant-a.com",
            "password": "Password123!",
            "full_name": "Alice Tenant A",
            "organization_name": "Tenant A Corp",
        },
    )
    assert res_a.status_code == 201
    headers_a = {"Authorization": f"Bearer {res_a.json()['access_token']}"}

    # Fetch Tenant A's project
    orgs_a = (await client.get("/api/v1/organizations", headers=headers_a)).json()
    org_a_id = orgs_a[0]["id"]
    projects_a = (await client.get(f"/api/v1/organizations/{org_a_id}/projects", headers=headers_a)).json()
    project_a_id = projects_a[0]["id"]

    # Create API key in Tenant A's project
    key_res_a = await client.post(
        f"/api/v1/projects/{project_a_id}/api-keys",
        json={"name": "Tenant A Secret Key"},
        headers=headers_a,
    )
    assert key_res_a.status_code == 201
    key_a_data = key_res_a.json()
    raw_key_a = key_a_data["raw_key"]
    key_a_id = key_a_data["id"]

    # 2. Register Tenant B
    res_b = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "bob@tenant-b.com",
            "password": "Password123!",
            "full_name": "Bob Tenant B",
            "organization_name": "Tenant B Corp",
        },
    )
    assert res_b.status_code == 201
    headers_b = {"Authorization": f"Bearer {res_b.json()['access_token']}"}

    # 3. Tenant B attempts to read Tenant A's project directly -> MUST return 404
    attack_get_proj = await client.get(f"/api/v1/projects/{project_a_id}", headers=headers_b)
    assert attack_get_proj.status_code == 404

    # 4. Tenant B attempts to list Tenant A's API keys -> MUST return 404
    attack_list_keys = await client.get(f"/api/v1/projects/{project_a_id}/api-keys", headers=headers_b)
    assert attack_list_keys.status_code == 404

    # 5. Tenant B attempts to generate an API key in Tenant A's project -> MUST return 404
    attack_create_key = await client.post(
        f"/api/v1/projects/{project_a_id}/api-keys",
        json={"name": "Unauthorized Key"},
        headers=headers_b,
    )
    assert attack_create_key.status_code == 404

    # 6. Tenant B attempts to revoke Tenant A's API key -> MUST return 404
    attack_revoke_key = await client.delete(
        f"/api/v1/projects/{project_a_id}/api-keys/{key_a_id}",
        headers=headers_b,
    )
    assert attack_revoke_key.status_code == 404

    # 7. Validate that API key A authenticates strictly to Project A
    validated_project = await APIKeyService.validate_api_key(db_session, raw_key_a)
    assert validated_project is not None
    assert str(validated_project.id) == project_a_id
    assert str(validated_project.organization_id) == org_a_id

