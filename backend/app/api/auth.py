import logging

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.redis import get_redis_client
from app.models.core import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse, UserPublic
from app.services.auth_service import AuthError, authenticate_user, change_password, create_session, revoke_session

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_expire_hours * 3600,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.session_cookie_secure,
        samesite="lax",
        httponly=True,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)) -> LoginResponse:
    client_ip = request.client.host if request.client else "unknown"
    _enforce_login_rate_limit(payload.username, client_ip)
    try:
        user = authenticate_user(db, payload.username, payload.password)
    except AuthError as exc:
        _record_login_failure(payload.username, client_ip)
        logger.warning("Login failed username=%s ip=%s reason=%s", payload.username.strip().lower(), client_ip, str(exc))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    _clear_login_failures(payload.username, client_ip)
    token, _ = create_session(
        db,
        user,
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
    )
    logger.info("Login succeeded user_id=%s username=%s ip=%s", user.id, user.username, client_ip)
    set_session_cookie(response, token)
    return LoginResponse(user=UserPublic.model_validate(user))


@router.post("/logout")
def logout(
    response: Response,
    db: Session = Depends(get_db),
    session_token: str | None = Cookie(default=None, alias=settings.session_cookie_name),
) -> dict[str, str]:
    if session_token:
        revoke_session(db, session_token)
    clear_session_cookie(response)
    return {"status": "ok"}


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/change-password")
def change_own_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        change_password(db, current_user, payload.old_password, payload.new_password)
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"status": "ok", "session_policy": "current_session_retained"}


def _login_rate_key(username: str, ip_address: str) -> str:
    normalized = username.strip().lower()
    return f"auth:login_fail:{normalized}:{ip_address}"


def _enforce_login_rate_limit(username: str, ip_address: str) -> None:
    count = get_redis_client().get(_login_rate_key(username, ip_address))
    if count is not None and int(count) >= settings.login_rate_limit_max_failures:
        logger.warning("Login blocked by rate limit username=%s ip=%s", username.strip().lower(), ip_address)
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many failed login attempts. Please try again later.")


def _record_login_failure(username: str, ip_address: str) -> None:
    redis = get_redis_client()
    key = _login_rate_key(username, ip_address)
    count = redis.incr(key)
    if count == 1:
        redis.expire(key, settings.login_rate_limit_window_seconds)


def _clear_login_failures(username: str, ip_address: str) -> None:
    get_redis_client().delete(_login_rate_key(username, ip_address))
