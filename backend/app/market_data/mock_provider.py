from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.market_data.base import Bar, MarketDataProvider, Quote


class MockMarketDataProvider(MarketDataProvider):
    """Deterministic mock data for wiring the app before real providers exist."""

    def __init__(self) -> None:
        self.market_tz = ZoneInfo(settings.market_timezone)

    def get_realtime_quotes(self, symbols: list[str]) -> list[Quote]:
        now = datetime.now(self.market_tz)
        quotes: list[Quote] = []
        for index, symbol in enumerate(symbols):
            base = Decimal("10") + Decimal(index)
            quotes.append(
                Quote(
                    symbol=symbol,
                    market="CN",
                    ts=now,
                    last_price=base,
                    pct_change=Decimal("0.50"),
                    volume=Decimal("1000000"),
                    amount=base * Decimal("1000000"),
                )
            )
        return quotes

    def get_daily_bars(self, symbol: str, start: date, end: date) -> list[Bar]:
        bars: list[Bar] = []
        current = start
        price = Decimal("10")
        while current <= end:
            if current.weekday() < 5:
                bars.append(
                    Bar(
                        symbol=symbol,
                        market="CN",
                        ts=current,
                        open=price,
                        high=price + Decimal("0.20"),
                        low=price - Decimal("0.10"),
                        close=price + Decimal("0.05"),
                        volume=Decimal("1000000"),
                        amount=price * Decimal("1000000"),
                    )
                )
                price += Decimal("0.03")
            current += timedelta(days=1)
        return bars

    def get_intraday_bars(self, symbol: str, freq: str, start: datetime, end: datetime) -> list[Bar]:
        bars: list[Bar] = []
        current = start
        price = Decimal("10")
        step = timedelta(minutes=1 if freq == "1m" else 5)
        while current <= end:
            bars.append(
                Bar(
                    symbol=symbol,
                    market="CN",
                    ts=current,
                    open=price,
                    high=price + Decimal("0.02"),
                    low=price - Decimal("0.01"),
                    close=price + Decimal("0.01"),
                    volume=Decimal("10000"),
                    amount=price * Decimal("10000"),
                )
            )
            price += Decimal("0.01")
            current += step
        return bars

    def get_index_quotes(self, symbols: list[str]) -> list[Quote]:
        return self.get_realtime_quotes(symbols)

    def get_market_calendar(self, start: date, end: date) -> list[date]:
        days: list[date] = []
        current = start
        while current <= end:
            if current.weekday() < 5:
                days.append(current)
            current += timedelta(days=1)
        return days

