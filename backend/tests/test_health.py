"""Smoke tests: health endpoint, /api/me profile + stats."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


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
