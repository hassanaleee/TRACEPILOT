import secrets
import uuid
from typing import List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.models.organization import Organization, OrganizationMember, OrganizationRole
from app.models.project import Project
from app.models.user import User
from app.schemas.organization import OrganizationCreateRequest
from app.schemas.project import ProjectCreateRequest
from app.services.auth_service import slugify


class ProjectService:
    @staticmethod
    async def get_user_organizations(
        db: AsyncSession, user_id: uuid.UUID
    ) -> List[Tuple[Organization, OrganizationRole]]:
        """List all organizations the user is a member of, along with their role."""
        stmt = (
            select(Organization, OrganizationMember.role)
            .join(OrganizationMember, Organization.id == OrganizationMember.organization_id)
            .where(OrganizationMember.user_id == user_id)
            .order_by(Organization.created_at.asc())
        )
        result = await db.execute(stmt)
        return [(org, role) for org, role in result.all()]

    @staticmethod
    async def create_organization(
        db: AsyncSession, user: User, request: OrganizationCreateRequest
    ) -> Organization:
        """Create a new organization and grant OWNER role to the user."""
        base_slug = slugify(request.slug or request.name)
        org_slug = f"{base_slug}-{secrets.token_hex(3)}"

        org = Organization(name=request.name, slug=org_slug)
        db.add(org)
        await db.flush()

        member = OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            role=OrganizationRole.OWNER,
        )
        db.add(member)
        await db.flush()
        return org

    @staticmethod
    async def get_organization_role(
        db: AsyncSession, organization_id: uuid.UUID, user_id: uuid.UUID
    ) -> Optional[OrganizationRole]:
        """Check if user is a member of the organization and return their role."""
        stmt = select(OrganizationMember.role).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
        return (await db.execute(stmt)).scalar_one_or_none()

    @staticmethod
    async def get_projects_for_organization(
        db: AsyncSession, organization_id: uuid.UUID, user_id: uuid.UUID
    ) -> List[Project]:
        """List all projects in an organization if user is a member."""
        role = await ProjectService.get_organization_role(db, organization_id, user_id)
        if not role:
            raise NotFoundError("Organization not found or access denied")

        stmt = (
            select(Project)
            .where(Project.organization_id == organization_id)
            .order_by(Project.created_at.asc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create_project(
        db: AsyncSession,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        request: ProjectCreateRequest,
    ) -> Project:
        """Create a new project under an organization (requires OWNER or ADMIN)."""
        role = await ProjectService.get_organization_role(db, organization_id, user_id)
        if not role:
            raise NotFoundError("Organization not found or access denied")
        if role not in (OrganizationRole.OWNER, OrganizationRole.ADMIN):
            raise PermissionDeniedError("Insufficient permissions to create projects")

        base_slug = slugify(request.slug or request.name)
        # Check slug collision within the same organization
        stmt = select(Project).where(
            Project.organization_id == organization_id,
            Project.slug == base_slug,
        )
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            base_slug = f"{base_slug}-{secrets.token_hex(2)}"

        project = Project(
            organization_id=organization_id,
            name=request.name,
            slug=base_slug,
            description=request.description,
        )
        db.add(project)
        await db.flush()
        return project

    @staticmethod
    async def get_project_with_auth(
        db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
    ) -> Tuple[Project, OrganizationRole]:
        """Fetch project and assert that caller's user belongs to the project's organization."""
        stmt = (
            select(Project, OrganizationMember.role)
            .join(Organization, Project.organization_id == Organization.id)
            .join(OrganizationMember, Organization.id == OrganizationMember.organization_id)
            .where(Project.id == project_id, OrganizationMember.user_id == user_id)
        )
        row = (await db.execute(stmt)).first()
        if not row:
            raise NotFoundError("Project not found")
        project, role = row
        return project, role

