from typing import List, Optional
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import User
from app.models.ledger import DaybookEntry, Branch
from app.schemas.ledger import DaybookEntryOut
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/daybook", tags=["Daybook"])


@router.get("/", response_model=List[DaybookEntryOut])
async def get_daybook(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    branch_id: Optional[str] = Query(None),
    voucher_type: Optional[str] = Query(None),
    payment_mode: Optional[str] = Query(None),
    account_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Default to today's date if no date filters are specified (and not a search query)
    if not from_date and not to_date:
        if not search:
            from_date = date.today()
            to_date = date.today()

    # Date Range Validation
    if from_date and to_date:
        if from_date > to_date:
            raise HTTPException(status_code=400, detail="from_date cannot be after to_date")
        if (to_date - from_date) > timedelta(days=92):
            raise HTTPException(status_code=400, detail="Date range cannot exceed 3 months (92 days)")
    elif from_date:
        if (date.today() - from_date) > timedelta(days=92):
            raise HTTPException(status_code=400, detail="Date range cannot exceed 3 months (92 days)")
    elif to_date:
        raise HTTPException(status_code=400, detail="from_date is required when to_date is specified")

    q = select(DaybookEntry).order_by(DaybookEntry.date.desc(), DaybookEntry.created_at.desc())

    if from_date:
        q = q.where(DaybookEntry.date >= from_date)
    if to_date:
        q = q.where(DaybookEntry.date <= to_date)
    if branch_id:
        q = q.where(DaybookEntry.branch_id == branch_id)
    if voucher_type:
        q = q.where(DaybookEntry.voucher_type == voucher_type)
    if payment_mode:
        q = q.where(DaybookEntry.payment_mode == payment_mode)
    if account_id:
        q = q.where(DaybookEntry.account_id == account_id)
    if search:
        q = q.where(
            DaybookEntry.particulars.ilike(f"%{search}%")
            | DaybookEntry.voucher_number.ilike(f"%{search}%")
            | DaybookEntry.reference_number.ilike(f"%{search}%")
        )

    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    entries = result.scalars().all()

    # Attach branch names
    output = []
    for e in entries:
        branch_name = None
        if e.branch_id:
            r = await db.execute(select(Branch).where(Branch.id == e.branch_id))
            br = r.scalar_one_or_none()
            branch_name = br.name if br else None
        output.append(DaybookEntryOut(
            id=e.id,
            date=e.date,
            voucher_type=e.voucher_type,
            voucher_number=e.voucher_number,
            voucher_id=e.voucher_id,
            branch_id=e.branch_id,
            branch_name=branch_name,
            particulars=e.particulars,
            debit=e.debit,
            credit=e.credit,
            payment_mode=e.payment_mode,
            reference_number=e.reference_number,
            narration=e.narration,
            account_type=e.account_type,
            account_id=e.account_id,
            created_at=e.created_at,
        ))
    return output
