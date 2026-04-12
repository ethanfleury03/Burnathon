"""Tests for the background processing pipeline with mocked services."""

import uuid
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Class, Lecture, LectureStatus, User, UserRole


@pytest.fixture
async def uploaded_lecture(db_session: AsyncSession) -> Lecture:
    """A lecture in 'uploaded' status with a fake audio file path."""
    user = User(
        id=uuid.uuid4(),
        clerk_user_id="proc_user",
        email="proc@test.com",
        role=UserRole.user,
    )
    db_session.add(user)
    await db_session.flush()

    cls = Class(id=uuid.uuid4(), owner_user_id=user.id, title="Processing Test")
    db_session.add(cls)
    await db_session.flush()

    lecture_id = uuid.uuid4()
    lec = Lecture(
        id=lecture_id,
        class_id=cls.id,
        owner_user_id=user.id,
        title="Audio to Process",
        audio_storage_key=f"{lecture_id}/audio.webm",
        audio_original_filename="audio.webm",
        audio_mime_type="audio/webm",
        audio_size_bytes=5000,
        status=LectureStatus.uploaded,
    )
    db_session.add(lec)
    await db_session.commit()
    await db_session.refresh(lec)
    return lec


@pytest.mark.asyncio
async def test_process_lecture_success(uploaded_lecture: Lecture, db_session: AsyncSession, tmp_path):
    """Full pipeline: transcribe + summarize, ending at status=ready."""
    audio_dir = tmp_path / str(uploaded_lecture.id)
    audio_dir.mkdir()
    audio_file = audio_dir / "audio.webm"
    audio_file.write_bytes(b"fake-audio")

    mock_storage = MagicMock()
    mock_storage.get_local_path.return_value = audio_file

    with (
        patch("app.processing.get_storage", return_value=mock_storage),
        patch("app.processing.async_session", return_value=db_session),
        patch("app.processing.transcription") as mock_transcription,
        patch("app.processing.ai") as mock_ai,
    ):
        mock_transcription.transcribe.return_value = "Transcribed text about physics."
        mock_ai.summarize = AsyncMock(return_value="Summary: physics concepts covered.")

        # Patch async_session as a context manager that yields the test session
        from contextlib import asynccontextmanager

        @asynccontextmanager
        async def _fake_session():
            yield db_session

        with patch("app.processing.async_session", side_effect=lambda: _fake_session()):
            from app.processing import process_lecture
            await process_lecture(uploaded_lecture.id)

    result = await db_session.execute(
        select(Lecture).where(Lecture.id == uploaded_lecture.id)
    )
    lecture = result.scalar_one()
    assert lecture.status == LectureStatus.ready
    assert lecture.transcript_text == "Transcribed text about physics."
    assert lecture.summary_text == "Summary: physics concepts covered."
    assert lecture.processing_error is None


@pytest.mark.asyncio
async def test_process_lecture_transcription_failure(
    uploaded_lecture: Lecture, db_session: AsyncSession, tmp_path
):
    """If transcription fails, status should be 'failed' with error message."""
    audio_dir = tmp_path / str(uploaded_lecture.id)
    audio_dir.mkdir()
    audio_file = audio_dir / "audio.webm"
    audio_file.write_bytes(b"corrupt-audio")

    mock_storage = MagicMock()
    mock_storage.get_local_path.return_value = audio_file

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _fake_session():
        yield db_session

    with (
        patch("app.processing.get_storage", return_value=mock_storage),
        patch("app.processing.async_session", side_effect=lambda: _fake_session()),
        patch("app.processing.transcription") as mock_transcription,
    ):
        mock_transcription.transcribe.side_effect = RuntimeError("Whisper model failed")

        from app.processing import process_lecture
        await process_lecture(uploaded_lecture.id)

    result = await db_session.execute(
        select(Lecture).where(Lecture.id == uploaded_lecture.id)
    )
    lecture = result.scalar_one()
    assert lecture.status == LectureStatus.failed
    assert "Whisper model failed" in lecture.processing_error


@pytest.mark.asyncio
async def test_process_lecture_missing_audio_file(
    uploaded_lecture: Lecture, db_session: AsyncSession
):
    """If the audio file doesn't exist on disk, processing should fail."""
    mock_storage = MagicMock()
    mock_storage.get_local_path.return_value = Path("/nonexistent/audio.webm")

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _fake_session():
        yield db_session

    with (
        patch("app.processing.get_storage", return_value=mock_storage),
        patch("app.processing.async_session", side_effect=lambda: _fake_session()),
    ):
        from app.processing import process_lecture
        await process_lecture(uploaded_lecture.id)

    result = await db_session.execute(
        select(Lecture).where(Lecture.id == uploaded_lecture.id)
    )
    lecture = result.scalar_one()
    assert lecture.status == LectureStatus.failed
    assert "not found" in lecture.processing_error.lower()


@pytest.mark.asyncio
async def test_generate_quiz_success(db_session: AsyncSession):
    """Quiz generation should save quiz_data when transcript exists."""
    user = User(
        id=uuid.uuid4(), clerk_user_id="quiz_user", email="quiz@test.com", role=UserRole.user
    )
    db_session.add(user)
    await db_session.flush()

    cls = Class(id=uuid.uuid4(), owner_user_id=user.id, title="Quiz Class")
    db_session.add(cls)
    await db_session.flush()

    lec = Lecture(
        id=uuid.uuid4(),
        class_id=cls.id,
        owner_user_id=user.id,
        title="Quiz Lecture",
        audio_storage_key="fake/audio.webm",
        audio_original_filename="audio.webm",
        audio_mime_type="audio/webm",
        audio_size_bytes=100,
        status=LectureStatus.ready,
        transcript_text="A lecture about machine learning fundamentals.",
    )
    db_session.add(lec)
    await db_session.commit()

    mock_quiz = {
        "questions": [
            {
                "question": "What is ML?",
                "options": ["A", "B", "C", "D"],
                "correct_index": 0,
            }
        ],
        "flashcards": [{"front": "ML", "back": "Machine Learning"}],
    }

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _fake_session():
        yield db_session

    with (
        patch("app.processing.async_session", side_effect=lambda: _fake_session()),
        patch("app.processing.ai") as mock_ai,
    ):
        mock_ai.generate_quiz = AsyncMock(return_value=mock_quiz)

        from app.processing import generate_quiz_for_lecture
        await generate_quiz_for_lecture(lec.id)

    result = await db_session.execute(select(Lecture).where(Lecture.id == lec.id))
    lecture = result.scalar_one()
    assert lecture.quiz_data is not None
    assert len(lecture.quiz_data["questions"]) == 1
    assert len(lecture.quiz_data["flashcards"]) == 1
