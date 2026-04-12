import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.dependencies import DB, CurrentUser
from app.models import Class, Lecture, UserRole
from app.schemas import ClassCreate, ClassDetail, ClassOut, ClassUpdate, LectureOut

router = APIRouter(prefix="/api/classes", tags=["classes"])


@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
async def create_class(body: ClassCreate, user: CurrentUser, db: DB):
    cls = Class(id=uuid.uuid4(), owner_user_id=user.id, title=body.title)
    db.add(cls)
    await db.commit()
    await db.refresh(cls)
    return ClassOut(
        id=cls.id,
        owner_user_id=cls.owner_user_id,
        title=cls.title,
        created_at=cls.created_at,
        archived_at=cls.archived_at,
        lecture_count=0,
    )


@router.get("", response_model=list[ClassOut])
async def list_classes(user: CurrentUser, db: DB):
    query = select(Class, func.count(Lecture.id).label("lecture_count")).outerjoin(
        Lecture, (Lecture.class_id == Class.id) & (Lecture.deleted_at.is_(None))
    ).group_by(Class.id)

    if user.role != UserRole.admin:
        query = query.where(Class.owner_user_id == user.id)

    query = query.where(Class.archived_at.is_(None)).order_by(Class.created_at.desc())
    result = await db.execute(query)

    return [
        ClassOut(
            id=cls.id,
            owner_user_id=cls.owner_user_id,
            title=cls.title,
            created_at=cls.created_at,
            archived_at=cls.archived_at,
            lecture_count=count,
        )
        for cls, count in result.all()
    ]


@router.get("/{class_id}", response_model=ClassDetail)
async def get_class(class_id: uuid.UUID, user: CurrentUser, db: DB):
    result = await db.execute(select(Class).where(Class.id == class_id))
    cls = result.scalar_one_or_none()
    if cls is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    if user.role != UserRole.admin and cls.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your class")

    lectures_result = await db.execute(
        select(Lecture)
        .where(Lecture.class_id == class_id, Lecture.deleted_at.is_(None))
        .order_by(Lecture.uploaded_at.desc())
    )
    lectures = lectures_result.scalars().all()

    return ClassDetail(
        id=cls.id,
        owner_user_id=cls.owner_user_id,
        title=cls.title,
        created_at=cls.created_at,
        archived_at=cls.archived_at,
        lecture_count=len(lectures),
        lectures=[LectureOut.model_validate(l) for l in lectures],
    )


@router.patch("/{class_id}", response_model=ClassOut)
async def update_class(class_id: uuid.UUID, body: ClassUpdate, user: CurrentUser, db: DB):
    result = await db.execute(select(Class).where(Class.id == class_id))
    cls = result.scalar_one_or_none()
    if cls is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
    if user.role != UserRole.admin and cls.owner_user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your class")

    if body.title is not None:
        cls.title = body.title
    if body.archived is True:
        cls.archived_at = datetime.now(timezone.utc)
    elif body.archived is False:
        cls.archived_at = None

    await db.commit()
    await db.refresh(cls)

    count_result = await db.execute(
        select(func.count(Lecture.id)).where(Lecture.class_id == class_id, Lecture.deleted_at.is_(None))
    )
    count = count_result.scalar() or 0

    return ClassOut(
        id=cls.id,
        owner_user_id=cls.owner_user_id,
        title=cls.title,
        created_at=cls.created_at,
        archived_at=cls.archived_at,
        lecture_count=count,
    )
