import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

# Embedding dimensionality for chunk vectors. Must match settings.embeddings_dim.
EMBEDDING_DIM = 384

# JSON type that uses JSONB on PostgreSQL, plain JSON elsewhere (e.g. SQLite in tests)
PortableJSON = JSON().with_variant(JSONB, "postgresql")


def _embedding_type():
    """Return a SQLAlchemy type for a fixed-size embedding vector.

    On PostgreSQL we prefer pgvector's ``Vector`` type (required for HNSW
    cosine search). Everywhere else (e.g. SQLite in tests) we fall back to
    plain JSON so ORM unit tests can still round-trip embedding arrays.
    """
    try:
        from pgvector.sqlalchemy import Vector  # type: ignore
    except ImportError:  # pragma: no cover - pgvector is optional outside prod
        return JSON()
    return JSON().with_variant(Vector(EMBEDDING_DIM), "postgresql")


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class LectureStatus(str, enum.Enum):
    uploaded = "uploaded"
    transcribing = "transcribing"
    summarizing = "summarizing"
    ready = "ready"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    full_name: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.user)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    classes: Mapped[list["Class"]] = relationship(back_populates="owner", cascade="all, delete-orphan")
    lectures: Mapped[list["Lecture"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class ClassVisibility(str, enum.Enum):
    private = "private"
    public = "public"


class Class(Base):
    __tablename__ = "classes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    visibility: Mapped[ClassVisibility] = mapped_column(
        Enum(ClassVisibility),
        nullable=False,
        default=ClassVisibility.private,
        server_default=ClassVisibility.private.value,
        index=True,
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped["User"] = relationship(back_populates="classes")
    lectures: Mapped[list["Lecture"]] = relationship(back_populates="class_", cascade="all, delete-orphan")


class Lecture(Base):
    __tablename__ = "lectures"
    __table_args__ = (Index("ix_lectures_class_uploaded", "class_id", "uploaded_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("classes.id"), nullable=False, index=True
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    audio_storage_key: Mapped[str] = mapped_column(String, nullable=False)
    audio_original_filename: Mapped[str] = mapped_column(String, nullable=False)
    audio_mime_type: Mapped[str] = mapped_column(String, nullable=False)
    audio_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True)
    notes_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcript_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    quiz_data: Mapped[dict | None] = mapped_column(PortableJSON, nullable=True)
    status: Mapped[LectureStatus] = mapped_column(
        Enum(LectureStatus), nullable=False, default=LectureStatus.uploaded, index=True
    )
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    augmented_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    augmented_citations: Mapped[list | None] = mapped_column(PortableJSON, nullable=True)
    augmented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    class_: Mapped["Class"] = relationship(back_populates="lectures")
    owner: Mapped["User"] = relationship(back_populates="lectures")


class ChatRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"


class LectureChunk(Base):
    """A sentence-window chunk of a lecture transcript used for RAG retrieval."""

    __tablename__ = "lecture_chunks"
    __table_args__ = (
        Index("ix_lecture_chunks_class", "class_id"),
        Index("ix_lecture_chunks_lecture", "lecture_id", "chunk_index"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lecture_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("lectures.id", ondelete="CASCADE"),
        nullable=False,
    )
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("classes.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(_embedding_type(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ClassChat(Base):
    __tablename__ = "class_chats"
    __table_args__ = (Index("ix_class_chats_class_user", "class_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("classes.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String, nullable=False, default="New chat")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    messages: Mapped[list["ClassChatMessage"]] = relationship(
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="ClassChatMessage.created_at",
    )


class ClassChatMessage(Base):
    __tablename__ = "class_chat_messages"
    __table_args__ = (Index("ix_class_chat_messages_chat", "chat_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("class_chats.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[ChatRole] = mapped_column(Enum(ChatRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    citations: Mapped[list | None] = mapped_column(PortableJSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    chat: Mapped["ClassChat"] = relationship(back_populates="messages")
