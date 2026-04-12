"""Tests for class CRUD: create, list, get detail, update, archive, ownership."""

import pytest
from httpx import AsyncClient

from app.models import Class


# ── Create ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_class(client: AsyncClient):
    resp = await client.post("/api/classes", json={"title": "Physics 201"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Physics 201"
    assert data["archived_at"] is None
    assert data["lecture_count"] == 0


@pytest.mark.asyncio
async def test_create_class_empty_title_rejected(client: AsyncClient):
    resp = await client.post("/api/classes", json={})
    assert resp.status_code == 422


# ── List ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_classes_empty(client: AsyncClient):
    resp = await client.get("/api/classes")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_classes_returns_own(client: AsyncClient, sample_class: Class):
    resp = await client.get("/api/classes")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "CS 101"


@pytest.mark.asyncio
async def test_list_classes_excludes_other_users(other_client: AsyncClient, sample_class: Class):
    """other_user should not see user's classes."""
    resp = await other_client.get("/api/classes")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_admin_sees_all_classes(admin_client: AsyncClient, sample_class: Class):
    resp = await admin_client.get("/api/classes")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ── Get Detail ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_class_detail(client: AsyncClient, sample_class: Class):
    resp = await client.get(f"/api/classes/{sample_class.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "CS 101"
    assert data["lectures"] == []
    assert data["lecture_count"] == 0


@pytest.mark.asyncio
async def test_get_class_not_found(client: AsyncClient):
    resp = await client.get("/api/classes/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_class_forbidden_for_other_user(other_client: AsyncClient, sample_class: Class):
    resp = await other_client.get(f"/api/classes/{sample_class.id}")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_get_any_class(admin_client: AsyncClient, sample_class: Class):
    resp = await admin_client.get(f"/api/classes/{sample_class.id}")
    assert resp.status_code == 200


# ── Update ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_class_title(client: AsyncClient, sample_class: Class):
    resp = await client.patch(
        f"/api/classes/{sample_class.id}",
        json={"title": "CS 201 Advanced"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "CS 201 Advanced"


@pytest.mark.asyncio
async def test_archive_class(client: AsyncClient, sample_class: Class):
    resp = await client.patch(
        f"/api/classes/{sample_class.id}",
        json={"archived": True},
    )
    assert resp.status_code == 200
    assert resp.json()["archived_at"] is not None


@pytest.mark.asyncio
async def test_unarchive_class(client: AsyncClient, sample_class: Class):
    await client.patch(f"/api/classes/{sample_class.id}", json={"archived": True})
    resp = await client.patch(f"/api/classes/{sample_class.id}", json={"archived": False})
    assert resp.status_code == 200
    assert resp.json()["archived_at"] is None


@pytest.mark.asyncio
async def test_archived_class_hidden_from_list(client: AsyncClient, sample_class: Class):
    await client.patch(f"/api/classes/{sample_class.id}", json={"archived": True})
    resp = await client.get("/api/classes")
    assert len(resp.json()) == 0


@pytest.mark.asyncio
async def test_update_class_forbidden_for_other_user(other_client: AsyncClient, sample_class: Class):
    resp = await other_client.patch(
        f"/api/classes/{sample_class.id}",
        json={"title": "Hacked"},
    )
    assert resp.status_code == 403
