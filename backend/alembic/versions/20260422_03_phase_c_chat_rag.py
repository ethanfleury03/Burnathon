"""Phase C: chat with a class (pgvector RAG)

Revision ID: 20260422_03
Revises: 20260422_02
Create Date: 2026-04-22

- Enables the ``vector`` extension.
- Creates ``lecture_chunks`` with an embedding column (Vector(384)) and an
  HNSW index on the embedding for cosine similarity search.
- Creates ``class_chats`` and ``class_chat_messages`` for persisted
  per-class chat sessions (keyed to ``(class_id, user_id)``).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

try:
    from pgvector.sqlalchemy import Vector  # type: ignore
except ImportError:  # pragma: no cover
    Vector = None  # type: ignore


revision: str = "20260422_03"
down_revision: Union[str, None] = "20260422_02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


EMBEDDING_DIM = 384
CHAT_ROLE_ENUM = "chatrole"


def upgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    embedding_type = Vector(EMBEDDING_DIM) if (is_postgres and Vector) else sa.JSON()

    op.create_table(
        "lecture_chunks",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "lecture_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("lectures.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "class_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("classes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", embedding_type, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_lecture_chunks_class", "lecture_chunks", ["class_id"])
    op.create_index(
        "ix_lecture_chunks_lecture",
        "lecture_chunks",
        ["lecture_id", "chunk_index"],
    )

    if is_postgres:
        # HNSW index for cosine similarity (pgvector >= 0.5).
        op.execute(
            "CREATE INDEX ix_lecture_chunks_embedding_hnsw "
            "ON lecture_chunks USING hnsw (embedding vector_cosine_ops)"
        )

    chat_role_enum = sa.Enum("user", "assistant", name=CHAT_ROLE_ENUM)
    chat_role_enum.create(bind, checkfirst=True)

    op.create_table(
        "class_chats",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "class_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("classes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(),
            nullable=False,
            server_default=sa.text("'New chat'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_class_chats_class_user", "class_chats", ["class_id", "user_id"])

    op.create_table(
        "class_chat_messages",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "chat_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("class_chats.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", chat_role_enum, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("citations", JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_class_chat_messages_chat",
        "class_chat_messages",
        ["chat_id", "created_at"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    op.drop_index("ix_class_chat_messages_chat", table_name="class_chat_messages")
    op.drop_table("class_chat_messages")
    op.drop_index("ix_class_chats_class_user", table_name="class_chats")
    op.drop_table("class_chats")

    chat_role_enum = sa.Enum("user", "assistant", name=CHAT_ROLE_ENUM)
    chat_role_enum.drop(bind, checkfirst=True)

    if is_postgres:
        op.execute("DROP INDEX IF EXISTS ix_lecture_chunks_embedding_hnsw")
    op.drop_index("ix_lecture_chunks_lecture", table_name="lecture_chunks")
    op.drop_index("ix_lecture_chunks_class", table_name="lecture_chunks")
    op.drop_table("lecture_chunks")
