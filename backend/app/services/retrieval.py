"""Chunking + vector retrieval for class chat RAG.

- :func:`chunk_transcript` splits a transcript into overlapping
  sentence-aware windows capped at roughly ``max_tokens`` words each.
- :func:`index_lecture` replaces the existing chunks for a lecture and
  re-embeds them with the local :mod:`app.services.embeddings` model.
- :func:`retrieve` runs a cosine-similarity search over chunks scoped to a
  class and returns the top-K hits along with the parent lecture title.

Embeddings are stored in PostgreSQL via pgvector. On non-postgres engines
(e.g. SQLite used in tests), the embedding column falls back to JSON and
:func:`retrieve` returns the most recent chunks as a best-effort stub so
unit tests don't need a model download.
"""
from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import delete, desc, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Lecture, LectureChunk
from app.services import embeddings

logger = logging.getLogger(__name__)


_SENTENCE_SPLIT_RE = re.compile(r"(?<=[\.\!\?])\s+(?=[A-Z0-9])")
_WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: uuid.UUID
    lecture_id: uuid.UUID
    lecture_title: str
    chunk_index: int
    text: str
    score: float


def _split_sentences(text_value: str) -> list[str]:
    clean = _WHITESPACE_RE.sub(" ", text_value).strip()
    if not clean:
        return []
    sentences = [s.strip() for s in _SENTENCE_SPLIT_RE.split(clean) if s.strip()]
    return sentences


def chunk_transcript(
    transcript: str,
    *,
    max_tokens: int = 500,
    overlap: int = 50,
) -> list[str]:
    """Split a transcript into sentence-aware chunks.

    ``max_tokens`` and ``overlap`` are counted in whitespace-separated words
    which is a fair approximation for the sentence-transformer tokenizer.
    """
    if not transcript or not transcript.strip():
        return []
    sentences = _split_sentences(transcript)
    if not sentences:
        return []

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for sentence in sentences:
        sentence_len = len(sentence.split())
        if current_len + sentence_len > max_tokens and current:
            chunks.append(" ".join(current).strip())
            if overlap > 0 and current:
                tail_words = " ".join(current).split()[-overlap:]
                current = [" ".join(tail_words)]
                current_len = len(tail_words)
            else:
                current = []
                current_len = 0
        current.append(sentence)
        current_len += sentence_len
    if current:
        chunks.append(" ".join(current).strip())
    return [c for c in chunks if c]


async def index_lecture(session: AsyncSession, lecture: Lecture) -> int:
    """Replace stored chunks for ``lecture`` with fresh embeddings.

    Returns the number of chunks written. A lecture without a transcript
    results in any existing chunks being cleared and 0 returned.
    """
    await session.execute(
        delete(LectureChunk).where(LectureChunk.lecture_id == lecture.id)
    )

    transcript = lecture.transcript_text or ""
    pieces = chunk_transcript(transcript)
    if not pieces:
        await session.commit()
        return 0

    try:
        vectors = await embeddings.embed_texts(pieces)
    except embeddings.EmbeddingsUnavailable:
        logger.warning(
            "Embeddings backend unavailable; skipping index for lecture %s",
            lecture.id,
        )
        await session.commit()
        return 0

    rows = [
        LectureChunk(
            id=uuid.uuid4(),
            lecture_id=lecture.id,
            class_id=lecture.class_id,
            chunk_index=i,
            text=piece,
            embedding=vector,
        )
        for i, (piece, vector) in enumerate(zip(pieces, vectors))
    ]
    session.add_all(rows)
    await session.commit()
    return len(rows)


async def retrieve(
    session: AsyncSession,
    class_id: uuid.UUID,
    query: str,
    *,
    k: int = 6,
) -> list[RetrievedChunk]:
    """Return the top-K chunks in a class ranked by cosine similarity."""
    dialect = session.bind.dialect.name if session.bind else ""

    # Non-postgres fallback for tests: return the most recent chunks scoped to
    # the class so the rest of the pipeline has something to exercise.
    if dialect != "postgresql":
        stmt = (
            select(LectureChunk, Lecture.title)
            .join(Lecture, Lecture.id == LectureChunk.lecture_id)
            .where(LectureChunk.class_id == class_id)
            .order_by(desc(LectureChunk.created_at))
            .limit(k)
        )
        result = await session.execute(stmt)
        return [
            RetrievedChunk(
                chunk_id=chunk.id,
                lecture_id=chunk.lecture_id,
                lecture_title=title,
                chunk_index=chunk.chunk_index,
                text=chunk.text,
                score=0.0,
            )
            for chunk, title in result.all()
        ]

    try:
        vector = await embeddings.embed_text(query)
    except embeddings.EmbeddingsUnavailable:
        logger.warning("Embeddings unavailable; retrieve() returning no chunks")
        return []

    vector_literal = "[" + ",".join(f"{v:.8f}" for v in vector) + "]"
    stmt = text(
        """
        SELECT c.id, c.lecture_id, c.chunk_index, c.text,
               (c.embedding <=> CAST(:vector AS vector)) AS distance,
               l.title
        FROM lecture_chunks c
        JOIN lectures l ON l.id = c.lecture_id
        WHERE c.class_id = :class_id
        ORDER BY c.embedding <=> CAST(:vector AS vector)
        LIMIT :k
        """
    ).bindparams(vector=vector_literal, class_id=class_id, k=k)

    result = await session.execute(stmt)
    rows = result.mappings().all()
    return [
        RetrievedChunk(
            chunk_id=row["id"],
            lecture_id=row["lecture_id"],
            lecture_title=row["title"],
            chunk_index=row["chunk_index"],
            text=row["text"],
            score=1.0 - float(row["distance"]),
        )
        for row in rows
    ]


def chunks_to_citations(chunks: Iterable[RetrievedChunk]) -> list[dict]:
    """Shape retrieval results into the citation payload used by the client."""
    return [
        {
            "label": f"L{i}",
            "lecture_id": str(c.lecture_id),
            "lecture_title": c.lecture_title,
            "chunk_index": c.chunk_index,
            "excerpt": c.text[:380],
        }
        for i, c in enumerate(chunks, start=1)
    ]
