from fastapi import APIRouter

from app.api.v1.endpoints import auth, dashboard, banks, branches, receipts, payments, expenses, transfers, daybook, ledger, reports, config

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(banks.router)
api_router.include_router(branches.router)
api_router.include_router(receipts.router)
api_router.include_router(payments.router)
api_router.include_router(expenses.router)
api_router.include_router(transfers.router)
api_router.include_router(daybook.router)
api_router.include_router(ledger.router)
api_router.include_router(reports.router)
api_router.include_router(config.router)
