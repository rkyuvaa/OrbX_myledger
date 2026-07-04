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
    Atomically increment and return the next voucher number for the given type and FY.
    Creates the sequence record if it doesn't exist.
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

    seq.current_number += 1
    number = str(seq.current_number).zfill(seq.padding)
    return f"{seq.prefix}-{number}"
