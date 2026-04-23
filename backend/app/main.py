import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from app.config import settings
from app.dependencies import DB, CurrentUser
from app.models import Class, Lecture
from app.routers import admin, classes, db_meta, lectures
from app.schemas import MeOut, UserOut, UserStats

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Student Lecture Portal", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(classes.router)
app.include_router(lectures.router)
app.include_router(admin.router)
app.include_router(db_meta.router)

uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(parents=True, exist_ok=True)


@app.get("/api/me", response_model=MeOut)
async def get_me(user: CurrentUser, db: DB):
    class_count = await db.execute(
        select(func.count(Class.id)).where(Class.owner_user_id == user.id)
    )
    lecture_count = await db.execute(
        select(func.count(Lecture.id)).where(
            Lecture.owner_user_id == user.id, Lecture.deleted_at.is_(None)
        )
    )
    duration_sum = await db.execute(
        select(func.coalesce(func.sum(Lecture.duration_seconds), 0)).where(
            Lecture.owner_user_id == user.id, Lecture.deleted_at.is_(None)
        )
    )

    return MeOut(
        user=UserOut.model_validate(user),
        stats=UserStats(
            total_classes=class_count.scalar() or 0,
            total_lectures=lecture_count.scalar() or 0,
            total_audio_seconds=duration_sum.scalar() or 0,
        ),
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}
