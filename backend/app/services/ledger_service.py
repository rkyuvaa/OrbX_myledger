from datetime import date, datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete
from fastapi import HTTPException, status

from app.models.ledger import (
    BankAccount, CashAccount, Branch,
    ReceiptVoucher, PaymentVoucher, ExpenseVoucher, FundTransfer,
    DaybookEntry, LedgerEntry, AuditLog,
)
from app.models.company import CompanyProfile
from app.schemas.ledger import (
    ReceiptCreate, PaymentCreate, ExpenseCreate, FundTransferCreate,
    DashboardSummaryOut, DashboardKPIOut, BalanceTileOut,
    MonthlyFlowPoint, BranchCollectionPoint,
)
from app.services.voucher_service import get_next_voucher_number


# ─────────────────────────────────────────────
# HELPER: Resolve account name
# ─────────────────────────────────────────────

async def _get_bank(db: AsyncSession, account_id: str) -> BankAccount:
    result = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
    bank = result.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail=f"Bank account {account_id} not found")
    return bank


async def _get_cash(db: AsyncSession, account_id: str) -> CashAccount:
    result = await db.execute(select(CashAccount).where(CashAccount.id == account_id))
    cash = result.scalar_one_or_none()
    if not cash:
        raise HTTPException(status_code=404, detail=f"Cash account {account_id} not found")
    return cash


async def _resolve_account_name(db: AsyncSession, account_type: str, account_id: str) -> str:
    if account_type == "bank":
        bank = await _get_bank(db, account_id)
        return bank.name
    else:
        cash = await _get_cash(db, account_id)
        return cash.name


# ─────────────────────────────────────────────
# DAYBOOK POSTING
# ─────────────────────────────────────────────

async def _post_daybook(
    db: AsyncSession,
    date: date,
    voucher_type: str,
    voucher_id: str,
    voucher_number: str,
    branch_id: Optional[str],
    particulars: str,
    debit: float,
    credit: float,
    payment_mode: Optional[str],
    reference_number: Optional[str],
    narration: Optional[str],
    account_type: Optional[str],
    account_id: Optional[str],
) -> None:
    entry = DaybookEntry(
        date=date,
        voucher_type=voucher_type,
        voucher_id=voucher_id,
        voucher_number=voucher_number,
        branch_id=branch_id,
        particulars=particulars,
        debit=debit,
        credit=credit,
        payment_mode=payment_mode,
        reference_number=reference_number,
        narration=narration,
        account_type=account_type,
        account_id=account_id,
    )
    db.add(entry)


# ─────────────────────────────────────────────
# LEDGER POSTING
# ─────────────────────────────────────────────

async def _post_ledger(
    db: AsyncSession,
    date: date,
    account_type: str,
    account_id: str,
    voucher_type: str,
    voucher_id: str,
    voucher_number: str,
    debit: float,
    credit: float,
    description: Optional[str],
) -> float:
    """Post a ledger entry and return the new running balance."""
    # Get previous running balance
    result = await db.execute(
        select(LedgerEntry.running_balance)
        .where(
            LedgerEntry.account_type == account_type,
            LedgerEntry.account_id == account_id,
        )
        .order_by(LedgerEntry.date.desc(), LedgerEntry.created_at.desc())
        .limit(1)
    )
    prev_balance = result.scalar_one_or_none() or 0.0

    # Get opening balance of account
    if account_type == "bank":
        acc_result = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
        acc = acc_result.scalar_one_or_none()
        if acc and prev_balance == 0.0:
            count_result = await db.execute(
                select(func.count()).where(
                    LedgerEntry.account_type == account_type,
                    LedgerEntry.account_id == account_id,
                )
            )
            if count_result.scalar() == 0:
                prev_balance = acc.opening_balance
    elif account_type == "cash":
        acc_result = await db.execute(select(CashAccount).where(CashAccount.id == account_id))
        acc = acc_result.scalar_one_or_none()
        if acc and prev_balance == 0.0:
            count_result = await db.execute(
                select(func.count()).where(
                    LedgerEntry.account_type == account_type,
                    LedgerEntry.account_id == account_id,
                )
            )
            if count_result.scalar() == 0:
                prev_balance = acc.opening_balance

    new_balance = prev_balance + credit - debit

    entry = LedgerEntry(
        date=date,
        account_type=account_type,
        account_id=account_id,
        voucher_type=voucher_type,
        voucher_id=voucher_id,
        voucher_number=voucher_number,
        debit=debit,
        credit=credit,
        running_balance=new_balance,
        description=description,
    )
    db.add(entry)
    return new_balance


# ─────────────────────────────────────────────
# RECEIPT TRANSACTION
# ─────────────────────────────────────────────

async def create_receipt(
    db: AsyncSession,
    data: ReceiptCreate,
    posted_by_id: str,
) -> ReceiptVoucher:
    # Validate: bank mode must have bank_account_id and reference
    if data.payment_mode == "bank":
        if not data.bank_account_id:
            raise HTTPException(status_code=422, detail="Bank account is required for bank payment mode")


    if data.payment_mode == "cash" and not data.cash_account_id:
        raise HTTPException(status_code=422, detail="Cash account is required for cash payment mode")

    # Generate voucher number
    voucher_number = await get_next_voucher_number(db, "RCV", data.date)

    # Determine if it's a pending cheque
    is_pending_cheque = False
    if data.payment_mode == "bank" and data.reference_number and "Cheque No:" in data.reference_number:
        if "Status: Cleared" not in data.reference_number:
            is_pending_cheque = True
            if "Status: Pending" not in data.reference_number:
                data.reference_number = f"{data.reference_number} | Status: Pending"

    # Create voucher record
    voucher = ReceiptVoucher(
        voucher_number=voucher_number,
        date=data.date,
        branch_id=data.branch_id,
        received_from=data.received_from,
        amount=data.amount,
        payment_mode=data.payment_mode,
        bank_account_id=data.bank_account_id if data.payment_mode == "bank" else None,
        cash_account_id=data.cash_account_id if data.payment_mode == "cash" else None,
        reference_number=data.reference_number,
        narration=data.narration,
        posted_by_id=posted_by_id,
    )
    db.add(voucher)
    await db.flush()

    # Update account balance
    particulars = f"Receipt from {data.received_from}"
    if data.payment_mode == "bank":
        bank = await _get_bank(db, data.bank_account_id)
        if not is_pending_cheque:
            bank.current_balance += data.amount
        account_type = "bank"
        account_id = data.bank_account_id
        account_name = bank.name
    else:
        cash = await _get_cash(db, data.cash_account_id)
        cash.current_balance += data.amount
        account_type = "cash"
        account_id = data.cash_account_id
        account_name = cash.name

    # Daybook entry
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="RCV",
        voucher_id=voucher.id,
        voucher_number=voucher_number,
        branch_id=data.branch_id,
        particulars=particulars,
        debit=0.0,
        credit=data.amount,
        payment_mode=data.payment_mode,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=account_type,
        account_id=account_id,
    )

    # Ledger entry
    if not is_pending_cheque:
        await _post_ledger(
            db=db,
            date=data.date,
            account_type=account_type,
            account_id=account_id,
            voucher_type="RCV",
            voucher_id=voucher.id,
            voucher_number=voucher_number,
            debit=0.0,
            credit=data.amount,
            description=particulars,
        )

    # Audit
    db.add(AuditLog(
        user_id=posted_by_id,
        action="CREATE",
        entity_type="ReceiptVoucher",
        entity_id=voucher.id,
        description=f"Created receipt {voucher_number} for ₹{data.amount:.2f}",
        new_values={"voucher_number": voucher_number, "amount": data.amount},
    ))

    await db.commit()
    await db.refresh(voucher)
    return voucher


# ─────────────────────────────────────────────
# PAYMENT TRANSACTION
# ─────────────────────────────────────────────

async def create_payment(
    db: AsyncSession,
    data: PaymentCreate,
    posted_by_id: str,
) -> PaymentVoucher:
    # Determine if it's a pending cheque
    is_pending_cheque = False
    if data.payment_mode == "bank" and data.reference_number and "Cheque No:" in data.reference_number:
        if "Status: Cleared" not in data.reference_number:
            is_pending_cheque = True
            if "Status: Pending" not in data.reference_number:
                data.reference_number = f"{data.reference_number} | Status: Pending"

    # Check sufficient balance
    if data.payment_mode == "bank":
        if not is_pending_cheque:
            bank = await _get_bank(db, data.bank_account_id)
            if not bank.is_overdraft_allowed and bank.current_balance < data.amount:
                raise HTTPException(
                    status_code=422,
                    detail=f"Insufficient balance in {bank.name}. Available: ₹{bank.current_balance:.2f}",
                )
    else:
        cash = await _get_cash(db, data.cash_account_id)
        if cash.current_balance < data.amount:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient cash balance. Available: ₹{cash.current_balance:.2f}",
            )

    # Generate voucher number
    voucher_number = await get_next_voucher_number(db, "PAY", data.date)

    voucher = PaymentVoucher(
        voucher_number=voucher_number,
        date=data.date,
        branch_id=data.branch_id,
        paid_to=data.paid_to,
        amount=data.amount,
        payment_mode=data.payment_mode,
        bank_account_id=data.bank_account_id if data.payment_mode == "bank" else None,
        cash_account_id=data.cash_account_id if data.payment_mode == "cash" else None,
        reference_number=data.reference_number,
        narration=data.narration,
        posted_by_id=posted_by_id,
    )
    db.add(voucher)
    await db.flush()

    # Update balance (debit)
    particulars = f"Payment to {data.paid_to}"
    if data.payment_mode == "bank":
        bank = await _get_bank(db, data.bank_account_id)
        if not is_pending_cheque:
            bank.current_balance -= data.amount
        account_type = "bank"
        account_id = data.bank_account_id
    else:
        cash = await _get_cash(db, data.cash_account_id)
        cash.current_balance -= data.amount
        account_type = "cash"
        account_id = data.cash_account_id

    # Daybook entry
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="PAY",
        voucher_id=voucher.id,
        voucher_number=voucher_number,
        branch_id=data.branch_id,
        particulars=particulars,
        debit=data.amount,
        credit=0.0,
        payment_mode=data.payment_mode,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=account_type,
        account_id=account_id,
    )

    # Ledger entry
    if not is_pending_cheque:
        await _post_ledger(
            db=db,
            date=data.date,
            account_type=account_type,
            account_id=account_id,
            voucher_type="PAY",
            voucher_id=voucher.id,
            voucher_number=voucher_number,
            debit=data.amount,
            credit=0.0,
            description=particulars,
        )

    db.add(AuditLog(
        user_id=posted_by_id,
        action="CREATE",
        entity_type="PaymentVoucher",
        entity_id=voucher.id,
        description=f"Created payment {voucher_number} for ₹{data.amount:.2f}",
        new_values={"voucher_number": voucher_number, "amount": data.amount},
    ))

    await db.commit()
    await db.refresh(voucher)
    return voucher


# ─────────────────────────────────────────────
# EXPENSE TRANSACTION
# ─────────────────────────────────────────────

async def create_expense(
    db: AsyncSession,
    data: ExpenseCreate,
    posted_by_id: str,
) -> ExpenseVoucher:
    # Validate
    if data.payment_mode == "bank":
        if not data.bank_account_id:
            raise HTTPException(status_code=422, detail="Bank account is required for bank payment mode")

    if data.payment_mode == "cash" and not data.cash_account_id:
        raise HTTPException(status_code=422, detail="Cash account is required for cash payment mode")

    # Determine if it's a pending cheque
    is_pending_cheque = False
    if data.payment_mode == "bank" and data.reference_number and "Cheque No:" in data.reference_number:
        if "Status: Cleared" not in data.reference_number:
            is_pending_cheque = True
            if "Status: Pending" not in data.reference_number:
                data.reference_number = f"{data.reference_number} | Status: Pending"

    # Check sufficient balance
    if data.payment_mode == "bank":
        if not is_pending_cheque:
            bank = await _get_bank(db, data.bank_account_id)
            if not bank.is_overdraft_allowed and bank.current_balance < data.amount:
                raise HTTPException(
                    status_code=422,
                    detail=f"Insufficient balance in {bank.name}. Available: ₹{bank.current_balance:.2f}",
                )
    else:
        cash = await _get_cash(db, data.cash_account_id)
        if cash.current_balance < data.amount:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient cash balance. Available: ₹{cash.current_balance:.2f}",
            )

    # Generate voucher number
    voucher_number = await get_next_voucher_number(db, "EXP", data.date)

    voucher = ExpenseVoucher(
        voucher_number=voucher_number,
        date=data.date,
        branch_id=data.branch_id,
        paid_to=data.paid_to,
        amount=data.amount,
        payment_mode=data.payment_mode,
        bank_account_id=data.bank_account_id if data.payment_mode == "bank" else None,
        cash_account_id=data.cash_account_id if data.payment_mode == "cash" else None,
        reference_number=data.reference_number,
        narration=data.narration,
        posted_by_id=posted_by_id,
    )
    db.add(voucher)
    await db.flush()

    # Update balance (debit)
    particulars = f"Expense to {data.paid_to}"
    if data.payment_mode == "bank":
        bank = await _get_bank(db, data.bank_account_id)
        if not is_pending_cheque:
            bank.current_balance -= data.amount
        account_type = "bank"
        account_id = data.bank_account_id
    else:
        cash = await _get_cash(db, data.cash_account_id)
        cash.current_balance -= data.amount
        account_type = "cash"
        account_id = data.cash_account_id

    # Daybook entry
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="EXP",
        voucher_id=voucher.id,
        voucher_number=voucher_number,
        branch_id=data.branch_id,
        particulars=particulars,
        debit=data.amount,
        credit=0.0,
        payment_mode=data.payment_mode,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=account_type,
        account_id=account_id,
    )

    # Ledger entry
    if not is_pending_cheque:
        await _post_ledger(
            db=db,
            date=data.date,
            account_type=account_type,
            account_id=account_id,
            voucher_type="EXP",
            voucher_id=voucher.id,
            voucher_number=voucher_number,
            debit=data.amount,
            credit=0.0,
            description=particulars,
        )

    db.add(AuditLog(
        user_id=posted_by_id,
        action="CREATE",
        entity_type="ExpenseVoucher",
        entity_id=voucher.id,
        description=f"Created expense {voucher_number} for ₹{data.amount:.2f}",
        new_values={"voucher_number": voucher_number, "amount": data.amount},
    ))

    await db.commit()
    await db.refresh(voucher)
    return voucher



# ─────────────────────────────────────────────
# FUND TRANSFER
# ─────────────────────────────────────────────

async def create_fund_transfer(
    db: AsyncSession,
    data: FundTransferCreate,
    posted_by_id: str,
) -> FundTransfer:
    if data.from_account_id == data.to_account_id and data.from_account_type == data.to_account_type:
        raise HTTPException(status_code=422, detail="From and To accounts cannot be the same")

    # Validate balance on source
    if data.from_account_type == "bank":
        from_bank = await _get_bank(db, data.from_account_id)
        if not from_bank.is_overdraft_allowed and from_bank.current_balance < data.amount:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient balance in {from_bank.name}. Available: ₹{from_bank.current_balance:.2f}",
            )
        from_name = from_bank.name
    else:
        from_cash = await _get_cash(db, data.from_account_id)
        if from_cash.current_balance < data.amount:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient cash balance. Available: ₹{from_cash.current_balance:.2f}",
            )
        from_name = from_cash.name

    if data.to_account_type == "bank":
        to_bank = await _get_bank(db, data.to_account_id)
        to_name = to_bank.name
    else:
        to_cash = await _get_cash(db, data.to_account_id)
        to_name = to_cash.name

    # Generate voucher number
    voucher_number = await get_next_voucher_number(db, "TRF", data.date)

    transfer = FundTransfer(
        voucher_number=voucher_number,
        date=data.date,
        from_account_type=data.from_account_type,
        from_account_id=data.from_account_id,
        to_account_type=data.to_account_type,
        to_account_id=data.to_account_id,
        amount=data.amount,
        reference_number=data.reference_number,
        narration=data.narration,
        posted_by_id=posted_by_id,
    )
    db.add(transfer)
    await db.flush()

    # Debit source
    if data.from_account_type == "bank":
        from_bank.current_balance -= data.amount
    else:
        from_cash.current_balance -= data.amount

    # Credit destination
    if data.to_account_type == "bank":
        to_bank.current_balance += data.amount
    else:
        to_cash.current_balance += data.amount

    particulars_from = f"Transfer to {to_name}"
    particulars_to = f"Transfer from {from_name}"

    # Daybook (debit leg)
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="TRF",
        voucher_id=transfer.id,
        voucher_number=voucher_number,
        branch_id=None,
        particulars=particulars_from,
        debit=data.amount,
        credit=0.0,
        payment_mode=None,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=data.from_account_type,
        account_id=data.from_account_id,
    )

    # Daybook (credit leg)
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="TRF",
        voucher_id=transfer.id,
        voucher_number=voucher_number,
        branch_id=None,
        particulars=particulars_to,
        debit=0.0,
        credit=data.amount,
        payment_mode=None,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=data.to_account_type,
        account_id=data.to_account_id,
    )

    # Ledger (debit source)
    await _post_ledger(
        db=db,
        date=data.date,
        account_type=data.from_account_type,
        account_id=data.from_account_id,
        voucher_type="TRF",
        voucher_id=transfer.id,
        voucher_number=voucher_number,
        debit=data.amount,
        credit=0.0,
        description=particulars_from,
    )

    # Ledger (credit destination)
    await _post_ledger(
        db=db,
        date=data.date,
        account_type=data.to_account_type,
        account_id=data.to_account_id,
        voucher_type="TRF",
        voucher_id=transfer.id,
        voucher_number=voucher_number,
        debit=0.0,
        credit=data.amount,
        description=particulars_to,
    )

    db.add(AuditLog(
        user_id=posted_by_id,
        action="CREATE",
        entity_type="FundTransfer",
        entity_id=transfer.id,
        description=f"Transfer {voucher_number}: {from_name} → {to_name} ₹{data.amount:.2f}",
        new_values={"voucher_number": voucher_number, "amount": data.amount},
    ))

    await db.commit()
    await db.refresh(transfer)
    return transfer


# ─────────────────────────────────────────────
# REVERSAL
# ─────────────────────────────────────────────

async def reverse_receipt(
    db: AsyncSession,
    receipt_id: str,
    posted_by_id: str,
    reason: str = "Reversal",
) -> ReceiptVoucher:
    result = await db.execute(select(ReceiptVoucher).where(ReceiptVoucher.id == receipt_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Receipt voucher not found")
    if original.is_reversed:
        raise HTTPException(status_code=422, detail="This voucher is already reversed")

    # Create reversal via create_receipt with negative-equivalent (actually reverse payment)
    rev_voucher_number = await get_next_voucher_number(db, "RCV", date.today())
    reversal = ReceiptVoucher(
        voucher_number=rev_voucher_number,
        date=date.today(),
        branch_id=original.branch_id,
        received_from=original.received_from,
        amount=original.amount,
        payment_mode=original.payment_mode,
        bank_account_id=original.bank_account_id,
        cash_account_id=original.cash_account_id,
        reference_number=original.reference_number,
        narration=f"REVERSAL of {original.voucher_number}: {reason}",
        is_reversed=False,
        reversal_of_id=original.id,
        posted_by_id=posted_by_id,
    )
    db.add(reversal)

    # Mark original as reversed
    original.is_reversed = True

    # Reverse the balance impact
    is_pending_cheque = (original.payment_mode == "bank" and original.reference_number and "Cheque No:" in original.reference_number and "Status: Pending" in original.reference_number)
    if original.payment_mode == "bank":
        bank = await _get_bank(db, original.bank_account_id)
        if not is_pending_cheque:
            bank.current_balance -= original.amount
        account_type = "bank"
        account_id = original.bank_account_id
    else:
        cash = await _get_cash(db, original.cash_account_id)
        cash.current_balance -= original.amount
        account_type = "cash"
        account_id = original.cash_account_id

    await db.flush()
    particulars = f"REVERSAL: Receipt from {original.received_from}"
    await _post_daybook(
        db=db, date=date.today(), voucher_type="RCV", voucher_id=reversal.id,
        voucher_number=rev_voucher_number, branch_id=original.branch_id,
        particulars=particulars, debit=original.amount, credit=0.0,
        payment_mode=original.payment_mode, reference_number=original.reference_number,
        narration=reversal.narration, account_type=account_type, account_id=account_id,
    )
    if not is_pending_cheque:
        await _post_ledger(
            db=db, date=date.today(), account_type=account_type, account_id=account_id,
            voucher_type="RCV", voucher_id=reversal.id, voucher_number=rev_voucher_number,
            debit=original.amount, credit=0.0, description=particulars,
        )

    db.add(AuditLog(
        user_id=posted_by_id,
        action="REVERSE",
        entity_type="ReceiptVoucher",
        entity_id=original.id,
        description=f"Reversed receipt {original.voucher_number}. Reversal: {rev_voucher_number}",
    ))

    await db.commit()
    await db.refresh(reversal)
    return reversal


async def reverse_payment(
    db: AsyncSession,
    payment_id: str,
    posted_by_id: str,
    reason: str = "Reversal",
) -> PaymentVoucher:
    result = await db.execute(select(PaymentVoucher).where(PaymentVoucher.id == payment_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Payment voucher not found")
    if original.is_reversed:
        raise HTTPException(status_code=422, detail="This voucher is already reversed")

    rev_voucher_number = await get_next_voucher_number(db, "PAY", date.today())
    reversal = PaymentVoucher(
        voucher_number=rev_voucher_number,
        date=date.today(),
        branch_id=original.branch_id,
        paid_to=original.paid_to,
        amount=original.amount,
        payment_mode=original.payment_mode,
        bank_account_id=original.bank_account_id,
        cash_account_id=original.cash_account_id,
        reference_number=original.reference_number,
        narration=f"REVERSAL of {original.voucher_number}: {reason}",
        is_reversed=False,
        reversal_of_id=original.id,
        posted_by_id=posted_by_id,
    )
    db.add(reversal)
    original.is_reversed = True

    # Reverse the balance (credit back)
    is_pending_cheque = (original.payment_mode == "bank" and original.reference_number and "Cheque No:" in original.reference_number and "Status: Pending" in original.reference_number)
    if original.payment_mode == "bank":
        bank = await _get_bank(db, original.bank_account_id)
        if not is_pending_cheque:
            bank.current_balance += original.amount
        account_type = "bank"
        account_id = original.bank_account_id
    else:
        cash = await _get_cash(db, original.cash_account_id)
        cash.current_balance += original.amount
        account_type = "cash"
        account_id = original.cash_account_id

    await db.flush()
    particulars = f"REVERSAL: Payment to {original.paid_to}"
    await _post_daybook(
        db=db, date=date.today(), voucher_type="PAY", voucher_id=reversal.id,
        voucher_number=rev_voucher_number, branch_id=original.branch_id,
        particulars=particulars, debit=0.0, credit=original.amount,
        payment_mode=original.payment_mode, reference_number=original.reference_number,
        narration=reversal.narration, account_type=account_type, account_id=account_id,
    )
    if not is_pending_cheque:
        await _post_ledger(
            db=db, date=date.today(), account_type=account_type, account_id=account_id,
            voucher_type="PAY", voucher_id=reversal.id, voucher_number=rev_voucher_number,
            debit=0.0, credit=original.amount, description=particulars,
        )

    db.add(AuditLog(
        user_id=posted_by_id,
        action="REVERSE",
        entity_type="PaymentVoucher",
        entity_id=original.id,
        description=f"Reversed payment {original.voucher_number}. Reversal: {rev_voucher_number}",
    ))

    await db.commit()
    await db.refresh(reversal)
    return reversal


async def reverse_expense(
    db: AsyncSession,
    expense_id: str,
    posted_by_id: str,
    reason: str = "Reversal",
) -> ExpenseVoucher:
    result = await db.execute(select(ExpenseVoucher).where(ExpenseVoucher.id == expense_id))
    original = result.scalar_one_or_none()
    if not original:
        raise HTTPException(status_code=404, detail="Expense voucher not found")
    if original.is_reversed:
        raise HTTPException(status_code=422, detail="This voucher is already reversed")

    rev_voucher_number = await get_next_voucher_number(db, "EXP", date.today())
    reversal = ExpenseVoucher(
        voucher_number=rev_voucher_number,
        date=date.today(),
        branch_id=original.branch_id,
        paid_to=original.paid_to,
        amount=original.amount,
        payment_mode=original.payment_mode,
        bank_account_id=original.bank_account_id,
        cash_account_id=original.cash_account_id,
        reference_number=original.reference_number,
        narration=f"REVERSAL of {original.voucher_number}: {reason}",
        is_reversed=False,
        reversal_of_id=original.id,
        posted_by_id=posted_by_id,
    )
    db.add(reversal)
    original.is_reversed = True

    # Reverse the balance (credit back)
    is_pending_cheque = (original.payment_mode == "bank" and original.reference_number and "Cheque No:" in original.reference_number and "Status: Pending" in original.reference_number)
    if original.payment_mode == "bank":
        bank = await _get_bank(db, original.bank_account_id)
        if not is_pending_cheque:
            bank.current_balance += original.amount
        account_type = "bank"
        account_id = original.bank_account_id
    else:
        cash = await _get_cash(db, original.cash_account_id)
        cash.current_balance += original.amount
        account_type = "cash"
        account_id = original.cash_account_id

    await db.flush()
    particulars = f"REVERSAL: Expense to {original.paid_to}"
    await _post_daybook(
        db=db, date=date.today(), voucher_type="EXP", voucher_id=reversal.id,
        voucher_number=rev_voucher_number, branch_id=original.branch_id,
        particulars=particulars, debit=0.0, credit=original.amount,
        payment_mode=original.payment_mode, reference_number=original.reference_number,
        narration=reversal.narration, account_type=account_type, account_id=account_id,
    )
    if not is_pending_cheque:
        await _post_ledger(
            db=db, date=date.today(), account_type=account_type, account_id=account_id,
            voucher_type="EXP", voucher_id=reversal.id, voucher_number=rev_voucher_number,
            debit=0.0, credit=original.amount, description=particulars,
        )

    db.add(AuditLog(
        user_id=posted_by_id,
        action="REVERSE",
        entity_type="ExpenseVoucher",
        entity_id=original.id,
        description=f"Reversed expense {original.voucher_number}. Reversal: {rev_voucher_number}",
    ))

    await db.commit()
    await db.refresh(reversal)
    return reversal



# ─────────────────────────────────────────────
# DASHBOARD SUMMARY
# ─────────────────────────────────────────────

async def get_dashboard_summary(db: AsyncSession) -> DashboardSummaryOut:
    today = date.today()

    # Total bank balances
    banks_result = await db.execute(
        select(BankAccount).where(BankAccount.status == "active")
    )
    banks = banks_result.scalars().all()

    cash_result = await db.execute(
        select(CashAccount).where(CashAccount.status == "active")
    )
    cashes = cash_result.scalars().all()

    total_bank_balance = sum(b.current_balance for b in banks)
    total_cash_balance = sum(c.current_balance for c in cashes)

    account_tiles = [
        BalanceTileOut(id=b.id, name=b.name, balance=b.current_balance, account_type="bank")
        for b in banks
    ] + [
        BalanceTileOut(id=c.id, name=c.name, balance=c.current_balance, account_type="cash")
        for c in cashes
    ]

    # Today's receipts
    today_rcv_result = await db.execute(
        select(func.coalesce(func.sum(ReceiptVoucher.amount), 0.0))
        .where(ReceiptVoucher.date == today, ReceiptVoucher.is_reversed == False)
    )
    today_receipts = float(today_rcv_result.scalar())

    # Today's payments
    today_pay_result = await db.execute(
        select(func.coalesce(func.sum(PaymentVoucher.amount), 0.0))
        .where(PaymentVoucher.date == today, PaymentVoucher.is_reversed == False)
    )
    today_payments = float(today_pay_result.scalar())

    # Today's expenses
    today_exp_result = await db.execute(
        select(func.coalesce(func.sum(ExpenseVoucher.amount), 0.0))
        .where(ExpenseVoucher.date == today, ExpenseVoucher.is_reversed == False)
    )
    today_expenses = float(today_exp_result.scalar())

    # Branch collection today
    branch_today_result = await db.execute(
        select(func.coalesce(func.sum(ReceiptVoucher.amount), 0.0))
        .where(
            ReceiptVoucher.date == today,
            ReceiptVoucher.is_reversed == False,
            ReceiptVoucher.branch_id.isnot(None),
        )
    )
    branch_collection_today = float(branch_today_result.scalar())

    # Today's cheques calculations (based on Date: YYYY-MM-DD pattern in reference number)
    today_str = today.strftime("%Y-%m-%d")
    
    # Received cheques clearing today (Pending and Date is today)
    rcv_cheques_result = await db.execute(
        select(ReceiptVoucher)
        .where(
            ReceiptVoucher.payment_mode == "bank",
            ReceiptVoucher.is_reversed == False,
            ReceiptVoucher.reference_number.like(f"%Date: {today_str}%"),
            ReceiptVoucher.reference_number.like("%Status: Pending%")
        )
    )
    today_received_cheques_clear = float(sum(v.amount for v in rcv_cheques_result.scalars().all()))

    # Given cheques clearing today (Pending and Date is today)
    pay_cheques_result = await db.execute(
        select(PaymentVoucher)
        .where(
            PaymentVoucher.payment_mode == "bank",
            PaymentVoucher.is_reversed == False,
            PaymentVoucher.reference_number.like(f"%Date: {today_str}%"),
            PaymentVoucher.reference_number.like("%Status: Pending%")
        )
    )
    exp_cheques_result = await db.execute(
        select(ExpenseVoucher)
        .where(
            ExpenseVoucher.payment_mode == "bank",
            ExpenseVoucher.is_reversed == False,
            ExpenseVoucher.reference_number.like(f"%Date: {today_str}%"),
            ExpenseVoucher.reference_number.like("%Status: Pending%")
        )
    )
    today_given_cheques_clear = float(
        sum(v.amount for v in pay_cheques_result.scalars().all()) + 
        sum(v.amount for v in exp_cheques_result.scalars().all())
    )

    kpis = DashboardKPIOut(
        total_bank_balance=total_bank_balance,
        total_cash_balance=total_cash_balance,
        today_receipts=today_receipts,
        today_payments=today_payments,
        today_expenses=today_expenses,
        branch_collection_today=branch_collection_today,
        account_tiles=account_tiles,
        today_received_cheques_clear=today_received_cheques_clear,
        today_given_cheques_clear=today_given_cheques_clear,
    )

    # Monthly flow (last 6 months)
    from dateutil.relativedelta import relativedelta
    monthly_flow = []
    for i in range(5, -1, -1):
        m_date = today - relativedelta(months=i)
        m_start = m_date.replace(day=1)
        if m_date.month == 12:
            m_end = m_date.replace(month=12, day=31)
        else:
            m_end = (m_date.replace(month=m_date.month + 1, day=1) - relativedelta(days=1))

        rcv_result = await db.execute(
            select(func.coalesce(func.sum(ReceiptVoucher.amount), 0.0))
            .where(
                ReceiptVoucher.date >= m_start,
                ReceiptVoucher.date <= m_end,
                ReceiptVoucher.is_reversed == False,
            )
        )
        pay_result = await db.execute(
            select(func.coalesce(func.sum(PaymentVoucher.amount), 0.0))
            .where(
                PaymentVoucher.date >= m_start,
                PaymentVoucher.date <= m_end,
                PaymentVoucher.is_reversed == False,
            )
        )
        exp_result = await db.execute(
            select(func.coalesce(func.sum(ExpenseVoucher.amount), 0.0))
            .where(
                ExpenseVoucher.date >= m_start,
                ExpenseVoucher.date <= m_end,
                ExpenseVoucher.is_reversed == False,
            )
        )
        monthly_flow.append(MonthlyFlowPoint(
            month=m_date.strftime("%b %Y"),
            receipts=float(rcv_result.scalar()),
            payments=float(pay_result.scalar()),
            expenses=float(exp_result.scalar()),
        ))

    # Top branch collections (current month)
    from sqlalchemy import desc
    month_start = today.replace(day=1)
    branch_rows = await db.execute(
        select(Branch.name, Branch.code, func.coalesce(func.sum(ReceiptVoucher.amount), 0.0).label("total"))
        .join(ReceiptVoucher, ReceiptVoucher.branch_id == Branch.id, isouter=True)
        .where(
            or_(ReceiptVoucher.date.is_(None), ReceiptVoucher.date >= month_start),
            or_(ReceiptVoucher.is_reversed.is_(None), ReceiptVoucher.is_reversed == False),
        )
        .group_by(Branch.id, Branch.name, Branch.code)
        .order_by(desc("total"))
        .limit(6)
    )
    top_branch_collections = [
        BranchCollectionPoint(branch_name=row.name, branch_code=row.code, amount=float(row.total))
        for row in branch_rows
    ]

    # Recent transactions (last 10)
    recent = []
    rcv_rows = await db.execute(
        select(ReceiptVoucher)
        .where(ReceiptVoucher.is_reversed == False)
        .order_by(ReceiptVoucher.date.desc(), ReceiptVoucher.created_at.desc())
        .limit(5)
    )
    for v in rcv_rows.scalars().all():
        recent.append({
            "id": v.id,
            "type": "Receipt",
            "voucher_number": v.voucher_number,
            "party": v.received_from,
            "amount": v.amount,
            "date": v.date.isoformat(),
            "payment_mode": v.payment_mode,
        })

    pay_rows = await db.execute(
        select(PaymentVoucher)
        .where(PaymentVoucher.is_reversed == False)
        .order_by(PaymentVoucher.date.desc(), PaymentVoucher.created_at.desc())
        .limit(5)
    )
    for v in pay_rows.scalars().all():
        recent.append({
            "id": v.id,
            "type": "Payment",
            "voucher_number": v.voucher_number,
            "party": v.paid_to,
            "amount": v.amount,
            "date": v.date.isoformat(),
            "payment_mode": v.payment_mode,
        })

    exp_rows = await db.execute(
        select(ExpenseVoucher)
        .where(ExpenseVoucher.is_reversed == False)
        .order_by(ExpenseVoucher.date.desc(), ExpenseVoucher.created_at.desc())
        .limit(5)
    )
    for v in exp_rows.scalars().all():
        recent.append({
            "id": v.id,
            "type": "Expense",
            "voucher_number": v.voucher_number,
            "party": v.paid_to,
            "amount": v.amount,
            "date": v.date.isoformat(),
            "payment_mode": v.payment_mode,
        })

    recent.sort(key=lambda x: x["date"], reverse=True)

    return DashboardSummaryOut(
        kpis=kpis,
        monthly_flow=monthly_flow,
        top_branch_collections=top_branch_collections,
        recent_transactions=recent[:10],
    )


# ─────────────────────────────────────────────
# EDITING RECORDS & RECALCULATING BALANCES
# ─────────────────────────────────────────────

async def recalculate_ledger_balances(db: AsyncSession, account_type: str, account_id: str) -> None:
    if not account_id:
        return
    # 1. Get opening balance of the account
    if account_type == "bank":
        acc_result = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
        acc = acc_result.scalar_one_or_none()
        opening_balance = acc.opening_balance if acc else 0.0
    elif account_type == "cash":
        acc_result = await db.execute(select(CashAccount).where(CashAccount.id == account_id))
        acc = acc_result.scalar_one_or_none()
        opening_balance = acc.opening_balance if acc else 0.0
    else:
        opening_balance = 0.0

    # 2. Get all ledger entries sorted by date, then created_at
    result = await db.execute(
        select(LedgerEntry)
        .where(LedgerEntry.account_type == account_type, LedgerEntry.account_id == account_id)
        .order_by(LedgerEntry.date.asc(), LedgerEntry.created_at.asc())
    )
    entries = result.scalars().all()

    # 3. Recalculate and update
    current_bal = opening_balance
    for entry in entries:
        current_bal = current_bal + entry.credit - entry.debit
        entry.running_balance = current_bal


async def update_receipt(
    db: AsyncSession,
    receipt_id: str,
    data: ReceiptCreate,
    posted_by_id: str,
) -> ReceiptVoucher:
    # 1. Fetch existing voucher
    result = await db.execute(select(ReceiptVoucher).where(ReceiptVoucher.id == receipt_id))
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=404, detail="Receipt voucher not found")
    if voucher.is_reversed:
        raise HTTPException(status_code=400, detail="Cannot edit a reversed voucher")

    old_payment_mode = voucher.payment_mode
    old_amount = voucher.amount
    old_bank_id = voucher.bank_account_id
    old_cash_id = voucher.cash_account_id

    # 2. Validate input
    if data.payment_mode == "bank" and not data.bank_account_id:
        raise HTTPException(status_code=422, detail="Bank account is required for bank payment mode")
    if data.payment_mode == "cash" and not data.cash_account_id:
        raise HTTPException(status_code=422, detail="Cash account is required for cash payment mode")

    # 3. Revert old balance impact
    if old_payment_mode == "bank" and old_bank_id:
        old_bank = await _get_bank(db, old_bank_id)
        old_bank.current_balance -= old_amount
    elif old_payment_mode == "cash" and old_cash_id:
        old_cash = await _get_cash(db, old_cash_id)
        old_cash.current_balance -= old_amount

    # 4. Apply new balance impact
    if data.payment_mode == "bank":
        new_bank = await _get_bank(db, data.bank_account_id)
        new_bank.current_balance += data.amount
        account_type = "bank"
        account_id = data.bank_account_id
    else:
        new_cash = await _get_cash(db, data.cash_account_id)
        new_cash.current_balance += data.amount
        account_type = "cash"
        account_id = data.cash_account_id

    # 5. Delete old DaybookEntry and LedgerEntry
    await db.execute(delete(DaybookEntry).where(DaybookEntry.voucher_id == voucher.id, DaybookEntry.voucher_type == "RCV"))
    await db.execute(delete(LedgerEntry).where(LedgerEntry.voucher_id == voucher.id, LedgerEntry.voucher_type == "RCV"))

    # 6. Update voucher fields
    voucher.date = data.date
    voucher.branch_id = data.branch_id
    voucher.received_from = data.received_from
    voucher.amount = data.amount
    voucher.payment_mode = data.payment_mode
    voucher.bank_account_id = data.bank_account_id if data.payment_mode == "bank" else None
    voucher.cash_account_id = data.cash_account_id if data.payment_mode == "cash" else None
    voucher.reference_number = data.reference_number
    voucher.narration = data.narration

    # 7. Post new DaybookEntry
    particulars = f"Receipt from {data.received_from}"
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="RCV",
        voucher_id=voucher.id,
        voucher_number=voucher.voucher_number,
        branch_id=data.branch_id,
        particulars=particulars,
        debit=0.0,
        credit=data.amount,
        payment_mode=data.payment_mode,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=account_type,
        account_id=account_id,
    )

    # 8. Post new LedgerEntry
    await _post_ledger(
        db=db,
        date=data.date,
        account_type=account_type,
        account_id=account_id,
        voucher_type="RCV",
        voucher_id=voucher.id,
        voucher_number=voucher.voucher_number,
        debit=0.0,
        credit=data.amount,
        description=particulars,
    )

    # 9. Recalculate ledger balances for affected accounts
    await recalculate_ledger_balances(db, old_payment_mode, old_bank_id if old_payment_mode == "bank" else old_cash_id)
    if (old_payment_mode != data.payment_mode) or (old_payment_mode == "bank" and old_bank_id != data.bank_account_id) or (old_payment_mode == "cash" and old_cash_id != data.cash_account_id):
        await recalculate_ledger_balances(db, account_type, account_id)

    # 10. Audit log
    db.add(AuditLog(
        user_id=posted_by_id,
        action="UPDATE",
        entity_type="ReceiptVoucher",
        entity_id=voucher.id,
        description=f"Updated receipt {voucher.voucher_number} to ₹{data.amount:.2f}",
        new_values={"voucher_number": voucher.voucher_number, "amount": data.amount},
    ))

    await db.commit()
    await db.refresh(voucher)
    return voucher


async def update_payment(
    db: AsyncSession,
    payment_id: str,
    data: PaymentCreate,
    posted_by_id: str,
) -> PaymentVoucher:
    # 1. Fetch existing voucher
    result = await db.execute(select(PaymentVoucher).where(PaymentVoucher.id == payment_id))
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=404, detail="Payment voucher not found")
    if voucher.is_reversed:
        raise HTTPException(status_code=400, detail="Cannot edit a reversed voucher")

    old_payment_mode = voucher.payment_mode
    old_amount = voucher.amount
    old_bank_id = voucher.bank_account_id
    old_cash_id = voucher.cash_account_id

    # 2. Validate input
    if data.payment_mode == "bank" and not data.bank_account_id:
        raise HTTPException(status_code=422, detail="Bank account is required for bank payment mode")
    if data.payment_mode == "cash" and not data.cash_account_id:
        raise HTTPException(status_code=422, detail="Cash account is required for cash payment mode")

    # 3. Revert old balance impact
    if old_payment_mode == "bank" and old_bank_id:
        old_bank = await _get_bank(db, old_bank_id)
        old_bank.current_balance += old_amount
    elif old_payment_mode == "cash" and old_cash_id:
        old_cash = await _get_cash(db, old_cash_id)
        old_cash.current_balance += old_amount

    # 4. Check sufficient balance and apply new impact
    if data.payment_mode == "bank":
        new_bank = await _get_bank(db, data.bank_account_id)
        if not new_bank.is_overdraft_allowed and new_bank.current_balance < data.amount:
            # Revert the balance changes we made in step 3
            if old_payment_mode == "bank" and old_bank_id:
                old_bank.current_balance -= old_amount
            elif old_payment_mode == "cash" and old_cash_id:
                old_cash.current_balance -= old_amount
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient balance in {new_bank.name}. Available: ₹{new_bank.current_balance:.2f}",
            )
        new_bank.current_balance -= data.amount
        account_type = "bank"
        account_id = data.bank_account_id
    else:
        new_cash = await _get_cash(db, data.cash_account_id)
        if new_cash.current_balance < data.amount:
            # Revert the balance changes we made in step 3
            if old_payment_mode == "bank" and old_bank_id:
                old_bank.current_balance -= old_amount
            elif old_payment_mode == "cash" and old_cash_id:
                old_cash.current_balance -= old_amount
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient cash balance. Available: ₹{new_cash.current_balance:.2f}",
            )
        new_cash.current_balance -= data.amount
        account_type = "cash"
        account_id = data.cash_account_id

    # 5. Delete old DaybookEntry and LedgerEntry
    await db.execute(delete(DaybookEntry).where(DaybookEntry.voucher_id == voucher.id, DaybookEntry.voucher_type == "PAY"))
    await db.execute(delete(LedgerEntry).where(LedgerEntry.voucher_id == voucher.id, LedgerEntry.voucher_type == "PAY"))

    # 6. Update voucher fields
    voucher.date = data.date
    voucher.branch_id = data.branch_id
    voucher.paid_to = data.paid_to
    voucher.amount = data.amount
    voucher.payment_mode = data.payment_mode
    voucher.bank_account_id = data.bank_account_id if data.payment_mode == "bank" else None
    voucher.cash_account_id = data.cash_account_id if data.payment_mode == "cash" else None
    voucher.reference_number = data.reference_number
    voucher.narration = data.narration

    # 7. Post new DaybookEntry
    particulars = f"Payment to {data.paid_to}"
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="PAY",
        voucher_id=voucher.id,
        voucher_number=voucher.voucher_number,
        branch_id=data.branch_id,
        particulars=particulars,
        debit=data.amount,
        credit=0.0,
        payment_mode=data.payment_mode,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=account_type,
        account_id=account_id,
    )

    # 8. Post new LedgerEntry
    await _post_ledger(
        db=db,
        date=data.date,
        account_type=account_type,
        account_id=account_id,
        voucher_type="PAY",
        voucher_id=voucher.id,
        voucher_number=voucher.voucher_number,
        debit=data.amount,
        credit=0.0,
        description=particulars,
    )

    # 9. Recalculate ledger balances for affected accounts
    await recalculate_ledger_balances(db, old_payment_mode, old_bank_id if old_payment_mode == "bank" else old_cash_id)
    if (old_payment_mode != data.payment_mode) or (old_payment_mode == "bank" and old_bank_id != data.bank_account_id) or (old_payment_mode == "cash" and old_cash_id != data.cash_account_id):
        await recalculate_ledger_balances(db, account_type, account_id)

    # 10. Audit log
    db.add(AuditLog(
        user_id=posted_by_id,
        action="UPDATE",
        entity_type="PaymentVoucher",
        entity_id=voucher.id,
        description=f"Updated payment {voucher.voucher_number} to ₹{data.amount:.2f}",
        new_values={"voucher_number": voucher.voucher_number, "amount": data.amount},
    ))

    await db.commit()
    await db.refresh(voucher)
    return voucher


async def update_expense(
    db: AsyncSession,
    expense_id: str,
    data: ExpenseCreate,
    posted_by_id: str,
) -> ExpenseVoucher:
    # 1. Fetch existing voucher
    result = await db.execute(select(ExpenseVoucher).where(ExpenseVoucher.id == expense_id))
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=404, detail="Expense voucher not found")
    if voucher.is_reversed:
        raise HTTPException(status_code=400, detail="Cannot edit a reversed voucher")

    old_payment_mode = voucher.payment_mode
    old_amount = voucher.amount
    old_bank_id = voucher.bank_account_id
    old_cash_id = voucher.cash_account_id

    # 2. Validate input
    if data.payment_mode == "bank" and not data.bank_account_id:
        raise HTTPException(status_code=422, detail="Bank account is required for bank payment mode")
    if data.payment_mode == "cash" and not data.cash_account_id:
        raise HTTPException(status_code=422, detail="Cash account is required for cash payment mode")

    # 3. Revert old balance impact
    if old_payment_mode == "bank" and old_bank_id:
        old_bank = await _get_bank(db, old_bank_id)
        old_bank.current_balance += old_amount
    elif old_payment_mode == "cash" and old_cash_id:
        old_cash = await _get_cash(db, old_cash_id)
        old_cash.current_balance += old_amount

    # 4. Check sufficient balance and apply new impact
    if data.payment_mode == "bank":
        new_bank = await _get_bank(db, data.bank_account_id)
        if not new_bank.is_overdraft_allowed and new_bank.current_balance < data.amount:
            # Revert the balance changes we made in step 3
            if old_payment_mode == "bank" and old_bank_id:
                old_bank.current_balance -= old_amount
            elif old_payment_mode == "cash" and old_cash_id:
                old_cash.current_balance -= old_amount
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient balance in {new_bank.name}. Available: ₹{new_bank.current_balance:.2f}",
            )
        new_bank.current_balance -= data.amount
        account_type = "bank"
        account_id = data.bank_account_id
    else:
        new_cash = await _get_cash(db, data.cash_account_id)
        if new_cash.current_balance < data.amount:
            # Revert the balance changes we made in step 3
            if old_payment_mode == "bank" and old_bank_id:
                old_bank.current_balance -= old_amount
            elif old_payment_mode == "cash" and old_cash_id:
                old_cash.current_balance -= old_amount
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient cash balance. Available: ₹{new_cash.current_balance:.2f}",
            )
        new_cash.current_balance -= data.amount
        account_type = "cash"
        account_id = data.cash_account_id

    # 5. Delete old DaybookEntry and LedgerEntry
    await db.execute(delete(DaybookEntry).where(DaybookEntry.voucher_id == voucher.id, DaybookEntry.voucher_type == "EXP"))
    await db.execute(delete(LedgerEntry).where(LedgerEntry.voucher_id == voucher.id, LedgerEntry.voucher_type == "EXP"))

    # 6. Update voucher fields
    voucher.date = data.date
    voucher.branch_id = data.branch_id
    voucher.paid_to = data.paid_to
    voucher.amount = data.amount
    voucher.payment_mode = data.payment_mode
    voucher.bank_account_id = data.bank_account_id if data.payment_mode == "bank" else None
    voucher.cash_account_id = data.cash_account_id if data.payment_mode == "cash" else None
    voucher.reference_number = data.reference_number
    voucher.narration = data.narration

    # 7. Post new DaybookEntry
    particulars = f"Expense to {data.paid_to}"
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="EXP",
        voucher_id=voucher.id,
        voucher_number=voucher.voucher_number,
        branch_id=data.branch_id,
        particulars=particulars,
        debit=data.amount,
        credit=0.0,
        payment_mode=data.payment_mode,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=account_type,
        account_id=account_id,
    )

    # 8. Post new LedgerEntry
    await _post_ledger(
        db=db,
        date=data.date,
        account_type=account_type,
        account_id=account_id,
        voucher_type="EXP",
        voucher_id=voucher.id,
        voucher_number=voucher.voucher_number,
        debit=data.amount,
        credit=0.0,
        description=particulars,
    )

    # 9. Recalculate ledger balances for affected accounts
    await recalculate_ledger_balances(db, old_payment_mode, old_bank_id if old_payment_mode == "bank" else old_cash_id)
    if (old_payment_mode != data.payment_mode) or (old_payment_mode == "bank" and old_bank_id != data.bank_account_id) or (old_payment_mode == "cash" and old_cash_id != data.cash_account_id):
        await recalculate_ledger_balances(db, account_type, account_id)

    # 10. Audit log
    db.add(AuditLog(
        user_id=posted_by_id,
        action="UPDATE",
        entity_type="ExpenseVoucher",
        entity_id=voucher.id,
        description=f"Updated expense {voucher.voucher_number} to ₹{data.amount:.2f}",
        new_values={"voucher_number": voucher.voucher_number, "amount": data.amount},
    ))

    await db.commit()
    await db.refresh(voucher)
    return voucher



async def update_fund_transfer(
    db: AsyncSession,
    transfer_id: str,
    data: FundTransferCreate,
    posted_by_id: str,
) -> FundTransfer:
    # 1. Fetch existing voucher
    result = await db.execute(select(FundTransfer).where(FundTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Fund transfer not found")

    if data.from_account_id == data.to_account_id and data.from_account_type == data.to_account_type:
        raise HTTPException(status_code=422, detail="From and To accounts cannot be the same")

    old_from_type = transfer.from_account_type
    old_from_id = transfer.from_account_id
    old_to_type = transfer.to_account_type
    old_to_id = transfer.to_account_id
    old_amount = transfer.amount

    # 2. Revert old balance impact:
    # Source was debited, so add back amount
    if old_from_type == "bank":
        old_from_bank = await _get_bank(db, old_from_id)
        old_from_bank.current_balance += old_amount
    else:
        old_from_cash = await _get_cash(db, old_from_id)
        old_from_cash.current_balance += old_amount

    # Destination was credited, so subtract amount
    if old_to_type == "bank":
        old_to_bank = await _get_bank(db, old_to_id)
        old_to_bank.current_balance -= old_amount
    else:
        old_to_cash = await _get_cash(db, old_to_id)
        old_to_cash.current_balance -= old_amount

    # 3. Check sufficient balance and apply new impact
    if data.from_account_type == "bank":
        new_from_bank = await _get_bank(db, data.from_account_id)
        if not new_from_bank.is_overdraft_allowed and new_from_bank.current_balance < data.amount:
            # Revert the balance changes we made in step 2
            if old_from_type == "bank":
                old_from_bank.current_balance -= old_amount
            else:
                old_from_cash.current_balance -= old_amount
            if old_to_type == "bank":
                old_to_bank.current_balance += old_amount
            else:
                old_to_cash.current_balance += old_amount
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient balance in {new_from_bank.name}. Available: ₹{new_from_bank.current_balance:.2f}",
            )
        new_from_bank.current_balance -= data.amount
        from_name = new_from_bank.name
    else:
        new_from_cash = await _get_cash(db, data.from_account_id)
        if new_from_cash.current_balance < data.amount:
            # Revert the balance changes we made in step 2
            if old_from_type == "bank":
                old_from_bank.current_balance -= old_amount
            else:
                old_from_cash.current_balance -= old_amount
            if old_to_type == "bank":
                old_to_bank.current_balance += old_amount
            else:
                old_to_cash.current_balance += old_amount
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient cash balance. Available: ₹{new_from_cash.current_balance:.2f}",
            )
        new_from_cash.current_balance -= data.amount
        from_name = new_from_cash.name

    if data.to_account_type == "bank":
        new_to_bank = await _get_bank(db, data.to_account_id)
        new_to_bank.current_balance += data.amount
        to_name = new_to_bank.name
    else:
        new_to_cash = await _get_cash(db, data.to_account_id)
        new_to_cash.current_balance += data.amount
        to_name = new_to_cash.name

    # 4. Delete old DaybookEntry and LedgerEntry records
    await db.execute(delete(DaybookEntry).where(DaybookEntry.voucher_id == transfer.id, DaybookEntry.voucher_type == "TRF"))
    await db.execute(delete(LedgerEntry).where(LedgerEntry.voucher_id == transfer.id, LedgerEntry.voucher_type == "TRF"))

    # 5. Update transfer fields
    transfer.date = data.date
    transfer.from_account_type = data.from_account_type
    transfer.from_account_id = data.from_account_id
    transfer.to_account_type = data.to_account_type
    transfer.to_account_id = data.to_account_id
    transfer.amount = data.amount
    transfer.reference_number = data.reference_number
    transfer.narration = data.narration

    # 6. Post new Daybook entries (both legs)
    particulars_from = f"Transfer to {to_name}"
    particulars_to = f"Transfer from {from_name}"

    # Daybook (debit leg)
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="TRF",
        voucher_id=transfer.id,
        voucher_number=transfer.voucher_number,
        branch_id=None,
        particulars=particulars_from,
        debit=data.amount,
        credit=0.0,
        payment_mode=None,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=data.from_account_type,
        account_id=data.from_account_id,
    )

    # Daybook (credit leg)
    await _post_daybook(
        db=db,
        date=data.date,
        voucher_type="TRF",
        voucher_id=transfer.id,
        voucher_number=transfer.voucher_number,
        branch_id=None,
        particulars=particulars_to,
        debit=0.0,
        credit=data.amount,
        payment_mode=None,
        reference_number=data.reference_number,
        narration=data.narration,
        account_type=data.to_account_type,
        account_id=data.to_account_id,
    )

    # Ledger (debit source)
    await _post_ledger(
        db=db,
        date=data.date,
        account_type=data.from_account_type,
        account_id=data.from_account_id,
        voucher_type="TRF",
        voucher_id=transfer.id,
        voucher_number=transfer.voucher_number,
        debit=data.amount,
        credit=0.0,
        description=particulars_from,
    )

    # Ledger (credit destination)
    await _post_ledger(
        db=db,
        date=data.date,
        account_type=data.to_account_type,
        account_id=data.to_account_id,
        voucher_type="TRF",
        voucher_id=transfer.id,
        voucher_number=transfer.voucher_number,
        debit=0.0,
        credit=data.amount,
        description=particulars_to,
    )

    # 7. Recalculate ledger balances for affected accounts
    await recalculate_ledger_balances(db, old_from_type, old_from_id)
    await recalculate_ledger_balances(db, old_to_type, old_to_id)
    if (old_from_type != data.from_account_type) or (old_from_id != data.from_account_id):
        await recalculate_ledger_balances(db, data.from_account_type, data.from_account_id)
    if (old_to_type != data.to_account_type) or (old_to_id != data.to_account_id):
        await recalculate_ledger_balances(db, data.to_account_type, data.to_account_id)

    # 8. Audit log
    db.add(AuditLog(
        user_id=posted_by_id,
        action="UPDATE",
        entity_type="FundTransfer",
        entity_id=transfer.id,
        description=f"Updated transfer {transfer.voucher_number}: {from_name} → {to_name} ₹{data.amount:.2f}",
        new_values={"voucher_number": transfer.voucher_number, "amount": data.amount},
    ))

    await db.commit()
    await db.refresh(transfer)
    return transfer


async def delete_receipt(
    db: AsyncSession,
    receipt_id: str,
    posted_by_id: str,
) -> None:
    # 1. Fetch voucher
    result = await db.execute(select(ReceiptVoucher).where(ReceiptVoucher.id == receipt_id))
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=404, detail="Receipt voucher not found")

    # 2. Revert balance impact
    account_type = None
    account_id = None
    if voucher.payment_mode == "bank" and voucher.bank_account_id:
        is_pending_cheque = (voucher.payment_mode == "bank" and voucher.reference_number and "Cheque No:" in voucher.reference_number and "Status: Pending" in voucher.reference_number)
        if not is_pending_cheque:
            bank = await _get_bank(db, voucher.bank_account_id)
            bank.current_balance -= voucher.amount
            await db.flush()
        account_type = "bank"
        account_id = voucher.bank_account_id
    elif voucher.payment_mode == "cash" and voucher.cash_account_id:
        cash = await _get_cash(db, voucher.cash_account_id)
        cash.current_balance -= voucher.amount
        await db.flush()
        account_type = "cash"
        account_id = voucher.cash_account_id

    # 3. Delete Daybook and Ledger entries
    await db.execute(delete(DaybookEntry).where(DaybookEntry.voucher_id == voucher.id, DaybookEntry.voucher_type == "RCV"))
    await db.execute(delete(LedgerEntry).where(LedgerEntry.voucher_id == voucher.id, LedgerEntry.voucher_type == "RCV"))

    # 4. Delete voucher
    await db.delete(voucher)
    await db.flush()

    # 5. Recalculate
    if account_type and account_id:
        await recalculate_ledger_balances(db, account_type, account_id)

    # 6. Audit Log
    db.add(AuditLog(
        user_id=posted_by_id,
        action="DELETE",
        entity_type="ReceiptVoucher",
        entity_id=receipt_id,
        description=f"Deleted receipt {voucher.voucher_number} for ₹{voucher.amount:.2f}",
    ))

    await db.commit()


async def delete_payment(
    db: AsyncSession,
    payment_id: str,
    posted_by_id: str,
) -> None:
    # 1. Fetch voucher
    result = await db.execute(select(PaymentVoucher).where(PaymentVoucher.id == payment_id))
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=404, detail="Payment voucher not found")

    # 2. Revert balance impact: payment spent money, so we ADD it back
    account_type = None
    account_id = None
    if voucher.payment_mode == "bank" and voucher.bank_account_id:
        is_pending_cheque = (voucher.payment_mode == "bank" and voucher.reference_number and "Cheque No:" in voucher.reference_number and "Status: Pending" in voucher.reference_number)
        if not is_pending_cheque:
            bank = await _get_bank(db, voucher.bank_account_id)
            bank.current_balance += voucher.amount
            await db.flush()
        account_type = "bank"
        account_id = voucher.bank_account_id
    elif voucher.payment_mode == "cash" and voucher.cash_account_id:
        cash = await _get_cash(db, voucher.cash_account_id)
        cash.current_balance += voucher.amount
        await db.flush()
        account_type = "cash"
        account_id = voucher.cash_account_id

    # 3. Delete Daybook and Ledger entries
    await db.execute(delete(DaybookEntry).where(DaybookEntry.voucher_id == voucher.id, DaybookEntry.voucher_type == "PAY"))
    await db.execute(delete(LedgerEntry).where(LedgerEntry.voucher_id == voucher.id, LedgerEntry.voucher_type == "PAY"))

    # 4. Delete voucher
    await db.delete(voucher)
    await db.flush()

    # 5. Recalculate
    if account_type and account_id:
        await recalculate_ledger_balances(db, account_type, account_id)

    # 6. Audit Log
    db.add(AuditLog(
        user_id=posted_by_id,
        action="DELETE",
        entity_type="PaymentVoucher",
        entity_id=payment_id,
        description=f"Deleted payment {voucher.voucher_number} for ₹{voucher.amount:.2f}",
    ))

    await db.commit()


async def delete_expense(
    db: AsyncSession,
    expense_id: str,
    posted_by_id: str,
) -> None:
    # 1. Fetch voucher
    result = await db.execute(select(ExpenseVoucher).where(ExpenseVoucher.id == expense_id))
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=404, detail="Expense voucher not found")

    # 2. Revert balance impact: expense spent money, so we ADD it back
    account_type = None
    account_id = None
    if voucher.payment_mode == "bank" and voucher.bank_account_id:
        is_pending_cheque = (voucher.payment_mode == "bank" and voucher.reference_number and "Cheque No:" in voucher.reference_number and "Status: Pending" in voucher.reference_number)
        if not is_pending_cheque:
            bank = await _get_bank(db, voucher.bank_account_id)
            bank.current_balance += voucher.amount
            await db.flush()
        account_type = "bank"
        account_id = voucher.bank_account_id
    elif voucher.payment_mode == "cash" and voucher.cash_account_id:
        cash = await _get_cash(db, voucher.cash_account_id)
        cash.current_balance += voucher.amount
        await db.flush()
        account_type = "cash"
        account_id = voucher.cash_account_id

    # 3. Delete Daybook and Ledger entries
    await db.execute(delete(DaybookEntry).where(DaybookEntry.voucher_id == voucher.id, DaybookEntry.voucher_type == "EXP"))
    await db.execute(delete(LedgerEntry).where(LedgerEntry.voucher_id == voucher.id, LedgerEntry.voucher_type == "EXP"))

    # 4. Delete voucher
    await db.delete(voucher)
    await db.flush()

    # 5. Recalculate
    if account_type and account_id:
        await recalculate_ledger_balances(db, account_type, account_id)

    # 6. Audit Log
    db.add(AuditLog(
        user_id=posted_by_id,
        action="DELETE",
        entity_type="ExpenseVoucher",
        entity_id=expense_id,
        description=f"Deleted expense {voucher.voucher_number} for ₹{voucher.amount:.2f}",
    ))

    await db.commit()
