from app.models import Lecture
from app.schemas import LectureDetail, LectureOut
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


def serialize_lecture_detail(lecture: Lecture) -> LectureDetail:
    base = serialize_lecture(lecture)
    return LectureDetail(
        **base.model_dump(),
        notes_text=lecture.notes_text,
        transcript_text=lecture.transcript_text,
        summary_text=lecture.summary_text,
        quiz_data=lecture.quiz_data,
        processing_error=lecture.processing_error,
        owner_user_id=lecture.owner_user_id,
    )
