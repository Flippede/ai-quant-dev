from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.market_data.base import Bar, InstrumentInfo, MarketDataProvider, Quote

MOCK_INSTRUMENTS: list[InstrumentInfo] = [
    InstrumentInfo("000001", "CN", "上证指数", "index", "SSE", metadata={"alias": "SHCOMP"}),
    InstrumentInfo("000300", "CN", "沪深300", "index", "CSI", metadata={"alias": "CSI300"}),
    InstrumentInfo("399006", "CN", "创业板指", "index", "SZSE", metadata={"alias": "CHINEXT"}),
    InstrumentInfo("510300", "CN", "沪深300ETF", "etf", "SSE", metadata={"tracking": "沪深300"}),
    InstrumentInfo("510500", "CN", "中证500ETF", "etf", "SSE", metadata={"tracking": "中证500"}),
    InstrumentInfo("159915", "CN", "创业板ETF", "etf", "SZSE", metadata={"tracking": "创业板指"}),
    InstrumentInfo("512880", "CN", "证券ETF", "etf", "SSE", metadata={"theme": "证券"}),
    InstrumentInfo("600519", "CN", "贵州茅台", "stock", "SSE", metadata={"industry": "白酒"}),
    InstrumentInfo("000858", "CN", "五粮液", "stock", "SZSE", metadata={"industry": "白酒"}),
    InstrumentInfo("300750", "CN", "宁德时代", "stock", "SZSE", metadata={"industry": "电池"}),
    InstrumentInfo("601318", "CN", "中国平安", "stock", "SSE", metadata={"industry": "保险"}),
]

PRICE_BASES: dict[str, Decimal] = {
    "000001": Decimal("3128.45"),
    "000300": Decimal("3672.80"),
    "399006": Decimal("1845.22"),
    "510300": Decimal("3.782"),
    "510500": Decimal("5.945"),
    "159915": Decimal("1.842"),
    "512880": Decimal("0.873"),
    "600519": Decimal("1688.00"),
    "000858": Decimal("151.20"),
    "300750": Decimal("212.35"),
    "601318": Decimal("46.18"),
}

PCT_CHANGES: dict[str, Decimal] = {
    "000001": Decimal("0.42"),
    "000300": Decimal("0.68"),
    "399006": Decimal("-0.31"),
    "510300": Decimal("0.65"),
    "510500": Decimal("0.28"),
    "159915": Decimal("-0.22"),
    "512880": Decimal("1.15"),
    "600519": Decimal("0.36"),
    "000858": Decimal("-0.18"),
    "300750": Decimal("1.08"),
    "601318": Decimal("0.74"),
}


class MockMarketDataProvider(MarketDataProvider):
    """Deterministic mock data for wiring the app before real providers exist."""

    def __init__(self) -> None:
        self.market_tz = ZoneInfo(settings.market_timezone)
        self._instruments = {(item.market, item.symbol): item for item in MOCK_INSTRUMENTS}

    def get_realtime_quotes(self, symbols: list[str]) -> list[Quote]:
        now = datetime.now(self.market_tz)
        quotes: list[Quote] = []
        for index, raw_symbol in enumerate(symbols):
            symbol = raw_symbol.strip()
            instrument = self._find_by_symbol(symbol)
            base = PRICE_BASES.get(symbol, Decimal("10") + Decimal(index))
            pct_change = PCT_CHANGES.get(symbol, Decimal("0.50"))
            quotes.append(
                Quote(
                    symbol=symbol,
                    market=instrument.market if instrument else "CN",
                    name=instrument.name if instrument else symbol,
                    asset_type=instrument.asset_type if instrument else "stock",
                    ts=now,
                    last_price=base,
                    pct_change=pct_change,
                    volume=Decimal("1000000") + Decimal(index * 10000),
                    amount=base * (Decimal("1000000") + Decimal(index * 10000)),
                )
            )
        return quotes

    def get_daily_bars(self, symbol: str, market: str, start: date, end: date, adjust_mode: str = "qfq") -> list[Bar]:
        bars: list[Bar] = []
        current = start
        price = PRICE_BASES.get(symbol, Decimal("10"))
        while current <= end:
            if current.weekday() < 5:
                bars.append(
                    Bar(
                        symbol=symbol,
                        market="CN",
                        ts=current,
                        open=price,
                        high=price * Decimal("1.012"),
                        low=price * Decimal("0.994"),
                        close=price * Decimal("1.005"),
                        volume=Decimal("1000000"),
                        amount=price * Decimal("1000000"),
                    )
                )
                price *= Decimal("1.001")
            current += timedelta(days=1)
        return bars

    def get_intraday_bars(self, symbol: str, freq: str, start: datetime, end: datetime) -> list[Bar]:
        bars: list[Bar] = []
        current = start
        price = PRICE_BASES.get(symbol, Decimal("10"))
        step = timedelta(minutes=1 if freq == "1m" else 5)
        while current <= end:
            bars.append(
                Bar(
                    symbol=symbol,
                    market="CN",
                    ts=current,
                    open=price,
                    high=price * Decimal("1.002"),
                    low=price * Decimal("0.999"),
                    close=price * Decimal("1.001"),
                    volume=Decimal("10000"),
                    amount=price * Decimal("10000"),
                )
            )
            price *= Decimal("1.0002")
            current += step
        return bars

    def get_index_quotes(self, symbols: list[str]) -> list[Quote]:
        return self.get_realtime_quotes(symbols)

    def search_instruments(self, keyword: str) -> list[InstrumentInfo]:
        normalized = keyword.strip().lower()
        if not normalized:
            return MOCK_INSTRUMENTS[:10]
        return [
            item
            for item in MOCK_INSTRUMENTS
            if normalized in item.symbol.lower()
            or normalized in item.name.lower()
            or normalized in str((item.metadata or {}).get("alias", "")).lower()
        ][:20]

    def get_instrument_detail(self, symbol: str, market: str) -> InstrumentInfo | None:
        return self._instruments.get((market, symbol))

    def get_market_calendar(self, start: date, end: date) -> list[date]:
        days: list[date] = []
        current = start
        while current <= end:
            if current.weekday() < 5:
                days.append(current)
            current += timedelta(days=1)
        return days

    def _find_by_symbol(self, symbol: str) -> InstrumentInfo | None:
        for item in MOCK_INSTRUMENTS:
            if item.symbol == symbol:
                return item
        return None
