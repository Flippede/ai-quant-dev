from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import parse_user_id, require_admin
from app.models.core import User
from app.schemas.users import AdminUserPublic, CreateUserRequest, ResetPasswordRequest
from app.services.auth_service import (
    DuplicateUsernameError,
    create_user,
    disable_user,
    enable_user,
    reset_password,
    revoke_user_sessions,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserPublic])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


@router.post("/users", response_model=AdminUserPublic, status_code=status.HTTP_201_CREATED)
def create_user_api(
    payload: CreateUserRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    try:
        return create_user(db, payload.username, payload.password, payload.role)
    except DuplicateUsernameError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists") from exc


@router.post("/users/{user_id}/disable", response_model=AdminUserPublic)
def disable_user_api(user_id: str, current_admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> User:
    user = db.get(User, parse_user_id(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin cannot disable self")
    disable_user(db, user)
    db.refresh(user)
    return user


@router.post("/users/{user_id}/enable", response_model=AdminUserPublic)
def enable_user_api(user_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> User:
    user = db.get(User, parse_user_id(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    enable_user(db, user)
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    payload: ResetPasswordRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.get(User, parse_user_id(user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    reset_password(db, user, payload.password)
    revoke_user_sessions(db, user.id)
    return {"status": "ok", "session_policy": "all_user_sessions_revoked"}

