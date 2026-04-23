from app.models import Class, Lecture
from app.schemas import (
    AugmentedCitation,
    ClassOut,
    ClassVisibility,
    LectureDetail,
    LectureOut,
)
from app.services.storage import get_storage


def serialize_lecture(lecture: Lecture) -> LectureOut:
    storage = get_storage()
    return LectureOut(
        id=lecture.id,
        class_id=lecture.class_id,
        title=lecture.title,
        audio_original_filename=lecture.audio_original_filename,
        audio_size_bytes=lecture.audio_size_bytes,
        duration_seconds=lecture.duration_seconds,
        status=lecture.status,
        uploaded_at=lecture.uploaded_at,
        audio_url=storage.get_url(lecture.audio_storage_key),
    )


def serialize_lecture_detail(lecture: Lecture, *, can_edit: bool = True) -> LectureDetail:
    base = serialize_lecture(lecture)
    citations: list[AugmentedCitation] | None = None
    raw_citations = getattr(lecture, "augmented_citations", None)
    if isinstance(raw_citations, list):
        citations = []
        for item in raw_citations:
            if isinstance(item, dict):
                try:
                    citations.append(AugmentedCitation(**item))
                except Exception:
                    continue
    return LectureDetail(
        **base.model_dump(),
        notes_text=lecture.notes_text,
        transcript_text=lecture.transcript_text,
        summary_text=lecture.summary_text,
        quiz_data=lecture.quiz_data,
        processing_error=lecture.processing_error,
        owner_user_id=lecture.owner_user_id,
        can_edit=can_edit,
        augmented_text=getattr(lecture, "augmented_text", None),
        augmented_citations=citations,
        augmented_at=getattr(lecture, "augmented_at", None),
    )


def serialize_class(
    cls: Class,
    *,
    lecture_count: int,
    can_edit: bool,
) -> ClassOut:
    visibility = cls.visibility if isinstance(cls.visibility, ClassVisibility) else ClassVisibility(cls.visibility)
    return ClassOut(
        id=cls.id,
        owner_user_id=cls.owner_user_id,
        title=cls.title,
        created_at=cls.created_at,
        archived_at=cls.archived_at,
        visibility=visibility,
        published_at=cls.published_at,
        lecture_count=lecture_count,
        can_edit=can_edit,
    )
