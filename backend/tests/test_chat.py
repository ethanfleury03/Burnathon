"""Per-class chat API (RAG + SSE)."""

import uuid

import pytest
from httpx import AsyncClient

from app.models import EMBEDDING_DIM, LectureChunk


@pytest.mark.asyncio
async def test_class_chat_stream_persists_messages(
    client: AsyncClient,
    sample_class,
    sample_lecture,
    db_session,
    monkeypatch,
):
    async def fake_chat(_messages, _retrieved):
        yield "Hello"
        yield " world."

    monkeypatch.setattr("app.routers.chat.ai.chat_with_class", fake_chat)

    chunk = LectureChunk(
        id=uuid.uuid4(),
        lecture_id=sample_lecture.id,
        class_id=sample_class.id,
        chunk_index=0,
        text="Discussion of algorithms and graphs.",
        embedding=[0.001] * EMBEDDING_DIM,
    )
    db_session.add(chunk)
    await db_session.commit()

    r = await client.post(f"/api/classes/{sample_class.id}/chats", json={})
    assert r.status_code == 201
    chat_id = r.json()["id"]

    body = b""
    async with client.stream(
        "POST",
        f"/api/classes/{sample_class.id}/chats/{chat_id}/messages",
        json={"content": "What is this class about?"},
    ) as resp:
        assert resp.status_code == 200
        async for bchunk in resp.aiter_bytes():
            body += bchunk

    assert b"event: token" in body
    assert b"event: done" in body

    r2 = await client.get(f"/api/classes/{sample_class.id}/chats/{chat_id}")
    assert r2.status_code == 200
    msgs = r2.json()
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"
    assert "Hello world" in msgs[1]["content"]
    assert msgs[1]["citations"]


@pytest.mark.asyncio
async def test_admin_reindex_calls_embeddings(
    admin_client: AsyncClient, sample_lecture, monkeypatch
):
    async def fake_embed_texts(texts: list[str]) -> list[list[float]]:
        return [[0.0] * EMBEDDING_DIM for _ in texts]

    monkeypatch.setattr(
        "app.services.retrieval.embeddings.embed_texts", fake_embed_texts
    )

    resp = await admin_client.post("/api/admin/reindex?only_missing=false")
    assert resp.status_code == 200
    data = resp.json()
    assert data["scanned"] >= 1
    assert data["chunks_written"] >= 1
