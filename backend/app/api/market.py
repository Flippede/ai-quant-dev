from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.core import User
from app.schemas.market import (
    InstrumentDetailResponse,
    InstrumentPublic,
    DailyBarPublic,
    MarketBarsResponse,
    MarketOverviewResponse,
    QuotesRequest,
    QuotePublic,
)
from app.services.market_service import get_instrument, get_market_overview, get_quotes, quote_for_instrument, search_instruments
from app.market_data.provider import get_market_data_provider

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


@router.get("/api/market/bars", response_model=MarketBarsResponse)
def market_bars(
    symbol: str = Query(min_length=1, max_length=32),
    market: str = Query(default="CN", min_length=1, max_length=16),
    period: str = Query(default="1d"),
    adjust: str = Query(default="qfq", pattern="^(none|qfq|hfq)$"),
    start_date: date = Query(...),
    end_date: date = Query(...),
    _: User = Depends(get_current_user),
) -> MarketBarsResponse:
    if period != "1d":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only daily period 1d is supported in this MVP")
    if start_date > end_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be before end_date")

    provider = get_market_data_provider()
    bars = provider.get_daily_bars(symbol, market, start_date, end_date, adjust)
    return MarketBarsResponse(
        symbol=symbol,
        market=market,
        period=period,
        adjustment_mode=adjust,
        bars=[
            DailyBarPublic(
                symbol=bar.symbol,
                market=bar.market,
                trade_date=bar.ts if isinstance(bar.ts, date) else bar.ts.date(),
                open=float(bar.open),
                high=float(bar.high),
                low=float(bar.low),
                close=float(bar.close),
                volume=float(bar.volume),
                amount=float(bar.amount),
            )
            for bar in bars
        ],
    )
