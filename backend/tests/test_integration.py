"""Integration-style tests: multi-step user flows."""

import pytest
from httpx import AsyncClient
from unittest.mock import patch

from app.services.storage import LocalStorage


@pytest.mark.asyncio
async def test_full_user_flow(client: AsyncClient, tmp_path):
    """
    End-to-end flow:
    1. Create a class
    2. Upload a lecture to the class
    3. Verify class detail shows the lecture
    4. Verify lecture detail returns upload data
    5. Soft-delete the lecture
    6. Verify it disappears from class detail
    """
    mock_storage = LocalStorage(str(tmp_path))

    # 1. Create class
    resp = await client.post("/api/classes", json={"title": "Biology 101"})
    assert resp.status_code == 201
    class_id = resp.json()["id"]

    # 2. Upload lecture
    with (
        patch("app.routers.lectures.process_lecture"),
        patch("app.routers.lectures.get_storage", return_value=mock_storage),
    ):
        resp = await client.post(
            f"/api/classes/{class_id}/lectures",
            data={"title": "Cell Biology"},
            files={"audio": ("lecture.webm", b"audio-content", "audio/webm")},
        )
    assert resp.status_code == 201
    lecture_id = resp.json()["id"]
    assert resp.json()["status"] == "uploaded"

    # 3. Class detail shows lecture
    resp = await client.get(f"/api/classes/{class_id}")
    assert resp.status_code == 200
    assert resp.json()["lecture_count"] == 1
    assert len(resp.json()["lectures"]) == 1
    assert resp.json()["lectures"][0]["title"] == "Cell Biology"

    # 4. Lecture detail
    resp = await client.get(f"/api/lectures/{lecture_id}")
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["title"] == "Cell Biology"
    assert detail["audio_size_bytes"] == len(b"audio-content")

    # 5. Soft-delete
    resp = await client.delete(f"/api/lectures/{lecture_id}")
    assert resp.status_code == 204

    # 6. Class detail no longer shows deleted lecture
    resp = await client.get(f"/api/classes/{class_id}")
    assert resp.status_code == 200
    assert resp.json()["lecture_count"] == 0
    assert len(resp.json()["lectures"]) == 0


@pytest.mark.asyncio
async def test_admin_can_manage_other_users_data(
    admin_client: AsyncClient, client: AsyncClient
):
    """Admin should be able to see and manage any user's classes and lectures."""
    # Normal user creates a class
    resp = await client.post("/api/classes", json={"title": "Private Class"})
    class_id = resp.json()["id"]

    # Admin can see it
    resp = await admin_client.get(f"/api/classes/{class_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Private Class"

    # Admin can update it
    resp = await admin_client.patch(
        f"/api/classes/{class_id}",
        json={"title": "Renamed by Admin"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed by Admin"


@pytest.mark.asyncio
async def test_multiple_classes_independence(client: AsyncClient, tmp_path):
    """Lectures in one class don't appear in another."""
    mock_storage = LocalStorage(str(tmp_path))

    resp1 = await client.post("/api/classes", json={"title": "Math"})
    resp2 = await client.post("/api/classes", json={"title": "English"})
    math_id = resp1.json()["id"]
    english_id = resp2.json()["id"]

    with (
        patch("app.routers.lectures.process_lecture"),
        patch("app.routers.lectures.get_storage", return_value=mock_storage),
    ):
        await client.post(
            f"/api/classes/{math_id}/lectures",
            data={"title": "Calculus"},
            files={"audio": ("calc.webm", b"calc", "audio/webm")},
        )

    resp = await client.get(f"/api/classes/{math_id}")
    assert resp.json()["lecture_count"] == 1

    resp = await client.get(f"/api/classes/{english_id}")
    assert resp.json()["lecture_count"] == 0
