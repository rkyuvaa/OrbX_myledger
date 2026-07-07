from typing import Optional
from datetime import date
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.models.auth import User
from app.models.ledger import ReceiptVoucher, PaymentVoucher, ExpenseVoucher, Branch, BankAccount, CashAccount
from app.api.v1.endpoints.auth import get_current_user
import io

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/cash-book")
async def cash_book(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    cash_account_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cash book: all cash receipts and payments/expenses."""
    rcv_q = select(ReceiptVoucher).where(ReceiptVoucher.payment_mode == "cash", ReceiptVoucher.is_reversed == False)
    pay_q = select(PaymentVoucher).where(PaymentVoucher.payment_mode == "cash", PaymentVoucher.is_reversed == False)
    exp_q = select(ExpenseVoucher).where(ExpenseVoucher.payment_mode == "cash", ExpenseVoucher.is_reversed == False)

    if from_date:
        rcv_q = rcv_q.where(ReceiptVoucher.date >= from_date)
        pay_q = pay_q.where(PaymentVoucher.date >= from_date)
        exp_q = exp_q.where(ExpenseVoucher.date >= from_date)
    if to_date:
        rcv_q = rcv_q.where(ReceiptVoucher.date <= to_date)
        pay_q = pay_q.where(PaymentVoucher.date <= to_date)
        exp_q = exp_q.where(ExpenseVoucher.date <= to_date)
    if cash_account_id:
        rcv_q = rcv_q.where(ReceiptVoucher.cash_account_id == cash_account_id)
        pay_q = pay_q.where(PaymentVoucher.cash_account_id == cash_account_id)
        exp_q = exp_q.where(ExpenseVoucher.cash_account_id == cash_account_id)

    receipts = (await db.execute(rcv_q.order_by(ReceiptVoucher.date))).scalars().all()
    payments = (await db.execute(pay_q.order_by(PaymentVoucher.date))).scalars().all()
    expenses = (await db.execute(exp_q.order_by(ExpenseVoucher.date))).scalars().all()

    outflows = []
    for p in payments:
        outflows.append({
            "date": p.date.isoformat(),
            "voucher_number": p.voucher_number,
            "paid_to": p.paid_to,
            "narration": p.narration,
            "amount": p.amount,
        })
    for e in expenses:
        outflows.append({
            "date": e.date.isoformat(),
            "voucher_number": e.voucher_number,
            "paid_to": f"[Expense] {e.paid_to}",
            "narration": e.narration,
            "amount": e.amount,
        })
    outflows.sort(key=lambda x: x["date"])

    total_out = sum(p.amount for p in payments) + sum(e.amount for e in expenses)

    return {
        "report": "Cash Book",
        "from_date": from_date,
        "to_date": to_date,
        "total_receipts": sum(r.amount for r in receipts),
        "total_payments": total_out,
        "net": sum(r.amount for r in receipts) - total_out,
        "receipts": [
            {
                "date": r.date.isoformat(),
                "voucher_number": r.voucher_number,
                "received_from": r.received_from,
                "narration": r.narration,
                "amount": r.amount,
            }
            for r in receipts
        ],
        "payments": outflows,
    }


@router.get("/bank-book")
async def bank_book(
    bank_account_id: str = Query(...),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bank book for a specific bank account."""
    rcv_q = select(ReceiptVoucher).where(
        ReceiptVoucher.payment_mode == "bank",
        ReceiptVoucher.bank_account_id == bank_account_id,
        ReceiptVoucher.is_reversed == False,
    )
    pay_q = select(PaymentVoucher).where(
        PaymentVoucher.payment_mode == "bank",
        PaymentVoucher.bank_account_id == bank_account_id,
        PaymentVoucher.is_reversed == False,
    )
    exp_q = select(ExpenseVoucher).where(
        ExpenseVoucher.payment_mode == "bank",
        ExpenseVoucher.bank_account_id == bank_account_id,
        ExpenseVoucher.is_reversed == False,
    )

    if from_date:
        rcv_q = rcv_q.where(ReceiptVoucher.date >= from_date)
        pay_q = pay_q.where(PaymentVoucher.date >= from_date)
        exp_q = exp_q.where(ExpenseVoucher.date >= from_date)
    if to_date:
        rcv_q = rcv_q.where(ReceiptVoucher.date <= to_date)
        pay_q = pay_q.where(PaymentVoucher.date <= to_date)
        exp_q = exp_q.where(ExpenseVoucher.date <= to_date)

    receipts = (await db.execute(rcv_q.order_by(ReceiptVoucher.date))).scalars().all()
    payments = (await db.execute(pay_q.order_by(PaymentVoucher.date))).scalars().all()
    expenses = (await db.execute(exp_q.order_by(ExpenseVoucher.date))).scalars().all()

    outflows = []
    for p in payments:
        outflows.append({
            "date": p.date.isoformat(),
            "voucher_number": p.voucher_number,
            "paid_to": p.paid_to,
            "reference_number": p.reference_number,
            "narration": p.narration,
            "amount": p.amount,
        })
    for e in expenses:
        outflows.append({
            "date": e.date.isoformat(),
            "voucher_number": e.voucher_number,
            "paid_to": f"[Expense] {e.paid_to}",
            "reference_number": e.reference_number,
            "narration": e.narration,
            "amount": e.amount,
        })
    outflows.sort(key=lambda x: x["date"])

    total_out = sum(p.amount for p in payments) + sum(e.amount for e in expenses)

    r_bank = await db.execute(select(BankAccount).where(BankAccount.id == bank_account_id))
    bank = r_bank.scalar_one_or_none()

    return {
        "report": "Bank Book",
        "bank_name": bank.name if bank else "Unknown",
        "from_date": from_date,
        "to_date": to_date,
        "opening_balance": bank.opening_balance if bank else 0.0,
        "current_balance": bank.current_balance if bank else 0.0,
        "total_receipts": sum(r.amount for r in receipts),
        "total_payments": total_out,
        "receipts": [
            {
                "date": r.date.isoformat(),
                "voucher_number": r.voucher_number,
                "received_from": r.received_from,
                "reference_number": r.reference_number,
                "narration": r.narration,
                "amount": r.amount,
            }
            for r in receipts
        ],
        "payments": outflows,
    }


@router.get("/branch-collection")
async def branch_collection(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    branch_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Branch-wise collection report."""
    q = select(
        Branch.id,
        Branch.name,
        Branch.code,
        func.coalesce(func.sum(ReceiptVoucher.amount), 0.0).label("total_collected"),
        func.count(ReceiptVoucher.id).label("count"),
    ).join(ReceiptVoucher, ReceiptVoucher.branch_id == Branch.id, isouter=True)

    if from_date:
        q = q.where(
            (ReceiptVoucher.date.is_(None)) | (ReceiptVoucher.date >= from_date)
        )
    if to_date:
        q = q.where(
            (ReceiptVoucher.date.is_(None)) | (ReceiptVoucher.date <= to_date)
        )
    if branch_id:
        q = q.where(Branch.id == branch_id)

    q = q.where(
        (ReceiptVoucher.is_reversed.is_(None)) | (ReceiptVoucher.is_reversed == False)
    ).group_by(Branch.id, Branch.name, Branch.code).order_by(func.sum(ReceiptVoucher.amount).desc())

    result = await db.execute(q)
    rows = result.all()

    return {
        "report": "Branch-wise Collection",
        "from_date": from_date,
        "to_date": to_date,
        "data": [
            {
                "branch_id": r.id,
                "branch_name": r.name,
                "branch_code": r.code,
                "total_collected": float(r.total_collected),
                "transaction_count": r.count,
            }
            for r in rows
        ],
    }


@router.get("/branch-payment")
async def branch_payment(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    branch_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Branch-wise payment report."""
    q_pay = select(
        Branch.id,
        Branch.name,
        Branch.code,
        func.coalesce(func.sum(PaymentVoucher.amount), 0.0).label("total_paid"),
        func.count(PaymentVoucher.id).label("count"),
    ).join(PaymentVoucher, PaymentVoucher.branch_id == Branch.id, isouter=True)

    if from_date:
        q_pay = q_pay.where((PaymentVoucher.date.is_(None)) | (PaymentVoucher.date >= from_date))
    if to_date:
        q_pay = q_pay.where((PaymentVoucher.date.is_(None)) | (PaymentVoucher.date <= to_date))
    if branch_id:
        q_pay = q_pay.where(Branch.id == branch_id)

    q_pay = q_pay.where(
        (PaymentVoucher.is_reversed.is_(None)) | (PaymentVoucher.is_reversed == False)
    ).group_by(Branch.id, Branch.name, Branch.code)

    result_pay = await db.execute(q_pay)
    pay_rows = result_pay.all()

    # Query expenses
    q_exp = select(
        Branch.id,
        func.coalesce(func.sum(ExpenseVoucher.amount), 0.0).label("total_paid"),
        func.count(ExpenseVoucher.id).label("count"),
    ).join(ExpenseVoucher, ExpenseVoucher.branch_id == Branch.id, isouter=True)

    if from_date:
        q_exp = q_exp.where((ExpenseVoucher.date.is_(None)) | (ExpenseVoucher.date >= from_date))
    if to_date:
        q_exp = q_exp.where((ExpenseVoucher.date.is_(None)) | (ExpenseVoucher.date <= to_date))
    if branch_id:
        q_exp = q_exp.where(Branch.id == branch_id)

    q_exp = q_exp.where(
        (ExpenseVoucher.is_reversed.is_(None)) | (ExpenseVoucher.is_reversed == False)
    ).group_by(Branch.id)

    result_exp = await db.execute(q_exp)
    exp_rows = {row.id: (float(row.total_paid), row.count) for row in result_exp.all()}

    data = []
    for r in pay_rows:
        exp_amt, exp_cnt = exp_rows.get(r.id, (0.0, 0))
        data.append({
            "branch_id": r.id,
            "branch_name": r.name,
            "branch_code": r.code,
            "total_paid": float(r.total_paid) + exp_amt,
            "transaction_count": r.count + exp_cnt,
        })

    return {
        "report": "Branch-wise Payment",
        "from_date": from_date,
        "to_date": to_date,
        "data": data,
    }


@router.get("/cash-flow")
async def cash_flow(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Monthly cash flow summary."""
    rcv_result = await db.execute(
        select(func.coalesce(func.sum(ReceiptVoucher.amount), 0.0))
        .where(
            ReceiptVoucher.is_reversed == False,
            *(([ReceiptVoucher.date >= from_date] if from_date else []) +
              ([ReceiptVoucher.date <= to_date] if to_date else [])),
        )
    )
    pay_result = await db.execute(
        select(func.coalesce(func.sum(PaymentVoucher.amount), 0.0))
        .where(
            PaymentVoucher.is_reversed == False,
            *(([PaymentVoucher.date >= from_date] if from_date else []) +
              ([PaymentVoucher.date <= to_date] if to_date else [])),
        )
    )
    exp_result = await db.execute(
        select(func.coalesce(func.sum(ExpenseVoucher.amount), 0.0))
        .where(
            ExpenseVoucher.is_reversed == False,
            *(([ExpenseVoucher.date >= from_date] if from_date else []) +
              ([ExpenseVoucher.date <= to_date] if to_date else [])),
        )
    )
    total_in = float(rcv_result.scalar())
    total_out = float(pay_result.scalar()) + float(exp_result.scalar())

    return {
        "report": "Cash Flow",
        "from_date": from_date,
        "to_date": to_date,
        "total_inflow": total_in,
        "total_outflow": total_out,
        "net_flow": total_in - total_out,
    }
