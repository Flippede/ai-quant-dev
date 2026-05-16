from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.core import User
from app.schemas.watchlist import (
    CreateWatchlistGroupRequest,
    CreateWatchlistItemRequest,
    UpdateWatchlistGroupRequest,
    UpdateWatchlistItemRequest,
    WatchlistGroupPublic,
    WatchlistItemPublic,
)
from app.services.watchlist_service import (
    DuplicateWatchlistItemError,
    WatchlistError,
    add_item,
    create_group,
    delete_group,
    delete_item,
    list_groups,
    update_group,
    update_item,
)

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


@router.get("/groups", response_model=list[WatchlistGroupPublic])
def get_watchlist_groups(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_groups(db, current_user)


@router.post("/groups", response_model=WatchlistGroupPublic, status_code=status.HTTP_201_CREATED)
def create_watchlist_group(
    payload: CreateWatchlistGroupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchlistGroupPublic:
    try:
        group = create_group(db, current_user, payload.name, payload.sort_order)
    except WatchlistError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return WatchlistGroupPublic(id=group.id, name=group.name, sort_order=group.sort_order, items=[])


@router.patch("/groups/{group_id}", response_model=WatchlistGroupPublic)
def patch_watchlist_group(
    group_id: UUID,
    payload: UpdateWatchlistGroupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchlistGroupPublic:
    try:
        group = update_group(db, current_user, group_id, payload.name, payload.sort_order)
    except WatchlistError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return WatchlistGroupPublic(id=group.id, name=group.name, sort_order=group.sort_order, items=[])


@router.delete("/groups/{group_id}")
def delete_watchlist_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not delete_group(db, current_user, group_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return {"status": "ok", "delete_policy": "group_items_cascade_deleted"}


@router.post("/items", response_model=WatchlistItemPublic, status_code=status.HTTP_201_CREATED)
def create_watchlist_item(
    payload: CreateWatchlistItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchlistItemPublic:
    try:
        item = add_item(db, current_user, payload.group_id, payload.symbol, payload.market, payload.note, payload.sort_order)
    except DuplicateWatchlistItemError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except WatchlistError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return WatchlistItemPublic.model_validate(item)


@router.patch("/items/{item_id}", response_model=WatchlistItemPublic)
def patch_watchlist_item(
    item_id: UUID,
    payload: UpdateWatchlistItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WatchlistItemPublic:
    item = update_item(db, current_user, item_id, "note" in payload.model_fields_set, payload.note, payload.sort_order)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return WatchlistItemPublic.model_validate(item)


@router.delete("/items/{item_id}")
def delete_watchlist_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not delete_item(db, current_user, item_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return {"status": "ok"}
