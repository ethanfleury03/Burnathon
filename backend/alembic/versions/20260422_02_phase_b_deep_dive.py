"""Phase B: deep dive augmentation columns on lectures

Revision ID: 20260422_02
Revises: 20260422_01
Create Date: 2026-04-22

Adds ``augmented_text``, ``augmented_citations`` (JSONB), and ``augmented_at``
to ``lectures`` so a generated deep-dive article can be persisted alongside
references returned by the web-search step.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision: str = "20260422_02"
down_revision: Union[str, None] = "20260422_01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lectures", sa.Column("augmented_text", sa.Text(), nullable=True))
    op.add_column(
        "lectures",
        sa.Column("augmented_citations", JSONB(), nullable=True),
    )
    op.add_column(
        "lectures",
        sa.Column("augmented_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("lectures", "augmented_at")
    op.drop_column("lectures", "augmented_citations")
    op.drop_column("lectures", "augmented_text")
