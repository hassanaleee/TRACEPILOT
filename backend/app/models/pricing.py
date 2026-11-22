from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class ModelPricing(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "model_pricing"
    __table_args__ = (
        UniqueConstraint("model_name", "provider", name="uq_model_pricing_name_provider"),
    )

    model_name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    input_price_per_1m: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    output_price_per_1m: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

