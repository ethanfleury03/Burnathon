"""
Shared test fixtures.

Uses an in-memory SQLite database so tests run without PostgreSQL.
Auth is bypassed by overriding the get_current_user dependency.
External services (transcription, OpenAI) are mocked.
"""

import uuid
from typing import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base, Class, Lecture, LectureStatus, User, UserRole


# ---------------------------------------------------------------------------
# SQLite async engine for tests
# ---------------------------------------------------------------------------

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DB_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


# SQLite doesn't enforce FK constraints by default
@event.listens_for(test_engine.sync_engine, "connect")
def _enable_fk(dbapi_conn, _rec):
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


# ---------------------------------------------------------------------------
# Database lifecycle
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
async def setup_db():
    """Create all tables before each test, drop after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(autouse=True)
def bind_test_async_session(monkeypatch):
    """Route ``dependencies.async_session`` to the in-memory SQLite engine.

    Background code (e.g. chat streaming persistence) opens ad-hoc sessions
    via ``dependencies.async_session()`` instead of the overridden ``get_db``
    dependency; without this patch it would try the real DATABASE_URL.
    """
    from app import dependencies

    monkeypatch.setattr(dependencies, "async_session", TestSessionLocal)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# Seed data helpers
# ---------------------------------------------------------------------------

@pytest.fixture
async def user(db_session: AsyncSession) -> User:
    """A normal user."""
    u = User(
        id=uuid.uuid4(),
        clerk_user_id="clerk_user_1",
        email="student@test.com",
        full_name="Test Student",
        role=UserRole.user,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def admin(db_session: AsyncSession) -> User:
    """An admin user."""
    u = User(
        id=uuid.uuid4(),
        clerk_user_id="clerk_admin_1",
        email="admin@test.com",
        full_name="Test Admin",
        role=UserRole.admin,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def other_user(db_session: AsyncSession) -> User:
    """A second normal user for ownership tests."""
    u = User(
        id=uuid.uuid4(),
        clerk_user_id="clerk_user_2",
        email="other@test.com",
        full_name="Other Student",
        role=UserRole.user,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest.fixture
async def sample_class(db_session: AsyncSession, user: User) -> Class:
    """A class owned by 'user'."""
    cls = Class(id=uuid.uuid4(), owner_user_id=user.id, title="CS 101")
    db_session.add(cls)
    await db_session.commit()
    await db_session.refresh(cls)
    return cls


@pytest.fixture
async def sample_lecture(db_session: AsyncSession, user: User, sample_class: Class) -> Lecture:
    """A lecture in sample_class with status=ready and a transcript."""
    lec = Lecture(
        id=uuid.uuid4(),
        class_id=sample_class.id,
        owner_user_id=user.id,
        title="Lecture 1",
        audio_storage_key=f"{uuid.uuid4()}/audio.webm",
        audio_original_filename="audio.webm",
        audio_mime_type="audio/webm",
        audio_size_bytes=12345,
        duration_seconds=300,
        transcript_text="This is a test transcript about algorithms and data structures.",
        summary_text="A summary of algorithms.",
        status=LectureStatus.ready,
    )
    db_session.add(lec)
    await db_session.commit()
    await db_session.refresh(lec)
    return lec


# ---------------------------------------------------------------------------
# FastAPI test client with dependency overrides
# ---------------------------------------------------------------------------

def _make_client(acting_user: User):
    """Build an AsyncClient whose auth dependency returns `acting_user`."""
    from app.dependencies import get_current_user, get_db, verify_clerk_jwt
    from app.main import app

    async def _override_db():
        async with TestSessionLocal() as session:
            yield session

    async def _override_user():
        return acting_user

    async def _override_jwt():
        return {"sub": acting_user.clerk_user_id}

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[verify_clerk_jwt] = _override_jwt

    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    )


@pytest.fixture
def client(user: User):
    """HTTP client authenticated as a normal user."""
    from app.main import app
    c = _make_client(user)
    yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_client(admin: User):
    """HTTP client authenticated as an admin."""
    from app.main import app
    c = _make_client(admin)
    yield c
    app.dependency_overrides.clear()


@pytest.fixture
def other_client(other_user: User):
    """HTTP client authenticated as the other user."""
    from app.main import app
    c = _make_client(other_user)
    yield c
    app.dependency_overrides.clear()
