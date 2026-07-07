import asyncio
import sys
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.auth import User

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        if not users:
            print("No users found in the database.")
            return

        print("\n--- User Modification Timestamps ---")
        for idx, u in enumerate(users, start=1):
            # Print creation and last modified timestamps
            print(f"{idx}. Email: {u.email}")
            print(f"   Created At:    {u.created_at.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            print(f"   Last Modified: {u.updated_at.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            print("-" * 40)
        print()

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
