import asyncio
import sys
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.auth import User
from app.services.auth_service import get_password_hash

async def main():
    async with SessionLocal() as db:
        email = input("Enter email/username: ").strip()
        if not email:
            print("Error: Email cannot be empty.")
            return
            
        full_name = input("Enter full name: ").strip()
        if not full_name:
            print("Error: Full name cannot be empty.")
            return

        password = input("Enter password: ").strip()
        if not password:
            print("Error: Password cannot be empty.")
            return

        # Check if already exists
        result = await db.execute(select(User).where(User.email == email))
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Error: A user with email '{email}' already exists.")
            return

        new_user = User(
            email=email,
            full_name=full_name,
            hashed_password=get_password_hash(password),
            is_active=True,
            is_superuser=True,
            role="admin",
        )
        db.add(new_user)
        await db.commit()
        print(f"\n✅ Superuser '{email}' successfully created!")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
