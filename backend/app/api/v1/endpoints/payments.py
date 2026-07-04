from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import User
from app.models.ledger import PaymentVoucher, Branch, BankAccount, CashAccount
from app.schemas.ledger import PaymentCreate, PaymentOut
from app.services import ledger_service
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/", response_model=PaymentOut, status_code=201)
async def create_payment(
    body: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create payment voucher. Validates sufficient balance, updates accounts, posts entries."""
    voucher = await ledger_service.create_payment(db, body, current_user.id)
    return await _enrich_payment(db, voucher)


@router.get("/", response_model=List[PaymentOut])
async def list_payments(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    branch_id: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(PaymentVoucher).order_by(PaymentVoucher.date.desc(), PaymentVoucher.created_at.desc())

    if from_date:
        q = q.where(PaymentVoucher.date >= from_date)
    if to_date:
        q = q.where(PaymentVoucher.date <= to_date)
    if branch_id:
        q = q.where(PaymentVoucher.branch_id == branch_id)
    if payment_mode:
        q = q.where(PaymentVoucher.payment_mode == payment_mode)

    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    vouchers = result.scalars().all()
    return [await _enrich_payment(db, v) for v in vouchers]


@router.get("/{payment_id}", response_model=PaymentOut)
async def get_payment(
    payment_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(PaymentVoucher).where(PaymentVoucher.id == payment_id))
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=404, detail="Payment not found")
    return await _enrich_payment(db, voucher)


@router.post("/{payment_id}/reverse", response_model=PaymentOut)
async def reverse_payment(
    payment_id: str,
    reason: str = "Reversal",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    reversal = await ledger_service.reverse_payment(db, payment_id, current_user.id, reason)
    return await _enrich_payment(db, reversal)


async def _enrich_payment(db: AsyncSession, v: PaymentVoucher) -> PaymentOut:
    branch_name = None
    if v.branch_id:
        r = await db.execute(select(Branch).where(Branch.id == v.branch_id))
        br = r.scalar_one_or_none()
        branch_name = br.name if br else None

    bank_name = None
    if v.bank_account_id:
        r = await db.execute(select(BankAccount).where(BankAccount.id == v.bank_account_id))
        ba = r.scalar_one_or_none()
        bank_name = ba.name if ba else None

    cash_name = None
    if v.cash_account_id:
        r = await db.execute(select(CashAccount).where(CashAccount.id == v.cash_account_id))
        ca = r.scalar_one_or_none()
        cash_name = ca.name if ca else None

    return PaymentOut(
        id=v.id,
        voucher_number=v.voucher_number,
        date=v.date,
        branch_id=v.branch_id,
        branch_name=branch_name,
        paid_to=v.paid_to,
        amount=v.amount,
        payment_mode=v.payment_mode,
        bank_account_id=v.bank_account_id,
        bank_account_name=bank_name,
        cash_account_id=v.cash_account_id,
        cash_account_name=cash_name,
        reference_number=v.reference_number,
        narration=v.narration,
        is_reversed=v.is_reversed,
        reversal_of_id=v.reversal_of_id,
        posted_by_id=v.posted_by_id,
        created_at=v.created_at,
    )
