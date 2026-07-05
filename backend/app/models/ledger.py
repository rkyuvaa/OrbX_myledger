from datetime import date, datetime
from typing import Optional
from sqlalchemy import String, Float, Boolean, Date, DateTime, Text, func, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base


# ─────────────────────────────────────────────
# ACCOUNTS
# ─────────────────────────────────────────────

class BankAccount(Base):
    __tablename__ = "bank_accounts"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bank_branch_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    opening_balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    opening_date: Mapped[date] = mapped_column(Date, nullable=False)
    current_balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_overdraft_allowed: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, inactive
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class CashAccount(Base):
    __tablename__ = "cash_accounts"

    name: Mapped[str] = mapped_column(String(255), nullable=False, default="Cash in Hand")
    opening_balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    opening_date: Mapped[date] = mapped_column(Date, nullable=False)
    current_balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="active")


# ─────────────────────────────────────────────
# BRANCH
# ─────────────────────────────────────────────

class Branch(Base):
    __tablename__ = "branches"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, inactive


# ─────────────────────────────────────────────
# RECEIPT VOUCHER
# ─────────────────────────────────────────────

class ReceiptVoucher(Base):
    __tablename__ = "receipt_vouchers"

    voucher_number: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    branch_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    received_from: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(20), nullable=False)  # bank, cash
    bank_account_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("bank_accounts.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    cash_account_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("cash_accounts.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_reversed: Mapped[bool] = mapped_column(Boolean, default=False)
    reversal_of_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("receipt_vouchers.id", ondelete="SET NULL"), nullable=True
    )
    posted_by_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    branch: Mapped[Optional["Branch"]] = relationship("Branch", foreign_keys=[branch_id])
    bank_account: Mapped[Optional["BankAccount"]] = relationship("BankAccount", foreign_keys=[bank_account_id])
    cash_account: Mapped[Optional["CashAccount"]] = relationship("CashAccount", foreign_keys=[cash_account_id])
    posted_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[posted_by_id])


# ─────────────────────────────────────────────
# PAYMENT VOUCHER
# ─────────────────────────────────────────────

class PaymentVoucher(Base):
    __tablename__ = "payment_vouchers"

    voucher_number: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    branch_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    paid_to: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(20), nullable=False)  # bank, cash
    bank_account_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("bank_accounts.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    cash_account_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("cash_accounts.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_reversed: Mapped[bool] = mapped_column(Boolean, default=False)
    reversal_of_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("payment_vouchers.id", ondelete="SET NULL"), nullable=True
    )
    posted_by_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    branch: Mapped[Optional["Branch"]] = relationship("Branch", foreign_keys=[branch_id])
    bank_account: Mapped[Optional["BankAccount"]] = relationship("BankAccount", foreign_keys=[bank_account_id])
    cash_account: Mapped[Optional["CashAccount"]] = relationship("CashAccount", foreign_keys=[cash_account_id])
    posted_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[posted_by_id])


# ─────────────────────────────────────────────
# FUND TRANSFER
# ─────────────────────────────────────────────

class FundTransfer(Base):
    __tablename__ = "fund_transfers"

    voucher_number: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    from_account_type: Mapped[str] = mapped_column(String(10), nullable=False)  # bank, cash
    from_account_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    to_account_type: Mapped[str] = mapped_column(String(10), nullable=False)    # bank, cash
    to_account_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    posted_by_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


# ─────────────────────────────────────────────
# DAYBOOK ENTRY
# ─────────────────────────────────────────────

class DaybookEntry(Base):
    __tablename__ = "daybook_entries"

    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    voucher_type: Mapped[str] = mapped_column(String(10), nullable=False)  # RCV, PAY, TRF
    voucher_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    voucher_number: Mapped[str] = mapped_column(String(30), nullable=False)
    branch_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True
    )
    particulars: Mapped[str] = mapped_column(String(500), nullable=False)
    debit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    credit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    payment_mode: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    account_type: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)   # bank, cash
    account_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)

    # Relationship
    branch: Mapped[Optional["Branch"]] = relationship("Branch", foreign_keys=[branch_id])


# ─────────────────────────────────────────────
# LEDGER ENTRY
# ─────────────────────────────────────────────

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    account_type: Mapped[str] = mapped_column(String(10), nullable=False)  # bank, cash, branch
    account_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False, index=True)
    voucher_type: Mapped[str] = mapped_column(String(10), nullable=False)  # RCV, PAY, TRF
    voucher_id: Mapped[str] = mapped_column(UUID(as_uuid=False), nullable=False)
    voucher_number: Mapped[str] = mapped_column(String(30), nullable=False)
    debit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    credit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    running_balance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


# ─────────────────────────────────────────────
# AUDIT LOG
# ─────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    user_id: Mapped[Optional[str]] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)   # CREATE, UPDATE, REVERSE
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(UUID(as_uuid=False), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    old_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_values: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
