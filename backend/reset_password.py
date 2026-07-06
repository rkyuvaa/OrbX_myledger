import asyncio
import sys
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.auth import User
from app.services.auth_service import get_password_hash

async def main():
    async with SessionLocal() as db:
        # Get all users
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        if not users:
            print("No users found in the database.")
            return

        print("\n--- Current Users in Database ---")
        for idx, user in enumerate(users, start=1):
            print(f"{idx}. Email: {user.email} | Name: {user.full_name} | Role: {user.role} | Active: {user.is_active}")
        print("---------------------------------\n")

        print("Options:")
        print("1. Reset password of an existing user")
        print("2. Exit")
        choice = input("Enter choice (1-2): ").strip()

        if choice != "1":
            print("Exiting.")
            return

        email = input("Enter the email of the user to reset: ").strip()
        user_to_reset = next((u for u in users if u.email.lower() == email.lower()), None)

        if not user_to_reset:
            print(f"Error: User with email '{email}' not found.")
            return

        new_password = input(f"Enter new password for {user_to_reset.email}: ").strip()
        if not new_password:
            print("Error: Password cannot be empty.")
            return

        user_to_reset.hashed_password = get_password_hash(new_password)
        await db.commit()
        print(f"\n✅ Password successfully updated for {user_to_reset.email}!")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
