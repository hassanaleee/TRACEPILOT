import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.organization import OrganizationCreateRequest, OrganizationResponse
from app.schemas.project import ProjectCreateRequest, ProjectResponse
from app.services.project_service import ProjectService

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all organizations that the authenticated user belongs to."""
    orgs_with_roles = await ProjectService.get_user_organizations(db, current_user.id)
    results = []
    for org, role in orgs_with_roles:
        res = OrganizationResponse.model_validate(org)
        res.role = role
        results.append(res)
    return results


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    request: OrganizationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization. Caller becomes OWNER."""
    org = await ProjectService.create_organization(db, current_user, request)
    res = OrganizationResponse.model_validate(org)
    return res


@router.get("/{organization_id}/projects", response_model=List[ProjectResponse])
async def list_organization_projects(
    organization_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all projects belonging to the specified organization."""
    projects = await ProjectService.get_projects_for_organization(
        db, organization_id, current_user.id
    )
    return [ProjectResponse.model_validate(p) for p in projects]


@router.post("/{organization_id}/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_organization_project(
    organization_id: uuid.UUID,
    request: ProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a project inside the specified organization (requires OWNER or ADMIN)."""
    project = await ProjectService.create_project(
        db, organization_id, current_user.id, request
    )
    return ProjectResponse.model_validate(project)

