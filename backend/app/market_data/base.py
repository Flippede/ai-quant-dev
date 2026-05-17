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
    exchange: str | None = None
    provider: str = "mock"
    is_stale: bool = False
    source_status: str = "ok"


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
    def get_realtime_quotes(self, instruments: list[str]) -> list[Quote]:
        raise NotImplementedError

    @abstractmethod
    def get_daily_bars(self, symbol: str, market: str, start: date, end: date, adjust_mode: str = "qfq") -> list[Bar]:
        raise NotImplementedError

    def get_recent_daily_bars(self, symbol: str, market: str, periods: int, adjust_mode: str = "qfq") -> list[Bar]:
        end = date.today()
        start = end.replace(year=end.year - 1)
        bars = self.get_daily_bars(symbol, market, start, end, adjust_mode)
        return bars[-periods:]

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
