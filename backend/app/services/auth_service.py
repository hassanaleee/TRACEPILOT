import re
import secrets
import uuid
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, ConflictError, NotFoundError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.organization import Organization, OrganizationMember, OrganizationRole
from app.models.project import Project
from app.models.user import User
from app.schemas.auth import UserLoginRequest, UserRegisterRequest


def slugify(text: str) -> str:
    """Generate a clean URL-friendly slug from text."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    text = re.sub(r"^-+|-+$", "", text)
    return text or "default"


class AuthService:
    @staticmethod
    async def register(db: AsyncSession, request: UserRegisterRequest) -> Tuple[User, str]:
        """Register a new user, create their default organization, membership (OWNER),
        and default project. Returns (User, access_token)."""
        # Check if email is already taken
        stmt = select(User).where(User.email == request.email)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if existing:
            raise ConflictError("A user with this email address already exists")

        # Create user
        user = User(
            email=request.email,
            hashed_password=hash_password(request.password),
            full_name=request.full_name,
            is_active=True,
        )
        db.add(user)
        await db.flush()

        # Create default organization
        org_name = request.organization_name or f"{request.full_name}'s Team"
        base_slug = slugify(org_name)
        org_slug = f"{base_slug}-{secrets.token_hex(3)}"

        organization = Organization(
            name=org_name,
            slug=org_slug,
        )
        db.add(organization)
        await db.flush()

        # Assign OWNER role
        membership = OrganizationMember(
            organization_id=organization.id,
            user_id=user.id,
            role=OrganizationRole.OWNER,
        )
        db.add(membership)

        # Create default project
        default_project = Project(
            organization_id=organization.id,
            name="Default Project",
            slug="default-project",
            description="Initial project for your AI traces and evaluations.",
        )
        db.add(default_project)
        await db.flush()

        token = create_access_token(
            subject=str(user.id),
            extra_claims={"email": user.email, "name": user.full_name},
        )
        return user, token

    @staticmethod
    async def authenticate(db: AsyncSession, request: UserLoginRequest) -> Tuple[User, str]:
        """Verify user credentials and return (User, access_token)."""
        stmt = select(User).where(User.email == request.email)
        user = (await db.execute(stmt)).scalar_one_or_none()

        if not user or not verify_password(request.password, user.hashed_password):
            raise AuthenticationError("Incorrect email or password")

        if not user.is_active:
            raise AuthenticationError("User account is inactive")

        token = create_access_token(
            subject=str(user.id),
            extra_claims={"email": user.email, "name": user.full_name},
        )
        return user, token

    @staticmethod
    async def get_user_by_id(db: AsyncSession, user_id: str | uuid.UUID) -> Optional[User]:
        """Fetch active user by primary key."""
        if isinstance(user_id, str):
            try:
                user_id = uuid.UUID(user_id)
            except ValueError:
                return None

        stmt = select(User).where(User.id == user_id, User.is_active.is_(True))
        return (await db.execute(stmt)).scalar_one_or_none()
