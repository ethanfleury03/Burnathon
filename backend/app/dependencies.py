import uuid
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models import Class, ClassVisibility, Lecture, User, UserRole

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)

_jwks_cache: dict | None = None


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


def _jwks_request_headers() -> dict[str, str]:
    """Clerk Backend API JWKS (`api.clerk.com/v1/jwks`) requires Bearer auth with the secret key."""
    if settings.clerk_secret_key and "api.clerk.com" in settings.clerk_jwks_url:
        return {"Authorization": f"Bearer {settings.clerk_secret_key}"}
    return {}


async def _get_jwks() -> dict:
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(settings.clerk_jwks_url, headers=_jwks_request_headers())
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


def _extract_token(request: Request) -> str:
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")
    return auth[7:]


async def _verify_clerk_token(token: str) -> dict:
    try:
        jwks = await _get_jwks()
        header = jwt.get_unverified_header(token)
        key = next((k for k in jwks.get("keys", []) if k["kid"] == header.get("kid")), None)
        if key is None:
            global _jwks_cache
            _jwks_cache = None
            jwks = await _get_jwks()
            key = next((k for k in jwks.get("keys", []) if k["kid"] == header.get("kid")), None)
        if key is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signing key")
        payload = jwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False})
        return payload
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}")


async def verify_clerk_jwt(request: Request) -> dict:
    """Validates Bearer token with Clerk JWKS only (no database)."""
    token = _extract_token(request)
    return await _verify_clerk_token(token)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_token(request)
    payload = await _verify_clerk_token(token)
    clerk_user_id = payload.get("sub")
    if not clerk_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing subject")

    result = await db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
    user = result.scalar_one_or_none()

    if user is None:
        email = payload.get("email", payload.get("email_addresses", [{}])[0].get("email_address", ""))
        full_name = payload.get("name", payload.get("first_name", ""))
        if not email:
            email = f"{clerk_user_id}@clerk.user"
        user = User(
            id=uuid.uuid4(),
            clerk_user_id=clerk_user_id,
            email=email,
            full_name=full_name or None,
            role=UserRole.user,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


DB = Annotated[AsyncSession, Depends(get_db)]
ClerkJWTPayload = Annotated[dict, Depends(verify_clerk_jwt)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_admin)]


def _user_can_edit_class(cls: Class, user: User) -> bool:
    """Admins and owners can mutate; public viewers cannot."""
    return user.role == UserRole.admin or cls.owner_user_id == user.id


async def load_class_for_read(
    class_id: uuid.UUID,
    session: AsyncSession,
    user: User,
) -> tuple[Class, bool]:
    """Load a class if the user can read it (owner, admin, or public)."""
    result = await session.execute(select(Class).where(Class.id == class_id))
    cls = result.scalar_one_or_none()
    if cls is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    is_owner = _user_can_edit_class(cls, user)
    is_public = cls.visibility == ClassVisibility.public

    if not is_owner and not is_public:
        # Hide existence of private classes the viewer cannot see.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")

    return cls, is_owner


async def load_class_for_write(
    class_id: uuid.UUID,
    session: AsyncSession,
    user: User,
) -> Class:
    result = await session.execute(select(Class).where(Class.id == class_id))
    cls = result.scalar_one_or_none()
    if cls is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    if not _user_can_edit_class(cls, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your class")
    return cls


async def load_lecture_for_read(
    lecture_id: uuid.UUID,
    session: AsyncSession,
    user: User,
) -> tuple[Lecture, Class, bool]:
    """Return (lecture, parent class, can_edit) for a lecture the user can view."""
    result = await session.execute(
        select(Lecture, Class)
        .join(Class, Class.id == Lecture.class_id)
        .where(Lecture.id == lecture_id, Lecture.deleted_at.is_(None))
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")
    lecture, cls = row
    can_edit = _user_can_edit_class(cls, user)
    is_public = cls.visibility == ClassVisibility.public
    if not can_edit and not is_public:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")
    return lecture, cls, can_edit


async def load_lecture_for_write(
    lecture_id: uuid.UUID,
    session: AsyncSession,
    user: User,
) -> Lecture:
    result = await session.execute(
        select(Lecture).where(Lecture.id == lecture_id, Lecture.deleted_at.is_(None))
    )
    lecture = result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")
    if user.role != UserRole.admin and lecture.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your lecture")
    return lecture
