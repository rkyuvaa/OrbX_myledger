from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.models.auth import User
from app.models.ledger import Branch
from app.schemas.ledger import BranchCreate, BranchUpdate, BranchOut
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/branches", tags=["Branches"])


@router.post("/", response_model=BranchOut, status_code=201)
async def create_branch(
    body: BranchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check unique code
    existing = await db.execute(select(Branch).where(Branch.code == body.code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=422, detail=f"Branch code '{body.code}' already exists")

    branch = Branch(**body.model_dump())
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.get("/", response_model=List[BranchOut])
async def list_branches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Branch).order_by(Branch.name))
    return result.scalars().all()


@router.get("/{branch_id}", response_model=BranchOut)
async def get_branch(
    branch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.put("/{branch_id}", response_model=BranchOut)
async def update_branch(
    branch_id: str,
    body: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(branch, field, value)

    await db.commit()
    await db.refresh(branch)
    return branch


@router.delete("/{branch_id}")
async def deactivate_branch(
    branch_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch.status = "inactive"
    await db.commit()
    return {"message": "Branch deactivated"}
