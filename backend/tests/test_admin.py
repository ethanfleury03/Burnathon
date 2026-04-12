"""Tests for admin endpoints: access control, user management, lecture moderation."""

import pytest
from httpx import AsyncClient

from app.models import Lecture, User


# ── Access Control ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_users_forbidden_for_normal_user(client: AsyncClient):
    resp = await client.get("/api/admin/users")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_lectures_forbidden_for_normal_user(client: AsyncClient):
    resp = await client.get("/api/admin/lectures")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_classes_forbidden_for_normal_user(client: AsyncClient):
    resp = await client.get("/api/admin/classes")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_role_change_forbidden_for_normal_user(client: AsyncClient, user: User):
    resp = await client.patch(
        f"/api/admin/users/{user.id}",
        json={"role": "admin"},
    )
    assert resp.status_code == 403


# ── User Management ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_list_users(admin_client: AsyncClient, user: User, admin: User):
    resp = await admin_client.get("/api/admin/users")
    assert resp.status_code == 200
    data = resp.json()
    emails = {u["email"] for u in data}
    assert "student@test.com" in emails
    assert "admin@test.com" in emails


@pytest.mark.asyncio
async def test_admin_list_all_classes(admin_client: AsyncClient, sample_class):
    resp = await admin_client.get("/api/admin/classes")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    cs101 = next(cls for cls in data if cls["title"] == "CS 101")
    assert cs101["owner_user_id"] == str(sample_class.owner_user_id)
    assert "lecture_count" in cs101
    assert isinstance(cs101["lecture_count"], int)


@pytest.mark.asyncio
async def test_admin_promote_user(admin_client: AsyncClient, user: User):
    resp = await admin_client.patch(
        f"/api/admin/users/{user.id}",
        json={"role": "admin"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


@pytest.mark.asyncio
async def test_admin_demote_user(admin_client: AsyncClient, user: User):
    await admin_client.patch(f"/api/admin/users/{user.id}", json={"role": "admin"})
    resp = await admin_client.patch(
        f"/api/admin/users/{user.id}",
        json={"role": "user"},
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "user"


@pytest.mark.asyncio
async def test_admin_update_nonexistent_user(admin_client: AsyncClient):
    resp = await admin_client.patch(
        "/api/admin/users/00000000-0000-0000-0000-000000000000",
        json={"role": "admin"},
    )
    assert resp.status_code == 404


# ── Lecture Moderation ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_list_all_lectures(admin_client: AsyncClient, sample_lecture: Lecture):
    resp = await admin_client.get("/api/admin/lectures")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert any(l["title"] == "Lecture 1" for l in data)


@pytest.mark.asyncio
async def test_admin_list_lectures_includes_soft_deleted(
    admin_client: AsyncClient, sample_lecture: Lecture
):
    """Admin lecture list should include soft-deleted lectures (no deleted_at filter)."""
    # Admin deletes the lecture (soft-delete)
    resp = await admin_client.delete(f"/api/lectures/{sample_lecture.id}")
    assert resp.status_code == 204
    # Admin list should still show it (no deleted_at filter on admin endpoint)
    resp = await admin_client.get("/api/admin/lectures")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_admin_can_delete_any_lecture(admin_client: AsyncClient, sample_lecture: Lecture):
    resp = await admin_client.delete(f"/api/lectures/{sample_lecture.id}")
    assert resp.status_code == 204
