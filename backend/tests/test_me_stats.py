"""Tests for /api/me stats accuracy as data is created."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Class, Lecture, LectureStatus, User


@pytest.mark.asyncio
async def test_stats_reflect_classes(client: AsyncClient, sample_class: Class):
    resp = await client.get("/api/me")
    assert resp.json()["stats"]["total_classes"] == 1


@pytest.mark.asyncio
async def test_stats_reflect_lectures(client: AsyncClient, sample_lecture: Lecture):
    resp = await client.get("/api/me")
    stats = resp.json()["stats"]
    assert stats["total_lectures"] == 1
    assert stats["total_audio_seconds"] == 300


@pytest.mark.asyncio
async def test_stats_exclude_deleted_lectures(
    client: AsyncClient, sample_lecture: Lecture
):
    await client.delete(f"/api/lectures/{sample_lecture.id}")
    resp = await client.get("/api/me")
    stats = resp.json()["stats"]
    assert stats["total_lectures"] == 0
    assert stats["total_audio_seconds"] == 0


@pytest.mark.asyncio
async def test_stats_multiple_classes_and_lectures(
    client: AsyncClient, user: User, db_session: AsyncSession
):
    for i in range(3):
        cls = Class(id=uuid.uuid4(), owner_user_id=user.id, title=f"Class {i}")
        db_session.add(cls)
        await db_session.flush()
        for j in range(2):
            lec = Lecture(
                id=uuid.uuid4(),
                class_id=cls.id,
                owner_user_id=user.id,
                title=f"Lecture {i}-{j}",
                audio_storage_key=f"fake/{uuid.uuid4()}/a.webm",
                audio_original_filename="a.webm",
                audio_mime_type="audio/webm",
                audio_size_bytes=100,
                duration_seconds=60,
                status=LectureStatus.ready,
            )
            db_session.add(lec)
    await db_session.commit()

    resp = await client.get("/api/me")
    stats = resp.json()["stats"]
    assert stats["total_classes"] == 3
    assert stats["total_lectures"] == 6
    assert stats["total_audio_seconds"] == 360
