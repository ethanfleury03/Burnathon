"""Per-class chat sessions with RAG-backed answers.

Access model:
- Any user who can read the parent class (owner or public viewer) can
  create chats and post messages. Chat state is keyed to
  ``(class_id, user_id)`` so a public viewer gets their own history.
- Owners and admins do not see other users' chats on their class.

Streaming contract for ``POST /messages``:
- Response type ``text/event-stream``.
- Events:
  - ``event: token`` with ``data: <text>`` for each incoming token.
  - ``event: done`` with ``data: {"message": ClassChatMessageOut}`` for the
    final persisted assistant message (including citations).
  - ``event: error`` with ``data: <message>`` if the model call fails.
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app import dependencies
from app.dependencies import DB, CurrentUser, load_class_for_read
from app.models import ChatRole, ClassChat, ClassChatMessage, User
from app.schemas import (
    ClassChatCreate,
    ClassChatMessageCreate,
    ClassChatMessageOut,
    ClassChatOut,
)
from app.services import ai, retrieval

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])


def _serialize_chat(chat: ClassChat) -> ClassChatOut:
    return ClassChatOut.model_validate(chat)


def _serialize_message(message: ClassChatMessage) -> ClassChatMessageOut:
    return ClassChatMessageOut.model_validate(
        {
            "id": message.id,
            "chat_id": message.chat_id,
            "role": message.role.value
            if isinstance(message.role, ChatRole)
            else message.role,
            "content": message.content,
            "citations": message.citations,
            "created_at": message.created_at,
        }
    )


def _sse(event: str, payload: str) -> str:
    """Emit one SSE frame; ``payload`` must be a single-line string (e.g. JSON)."""
    return f"event: {event}\ndata: {payload}\n\n"


@router.get("/api/classes/{class_id}/chats", response_model=list[ClassChatOut])
async def list_chats(class_id: uuid.UUID, user: CurrentUser, db: DB):
    cls, _ = await load_class_for_read(class_id, db, user)
    stmt = (
        select(ClassChat)
        .where(ClassChat.class_id == cls.id, ClassChat.user_id == user.id)
        .order_by(ClassChat.updated_at.desc())
    )
    result = await db.execute(stmt)
    return [_serialize_chat(c) for c in result.scalars().all()]


@router.post(
    "/api/classes/{class_id}/chats",
    response_model=ClassChatOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_chat(
    class_id: uuid.UUID,
    body: ClassChatCreate,
    user: CurrentUser,
    db: DB,
):
    cls, _ = await load_class_for_read(class_id, db, user)
    chat = ClassChat(
        id=uuid.uuid4(),
        class_id=cls.id,
        user_id=user.id,
        title=(body.title or "").strip() or "New chat",
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return _serialize_chat(chat)


async def _load_chat(
    class_id: uuid.UUID,
    chat_id: uuid.UUID,
    db: AsyncSession,
    user: User,
) -> ClassChat:
    cls, _ = await load_class_for_read(class_id, db, user)
    result = await db.execute(
        select(ClassChat).where(
            ClassChat.id == chat_id,
            ClassChat.class_id == cls.id,
            ClassChat.user_id == user.id,
        )
    )
    chat = result.scalar_one_or_none()
    if chat is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found"
        )
    return chat


@router.get(
    "/api/classes/{class_id}/chats/{chat_id}",
    response_model=list[ClassChatMessageOut],
)
async def list_chat_messages(
    class_id: uuid.UUID,
    chat_id: uuid.UUID,
    user: CurrentUser,
    db: DB,
):
    chat = await _load_chat(class_id, chat_id, db, user)
    stmt = (
        select(ClassChatMessage)
        .where(ClassChatMessage.chat_id == chat.id)
        .order_by(ClassChatMessage.created_at.asc())
    )
    result = await db.execute(stmt)
    return [_serialize_message(m) for m in result.scalars().all()]


@router.post("/api/classes/{class_id}/chats/{chat_id}/messages")
async def post_chat_message(
    class_id: uuid.UUID,
    chat_id: uuid.UUID,
    body: ClassChatMessageCreate,
    user: CurrentUser,
    db: DB,
):
    """Append a user message, run RAG + LLM, stream the assistant reply."""
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Message content required"
        )

    chat = await _load_chat(class_id, chat_id, db, user)

    prior_result = await db.execute(
        select(ClassChatMessage)
        .where(ClassChatMessage.chat_id == chat.id)
        .order_by(ClassChatMessage.created_at.asc())
    )
    prior_messages = list(prior_result.scalars().all())

    history = [
        {
            "role": m.role.value if isinstance(m.role, ChatRole) else m.role,
            "content": m.content,
        }
        for m in prior_messages
    ] + [{"role": "user", "content": content}]

    user_message = ClassChatMessage(
        id=uuid.uuid4(),
        chat_id=chat.id,
        role=ChatRole.user,
        content=content,
        citations=None,
    )
    db.add(user_message)
    await db.commit()

    retrieved = await retrieval.retrieve(db, class_id=chat.class_id, query=content, k=6)
    citations_payload = retrieval.chunks_to_citations(retrieved)

    persist_chat_id = chat.id

    async def event_stream() -> AsyncIterator[str]:
        collected: list[str] = []
        try:
            async for token in ai.chat_with_class(history, citations_payload):
                collected.append(token)
                yield _sse("token", json.dumps(token))
        except Exception as exc:
            logger.exception("chat_with_class stream failed")
            yield _sse("error", json.dumps(str(exc)))
            return

        answer = "".join(collected).strip() or "(no answer)"
        try:
            async with dependencies.async_session() as stream_db:
                assistant_message = ClassChatMessage(
                    id=uuid.uuid4(),
                    chat_id=persist_chat_id,
                    role=ChatRole.assistant,
                    content=answer,
                    citations=citations_payload or None,
                )
                stream_db.add(assistant_message)
                await stream_db.execute(
                    update(ClassChat)
                    .where(ClassChat.id == persist_chat_id)
                    .values(updated_at=func.now())
                )
                await stream_db.commit()
                await stream_db.refresh(assistant_message)
                out_payload = _serialize_message(assistant_message).model_dump(
                    mode="json"
                )
        except SQLAlchemyError as exc:
            logger.exception("failed to persist assistant message")
            yield _sse("error", json.dumps(f"persist failed: {exc}"))
            return

        yield _sse("done", json.dumps({"message": out_payload}))

    return StreamingResponse(event_stream(), media_type="text/event-stream")


__all__ = ["router"]
