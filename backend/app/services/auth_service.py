from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    needs_password_rehash,
    session_expires_at,
    verify_password,
)
from app.core.timezone import utc_now
from app.models.core import AuthSession, User


class AuthError(Exception):
    pass


class DuplicateUsernameError(Exception):
    pass


def normalize_username(username: str) -> str:
    return username.strip().lower()


def create_user(db: Session, username: str, password: str, role: str = "user", is_active: bool = True) -> User:
    user = User(
        username=normalize_username(username),
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateUsernameError("Username already exists") from exc
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User:
    user = db.scalar(select(User).where(User.username == normalize_username(username)))
    if user is None:
        raise AuthError("Invalid username or password")
    if not user.is_active:
        raise AuthError("User is disabled")
    if not verify_password(password, user.password_hash):
        raise AuthError("Invalid username or password")

    if needs_password_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = utc_now()
    db.commit()
    db.refresh(user)
    return user


def create_session(
    db: Session,
    user: User,
    ip_address: str | None,
    user_agent: str | None,
) -> tuple[str, AuthSession]:
    token = generate_session_token()
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_session_token(token),
        expires_at=session_expires_at(),
        ip_address=ip_address,
        user_agent=user_agent,
        last_seen_at=utc_now(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return token, session


def revoke_session(db: Session, token: str) -> None:
    token_hash = hash_session_token(token)
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == token_hash, AuthSession.revoked_at.is_(None)))
    if session is not None:
        session.revoked_at = utc_now()
        db.commit()


def revoke_user_sessions(db: Session, user_id, exclude_session_id=None) -> None:
    stmt = update(AuthSession).where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
    if exclude_session_id is not None:
        stmt = stmt.where(AuthSession.id != exclude_session_id)
    db.execute(stmt.values(revoked_at=utc_now()))
    db.commit()


def change_password(db: Session, user: User, old_password: str, new_password: str) -> None:
    if not verify_password(old_password, user.password_hash):
        raise AuthError("Old password is incorrect")
    user.password_hash = hash_password(new_password)
    db.commit()


def reset_password(db: Session, user: User, new_password: str) -> None:
    user.password_hash = hash_password(new_password)
    db.commit()


def disable_user(db: Session, user: User) -> None:
    user.is_active = False
    db.commit()
    revoke_user_sessions(db, user.id)


def enable_user(db: Session, user: User) -> None:
    user.is_active = True
    db.commit()

