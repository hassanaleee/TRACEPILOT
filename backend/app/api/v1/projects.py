import uuid
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.api_key import APIKeyCreatedResponse, APIKeyCreateRequest, APIKeyResponse
from app.schemas.project import ProjectResponse
from app.services.api_key_service import APIKeyService
from app.services.project_service import ProjectService

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details of a project if user is a member of its organization."""
    project, _ = await ProjectService.get_project_with_auth(db, project_id, current_user.id)
    return ProjectResponse.model_validate(project)


@router.post(
    "/{project_id}/api-keys",
    response_model=APIKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_api_key(
    project_id: uuid.UUID,
    request: APIKeyCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate a new API key for the project.
    IMPORTANT: The full secret `raw_key` is returned ONLY in this response.
    Save it immediately, as it cannot be recovered.
    """
    api_key, raw_key = await APIKeyService.create_api_key(
        db, project_id, current_user.id, request
    )
    return APIKeyCreatedResponse(
        id=api_key.id,
        project_id=api_key.project_id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        last_used_at=api_key.last_used_at,
        expires_at=api_key.expires_at,
        revoked_at=api_key.revoked_at,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        raw_key=raw_key,
    )


@router.get("/{project_id}/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys for the project (shows prefix only, never secrets)."""
    keys = await APIKeyService.list_project_keys(db, project_id, current_user.id)
    return [APIKeyResponse.model_validate(k) for k in keys]


@router.delete("/{project_id}/api-keys/{key_id}", response_model=APIKeyResponse)
async def revoke_api_key(
    project_id: uuid.UUID,
    key_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an active API key immediately."""
    revoked = await APIKeyService.revoke_api_key(
        db, project_id, key_id, current_user.id
    )
    return APIKeyResponse.model_validate(revoked)
