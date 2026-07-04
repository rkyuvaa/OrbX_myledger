import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.v1.router import api_router
from app.db.session import SessionLocal
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and seed default data on startup."""
    async with SessionLocal() as db:
        await init_db(db)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Orbx My Ledger — Cash & Bank Management System API",
    version="1.0.0",
    docs_url="/docs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/api/v1/health", tags=["System"])
async def health_check():
    return {
        "success": True,
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0",
    }
