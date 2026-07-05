from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator


# ─────────────────────────────────────────────
# BANK ACCOUNT
# ─────────────────────────────────────────────

class BankAccountCreate(BaseModel):
    name: str
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_branch_name: Optional[str] = None
    opening_balance: float = 0.0
    opening_date: date
    is_overdraft_allowed: bool = False
    status: str = "active"
    notes: Optional[str] = None


class BankAccountUpdate(BaseModel):
    name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    bank_branch_name: Optional[str] = None
    is_overdraft_allowed: Optional[bool] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class BankAccountOut(BaseModel):
    id: str
    name: str
    account_number: Optional[str]
    ifsc_code: Optional[str]
    bank_branch_name: Optional[str]
    opening_balance: float
    opening_date: date
    current_balance: float
    is_overdraft_allowed: bool
    status: str
    notes: Optional[str]

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# CASH ACCOUNT
# ─────────────────────────────────────────────

class CashAccountCreate(BaseModel):
    name: str = "Cash in Hand"
    opening_balance: float = 0.0
    opening_date: date
    status: str = "active"


class CashAccountOut(BaseModel):
    id: str
    name: str
    opening_balance: float
    opening_date: date
    current_balance: float
    status: str

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# BRANCH
# ─────────────────────────────────────────────

class BranchCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: str = "active"


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = None


class BranchOut(BaseModel):
    id: str
    name: str
    code: str
    address: Optional[str]
    contact_person: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    status: str

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# RECEIPT VOUCHER
# ─────────────────────────────────────────────

class ReceiptCreate(BaseModel):
    date: date
    branch_id: Optional[str] = None
    received_from: str
    amount: float
    payment_mode: str  # bank | cash
    bank_account_id: Optional[str] = None
    cash_account_id: Optional[str] = None
    reference_number: Optional[str] = None
    narration: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v


class ReceiptOut(BaseModel):
    id: str
    voucher_number: str
    date: date
    branch_id: Optional[str]
    branch_name: Optional[str] = None
    received_from: str
    amount: float
    payment_mode: str
    bank_account_id: Optional[str]
    bank_account_name: Optional[str] = None
    cash_account_id: Optional[str]
    cash_account_name: Optional[str] = None
    reference_number: Optional[str]
    narration: Optional[str]
    is_reversed: bool
    reversal_of_id: Optional[str]
    posted_by_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# PAYMENT VOUCHER
# ─────────────────────────────────────────────

class PaymentCreate(BaseModel):
    date: date
    branch_id: Optional[str] = None
    paid_to: str
    amount: float
    payment_mode: str  # bank | cash
    bank_account_id: Optional[str] = None
    cash_account_id: Optional[str] = None
    reference_number: Optional[str] = None
    narration: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v


class PaymentOut(BaseModel):
    id: str
    voucher_number: str
    date: date
    branch_id: Optional[str]
    branch_name: Optional[str] = None
    paid_to: str
    amount: float
    payment_mode: str
    bank_account_id: Optional[str]
    bank_account_name: Optional[str] = None
    cash_account_id: Optional[str]
    cash_account_name: Optional[str] = None
    reference_number: Optional[str]
    narration: Optional[str]
    is_reversed: bool
    reversal_of_id: Optional[str]
    posted_by_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# FUND TRANSFER
# ─────────────────────────────────────────────

class FundTransferCreate(BaseModel):
    date: date
    from_account_type: str   # bank | cash
    from_account_id: str
    to_account_type: str     # bank | cash
    to_account_id: str
    amount: float
    reference_number: Optional[str] = None
    narration: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than zero")
        return v


class FundTransferOut(BaseModel):
    id: str
    voucher_number: str
    date: date
    from_account_type: str
    from_account_id: str
    from_account_name: Optional[str] = None
    to_account_type: str
    to_account_id: str
    to_account_name: Optional[str] = None
    amount: float
    reference_number: Optional[str]
    narration: Optional[str]
    posted_by_id: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# DAYBOOK
# ─────────────────────────────────────────────

class DaybookEntryOut(BaseModel):
    id: str
    date: date
    voucher_type: str
    voucher_number: str
    voucher_id: str
    branch_id: Optional[str]
    branch_name: Optional[str] = None
    particulars: str
    debit: float
    credit: float
    payment_mode: Optional[str]
    reference_number: Optional[str]
    narration: Optional[str]
    account_type: Optional[str]
    account_id: Optional[str]

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# LEDGER
# ─────────────────────────────────────────────

class LedgerEntryOut(BaseModel):
    id: str
    date: date
    account_type: str
    account_id: str
    voucher_type: str
    voucher_id: str
    voucher_number: str
    debit: float
    credit: float
    running_balance: float
    description: Optional[str]

    class Config:
        from_attributes = True


class LedgerStatementOut(BaseModel):
    account_id: str
    account_name: str
    account_type: str
    opening_balance: float
    closing_balance: float
    total_debit: float
    total_credit: float
    entries: List[LedgerEntryOut]


# ─────────────────────────────────────────────
# VOUCHER SEQUENCE
# ─────────────────────────────────────────────

class VoucherSequenceCreate(BaseModel):
    voucher_type: str
    prefix: str
    fy_start: int
    fy_end: int
    padding: int = 6


class VoucherSequenceUpdate(BaseModel):
    prefix: Optional[str] = None
    padding: Optional[int] = None
    next_number: Optional[int] = None


class VoucherSequenceOut(BaseModel):
    id: str
    voucher_type: str
    prefix: str
    current_number: int
    fy_start: int
    fy_end: int
    padding: int

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# COMPANY PROFILE
# ─────────────────────────────────────────────

class CompanyProfileUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    fy_start_month: Optional[int] = None
    fy_start_year: Optional[int] = None


class CompanyProfileOut(BaseModel):
    id: str
    name: str
    address: Optional[str]
    gstin: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    logo_url: Optional[str]
    fy_start_month: int
    fy_start_year: int

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────────

class BalanceTileOut(BaseModel):
    id: str
    name: str
    balance: float
    account_type: str  # bank | cash


class DashboardKPIOut(BaseModel):
    total_bank_balance: float
    total_cash_balance: float
    today_receipts: float
    today_payments: float
    branch_collection_today: float
    account_tiles: List[BalanceTileOut]


class MonthlyFlowPoint(BaseModel):
    month: str
    receipts: float
    payments: float


class BranchCollectionPoint(BaseModel):
    branch_name: str
    branch_code: str
    amount: float


class DashboardSummaryOut(BaseModel):
    kpis: DashboardKPIOut
    monthly_flow: List[MonthlyFlowPoint]
    top_branch_collections: List[BranchCollectionPoint]
    recent_transactions: List[dict]


# ─────────────────────────────────────────────
# REPORT FILTERS
# ─────────────────────────────────────────────

class ReportFilter(BaseModel):
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    branch_id: Optional[str] = None
    account_id: Optional[str] = None
    account_type: Optional[str] = None  # bank | cash
    export_format: Optional[str] = None  # excel | pdf
