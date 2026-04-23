import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.dependencies import AdminUser, DB
from app.models import Class, Lecture, User
from app.serializers import serialize_lecture
from app.schemas import AdminUserUpdate, ClassOut, LectureOut, UserOut

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
