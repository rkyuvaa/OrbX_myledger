from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.models.auth import User
from app.models.ledger import LedgerEntry, BankAccount, CashAccount, Branch, ReceiptVoucher, PaymentVoucher, ExpenseVoucher, DaybookEntry
from app.schemas.ledger import LedgerEntryOut, LedgerStatementOut
from app.api.v1.endpoints.auth import get_current_user
from app.services.ledger_service import _post_ledger, _get_bank

router = APIRouter(prefix="/ledger", tags=["Ledger"])


@router.get("/accounts")
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all accounts (bank + cash) available for ledger view."""
    banks = (await db.execute(select(BankAccount).where(BankAccount.status == "active"))).scalars().all()
    cashes = (await db.execute(select(CashAccount).where(CashAccount.status == "active"))).scalars().all()

    return {
        "bank_accounts": [
            {"id": b.id, "name": b.name, "current_balance": b.current_balance, "type": "bank"}
            for b in banks
        ],
        "cash_accounts": [
            {"id": c.id, "name": c.name, "current_balance": c.current_balance, "type": "cash"}
            for c in cashes
        ],
    }


@router.get("/statement", response_model=LedgerStatementOut)
async def get_ledger_statement(
    account_type: str = Query(..., description="bank or cash"),
    account_id: str = Query(...),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get ledger statement for a specific account with running balance."""
    # Resolve account info
    if account_type == "bank":
        r = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
        acc = r.scalar_one_or_none()
        if not acc:
            raise HTTPException(status_code=404, detail="Bank account not found")
        account_name = acc.name
        opening_balance = acc.opening_balance
    else:
        r = await db.execute(select(CashAccount).where(CashAccount.id == account_id))
        acc = r.scalar_one_or_none()
        if not acc:
            raise HTTPException(status_code=404, detail="Cash account not found")
        account_name = acc.name
        opening_balance = acc.opening_balance

    # Fetch entries
    q = select(LedgerEntry).where(
        LedgerEntry.account_type == account_type,
        LedgerEntry.account_id == account_id,
    ).order_by(LedgerEntry.date.asc(), LedgerEntry.created_at.asc())

    if from_date:
        q = q.where(LedgerEntry.date >= from_date)
    if to_date:
        q = q.where(LedgerEntry.date <= to_date)

    result = await db.execute(q)
    entries = result.scalars().all()

    total_debit = sum(e.debit for e in entries)
    total_credit = sum(e.credit for e in entries)
    closing_balance = opening_balance + total_credit - total_debit

    return LedgerStatementOut(
        account_id=account_id,
        account_name=account_name,
        account_type=account_type,
        opening_balance=opening_balance,
        closing_balance=closing_balance,
        total_debit=total_debit,
        total_credit=total_credit,
        entries=[LedgerEntryOut.model_validate(e) for e in entries],
    )


@router.get("/entries", response_model=List[LedgerEntryOut])
async def list_ledger_entries(
    account_type: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(LedgerEntry).order_by(LedgerEntry.date.desc(), LedgerEntry.created_at.desc())

    if account_type:
        q = q.where(LedgerEntry.account_type == account_type)
    if account_id:
        q = q.where(LedgerEntry.account_id == account_id)
    if from_date:
        q = q.where(LedgerEntry.date >= from_date)
    if to_date:
        q = q.where(LedgerEntry.date <= to_date)

    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/clear-cheque/{voucher_type}/{voucher_id}")
async def clear_cheque(
    voucher_type: str,
    voucher_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks a pending cheque as cleared, updating the bank balance and posting to the ledger."""
    if voucher_type == "RCV":
        r = await db.execute(select(ReceiptVoucher).where(ReceiptVoucher.id == voucher_id))
        voucher = r.scalar_one_or_none()
        if not voucher:
            raise HTTPException(status_code=404, detail="Receipt voucher not found")
        particulars = f"Receipt from {voucher.received_from}"
        debit, credit = 0.0, voucher.amount
    elif voucher_type == "PAY":
        r = await db.execute(select(PaymentVoucher).where(PaymentVoucher.id == voucher_id))
        voucher = r.scalar_one_or_none()
        if not voucher:
            raise HTTPException(status_code=404, detail="Payment voucher not found")
        particulars = f"Payment to {voucher.paid_to}"
        debit, credit = voucher.amount, 0.0
    elif voucher_type == "EXP":
        r = await db.execute(select(ExpenseVoucher).where(ExpenseVoucher.id == voucher_id))
        voucher = r.scalar_one_or_none()
        if not voucher:
            raise HTTPException(status_code=404, detail="Expense voucher not found")
        particulars = f"Expense to {voucher.paid_to}"
        debit, credit = voucher.amount, 0.0
    else:
        raise HTTPException(status_code=400, detail="Invalid voucher type")

    if not voucher.reference_number or "Status: Pending" not in voucher.reference_number:
        raise HTTPException(status_code=400, detail="Voucher is not a pending cheque or is already cleared")

    # Update reference status
    new_ref = voucher.reference_number.replace("Status: Pending", "Status: Cleared")
    voucher.reference_number = new_ref

    # Update DaybookEntry reference status
    db_entry_result = await db.execute(
        select(DaybookEntry).where(DaybookEntry.voucher_id == voucher_id, DaybookEntry.voucher_type == voucher_type)
    )
    db_entry = db_entry_result.scalar_one_or_none()
    if db_entry:
        db_entry.reference_number = new_ref

    # Update bank account balance
    bank = await _get_bank(db, voucher.bank_account_id)
    if not bank:
        raise HTTPException(status_code=404, detail="Bank account not found")

    if voucher_type in ("PAY", "EXP"):
        # Validate balance limits if overdraft is not allowed
        if not bank.is_overdraft_allowed and bank.current_balance < voucher.amount:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient balance in {bank.name} to clear this cheque. Available: ₹{bank.current_balance:.2f}",
            )
        bank.current_balance -= voucher.amount
    else:
        bank.current_balance += voucher.amount

    # Post official LedgerEntry
    await _post_ledger(
        db=db,
        date=voucher.date,
        account_type="bank",
        account_id=voucher.bank_account_id,
        voucher_type=voucher_type,
        voucher_id=voucher_id,
        voucher_number=voucher.voucher_number,
        debit=debit,
        credit=credit,
        description=particulars,
    )

    await db.commit()
    return {"status": "success", "message": "Cheque cleared successfully", "voucher_number": voucher.voucher_number}

