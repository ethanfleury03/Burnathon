import threading
from pathlib import Path

from app.config import settings

_model = None
_model_lock = threading.Lock()


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from faster_whisper import WhisperModel

                _model = WhisperModel(
                    settings.whisper_model,
                    device=settings.whisper_device,
                    compute_type="int8" if settings.whisper_device == "cpu" else "float16",
                )
    return _model


def transcribe(file_path: str | Path) -> str:
    """Transcribe an audio file using faster-whisper. Returns the full transcript text."""
    model = _get_model()
    segments, _info = model.transcribe(str(file_path), beam_size=5)
    return " ".join(segment.text.strip() for segment in segments)
