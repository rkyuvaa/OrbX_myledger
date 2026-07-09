from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import User
from app.models.ledger import ReceiptVoucher, Branch, BankAccount, CashAccount
from app.schemas.ledger import ReceiptCreate, ReceiptOut
from app.services import ledger_service
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/receipts", tags=["Receipts"])


@router.post("/", response_model=ReceiptOut, status_code=201)
async def create_receipt(
    body: ReceiptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new receipt voucher. Updates bank/cash balance and posts daybook/ledger."""
    voucher = await ledger_service.create_receipt(db, body, current_user.id)
    return await _enrich_receipt(db, voucher)


@router.get("/", response_model=List[ReceiptOut])
async def list_receipts(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    branch_id: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(ReceiptVoucher).order_by(ReceiptVoucher.date.desc(), ReceiptVoucher.created_at.desc())

    if from_date:
        q = q.where(ReceiptVoucher.date >= from_date)
    if to_date:
        q = q.where(ReceiptVoucher.date <= to_date)
    if branch_id:
        q = q.where(ReceiptVoucher.branch_id == branch_id)
    if payment_mode:
        q = q.where(ReceiptVoucher.payment_mode == payment_mode)

    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    vouchers = result.scalars().all()
    return [await _enrich_receipt(db, v) for v in vouchers]


@router.get("/{receipt_id}", response_model=ReceiptOut)
async def get_receipt(
    receipt_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi import HTTPException
    result = await db.execute(select(ReceiptVoucher).where(ReceiptVoucher.id == receipt_id))
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return await _enrich_receipt(db, voucher)


@router.put("/{receipt_id}", response_model=ReceiptOut)
async def update_receipt(
    receipt_id: str,
    body: ReceiptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a receipt voucher. Reverts previous balance changes, updates account mappings, Daybook and Ledger entries."""
    voucher = await ledger_service.update_receipt(db, receipt_id, body, current_user.id)
    return await _enrich_receipt(db, voucher)


@router.post("/{receipt_id}/reverse", response_model=ReceiptOut)
async def reverse_receipt(
    receipt_id: str,
    reason: str = "Reversal",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reverse a receipt voucher. Creates offsetting entry — no deletion allowed."""
    reversal = await ledger_service.reverse_receipt(db, receipt_id, current_user.id, reason)
    return await _enrich_receipt(db, reversal)


@router.delete("/{receipt_id}")
async def delete_receipt(
    receipt_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a receipt voucher."""
    await ledger_service.delete_receipt(db, receipt_id, current_user.id)
    return {"status": "success", "message": "Receipt voucher deleted successfully"}


async def _enrich_receipt(db: AsyncSession, v: ReceiptVoucher) -> ReceiptOut:
    """Attach related names to the voucher output."""
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

    return ReceiptOut(
        id=v.id,
        voucher_number=v.voucher_number,
        date=v.date,
        branch_id=v.branch_id,
        branch_name=branch_name,
        received_from=v.received_from,
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
