import argparse
import getpass

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.core import User
from app.services.auth_service import DuplicateUsernameError, create_user, normalize_username


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the first admin user.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", default=None)
    args = parser.parse_args()

    password = args.password or getpass.getpass("Password: ")
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters.")

    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.username == normalize_username(args.username)))
        if existing is not None:
            raise SystemExit(f"User already exists: {existing.username}")

        admin_count = db.scalar(select(User).where(User.role == "admin").limit(1))
        if admin_count is not None:
            raise SystemExit("An admin user already exists. Use the admin UI/API to create more admins.")

        try:
            user = create_user(db, args.username, password, role="admin")
        except DuplicateUsernameError as exc:
            raise SystemExit("Username already exists.") from exc

    print(f"Created admin user: {user.username}")


if __name__ == "__main__":
    main()

