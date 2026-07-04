from typing import Optional
from sqlalchemy import String, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class CompanyProfile(Base):
    __tablename__ = "company_profile"

    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Orbx Corporation")
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    fy_start_month: Mapped[int] = mapped_column(Integer, default=4)   # April
    fy_start_year: Mapped[int] = mapped_column(Integer, default=2026)  # FY 2026-27


class VoucherSequence(Base):
    __tablename__ = "voucher_sequences"

    voucher_type: Mapped[str] = mapped_column(String(10), nullable=False)  # RCV, PAY, TRF
    prefix: Mapped[str] = mapped_column(String(20), nullable=False)        # RCV, PAY, TRF
    current_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fy_start: Mapped[int] = mapped_column(Integer, nullable=False)         # e.g. 2026
    fy_end: Mapped[int] = mapped_column(Integer, nullable=False)           # e.g. 2027
    padding: Mapped[int] = mapped_column(Integer, default=6)              # RCV-000001
