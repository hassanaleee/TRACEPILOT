from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.core.redis import get_redis_client
from app.core.security import generate_api_key, hash_api_key
from app.models.api_key import APIKey
from app.models.organization import OrganizationRole
from app.models.project import Project
from app.schemas.api_key import APIKeyCreateRequest
from app.services.project_service import ProjectService


class APIKeyService:
    @staticmethod
    async def create_api_key(
        db: AsyncSession,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
        request: APIKeyCreateRequest,
    ) -> Tuple[APIKey, str]:
        """Create a new project API key. Returns (APIKey, raw_plaintext_key)."""
        # Verify user has write permissions (OWNER or ADMIN)
        _, role = await ProjectService.get_project_with_auth(db, project_id, user_id)
        if role not in (OrganizationRole.OWNER, OrganizationRole.ADMIN):
            raise PermissionDeniedError("Insufficient permissions to create API keys")

        raw_key, key_prefix, hashed_key = generate_api_key()

        expires_at = None
        if request.expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=request.expires_in_days)

        api_key = APIKey(
            project_id=project_id,
            name=request.name,
            key_prefix=key_prefix,
            hashed_key=hashed_key,
            expires_at=expires_at,
        )
        db.add(api_key)
        await db.flush()

        return api_key, raw_key

    @staticmethod
    async def list_project_keys(
        db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> List[APIKey]:
        """List all API keys for a project (caller must be an organization member)."""
        await ProjectService.get_project_with_auth(db, project_id, user_id)

        stmt = (
            select(APIKey)
            .where(APIKey.project_id == project_id)
            .order_by(APIKey.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def revoke_api_key(
        db: AsyncSession,
        project_id: uuid.UUID,
        key_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> APIKey:
        """Revoke an active API key and invalidate Redis cache."""
        _, role = await ProjectService.get_project_with_auth(db, project_id, user_id)
        if role not in (OrganizationRole.OWNER, OrganizationRole.ADMIN):
            raise PermissionDeniedError("Insufficient permissions to revoke API keys")

        stmt = select(APIKey).where(
            APIKey.id == key_id,
            APIKey.project_id == project_id,
        )
        api_key = (await db.execute(stmt)).scalar_one_or_none()
        if not api_key:
            raise NotFoundError("API key not found")

        api_key.revoked_at = datetime.now(timezone.utc)
        await db.flush()

        # Invalidate Redis cache if available
        redis = await get_redis_client()
        if redis:
            try:
                await redis.delete(f"apikey:{api_key.hashed_key}")
            except Exception:
                pass

        return api_key

    @staticmethod
    async def validate_api_key(db: AsyncSession, raw_key: str) -> Optional[Project]:
        """Validate an incoming raw API key string against hash and return its Project."""
        if not raw_key.startswith("tp_live_"):
            return None

        hashed = hash_api_key(raw_key)

        # Check Redis cache first
        redis = await get_redis_client()
        if redis:
            try:
                cached_project_id = await redis.get(f"apikey:{hashed}")
                if cached_project_id:
                    stmt = select(Project).where(Project.id == uuid.UUID(cached_project_id))
                    return (await db.execute(stmt)).scalar_one_or_none()
            except Exception:
                pass

        # Query Database
        now = datetime.now(timezone.utc)
        stmt = (
            select(APIKey, Project)
            .join(Project, APIKey.project_id == Project.id)
            .where(
                APIKey.hashed_key == hashed,
                APIKey.revoked_at.is_(None),
            )
        )
        result = (await db.execute(stmt)).first()
        if not result:
            return None

        api_key, project = result

        # Check expiration if set
        if api_key.expires_at:
            expires_at = api_key.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < now:
                return None

        # Update last_used_at timestamp
        api_key.last_used_at = now
        await db.flush()

        # Cache valid key in Redis with 5 minute TTL
        if redis:
            try:
                await redis.set(f"apikey:{hashed}", str(project.id), ex=300)
            except Exception:
                pass

        return project
