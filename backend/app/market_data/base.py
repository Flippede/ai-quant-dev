from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal


@dataclass(frozen=True)
class Quote:
    symbol: str
    market: str
    name: str
    asset_type: str
    ts: datetime
    last_price: Decimal
    pct_change: Decimal
    volume: Decimal
    amount: Decimal


@dataclass(frozen=True)
class InstrumentInfo:
    symbol: str
    market: str
    name: str
    asset_type: str
    exchange: str | None
    is_active: bool = True
    metadata: dict | None = None


@dataclass(frozen=True)
class Bar:
    symbol: str
    market: str
    ts: datetime | date
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal
    amount: Decimal


class MarketDataProvider(ABC):
    @abstractmethod
    def get_realtime_quotes(self, symbols: list[str]) -> list[Quote]:
        raise NotImplementedError

    @abstractmethod
    def get_daily_bars(self, symbol: str, start: date, end: date) -> list[Bar]:
        raise NotImplementedError

    @abstractmethod
    def get_intraday_bars(self, symbol: str, freq: str, start: datetime, end: datetime) -> list[Bar]:
        raise NotImplementedError

    @abstractmethod
    def get_index_quotes(self, symbols: list[str]) -> list[Quote]:
        raise NotImplementedError

    @abstractmethod
    def search_instruments(self, keyword: str) -> list[InstrumentInfo]:
        raise NotImplementedError

    @abstractmethod
    def get_instrument_detail(self, symbol: str, market: str) -> InstrumentInfo | None:
        raise NotImplementedError

    @abstractmethod
    def get_market_calendar(self, start: date, end: date) -> list[date]:
        raise NotImplementedError
