import pytest
from httpx import AsyncClient


async def get_auth_headers(client: AsyncClient, email: str = "project_test@tracepilot.dev") -> dict:
    reg_payload = {
        "email": email,
        "password": "Password123!",
        "full_name": "Project Lead",
        "organization_name": "Test Org",
    }
    res = await client.post("/api/v1/auth/register", json=reg_payload)
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_organization_and_project_lifecycle(client: AsyncClient):
    headers = await get_auth_headers(client)

    # 1. List auto-created organization
    orgs_res = await client.get("/api/v1/organizations", headers=headers)
    assert orgs_res.status_code == 200
    orgs = orgs_res.json()
    assert len(orgs) == 1
    org_id = orgs[0]["id"]
    assert orgs[0]["role"] == "OWNER"

    # 2. List default project in auto-created organization
    projects_res = await client.get(f"/api/v1/organizations/{org_id}/projects", headers=headers)
    assert projects_res.status_code == 200
    projects = projects_res.json()
    assert len(projects) == 1
    assert projects[0]["slug"] == "default-project"

    # 3. Create a second project
    new_proj_payload = {
        "name": "Customer Support RAG Agent",
        "slug": "support-rag",
        "description": "Production customer support RAG pipeline",
    }
    create_proj_res = await client.post(
        f"/api/v1/organizations/{org_id}/projects",
        json=new_proj_payload,
        headers=headers,
    )
    assert create_proj_res.status_code == 201
    created_proj = create_proj_res.json()
    assert created_proj["name"] == "Customer Support RAG Agent"
    assert created_proj["slug"] == "support-rag"

    # 4. Fetch the created project directly
    proj_id = created_proj["id"]
    get_proj_res = await client.get(f"/api/v1/projects/{proj_id}", headers=headers)
    assert get_proj_res.status_code == 200
    assert get_proj_res.json()["id"] == proj_id


@pytest.mark.asyncio
async def test_create_organization(client: AsyncClient):
    headers = await get_auth_headers(client, email="second_org@tracepilot.dev")

    # Create new organization
    new_org_payload = {"name": "AI Research Lab"}
    create_res = await client.post("/api/v1/organizations", json=new_org_payload, headers=headers)
    assert create_res.status_code == 201
    created_org = create_res.json()
    assert created_org["name"] == "AI Research Lab"

    # Verify user now has 2 organizations
    list_res = await client.get("/api/v1/organizations", headers=headers)
    assert len(list_res.json()) == 2

