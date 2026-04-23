import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models import ClassVisibility, LectureStatus, UserRole


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
    visibility: Literal["private", "public"] | None = None


class ClassOut(BaseModel):
    id: uuid.UUID
    owner_user_id: uuid.UUID
    title: str
    created_at: datetime
    archived_at: datetime | None
    visibility: ClassVisibility = ClassVisibility.private
    published_at: datetime | None = None
    lecture_count: int = 0
    can_edit: bool = False

    model_config = {"from_attributes": True}


class ClassDetail(ClassOut):
    lectures: list["LectureOut"]


class ClassSummaryOut(BaseModel):
    """Public-facing class summary used on the Explore page."""

    id: uuid.UUID
    title: str
    owner_user_id: uuid.UUID
    owner_display_name: str | None
    lecture_count: int
    published_at: datetime | None
    visibility: ClassVisibility


# ── Lecture ──────────────────────────────────────────────────────────

class LectureUpdate(BaseModel):
    title: str | None = None
    notes_text: str | None = None


class AugmentedCitation(BaseModel):
    """Reference metadata returned alongside a lecture deep-dive."""

    idx: int
    title: str
    url: str
    snippet: str


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
    can_edit: bool = False
    augmented_text: str | None = None
    augmented_citations: list[AugmentedCitation] | None = None
    augmented_at: datetime | None = None


# ── Chat ────────────────────────────────────────────────────────────

class Citation(BaseModel):
    label: str
    lecture_id: uuid.UUID
    lecture_title: str
    chunk_index: int
    excerpt: str


class ClassChatOut(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ClassChatCreate(BaseModel):
    title: str | None = None


class ClassChatMessageOut(BaseModel):
    id: uuid.UUID
    chat_id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str
    citations: list[Citation] | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ClassChatMessageCreate(BaseModel):
    content: str


class ReindexResult(BaseModel):
    scanned: int
    indexed: int
    chunks_written: int
    skipped: int
    errors: list[str] = []


# Resolve forward references
ClassDetail.model_rebuild()
