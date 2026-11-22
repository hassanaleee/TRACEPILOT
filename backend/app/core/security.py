import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(
    subject: str,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if extra_claims:
        to_encode.update(extra_claims)

    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a signed JWT access token."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except jwt.PyJWTError as exc:
        raise ValueError("Invalid or expired token") from exc


def generate_api_key() -> Tuple[str, str, str]:
    """
    Generate a cryptographically secure project API key.
    Returns:
        raw_key: The full plaintext secret shown to user once (e.g. tp_live_8f3a9e...)
        key_prefix: First 12 characters stored for identification (e.g. tp_live_8f3a)
        hashed_key: SHA-256 digest stored in database
    """
    random_bytes = secrets.token_hex(24)
    raw_key = f"tp_live_{random_bytes}"
    key_prefix = raw_key[:12]
    hashed_key = hash_api_key(raw_key)
    return raw_key, key_prefix, hashed_key


def hash_api_key(raw_key: str) -> str:
    """Compute the SHA-256 hexadecimal hash of an API key."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

