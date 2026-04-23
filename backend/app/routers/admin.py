import logging
import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.dependencies import AdminUser, DB
from app.models import Class, Lecture, LectureChunk, LectureStatus, User
from app.serializers import serialize_class, serialize_lecture
from app.schemas import (
    AdminUserUpdate,
    ClassOut,
    LectureOut,
    ReindexResult,
    UserOut,
)
from app.services import retrieval

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(_admin: AdminUser, db: DB):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.get("/classes", response_model=list[ClassOut])
async def list_all_classes(_admin: AdminUser, db: DB):
    query = (
        select(Class, func.count(Lecture.id).label("lecture_count"))
        .outerjoin(Lecture, Lecture.class_id == Class.id)
        .group_by(Class.id)
        .order_by(Class.created_at.desc())
    )
    result = await db.execute(query)

    return [
        serialize_class(cls, lecture_count=count, can_edit=True)
        for cls, count in result.all()
    ]


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user_role(user_id: uuid.UUID, body: AdminUserUpdate, _admin: AdminUser, db: DB):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = body.role
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/lectures", response_model=list[LectureOut])
async def list_all_lectures(_admin: AdminUser, db: DB):
    result = await db.execute(select(Lecture).order_by(Lecture.uploaded_at.desc()))
    return [serialize_lecture(lecture) for lecture in result.scalars().all()]


@router.post("/reindex", response_model=ReindexResult)
async def reindex_lectures(_admin: AdminUser, db: DB, only_missing: bool = True):
    """Backfill lecture-chunk embeddings for class-chat retrieval.

    With ``only_missing=True`` (default), only ready lectures whose chunk
    table is empty are re-indexed. Pass ``only_missing=false`` to force a
    full re-embed of every ready lecture.
    """
    stmt = select(Lecture).where(Lecture.status == LectureStatus.ready)
    result = await db.execute(stmt)
    lectures = result.scalars().all()

    scanned = 0
    indexed = 0
    skipped = 0
    chunks_written = 0
    errors: list[str] = []

    for lecture in lectures:
        scanned += 1
        if only_missing:
            count = await db.scalar(
                select(func.count(LectureChunk.id)).where(
                    LectureChunk.lecture_id == lecture.id
                )
            )
            if count and count > 0:
                skipped += 1
                continue
        try:
            written = await retrieval.index_lecture(db, lecture)
            chunks_written += written
            indexed += 1
        except Exception as exc:
            logger.exception("Reindex failed for lecture %s", lecture.id)
            errors.append(f"{lecture.id}: {exc}")

    return ReindexResult(
        scanned=scanned,
        indexed=indexed,
        chunks_written=chunks_written,
        skipped=skipped,
        errors=errors,
    )
