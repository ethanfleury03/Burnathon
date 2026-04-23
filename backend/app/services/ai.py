from __future__ import annotations

import json
from typing import AsyncGenerator

from openai import AsyncOpenAI

from app.config import settings
from app.services.web_search import SearchResult

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url=settings.openrouter_base_url,
        )
    return _client


async def summarize(transcript: str) -> str:
    """Generate a concise summary of a lecture transcript."""
    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a study assistant. Summarize the following lecture transcript "
                    "into clear, well-organized notes. Use bullet points for key concepts. "
                    "Keep it concise but thorough."
                ),
            },
            {"role": "user", "content": transcript},
        ],
        max_tokens=2000,
    )
    return response.choices[0].message.content or ""


async def generate_quiz(transcript: str) -> dict:
    """Generate quiz questions and flashcards from a lecture transcript."""
    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a study assistant. Based on the lecture transcript, generate:\n"
                    "1. 5-10 multiple choice questions with 4 options each and the correct answer index\n"
                    "2. 10-15 flashcards with a front (question/term) and back (answer/definition)\n\n"
                    "Return valid JSON with this structure:\n"
                    '{"questions": [{"question": "...", "options": ["A", "B", "C", "D"], '
                    '"correct_index": 0}], "flashcards": [{"front": "...", "back": "..."}]}'
                ),
            },
            {"role": "user", "content": transcript},
        ],
        max_tokens=3000,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rsplit(" ", 1)[0] + "…"


def derive_augmentation_queries(title: str, summary: str | None) -> list[str]:
    """Derive 2–3 focused web queries from the lecture title + summary bullets.

    The heuristics are intentionally cheap: we use the title as the first
    query, then pull the top bullet lines out of the summary (if any) and
    append them to the title for context. We never return more than three
    queries so the Tavily bill stays bounded.
    """
    title = (title or "").strip()
    queries: list[str] = []
    if title:
        queries.append(title)

    if summary:
        bullet_lines: list[str] = []
        for line in summary.splitlines():
            clean = line.strip()
            if not clean:
                continue
            if clean.startswith(("-", "*", "•")):
                clean = clean.lstrip("-*• ").strip()
            if len(clean) < 10 or len(clean) > 160:
                continue
            bullet_lines.append(clean)
            if len(bullet_lines) >= 2:
                break
        for line in bullet_lines:
            query = f"{title} {line}" if title else line
            queries.append(_truncate(query, 180))

    # De-duplicate while keeping order.
    seen: set[str] = set()
    out: list[str] = []
    for q in queries:
        key = q.lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(q)
        if len(out) >= 3:
            break
    return out


async def augment_lecture(
    title: str,
    summary: str | None,
    transcript_excerpt: str | None,
    search_results: list[SearchResult],
) -> dict:
    """Expand a lecture summary into a teaching article with inline citations.

    Returns ``{"text": str, "citations": [{idx,title,url,snippet}]}``. The
    prompt instructs the model to cite sources inline as ``[1]``, ``[2]``,
    and to avoid facts that aren't present in the provided sources.
    """
    numbered: list[dict] = []
    for i, result in enumerate(search_results, start=1):
        numbered.append(
            {
                "idx": i,
                "title": result.title,
                "url": result.url,
                "snippet": _truncate(result.snippet, 600),
            }
        )

    sources_block = (
        "\n\n".join(
            f"[{item['idx']}] {item['title']}\nURL: {item['url']}\n{item['snippet']}"
            for item in numbered
        )
        or "(no external sources found)"
    )

    system_prompt = (
        "You are a careful teaching assistant who expands lecture summaries "
        "into longer, teaching-style articles. Write in clear paragraphs (no "
        "bullet lists). Reference the provided SOURCES inline using bracketed "
        "numeric citations like [1] or [2] that match the source index. If the "
        "sources don't support a claim, prefer the lecture's own summary or "
        "omit the claim. Do NOT invent sources. Keep the article focused, "
        "around 400-700 words."
    )
    user_prompt = (
        f"Lecture title:\n{title or '(untitled)'}\n\n"
        f"Lecture summary:\n{_truncate(summary or '', 3500)}\n\n"
        f"Transcript excerpt (may be empty):\n{_truncate(transcript_excerpt or '', 2500)}\n\n"
        f"Sources:\n{sources_block}\n\n"
        "Write the teaching article now."
    )

    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        max_tokens=2400,
    )
    text = response.choices[0].message.content or ""

    citations = [
        {
            "idx": item["idx"],
            "title": item["title"],
            "url": item["url"],
            "snippet": item["snippet"],
        }
        for item in numbered
    ]
    return {"text": text.strip(), "citations": citations}


async def chat_with_class(
    messages: list[dict],
    retrieved: list[dict],
) -> AsyncGenerator[str, None]:
    """Stream an assistant answer grounded in ``retrieved`` transcript chunks.

    ``retrieved`` is a list of ``{label, lecture_id, lecture_title,
    chunk_index, excerpt}`` dicts (the same shape we emit as citations to the
    client). The model is told to answer using those excerpts only and to
    cite with the exact labels we supplied, e.g. ``[L1]``, ``[L2]``.
    """
    if retrieved:
        sources_block = "\n\n".join(
            f"{item['label']} - {item['lecture_title']} (chunk {item['chunk_index']})\n{_truncate(item['excerpt'], 900)}"
            for item in retrieved
        )
    else:
        sources_block = "(no excerpts retrieved)"

    system_prompt = (
        "You are a study assistant answering questions about a single class. "
        "Use ONLY the provided excerpts below. Every non-trivial claim must "
        "cite one of the excerpts using the bracketed label exactly as shown, "
        "for example [L1], [L2]. If the excerpts don't answer the question, "
        "say so plainly. Keep answers tight and readable.\n\n"
        f"EXCERPTS:\n{sources_block}"
    )

    chat_messages = [{"role": "system", "content": system_prompt}]
    for m in messages:
        role = m.get("role", "user")
        if role not in {"user", "assistant"}:
            continue
        chat_messages.append({"role": role, "content": str(m.get("content", ""))})

    client = _get_client()
    stream = await client.chat.completions.create(
        model=settings.openrouter_model,
        messages=chat_messages,
        max_tokens=1500,
        stream=True,
    )
    async for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content
