"""Friendly 503 responses for database outages or missing migrations."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import OperationalError, ProgrammingError

from app.dependencies import get_current_user, get_db
from app.main import app


class _FailingExecuteSession:
    async def execute(self, *_args, **_kwargs):
        raise OperationalError(
            "SELECT 1",
            {},
            OSError("Connect call failed ('127.0.0.1', 5432)"),
        )


class _MissingTableSession:
    def add(self, _obj):
        return None

    async def commit(self):
        raise ProgrammingError(
            "INSERT INTO classes ...",
            {},
            Exception('relation "classes" does not exist'),
        )

    async def refresh(self, _obj):
        return None


@pytest.mark.asyncio
async def test_me_returns_503_when_database_is_down(user):
    async def _override_user():
        return user

    async def _override_db():
        yield _FailingExecuteSession()

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            resp = await client.get("/api/me")
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 503
    assert "Start PostgreSQL" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_class_returns_503_when_schema_missing(user):
    async def _override_user():
        return user

    async def _override_db():
        yield _MissingTableSession()

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            resp = await client.post("/api/classes", json={"title": "Physics"})
    finally:
        app.dependency_overrides.clear()

    assert resp.status_code == 503
    assert "alembic upgrade head" in resp.json()["detail"]
