import logging
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_session_token
from app.core.timezone import utc_now
from app.models.core import AuthSession, User

logger = logging.getLogger(__name__)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> User:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token_hash = hash_session_token(session_token)
    session = db.scalar(
        select(AuthSession).where(
            AuthSession.token_hash == token_hash,
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > utc_now(),
        )
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        logger.warning("Disabled or missing user attempted access user_id=%s", session.user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is disabled")

    session.last_seen_at = utc_now()
    db.commit()
    request.state.auth_session = session
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        logger.warning("Non-admin attempted admin access user_id=%s role=%s", current_user.id, current_user.role)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def parse_user_id(user_id: str) -> UUID:
    try:
        return UUID(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid user id") from exc
