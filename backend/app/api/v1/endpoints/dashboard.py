from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.auth import User
from app.schemas.ledger import DashboardSummaryOut
from app.services import ledger_service
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryOut)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch all dashboard KPIs, charts, and recent transactions."""
    return await ledger_service.get_dashboard_summary(db)
