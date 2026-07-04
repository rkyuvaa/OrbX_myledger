from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.auth import User
from app.models.company import CompanyProfile
from app.services.auth_service import get_password_hash
from app.core.config import settings


async def init_db(db: AsyncSession) -> None:
    """Seed the database with default admin user and company profile on first run."""

    # Create superuser if not exists
    result = await db.execute(select(User).where(User.email == settings.FIRST_SUPERUSER_EMAIL))
    user = result.scalar_one_or_none()

    if not user:
        admin = User(
            email=settings.FIRST_SUPERUSER_EMAIL,
            full_name=settings.FIRST_SUPERUSER_NAME,
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            is_active=True,
            is_superuser=True,
            role="admin",
        )
        db.add(admin)
        print(f"✅ Created superuser: {settings.FIRST_SUPERUSER_EMAIL}")

    # Create company profile if not exists
    company_result = await db.execute(select(CompanyProfile).limit(1))
    company = company_result.scalar_one_or_none()

    if not company:
        company = CompanyProfile(
            name=settings.COMPANY_NAME,
            fy_start_year=settings.FY_START_YEAR,
            fy_start_month=settings.FY_START_MONTH,
        )
        db.add(company)
        print(f"✅ Created company profile: {settings.COMPANY_NAME}")

    await db.commit()
    print("✅ Database initialization complete.")
