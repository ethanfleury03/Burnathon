"""Tests for the local storage service."""

import uuid

import pytest

from app.services.storage import LocalStorage


@pytest.mark.asyncio
async def test_local_storage_save_and_retrieve(tmp_path):
    storage = LocalStorage(str(tmp_path))
    lecture_id = uuid.uuid4()
    data = b"fake audio content"

    key = await storage.save(lecture_id, "recording.webm", data)

    assert key == f"{lecture_id}/recording.webm"
    assert storage.get_url(key) == f"/files/{lecture_id}/recording.webm"

    local_path = storage.get_local_path(key)
    assert local_path is not None
    assert local_path.exists()
    assert local_path.read_bytes() == data


@pytest.mark.asyncio
async def test_local_storage_creates_directories(tmp_path):
    storage = LocalStorage(str(tmp_path / "nested" / "uploads"))
    lecture_id = uuid.uuid4()

    key = await storage.save(lecture_id, "test.mp3", b"mp3data")
    local_path = storage.get_local_path(key)
    assert local_path.exists()


@pytest.mark.asyncio
async def test_local_storage_multiple_files_same_lecture(tmp_path):
    storage = LocalStorage(str(tmp_path))
    lecture_id = uuid.uuid4()

    key1 = await storage.save(lecture_id, "audio.webm", b"audio")
    key2 = await storage.save(lecture_id, "notes.txt", b"notes")

    assert storage.get_local_path(key1).read_bytes() == b"audio"
    assert storage.get_local_path(key2).read_bytes() == b"notes"
