from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.core import Instrument, User, WatchlistGroup, WatchlistItem
from app.schemas.market import QuotePublic
from app.schemas.watchlist import WatchlistGroupPublic, WatchlistItemPublic
from app.services.market_service import get_instrument, get_quotes, seed_mock_instruments


class WatchlistError(Exception):
    pass


class DuplicateWatchlistItemError(Exception):
    pass


def list_groups(db: Session, user: User) -> list[WatchlistGroupPublic]:
    groups = list(
        db.scalars(
            select(WatchlistGroup)
            .where(WatchlistGroup.user_id == user.id)
            .order_by(WatchlistGroup.sort_order, WatchlistGroup.created_at)
        )
    )
    items = list(
        db.scalars(
            select(WatchlistItem)
            .where(WatchlistItem.user_id == user.id)
            .order_by(WatchlistItem.sort_order, WatchlistItem.created_at)
        )
    )
    quote_map = _quote_map_for_items(db, items)
    items_by_group: dict[UUID, list[WatchlistItemPublic]] = {}
    for item in items:
        items_by_group.setdefault(item.group_id, []).append(_item_public(item, quote_map.get(item.symbol)))

    return [
        WatchlistGroupPublic(id=group.id, name=group.name, sort_order=group.sort_order, items=items_by_group.get(group.id, []))
        for group in groups
    ]


def create_group(db: Session, user: User, name: str, sort_order: int) -> WatchlistGroup:
    group = WatchlistGroup(user_id=user.id, name=name.strip(), sort_order=sort_order)
    db.add(group)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise WatchlistError("Group name already exists") from exc
    db.refresh(group)
    return group


def update_group(db: Session, user: User, group_id: UUID, name: str | None, sort_order: int | None) -> WatchlistGroup | None:
    group = get_group(db, user, group_id)
    if group is None:
        return None
    if name is not None:
        group.name = name.strip()
    if sort_order is not None:
        group.sort_order = sort_order
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise WatchlistError("Group name already exists") from exc
    db.refresh(group)
    return group


def delete_group(db: Session, user: User, group_id: UUID) -> bool:
    group = get_group(db, user, group_id)
    if group is None:
        return False
    db.execute(delete(WatchlistItem).where(WatchlistItem.user_id == user.id, WatchlistItem.group_id == group.id))
    db.delete(group)
    db.commit()
    return True


def add_item(
    db: Session,
    user: User,
    group_id: UUID,
    symbol: str,
    market: str,
    note: str | None,
    sort_order: int,
) -> WatchlistItem:
    group = get_group(db, user, group_id)
    if group is None:
        raise WatchlistError("Group not found")

    instrument = get_instrument(db, market, symbol)
    if instrument is None:
        raise WatchlistError("Instrument not found")

    item = WatchlistItem(
        user_id=user.id,
        group_id=group.id,
        symbol=instrument.symbol,
        market=instrument.market,
        asset_type=instrument.asset_type,
        name_snapshot=instrument.name,
        sort_order=sort_order,
        note=note,
    )
    db.add(item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise DuplicateWatchlistItemError("Instrument already exists in this group") from exc
    db.refresh(item)
    return item


def update_item(
    db: Session,
    user: User,
    item_id: UUID,
    note_provided: bool,
    note: str | None,
    sort_order: int | None,
) -> WatchlistItem | None:
    item = get_item(db, user, item_id)
    if item is None:
        return None
    if note_provided:
        item.note = note
    if sort_order is not None:
        item.sort_order = sort_order
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, user: User, item_id: UUID) -> bool:
    item = get_item(db, user, item_id)
    if item is None:
        return False
    db.delete(item)
    db.commit()
    return True


def get_group(db: Session, user: User, group_id: UUID) -> WatchlistGroup | None:
    return db.scalar(select(WatchlistGroup).where(WatchlistGroup.id == group_id, WatchlistGroup.user_id == user.id))


def get_item(db: Session, user: User, item_id: UUID) -> WatchlistItem | None:
    return db.scalar(select(WatchlistItem).where(WatchlistItem.id == item_id, WatchlistItem.user_id == user.id))


def ensure_default_group(db: Session, user: User) -> WatchlistGroup:
    group = db.scalar(
        select(WatchlistGroup).where(WatchlistGroup.user_id == user.id).order_by(WatchlistGroup.sort_order).limit(1)
    )
    if group is not None:
        return group
    return create_group(db, user, "默认分组", 0)


def _quote_map_for_items(db: Session, items: list[WatchlistItem]) -> dict[str, QuotePublic]:
    symbols = sorted({item.symbol for item in items})
    if not symbols:
        return {}
    return {quote.symbol: quote for quote in get_quotes(db, symbols)}


def _item_public(item: WatchlistItem, quote: QuotePublic | None = None) -> WatchlistItemPublic:
    return WatchlistItemPublic(
        id=item.id,
        group_id=item.group_id,
        symbol=item.symbol,
        market=item.market,
        asset_type=item.asset_type,
        name_snapshot=item.name_snapshot,
        sort_order=item.sort_order,
        note=item.note,
        quote=quote,
    )
