import uuid
from typing import Optional
from fastapi import Depends, Header, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import AuthenticationError, PermissionDeniedError
from app.core.security import decode_access_token
from app.models.project import Project
from app.models.user import User
from app.services.api_key_service import APIKeyService
from app.services.auth_service import AuthService

security_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate Bearer JWT token and return active User instance."""
    if not credentials:
        raise AuthenticationError("Authorization header missing")

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except ValueError as exc:
        raise AuthenticationError(str(exc))

    user_id = payload.get("sub")
    if not user_id:
        raise AuthenticationError("Invalid token subject")

    user = await AuthService.get_user_by_id(db, user_id)
    if not user:
        raise AuthenticationError("User not found or deactivated")

    return user


async def get_project_by_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> Project:
    """
    Validate project API key supplied either via:
    1. 'X-API-Key: tp_live_...' header
    2. 'Authorization: Bearer tp_live_...' header
    """
    raw_key = x_api_key
    if not raw_key and credentials and credentials.credentials.startswith("tp_live_"):
        raw_key = credentials.credentials

    if not raw_key:
        raise AuthenticationError("API key required. Supply via 'X-API-Key' or 'Authorization: Bearer tp_live_...'")

    project = await APIKeyService.validate_api_key(db, raw_key)
    if not project:
        raise AuthenticationError("Invalid, expired, or revoked API key")

    return project

