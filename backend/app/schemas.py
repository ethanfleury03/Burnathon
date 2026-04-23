import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models import LectureStatus, UserRole


# ── User ────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: uuid.UUID
    clerk_user_id: str
    email: str
    full_name: str | None
    role: UserRole
    created_at: datetime

    model_config = {"from_attributes": True}


class UserStats(BaseModel):
    total_classes: int
    total_lectures: int
    total_audio_seconds: int


class MeOut(BaseModel):
    user: UserOut
    stats: UserStats


class AdminUserUpdate(BaseModel):
    role: UserRole


# ── DB schema (development) ────────────────────────────────────────

class DbColumnOut(BaseModel):
    name: str
    type: str
    nullable: bool
    primary_key: bool
    foreign_keys: list[str] = []


class DbTableOut(BaseModel):
    name: str
    columns: list[DbColumnOut]


# ── Class ───────────────────────────────────────────────────────────

class ClassCreate(BaseModel):
    title: str


class ClassUpdate(BaseModel):
    title: str | None = None
    archived: bool | None = None


class ClassOut(BaseModel):
    id: uuid.UUID
    owner_user_id: uuid.UUID
    title: str
    created_at: datetime
    archived_at: datetime | None
    lecture_count: int = 0

    model_config = {"from_attributes": True}


class ClassDetail(ClassOut):
    lectures: list["LectureOut"]


# ── Lecture ──────────────────────────────────────────────────────────

class LectureOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    title: str
    audio_original_filename: str
    audio_url: str
    audio_size_bytes: int
    duration_seconds: int | None
    status: LectureStatus
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class LectureDetail(LectureOut):
    notes_text: str | None
    transcript_text: str | None
    summary_text: str | None
    quiz_data: dict | None
    processing_error: str | None
    owner_user_id: uuid.UUID


# Resolve forward references
ClassDetail.model_rebuild()
