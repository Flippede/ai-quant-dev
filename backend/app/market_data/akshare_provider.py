from datetime import date, datetime, timedelta
from decimal import Decimal
import logging
from typing import Any
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.market_data.base import Bar, InstrumentInfo, MarketDataProvider, Quote
from app.market_data.symbols import infer_exchange, normalize_symbol, provider_code

logger = logging.getLogger(__name__)


class AKShareProvider(MarketDataProvider):
    provider_name = "akshare"

    def __init__(self) -> None:
        import akshare as ak

        self.ak = ak
        self.market_tz = ZoneInfo(settings.market_timezone)

    def get_realtime_quotes(self, instruments: list[str]) -> list[Quote]:
        symbols = {normalize_symbol(symbol) for symbol in instruments}
        rows = []
        for fetcher, asset_type in (
            (self._stock_spot, "stock"),
            (self.ak.fund_etf_spot_em, "etf"),
        ):
            try:
                df = fetcher()
            except Exception:
                logger.exception("AKShare realtime quote fetch failed asset_type=%s", asset_type)
                continue
            rows.extend(self._spot_rows(df, symbols, asset_type))
        return rows

    def _stock_spot(self):
        try:
            return self.ak.stock_zh_a_spot_em()
        except Exception:
            return self.ak.stock_zh_a_spot()

    def get_index_quotes(self, symbols: list[str]) -> list[Quote]:
        wanted = {normalize_symbol(symbol) for symbol in symbols}
        try:
            df = self.ak.stock_zh_index_spot_em()
        except Exception:
            try:
                df = self.ak.stock_zh_index_spot_sina()
            except Exception:
                logger.exception("AKShare index quote fetch failed")
                return []
        return self._spot_rows(df, wanted, "index")

    def search_instruments(self, keyword: str) -> list[InstrumentInfo]:
        normalized = keyword.strip().lower()
        instruments: list[InstrumentInfo] = []
        for fetcher, asset_type in ((self.ak.stock_zh_a_spot_em, "stock"), (self.ak.fund_etf_spot_em, "etf")):
            try:
                df = fetcher()
            except Exception:
                logger.exception("AKShare instrument search fetch failed asset_type=%s", asset_type)
                continue
            for row in df.to_dict("records")[:6000]:
                symbol = normalize_symbol(str(row.get("代码", "")))
                name = str(row.get("名称", symbol))
                if normalized and normalized not in symbol.lower() and normalized not in name.lower():
                    continue
                instruments.append(
                    InstrumentInfo(
                        symbol=symbol,
                        market="CN",
                        name=name,
                        asset_type=asset_type,
                        exchange=infer_exchange(symbol),
                        metadata={"provider": self.provider_name},
                    )
                )
                if len(instruments) >= 20:
                    return instruments
        return instruments

    def get_instrument_detail(self, symbol: str, market: str) -> InstrumentInfo | None:
        quotes = self.get_realtime_quotes([symbol])
        if quotes:
            quote = quotes[0]
            return InstrumentInfo(quote.symbol, "CN", quote.name, quote.asset_type, quote.exchange, metadata={"provider": self.provider_name})
        return None

    def get_daily_bars(self, symbol: str, market: str, start: date, end: date, adjust_mode: str = "qfq") -> list[Bar]:
        clean = normalize_symbol(symbol)
        start_s = start.strftime("%Y%m%d")
        end_s = end.strftime("%Y%m%d")
        provider_adjust = "" if adjust_mode == "none" else adjust_mode
        fetchers = []
        if clean.startswith(("5", "1")):
            fetchers.append(lambda: self.ak.fund_etf_hist_em(symbol=clean, period="daily", start_date=start_s, end_date=end_s, adjust=provider_adjust))
            fetchers.append(lambda: self.ak.fund_etf_hist_sina(symbol=f"{infer_exchange(clean).lower()}{clean}"))
        fetchers.append(lambda: self.ak.stock_zh_a_hist(symbol=clean, period="daily", start_date=start_s, end_date=end_s, adjust=provider_adjust))
        exchange = infer_exchange(clean)
        if exchange:
            fetchers.append(
                lambda: self.ak.stock_zh_a_daily(
                    symbol=f"{exchange.lower()}{clean}",
                    start_date=start_s,
                    end_date=end_s,
                    adjust=provider_adjust,
                )
            )
        for fetcher in fetchers:
            try:
                df = fetcher()
            except Exception:
                logger.exception("AKShare daily bars fetch failed symbol=%s", clean)
                continue
            bars = self._daily_rows(clean, df)
            if bars:
                return bars
        return []

    def get_intraday_bars(self, symbol: str, freq: str, start: datetime, end: datetime) -> list[Bar]:
        return []

    def get_market_calendar(self, start: date, end: date) -> list[date]:
        days: list[date] = []
        current = start
        while current <= end:
            if current.weekday() < 5:
                days.append(current)
            current += timedelta(days=1)
        return days

    def _spot_rows(self, df: Any, wanted: set[str], asset_type: str) -> list[Quote]:
        now = datetime.now(self.market_tz)
        quotes: list[Quote] = []
        for row in df.to_dict("records"):
            symbol = normalize_symbol(str(row.get("代码", "")))
            if symbol not in wanted:
                continue
            price = _decimal(row.get("最新价"))
            pct = _decimal(row.get("涨跌幅"))
            volume = _decimal(row.get("成交量"))
            amount = _decimal(row.get("成交额"))
            quotes.append(
                Quote(
                    symbol=symbol,
                    market="CN",
                    name=str(row.get("名称", symbol)),
                    asset_type=asset_type,
                    ts=now,
                    last_price=price,
                    pct_change=pct,
                    volume=volume,
                    amount=amount,
                    exchange=_exchange_for(symbol, asset_type),
                    provider=self.provider_name,
                    source_status="ok",
                )
            )
        return quotes

    def _daily_rows(self, symbol: str, df: Any) -> list[Bar]:
        bars: list[Bar] = []
        for row in df.to_dict("records"):
            trade_date = row.get("日期") or row.get("date")
            if not trade_date:
                continue
            if not isinstance(trade_date, date):
                trade_date = datetime.strptime(str(trade_date), "%Y-%m-%d").date()
            close = _decimal(row.get("收盘") or row.get("close"))
            volume = _decimal(row.get("成交量") or row.get("volume"))
            bars.append(
                Bar(
                    symbol=symbol,
                    market="CN",
                    ts=trade_date,
                    open=_decimal(row.get("开盘") or row.get("open")),
                    high=_decimal(row.get("最高") or row.get("high")),
                    low=_decimal(row.get("最低") or row.get("low")),
                    close=close,
                    volume=volume,
                    amount=_decimal(row.get("成交额") or row.get("amount")),
                )
            )
        return bars


def _decimal(value: Any) -> Decimal:
    try:
        if value is None or str(value) in {"-", "nan", "None"}:
            return Decimal("0")
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def _exchange_for(symbol: str, asset_type: str) -> str | None:
    if asset_type == "index" and symbol in {"000001", "000300"}:
        return "SH"
    return infer_exchange(symbol)
