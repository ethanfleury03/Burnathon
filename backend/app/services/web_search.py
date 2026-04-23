"""Thin async wrapper around Tavily web search.

Tavily's Python SDK is synchronous, so we run it in a worker thread. The
helper returns a normalized list of ``{title, url, snippet}`` dicts. The
``tavily_api_key`` setting must be configured; otherwise ``TavilyUnavailable``
is raised so callers can surface a friendly error.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


class TavilyUnavailable(RuntimeError):
    """Raised when the Tavily API key is missing or the SDK is unavailable."""


@dataclass(frozen=True)
class SearchResult:
    title: str
    url: str
    snippet: str


_client: Any = None


def _get_client() -> Any:
    global _client
    if _client is not None:
        return _client
    if not settings.tavily_api_key:
        raise TavilyUnavailable(
            "TAVILY_API_KEY is not configured. Set it in the environment to enable deep-dive augmentation."
        )
    try:
        from tavily import TavilyClient  # type: ignore
    except ImportError as exc:
        raise TavilyUnavailable(
            "tavily-python is not installed. Run `pip install tavily-python`."
        ) from exc
    _client = TavilyClient(api_key=settings.tavily_api_key)
    return _client


def _sync_search(query: str, max_results: int) -> list[SearchResult]:
    client = _get_client()
    response = client.search(
        query=query,
        search_depth="advanced",
        max_results=max_results,
    )
    raw = response.get("results", []) if isinstance(response, dict) else []
    out: list[SearchResult] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        out.append(
            SearchResult(
                title=str(item.get("title") or item.get("url") or "Untitled"),
                url=str(item.get("url") or ""),
                snippet=str(item.get("content") or item.get("snippet") or ""),
            )
        )
    return out


async def search(query: str, max_results: int = 5) -> list[SearchResult]:
    """Run a Tavily advanced search in a worker thread."""
    return await asyncio.to_thread(_sync_search, query, max_results)


async def search_many(
    queries: list[str], max_results_each: int = 4
) -> list[SearchResult]:
    """Run several searches in parallel and de-duplicate by URL."""
    tasks = [search(q, max_results_each) for q in queries if q.strip()]
    if not tasks:
        return []
    batches = await asyncio.gather(*tasks, return_exceptions=True)
    seen: set[str] = set()
    out: list[SearchResult] = []
    for batch in batches:
        if isinstance(batch, Exception):
            logger.warning("Tavily batch failed: %s", batch)
            continue
        for result in batch:
            if not result.url or result.url in seen:
                continue
            seen.add(result.url)
            out.append(result)
    return out
