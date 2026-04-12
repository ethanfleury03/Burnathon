import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DB, AdminUser
from app.models import Lecture, User
from app.schemas import AdminUserUpdate, LectureOut, UserOut

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[UserOut])
async def list_users(_admin: AdminUser, db: DB):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


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
    return [LectureOut.model_validate(l) for l in result.scalars().all()]
