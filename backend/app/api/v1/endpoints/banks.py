from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import User
from app.models.ledger import BankAccount, CashAccount
from app.schemas.ledger import (
    BankAccountCreate, BankAccountUpdate, BankAccountOut,
    CashAccountCreate, CashAccountUpdate, CashAccountOut,
)
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/banks", tags=["Bank & Cash Accounts"])


# ─── BANK ACCOUNTS ───

@router.post("/", response_model=BankAccountOut, status_code=201)
async def create_bank(
    body: BankAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bank = BankAccount(
        **body.model_dump(),
        current_balance=body.opening_balance,
    )
    db.add(bank)
    await db.commit()
    await db.refresh(bank)
    return bank


@router.get("/", response_model=List[BankAccountOut])
async def list_banks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(BankAccount).order_by(BankAccount.name))
    return result.scalars().all()


@router.get("/{bank_id}", response_model=BankAccountOut)
async def get_bank(
    bank_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(BankAccount).where(BankAccount.id == bank_id))
    bank = result.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return bank


@router.put("/{bank_id}", response_model=BankAccountOut)
async def update_bank(
    bank_id: str,
    body: BankAccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(BankAccount).where(BankAccount.id == bank_id))
    bank = result.scalar_one_or_none()
    if not bank:
        raise HTTPException(status_code=404, detail="Bank account not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "opening_balance":
            diff = value - bank.opening_balance
            bank.current_balance += diff
            bank.opening_balance = value
        else:
            setattr(bank, field, value)

    await db.commit()
    await db.refresh(bank)
    return bank


# ─── CASH ACCOUNTS ───

@router.post("/cash", response_model=CashAccountOut, status_code=201)
async def create_cash(
    body: CashAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cash = CashAccount(
        **body.model_dump(),
        current_balance=body.opening_balance,
    )
    db.add(cash)
    await db.commit()
    await db.refresh(cash)
    return cash


@router.get("/cash/all", response_model=List[CashAccountOut])
async def list_cash_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CashAccount).order_by(CashAccount.name))
    return result.scalars().all()


@router.put("/cash/{cash_id}", response_model=CashAccountOut)
async def update_cash(
    cash_id: str,
    body: CashAccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CashAccount).where(CashAccount.id == cash_id))
    cash = result.scalar_one_or_none()
    if not cash:
        raise HTTPException(status_code=404, detail="Cash account not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "opening_balance":
            diff = value - cash.opening_balance
            cash.current_balance += diff
            cash.opening_balance = value
        else:
            setattr(cash, field, value)

    await db.commit()
    await db.refresh(cash)
    return cash
