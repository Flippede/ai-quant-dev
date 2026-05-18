from datetime import date, datetime

from app.market_data.base import Bar, InstrumentInfo, MarketDataProvider, Quote


class TushareProvider(MarketDataProvider):
    provider_name = "tushare"

    def _not_configured(self) -> None:
        raise NotImplementedError("TushareProvider is not configured yet; set MARKET_DATA_PROVIDER=akshare or mock")

    def get_realtime_quotes(self, instruments: list[str]) -> list[Quote]:
        self._not_configured()

    def get_daily_bars(self, symbol: str, market: str, start: date, end: date, adjust_mode: str = "qfq") -> list[Bar]:
        self._not_configured()

    def get_intraday_bars(
        self,
        symbol: str,
        market: str,
        instrument_type: str,
        period: str,
        start: datetime,
        end: datetime,
        adjust_mode: str = "none",
    ) -> list[Bar]:
        self._not_configured()

    def get_index_quotes(self, symbols: list[str]) -> list[Quote]:
        self._not_configured()

    def search_instruments(self, keyword: str) -> list[InstrumentInfo]:
        self._not_configured()

    def get_instrument_detail(self, symbol: str, market: str) -> InstrumentInfo | None:
        self._not_configured()
