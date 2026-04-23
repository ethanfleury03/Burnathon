import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.dependencies import (
    DB,
    CurrentUser,
    load_class_for_read,
    load_class_for_write,
)
from app.models import Class, ClassVisibility, Lecture, User, UserRole
from app.serializers import serialize_class, serialize_lecture
from app.schemas import (
    ClassCreate,
    ClassDetail,
    ClassOut,
    ClassSummaryOut,
    ClassUpdate,
)

router = APIRouter(prefix="/api/classes", tags=["classes"])


@router.post("", response_model=ClassOut, status_code=status.HTTP_201_CREATED)
async def create_class(body: ClassCreate, user: CurrentUser, db: DB):
    cls = Class(id=uuid.uuid4(), owner_user_id=user.id, title=body.title)
    db.add(cls)
    await db.commit()
    await db.refresh(cls)
    return serialize_class(cls, lecture_count=0, can_edit=True)


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
        serialize_class(cls, lecture_count=count, can_edit=True)
        for cls, count in result.all()
    ]


@router.get("/explore", response_model=list[ClassSummaryOut])
async def explore_public_classes(
    user: CurrentUser,
    db: DB,
    q: str | None = Query(default=None, description="Search by title or owner"),
    limit: int = Query(default=60, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Paginated listing of classes marked public, visible to any signed-in user."""
    _ = user  # authentication side-effect only
    query = (
        select(
            Class,
            User.full_name,
            User.email,
            func.count(Lecture.id).label("lecture_count"),
        )
        .join(User, User.id == Class.owner_user_id)
        .outerjoin(Lecture, (Lecture.class_id == Class.id) & (Lecture.deleted_at.is_(None)))
        .where(
            Class.visibility == ClassVisibility.public,
            Class.archived_at.is_(None),
        )
        .group_by(Class.id, User.id)
        .order_by(Class.published_at.desc().nullslast(), Class.created_at.desc())
    )

    if q:
        like = f"%{q.strip()}%"
        query = query.where(
            (Class.title.ilike(like))
            | (User.full_name.ilike(like))
            | (User.email.ilike(like))
        )

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)

    out: list[ClassSummaryOut] = []
    for cls, full_name, email, count in result.all():
        display = full_name or email.split("@")[0] if email else None
        out.append(
            ClassSummaryOut(
                id=cls.id,
                title=cls.title,
                owner_user_id=cls.owner_user_id,
                owner_display_name=display,
                lecture_count=count or 0,
                published_at=cls.published_at,
                visibility=cls.visibility,
            )
        )
    return out


@router.get("/{class_id}", response_model=ClassDetail)
async def get_class(class_id: uuid.UUID, user: CurrentUser, db: DB):
    cls, can_edit = await load_class_for_read(class_id, db, user)

    lectures_result = await db.execute(
        select(Lecture)
        .where(Lecture.class_id == class_id, Lecture.deleted_at.is_(None))
        .order_by(Lecture.uploaded_at.desc())
    )
    lectures = lectures_result.scalars().all()

    base = serialize_class(cls, lecture_count=len(lectures), can_edit=can_edit)
    return ClassDetail(
        **base.model_dump(),
        lectures=[serialize_lecture(lecture) for lecture in lectures],
    )


@router.patch("/{class_id}", response_model=ClassOut)
async def update_class(class_id: uuid.UUID, body: ClassUpdate, user: CurrentUser, db: DB):
    cls = await load_class_for_write(class_id, db, user)

    if body.title is not None:
        title = body.title.strip()
        if not title:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Title cannot be empty",
            )
        cls.title = title
    if body.archived is True:
        cls.archived_at = datetime.now(timezone.utc)
    elif body.archived is False:
        cls.archived_at = None
    if body.visibility is not None:
        new_visibility = ClassVisibility(body.visibility)
        if new_visibility == ClassVisibility.public and cls.visibility != ClassVisibility.public:
            cls.published_at = datetime.now(timezone.utc)
        cls.visibility = new_visibility

    await db.commit()
    await db.refresh(cls)

    count_result = await db.execute(
        select(func.count(Lecture.id)).where(
            Lecture.class_id == class_id, Lecture.deleted_at.is_(None)
        )
    )
    count = count_result.scalar() or 0

    return serialize_class(cls, lecture_count=count, can_edit=True)
