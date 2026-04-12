import asyncio
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import async_session
from app.models import Lecture, LectureStatus
from app.services import ai, transcription
from app.services.storage import get_storage

logger = logging.getLogger(__name__)


async def _update_status(
    session: AsyncSession, lecture_id: uuid.UUID, status: LectureStatus, **kwargs
):
    result = await session.execute(select(Lecture).where(Lecture.id == lecture_id))
    lecture = result.scalar_one()
    lecture.status = status
    for key, value in kwargs.items():
        setattr(lecture, key, value)
    await session.commit()


async def process_lecture(lecture_id: uuid.UUID):
    """Background pipeline: transcribe locally, then summarize via GPT."""
    storage = get_storage()
    try:
        async with async_session() as session:
            result = await session.execute(select(Lecture).where(Lecture.id == lecture_id))
            lecture = result.scalar_one()
            storage_key = lecture.audio_storage_key

        local_path = storage.get_local_path(storage_key)
        if local_path is None or not local_path.exists():
            raise FileNotFoundError(f"Audio file not found: {storage_key}")

        # Step 1: Transcribe (CPU-bound, run in thread)
        async with async_session() as session:
            await _update_status(session, lecture_id, LectureStatus.transcribing)

        transcript = await asyncio.to_thread(transcription.transcribe, local_path)

        async with async_session() as session:
            await _update_status(session, lecture_id, LectureStatus.summarizing, transcript_text=transcript)

        # Step 2: Summarize via GPT
        summary = await ai.summarize(transcript)

        async with async_session() as session:
            await _update_status(session, lecture_id, LectureStatus.ready, summary_text=summary)

        logger.info("Lecture %s processing complete", lecture_id)

    except Exception as e:
        logger.exception("Lecture %s processing failed", lecture_id)
        try:
            async with async_session() as session:
                await _update_status(
                    session, lecture_id, LectureStatus.failed, processing_error=str(e)
                )
        except Exception:
            logger.exception("Failed to update lecture %s status to failed", lecture_id)


async def generate_quiz_for_lecture(lecture_id: uuid.UUID):
    """On-demand quiz generation from existing transcript."""
    try:
        async with async_session() as session:
            result = await session.execute(select(Lecture).where(Lecture.id == lecture_id))
            lecture = result.scalar_one()

            if not lecture.transcript_text:
                raise ValueError("No transcript available for quiz generation")

            quiz_data = await ai.generate_quiz(lecture.transcript_text)
            lecture.quiz_data = quiz_data
            await session.commit()

        logger.info("Quiz generated for lecture %s", lecture_id)

    except Exception as e:
        logger.exception("Quiz generation failed for lecture %s", lecture_id)
        try:
            async with async_session() as session:
                await _update_status(
                    session, lecture_id, LectureStatus.failed, processing_error=f"Quiz generation: {e}"
                )
        except Exception:
            logger.exception("Failed to update lecture %s status", lecture_id)
