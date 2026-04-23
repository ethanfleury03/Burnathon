"""Tests for read-only DB schema endpoint (development)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_db_schema_forbidden_for_normal_user(client: AsyncClient):
    resp = await client.get("/api/db/schema")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_db_schema_admin_only(admin_client: AsyncClient):
    resp = await admin_client.get("/api/db/schema")
    assert resp.status_code == 200
    data = resp.json()
    names = {t["name"] for t in data}
    assert names == {"users", "classes", "lectures"}

    users = next(t for t in data if t["name"] == "users")
    col_names = {c["name"] for c in users["columns"]}
    assert "id" in col_names
    assert "email" in col_names
    assert "clerk_user_id" in col_names

    classes = next(t for t in data if t["name"] == "classes")
    owner = next(c for c in classes["columns"] if c["name"] == "owner_user_id")
    assert owner["foreign_keys"] == ["users.id"]
