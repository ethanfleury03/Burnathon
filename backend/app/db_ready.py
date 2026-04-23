from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from app.dependencies import engine

CORE_TABLES = ("users", "classes", "lectures")
DB_CONNECTION_HINT = (
    "Database unavailable. Start PostgreSQL and verify DATABASE_URL points to the running server."
)
DB_MIGRATION_HINT = "Database schema is not initialized. Run `alembic upgrade head`."


@dataclass(slots=True)
class DatabaseStatus:
    ok: bool
    detail: str | None = None


def _exception_text(exc: BaseException) -> str:
    seen: set[int] = set()
    parts: list[str] = []
    current: BaseException | None = exc

    while current is not None and id(current) not in seen:
        seen.add(id(current))
        parts.append(f"{type(current).__name__}: {current}")
        current = current.__cause__ or current.__context__

    return " | ".join(parts).lower()


def classify_database_error(exc: BaseException) -> str | None:
    text = _exception_text(exc)

    connection_markers = (
        "connect call failed",
        "connection refused",
        "could not connect",
        "connection was refused",
        "name or service not known",
        "temporary failure in name resolution",
        "nodename nor servname",
        "timed out",
        "timeout expired",
        "targetserverattributenotmatched",
    )
    migration_markers = (
        "relation",
        "does not exist",
        "undefinedtable",
        "no such table",
    )

    if any(marker in text for marker in connection_markers):
        return DB_CONNECTION_HINT

    if (
        ("no such table" in text)
        or ("undefinedtable" in text)
        or ("relation" in text and "does not exist" in text)
    ):
        return DB_MIGRATION_HINT

    return None


async def get_database_status() -> DatabaseStatus:
    try:
        async with engine.connect() as connection:
            table_names = await connection.run_sync(
                lambda sync_connection: set(inspect(sync_connection).get_table_names())
            )
    except (SQLAlchemyError, OSError) as exc:
        return DatabaseStatus(ok=False, detail=classify_database_error(exc) or DB_CONNECTION_HINT)

    missing_tables = [table for table in CORE_TABLES if table not in table_names]
    if missing_tables:
        return DatabaseStatus(ok=False, detail=DB_MIGRATION_HINT)

    return DatabaseStatus(ok=True)
