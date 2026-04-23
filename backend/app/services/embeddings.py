"""Local sentence-transformers embeddings service.

The first call lazily downloads and pins a SentenceTransformer model in
memory (~90MB for the default ``BAAI/bge-small-en-v1.5``). All calls are
proxied through :func:`asyncio.to_thread` because the underlying model is
blocking.

Tests should monkeypatch :func:`embed_texts` to avoid downloading models.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingsUnavailable(RuntimeError):
    """Raised when sentence-transformers is unavailable at runtime."""


_model: Any = None


def _load_model() -> Any:
    global _model
    if _model is not None:
        return _model
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise EmbeddingsUnavailable(
            "sentence-transformers is not installed. Run "
            "`pip install sentence-transformers` to enable class chat."
        ) from exc
    logger.info(
        "Loading embeddings model %s (this downloads ~90MB on first run)",
        settings.embeddings_model_name,
    )
    _model = SentenceTransformer(settings.embeddings_model_name)
    return _model


def _sync_embed(texts: list[str]) -> list[list[float]]:
    model = _load_model()
    vectors = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return [list(map(float, v)) for v in vectors]


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of strings, returning unit-length float vectors."""
    if not texts:
        return []
    return await asyncio.to_thread(_sync_embed, texts)


async def embed_text(text: str) -> list[float]:
    vectors = await embed_texts([text])
    return vectors[0]
