import uuid
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.api_key import APIKey
    from app.models.trace import Trace
    from app.models.evaluation import EvaluationDataset


class Project(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_org_project_slug"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="projects")
    api_keys: Mapped[List["APIKey"]] = relationship(
        "APIKey",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    traces: Mapped[List["Trace"]] = relationship(
        "Trace",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    evaluation_datasets: Mapped[List["EvaluationDataset"]] = relationship(
        "EvaluationDataset",
        back_populates="project",
        cascade="all, delete-orphan",
    )

