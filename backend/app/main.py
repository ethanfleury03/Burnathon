import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, select

from app.db_ready import classify_database_error, get_database_status
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


@app.middleware("http")
async def handle_database_failures(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        detail = classify_database_error(exc)
        if detail is None:
            raise
        return JSONResponse(status_code=503, content={"detail": detail})

uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/files", StaticFiles(directory=str(uploads_path)), name="files")


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
    db_status = await get_database_status()
    if db_status.ok:
        return {"status": "ok", "database": "ok"}
    return JSONResponse(
        status_code=503,
        content={
            "status": "degraded",
            "database": "unavailable",
            "detail": db_status.detail,
        },
    )
