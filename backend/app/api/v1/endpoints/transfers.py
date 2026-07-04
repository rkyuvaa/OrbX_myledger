from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import User
from app.models.ledger import FundTransfer, BankAccount, CashAccount
from app.schemas.ledger import FundTransferCreate, FundTransferOut
from app.services import ledger_service
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/transfers", tags=["Fund Transfers"])


@router.post("/", response_model=FundTransferOut, status_code=201)
async def create_transfer(
    body: FundTransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transfer = await ledger_service.create_fund_transfer(db, body, current_user.id)
    return await _enrich_transfer(db, transfer)


@router.get("/", response_model=List[FundTransferOut])
async def list_transfers(
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(FundTransfer).order_by(FundTransfer.date.desc(), FundTransfer.created_at.desc())

    if from_date:
        q = q.where(FundTransfer.date >= from_date)
    if to_date:
        q = q.where(FundTransfer.date <= to_date)

    q = q.offset(skip).limit(limit)
    result = await db.execute(q)
    transfers = result.scalars().all()
    return [await _enrich_transfer(db, t) for t in transfers]


@router.get("/{transfer_id}", response_model=FundTransferOut)
async def get_transfer(
    transfer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(FundTransfer).where(FundTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return await _enrich_transfer(db, transfer)


async def _enrich_transfer(db: AsyncSession, t: FundTransfer) -> FundTransferOut:
    async def get_name(account_type: str, account_id: str) -> Optional[str]:
        if account_type == "bank":
            r = await db.execute(select(BankAccount).where(BankAccount.id == account_id))
            acc = r.scalar_one_or_none()
        else:
            r = await db.execute(select(CashAccount).where(CashAccount.id == account_id))
            acc = r.scalar_one_or_none()
        return acc.name if acc else None

    return FundTransferOut(
        id=t.id,
        voucher_number=t.voucher_number,
        date=t.date,
        from_account_type=t.from_account_type,
        from_account_id=t.from_account_id,
        from_account_name=await get_name(t.from_account_type, t.from_account_id),
        to_account_type=t.to_account_type,
        to_account_id=t.to_account_id,
        to_account_name=await get_name(t.to_account_type, t.to_account_id),
        amount=t.amount,
        reference_number=t.reference_number,
        narration=t.narration,
        posted_by_id=t.posted_by_id,
        created_at=t.created_at,
    )
