import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.config import settings


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, lecture_id: uuid.UUID, filename: str, data: bytes) -> str:
        """Save file and return the storage key."""

    @abstractmethod
    def get_url(self, storage_key: str) -> str:
        """Return a URL/path to access the file."""

    @abstractmethod
    def get_local_path(self, storage_key: str) -> Path | None:
        """Return local file path if available (for local transcription)."""


class LocalStorage(StorageBackend):
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def save(self, lecture_id: uuid.UUID, filename: str, data: bytes) -> str:
        lecture_dir = self.base_dir / str(lecture_id)
        lecture_dir.mkdir(parents=True, exist_ok=True)
        file_path = lecture_dir / filename
        file_path.write_bytes(data)
        return f"{lecture_id}/{filename}"

    def get_url(self, storage_key: str) -> str:
        return f"/files/{storage_key}"

    def get_local_path(self, storage_key: str) -> Path | None:
        return self.base_dir / storage_key


def get_storage() -> StorageBackend:
    if settings.storage_backend == "local":
        return LocalStorage(settings.upload_dir)
    raise ValueError(f"Unknown storage backend: {settings.storage_backend}")
