import json

from openai import AsyncOpenAI

from app.config import settings

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def summarize(transcript: str) -> str:
    """Generate a concise summary of a lecture transcript."""
    client = _get_client()
    response = await client.chat.completions.create(
        model="gpt-4o",
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
        model="gpt-4o",
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
