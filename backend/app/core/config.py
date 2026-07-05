from typing import Optional
from pydantic import EmailStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )

    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "My Ledger"
    SECRET_KEY: str = "orbx-ledger-dev-secret-key-change-in-production-2026"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/orbx_ledger"

    # First superuser
    FIRST_SUPERUSER_EMAIL: EmailStr = "admin@myledger.com"
    FIRST_SUPERUSER_PASSWORD: str = "Admin@123"
    FIRST_SUPERUSER_NAME: str = "System Administrator"

    # Company defaults
    COMPANY_NAME: str = "My Ledger"
    FY_START_YEAR: int = 2026   # FY 2026-27
    FY_START_MONTH: int = 4     # April


settings = Settings()
