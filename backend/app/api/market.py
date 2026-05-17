from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.core import User
from app.schemas.market import (
    InstrumentDetailResponse,
    InstrumentPublic,
    MarketOverviewResponse,
    QuotesRequest,
    QuotePublic,
)
from app.services.market_service import get_instrument, get_market_overview, get_quotes, quote_for_instrument, search_instruments

router = APIRouter(tags=["market"])


@router.get("/api/market/overview", response_model=MarketOverviewResponse)
def market_overview(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MarketOverviewResponse:
    indices = get_market_overview(db)
    if not indices:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Market overview unavailable")
    updated_at = max(item.updated_at for item in indices)
    return MarketOverviewResponse(indices=indices, updated_at=updated_at)


@router.post("/api/market/quotes", response_model=list[QuotePublic])
def market_quotes(
    payload: QuotesRequest,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[QuotePublic]:
    return get_quotes(db, payload.symbols)


@router.get("/api/instruments/search", response_model=list[InstrumentPublic])
def instrument_search(
    q: str = Query(default="", max_length=64),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InstrumentPublic]:
    return search_instruments(db, q)


@router.get("/api/instruments/{market}/{symbol}", response_model=InstrumentDetailResponse)
def instrument_detail(
    market: str,
    symbol: str,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InstrumentDetailResponse:
    instrument = get_instrument(db, market, symbol)
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")
    return InstrumentDetailResponse(
        instrument=InstrumentPublic.model_validate(instrument),
        quote=quote_for_instrument(db, instrument),
    )
