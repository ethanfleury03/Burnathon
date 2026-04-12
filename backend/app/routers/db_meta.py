"""Read-only database table structure for local development."""

from fastapi import APIRouter

from app.dependencies import ClerkJWTPayload
from app.models import Class, Lecture, User
from app.schemas import DbColumnOut, DbTableOut

router = APIRouter(prefix="/api/db", tags=["db"])


def _columns_for(model: type) -> list[DbColumnOut]:
    out: list[DbColumnOut] = []
    for col in model.__table__.columns:
        fks = [f"{fk.column.table.name}.{fk.column.name}" for fk in col.foreign_keys]
        out.append(
            DbColumnOut(
                name=col.name,
                type=str(col.type),
                nullable=col.nullable,
                primary_key=col.primary_key,
                foreign_keys=fks,
            )
        )
    return out


@router.get("/schema", response_model=list[DbTableOut])
async def get_table_schema(_token: ClerkJWTPayload):
    """Current SQLAlchemy model definitions (authoritative app schema)."""
    return [
        DbTableOut(name=User.__tablename__, columns=_columns_for(User)),
        DbTableOut(name=Class.__tablename__, columns=_columns_for(Class)),
        DbTableOut(name=Lecture.__tablename__, columns=_columns_for(Lecture)),
    ]
