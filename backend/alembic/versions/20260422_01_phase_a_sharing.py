"""Phase A: class sharing (visibility + published_at)

Revision ID: 20260422_01
Revises:
Create Date: 2026-04-22

Adds the ``visibility`` enum and ``published_at`` timestamp columns to the
``classes`` table so classes can be shared publicly via the Explore page.

This revision is the first in the history. For existing databases that were
previously bootstrapped via ``Base.metadata.create_all`` it only adds the new
columns; it does not attempt to recreate the base tables.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "20260422_01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


VISIBILITY_ENUM_NAME = "classvisibility"


def upgrade() -> None:
    bind = op.get_bind()
    visibility_enum = sa.Enum("private", "public", name=VISIBILITY_ENUM_NAME)
    visibility_enum.create(bind, checkfirst=True)

    op.add_column(
        "classes",
        sa.Column(
            "visibility",
            visibility_enum,
            nullable=False,
            server_default="private",
        ),
    )
    op.add_column(
        "classes",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_classes_visibility",
        "classes",
        ["visibility"],
    )


def downgrade() -> None:
    op.drop_index("ix_classes_visibility", table_name="classes")
    op.drop_column("classes", "published_at")
    op.drop_column("classes", "visibility")

    bind = op.get_bind()
    visibility_enum = sa.Enum("private", "public", name=VISIBILITY_ENUM_NAME)
    visibility_enum.drop(bind, checkfirst=True)
