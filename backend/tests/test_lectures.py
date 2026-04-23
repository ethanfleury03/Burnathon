"""Tests for lecture upload, retrieval, soft-delete, and quiz generation trigger."""

import uuid
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Class, Lecture, LectureStatus
from app.services.storage import LocalStorage


# ── Upload ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upload_lecture(client: AsyncClient, sample_class: Class, tmp_path):
    from app.services.storage import LocalStorage

    mock_storage = LocalStorage(str(tmp_path))
    with (
        patch("app.routers.lectures.process_lecture"),
        patch("app.routers.lectures.get_storage", return_value=mock_storage),
    ):
        resp = await client.post(
            f"/api/classes/{sample_class.id}/lectures",
            data={"title": "Intro Lecture", "notes": "Some notes"},
            files={"audio": ("test.webm", b"fake-audio-bytes", "audio/webm")},
        )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Intro Lecture"
    assert data["status"] == "uploaded"
    assert data["audio_original_filename"] == "test.webm"
    assert data["audio_size_bytes"] == len(b"fake-audio-bytes")


@pytest.mark.asyncio
async def test_upload_lecture_to_nonexistent_class(client: AsyncClient):
    resp = await client.post(
        f"/api/classes/{uuid.uuid4()}/lectures",
        data={"title": "Orphan"},
        files={"audio": ("test.webm", b"data", "audio/webm")},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_upload_to_archived_class_rejected(client: AsyncClient, sample_class: Class):
    await client.patch(f"/api/classes/{sample_class.id}", json={"archived": True})
    resp = await client.post(
        f"/api/classes/{sample_class.id}/lectures",
        data={"title": "Should Fail"},
        files={"audio": ("test.webm", b"data", "audio/webm")},
    )
    assert resp.status_code == 400
    assert "archived" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_to_other_users_class_forbidden(
    other_client: AsyncClient, sample_class: Class
):
    resp = await other_client.post(
        f"/api/classes/{sample_class.id}/lectures",
        data={"title": "Sneaky"},
        files={"audio": ("test.webm", b"data", "audio/webm")},
    )
    assert resp.status_code == 403


# ── Get Detail ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_lecture_detail(client: AsyncClient, sample_lecture: Lecture):
    resp = await client.get(f"/api/lectures/{sample_lecture.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Lecture 1"
    assert data["status"] == "ready"
    assert data["transcript_text"] is not None
    assert data["summary_text"] is not None
    assert data["owner_user_id"] is not None


@pytest.mark.asyncio
async def test_get_lecture_not_found(client: AsyncClient):
    resp = await client.get(f"/api/lectures/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_lecture_forbidden_for_other_user(
    other_client: AsyncClient, sample_lecture: Lecture
):
    resp = await other_client.get(f"/api/lectures/{sample_lecture.id}")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_can_get_any_lecture(admin_client: AsyncClient, sample_lecture: Lecture):
    resp = await admin_client.get(f"/api/lectures/{sample_lecture.id}")
    assert resp.status_code == 200


# ── Soft Delete ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_soft_delete_lecture(client: AsyncClient, sample_lecture: Lecture):
    resp = await client.delete(f"/api/lectures/{sample_lecture.id}")
    assert resp.status_code == 204

    resp = await client.get(f"/api/lectures/{sample_lecture.id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_lecture_forbidden_for_other_user(
    other_client: AsyncClient, sample_lecture: Lecture
):
    resp = await other_client.delete(f"/api/lectures/{sample_lecture.id}")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_soft_deleted_lecture_excluded_from_class_detail(
    client: AsyncClient, sample_class: Class, sample_lecture: Lecture
):
    await client.delete(f"/api/lectures/{sample_lecture.id}")
    resp = await client.get(f"/api/classes/{sample_class.id}")
    assert resp.status_code == 200
    assert len(resp.json()["lectures"]) == 0


# ── Quiz Generation Trigger ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_trigger_quiz_generation(client: AsyncClient, sample_lecture: Lecture):
    with patch("app.routers.lectures.generate_quiz_for_lecture"):
        resp = await client.post(f"/api/lectures/{sample_lecture.id}/generate-quiz")
    assert resp.status_code == 200
    assert resp.json()["id"] == str(sample_lecture.id)


@pytest.mark.asyncio
async def test_quiz_generation_requires_transcript(
    client: AsyncClient, sample_class: Class, db_session
):
    """A lecture without a transcript should reject quiz generation."""
    from app.models import Lecture, LectureStatus

    lec = Lecture(
        id=uuid.uuid4(),
        class_id=sample_class.id,
        owner_user_id=sample_class.owner_user_id,
        title="No Transcript",
        audio_storage_key="fake/audio.webm",
        audio_original_filename="audio.webm",
        audio_mime_type="audio/webm",
        audio_size_bytes=100,
        status=LectureStatus.uploaded,
        transcript_text=None,
    )
    db_session.add(lec)
    await db_session.commit()

    resp = await client.post(f"/api/lectures/{lec.id}/generate-quiz")
    assert resp.status_code == 400
    assert "transcribed" in resp.json()["detail"].lower()


# ── Authenticated audio download ──────────────────────────────────


async def _lecture_with_audio_on_disk(
    db_session: AsyncSession, sample_class: Class, owner_id: uuid.UUID, tmp_path: Path
) -> Lecture:
    lec_id = uuid.uuid4()
    audio_dir = tmp_path / str(lec_id)
    audio_dir.mkdir(parents=True)
    (audio_dir / "rec.webm").write_bytes(b"secret-audio-bytes")
    lec = Lecture(
        id=lec_id,
        class_id=sample_class.id,
        owner_user_id=owner_id,
        title="Audio Lecture",
        audio_storage_key=f"{lec_id}/rec.webm",
        audio_original_filename="rec.webm",
        audio_mime_type="audio/webm",
        audio_size_bytes=20,
        status=LectureStatus.ready,
        transcript_text="x",
        summary_text="y",
    )
    db_session.add(lec)
    await db_session.commit()
    await db_session.refresh(lec)
    return lec


@pytest.mark.asyncio
async def test_lecture_audio_download_owner(
    client: AsyncClient, user, sample_class: Class, db_session: AsyncSession, tmp_path: Path
):
    lec = await _lecture_with_audio_on_disk(db_session, sample_class, user.id, tmp_path)
    storage_root = LocalStorage(str(tmp_path))
    with patch("app.routers.lectures.get_storage", return_value=storage_root):
        resp = await client.get(f"/api/lectures/{lec.id}/audio")
    assert resp.status_code == 200
    assert resp.content == b"secret-audio-bytes"
    assert resp.headers.get("content-type", "").startswith("audio/webm")


@pytest.mark.asyncio
async def test_lecture_audio_download_forbidden_for_other_user(
    other_client: AsyncClient, user, sample_class: Class, db_session: AsyncSession, tmp_path: Path
):
    lec = await _lecture_with_audio_on_disk(db_session, sample_class, user.id, tmp_path)
    storage_root = LocalStorage(str(tmp_path))
    with patch("app.routers.lectures.get_storage", return_value=storage_root):
        resp = await other_client.get(f"/api/lectures/{lec.id}/audio")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_lecture_audio_download_admin(
    admin_client: AsyncClient, user, sample_class: Class, db_session: AsyncSession, tmp_path: Path
):
    lec = await _lecture_with_audio_on_disk(db_session, sample_class, user.id, tmp_path)
    storage_root = LocalStorage(str(tmp_path))
    with patch("app.routers.lectures.get_storage", return_value=storage_root):
        resp = await admin_client.get(f"/api/lectures/{lec.id}/audio")
    assert resp.status_code == 200
    assert resp.content == b"secret-audio-bytes"


@pytest.mark.asyncio
async def test_lecture_audio_download_unauthenticated(anon_client: AsyncClient, tmp_path: Path):
    resp = await anon_client.get(f"/api/lectures/{uuid.uuid4()}/audio")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_lecture_audio_download_file_missing(
    client: AsyncClient, user, sample_class: Class, db_session: AsyncSession, tmp_path: Path
):
    lec_id = uuid.uuid4()
    lec = Lecture(
        id=lec_id,
        class_id=sample_class.id,
        owner_user_id=user.id,
        title="Missing file",
        audio_storage_key=f"{lec_id}/nope.webm",
        audio_original_filename="nope.webm",
        audio_mime_type="audio/webm",
        audio_size_bytes=1,
        status=LectureStatus.ready,
        transcript_text="x",
        summary_text="y",
    )
    db_session.add(lec)
    await db_session.commit()
    storage_root = LocalStorage(str(tmp_path))
    with patch("app.routers.lectures.get_storage", return_value=storage_root):
        resp = await client.get(f"/api/lectures/{lec.id}/audio")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_lecture_audio_download_soft_deleted_lecture_not_found(
    client: AsyncClient, user, sample_class: Class, db_session: AsyncSession, tmp_path: Path
):
    from datetime import datetime, timezone

    lec = await _lecture_with_audio_on_disk(db_session, sample_class, user.id, tmp_path)
    lec.deleted_at = datetime.now(timezone.utc)
    await db_session.commit()
    storage_root = LocalStorage(str(tmp_path))
    with patch("app.routers.lectures.get_storage", return_value=storage_root):
        resp = await client.get(f"/api/lectures/{lec.id}/audio")
    assert resp.status_code == 404
