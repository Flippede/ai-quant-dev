from dataclasses import dataclass
from datetime import date, timedelta
from hashlib import sha256
import math


@dataclass(frozen=True)
class DailyBarPoint:
    symbol: str
    trade_date: date
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float


BASE_PRICES = {
    "510300": 3.78,
    "510500": 5.94,
    "159915": 1.84,
    "512880": 0.87,
}


def generate_mock_daily_bars(symbols: list[str], start: date, end: date, warmup_days: int = 260) -> dict[str, list[DailyBarPoint]]:
    data_start = start - timedelta(days=warmup_days)
    return {symbol: _generate_symbol_bars(symbol, data_start, end) for symbol in symbols}


def _generate_symbol_bars(symbol: str, start: date, end: date) -> list[DailyBarPoint]:
    seed = int(sha256(symbol.encode("utf-8")).hexdigest()[:8], 16)
    base = BASE_PRICES.get(symbol, 2.0 + (seed % 900) / 100)
    drift = 0.00005 + ((seed % 17) - 5) / 100000
    cycle_amp = 0.006 + (seed % 7) / 2000
    phase = (seed % 360) / 57.2958

    bars: list[DailyBarPoint] = []
    current = start
    index = 0
    price = base
    while current <= end:
        if current.weekday() < 5:
            seasonal = math.sin(index / 13 + phase) * cycle_amp
            medium_cycle = math.sin(index / 47 + phase / 2) * 0.0035
            shock = ((seed >> (index % 16)) & 7) / 10000 - 0.00035
            daily_return = drift + seasonal + medium_cycle + shock
            open_price = price
            close = max(0.05, price * (1 + daily_return))
            high = max(open_price, close) * 1.006
            low = min(open_price, close) * 0.994
            volume = 900000 + (seed % 100000) + index * 120
            bars.append(
                DailyBarPoint(
                    symbol=symbol,
                    trade_date=current,
                    open=round(open_price, 4),
                    high=round(high, 4),
                    low=round(low, 4),
                    close=round(close, 4),
                    volume=float(volume),
                    amount=round(close * volume, 4),
                )
            )
            price = close
            index += 1
        current += timedelta(days=1)
    return bars
