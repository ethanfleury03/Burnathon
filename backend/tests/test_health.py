"""Smoke tests: health endpoint, /api/me profile + stats."""

import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

from app.db_ready import DatabaseStatus


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    with patch("app.main.get_database_status", new=AsyncMock(return_value=DatabaseStatus(ok=True))):
        resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "database": "ok"}


@pytest.mark.asyncio
async def test_health_reports_degraded_database(client: AsyncClient):
    with patch(
        "app.main.get_database_status",
        new=AsyncMock(
            return_value=DatabaseStatus(
                ok=False,
                detail="Database schema is not initialized. Run `alembic upgrade head`.",
            )
        ),
    ):
        resp = await client.get("/api/health")

    assert resp.status_code == 503
    assert resp.json() == {
        "status": "degraded",
        "database": "unavailable",
        "detail": "Database schema is not initialized. Run `alembic upgrade head`.",
    }


@pytest.mark.asyncio
async def test_me_returns_user_and_empty_stats(client: AsyncClient):
    resp = await client.get("/api/me")
    assert resp.status_code == 200
    data = resp.json()

    assert data["user"]["email"] == "student@test.com"
    assert data["user"]["role"] == "user"
    assert data["stats"]["total_classes"] == 0
    assert data["stats"]["total_lectures"] == 0
    assert data["stats"]["total_audio_seconds"] == 0
