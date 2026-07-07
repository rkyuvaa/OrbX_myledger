from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import User
from app.models.company import CompanyProfile, VoucherSequence
from app.schemas.ledger import (
    CompanyProfileUpdate, CompanyProfileOut,
    VoucherSequenceUpdate, VoucherSequenceOut,
)
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/config", tags=["Configuration"])


# ─── COMPANY PROFILE ───

@router.get("/company", response_model=CompanyProfileOut)
async def get_company_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CompanyProfile).limit(1))
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company profile not configured")
    return company


@router.put("/company", response_model=CompanyProfileOut)
async def update_company_profile(
    body: CompanyProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(CompanyProfile).limit(1))
    company = result.scalar_one_or_none()
    if not company:
        company = CompanyProfile()
        db.add(company)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)
    return company


# ─── VOUCHER SEQUENCES ───

@router.get("/voucher-sequences", response_model=List[VoucherSequenceOut])
async def list_voucher_sequences(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.voucher_service import get_current_fy
    fy_start, fy_end = get_current_fy()
    
    # Ensure default sequences exist for current FY
    for v_type in ["RCV", "PAY", "TRF", "EXP"]:
        result = await db.execute(
            select(VoucherSequence).where(
                VoucherSequence.voucher_type == v_type,
                VoucherSequence.fy_start == fy_start,
                VoucherSequence.fy_end == fy_end,
            )
        )
        seq = result.scalar_one_or_none()
        if not seq:
            seq = VoucherSequence(
                voucher_type=v_type,
                prefix=v_type,
                current_number=0,
                fy_start=fy_start,
                fy_end=fy_end,
                padding=6,
            )
            db.add(seq)
    
    await db.commit()
    
    result = await db.execute(select(VoucherSequence).order_by(VoucherSequence.voucher_type))
    return result.scalars().all()


@router.put("/voucher-sequences/{seq_id}", response_model=VoucherSequenceOut)
async def update_voucher_sequence(
    seq_id: str,
    body: VoucherSequenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(VoucherSequence).where(VoucherSequence.id == seq_id))
    seq = result.scalar_one_or_none()
    if not seq:
        raise HTTPException(status_code=404, detail="Voucher sequence not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "next_number":
            seq.current_number = value - 1
        else:
            setattr(seq, field, value)

    await db.commit()
    await db.refresh(seq)
    return seq
