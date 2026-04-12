import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, status
from sqlalchemy import select

from app.dependencies import DB, CurrentUser
from app.models import Class, Lecture, LectureStatus, UserRole
from app.processing import generate_quiz_for_lecture, process_lecture
from app.schemas import LectureDetail, LectureOut
from app.services.storage import get_storage

router = APIRouter(tags=["lectures"])


@router.post(
    "/api/classes/{class_id}/lectures",
    response_model=LectureOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_lecture(
    class_id: uuid.UUID,
    title: str,
    audio: UploadFile,
    user: CurrentUser,
    db: DB,
    background_tasks: BackgroundTasks,
    notes: str | None = None,
):
    result = await db.execute(select(Class).where(Class.id == class_id))
    cls = result.scalar_one_or_none()
    if cls is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    if user.role != UserRole.admin and cls.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your class")
    if cls.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Class is archived")

    audio_data = await audio.read()
    lecture_id = uuid.uuid4()
    storage = get_storage()
    storage_key = await storage.save(lecture_id, audio.filename or "audio.webm", audio_data)

    lecture = Lecture(
        id=lecture_id,
        class_id=class_id,
        owner_user_id=user.id,
        title=title,
        audio_storage_key=storage_key,
        audio_original_filename=audio.filename or "audio.webm",
        audio_mime_type=audio.content_type or "audio/webm",
        audio_size_bytes=len(audio_data),
        notes_text=notes,
        status=LectureStatus.uploaded,
    )
    db.add(lecture)
    await db.commit()
    await db.refresh(lecture)

    background_tasks.add_task(process_lecture, lecture.id)

    return LectureOut.model_validate(lecture)


@router.get("/api/lectures/{lecture_id}", response_model=LectureDetail)
async def get_lecture(lecture_id: uuid.UUID, user: CurrentUser, db: DB):
    result = await db.execute(select(Lecture).where(Lecture.id == lecture_id, Lecture.deleted_at.is_(None)))
    lecture = result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")
    if user.role != UserRole.admin and lecture.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your lecture")
    return LectureDetail.model_validate(lecture)


@router.delete("/api/lectures/{lecture_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lecture(lecture_id: uuid.UUID, user: CurrentUser, db: DB):
    result = await db.execute(select(Lecture).where(Lecture.id == lecture_id))
    lecture = result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")
    if user.role != UserRole.admin and lecture.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your lecture")

    from datetime import datetime, timezone

    lecture.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/api/lectures/{lecture_id}/generate-quiz", response_model=LectureOut)
async def trigger_quiz_generation(
    lecture_id: uuid.UUID,
    user: CurrentUser,
    db: DB,
    background_tasks: BackgroundTasks,
):
    result = await db.execute(select(Lecture).where(Lecture.id == lecture_id, Lecture.deleted_at.is_(None)))
    lecture = result.scalar_one_or_none()
    if lecture is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lecture not found")
    if user.role != UserRole.admin and lecture.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your lecture")
    if not lecture.transcript_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lecture must be transcribed before generating a quiz",
        )

    background_tasks.add_task(generate_quiz_for_lecture, lecture.id)
    return LectureOut.model_validate(lecture)
