from datetime import date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.company import VoucherSequence
from app.core.config import settings


VOUCHER_TYPES = {
    "RCV": "Receipt",
    "PAY": "Payment",
    "TRF": "Transfer",
    "EXP": "Expense",
}


def get_current_fy(for_date: Optional[date] = None) -> tuple[int, int]:
    """Return (fy_start, fy_end) for a given date. FY starts April."""
    d = for_date or date.today()
    fy_month = settings.FY_START_MONTH
    if d.month >= fy_month:
        return d.year, d.year + 1
    else:
        return d.year - 1, d.year


async def get_next_voucher_number(
    db: AsyncSession,
    voucher_type: str,
    tx_date: Optional[date] = None,
) -> str:
    """
    Finds the first available serial number for this voucher type and FY
    by looking for the smallest missing positive integer in the database.
    This guarantees perfect continuity and automatic reuse of deleted voucher numbers.
    """
    fy_start, fy_end = get_current_fy(tx_date)

    result = await db.execute(
        select(VoucherSequence).where(
            VoucherSequence.voucher_type == voucher_type,
            VoucherSequence.fy_start == fy_start,
            VoucherSequence.fy_end == fy_end,
        ).with_for_update()
    )
    seq = result.scalar_one_or_none()

    if not seq:
        seq = VoucherSequence(
            voucher_type=voucher_type,
            prefix=voucher_type,
            current_number=0,
            fy_start=fy_start,
            fy_end=fy_end,
            padding=6,
        )
        db.add(seq)
        await db.flush()

    # Query all active voucher numbers from DaybookEntry index for this financial year
    from app.models.ledger import DaybookEntry
    from datetime import date as dt_date
    start_date = dt_date(fy_start, 4, 1)
    end_date = dt_date(fy_end, 3, 31)

    res = await db.execute(
        select(DaybookEntry.voucher_number)
        .where(
            DaybookEntry.voucher_type == voucher_type,
            DaybookEntry.date >= start_date,
            DaybookEntry.date <= end_date,
        )
    )
    existing_numbers = res.scalars().all()

    # Parse integer serial parts from RCV-000001 format
    used_ints = set()
    for num in existing_numbers:
        parts = num.split('-')
        if len(parts) == 2:
            try:
                used_ints.add(int(parts[1]))
            except ValueError:
                pass

    # Find the smallest missing integer starting from 1
    next_num = 1
    while next_num in used_ints:
        next_num += 1

    # Keep sequence table up to date with the largest seen number
    seq.current_number = max(seq.current_number, next_num)
    
    number_str = str(next_num).zfill(seq.padding)
    return f"{seq.prefix}-{number_str}"
