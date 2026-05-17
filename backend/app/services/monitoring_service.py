from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import get_redis_client
from app.core.timezone import utc_now
from app.market_data.base import Bar, Quote
from app.market_data.provider import get_market_data_provider, get_market_data_provider_name
from app.models.core import StrategySignal as StrategySignalModel
from app.models.core import StrategyTemplate, User, UserStrategyConfig, WatchlistItem
from app.services.market_service import get_market_overview, get_quotes

logger = logging.getLogger(__name__)


@dataclass
class MonitoringStatus:
    scheduler_running: bool = False
    last_quote_refresh_at: datetime | None = None
    last_strategy_scan_at: datetime | None = None
    last_error: str | None = None


monitoring_status = MonitoringStatus()
MONITORING_STATUS_KEY = "system:monitoring_status"


def mark_scheduler_heartbeat(running: bool = True) -> None:
    now = utc_now()
    monitoring_status.scheduler_running = running
    _write_status({"scheduler_running": str(running).lower(), "scheduler_heartbeat_at": now.isoformat()})


def refresh_market_quotes_once(db: Session) -> int:
    users_with_items = list(db.scalars(select(WatchlistItem.symbol).distinct()))
    symbols = sorted(set(users_with_items) | {"000001", "000300", "399006"})
    if symbols:
        try:
            get_quotes(db, symbols)
            get_market_overview(db)
        except Exception as exc:
            monitoring_status.last_error = f"market refresh failed: {exc}"
            logger.exception("Market quote refresh failed symbols=%s", ",".join(symbols[:20]))
            raise
    monitoring_status.last_quote_refresh_at = utc_now()
    _write_status({"last_quote_refresh_at": monitoring_status.last_quote_refresh_at.isoformat(), "last_error": ""})
    return len(symbols)


def scan_enabled_strategies_once(db: Session, force: bool = False) -> int:
    configs = list(db.scalars(select(UserStrategyConfig).where(UserStrategyConfig.is_enabled.is_(True))))
    written = 0
    provider = get_market_data_provider()
    for config in configs:
        user = db.get(User, config.user_id)
        template = db.get(StrategyTemplate, config.template_id)
        if user is None or template is None:
            continue
        symbols = _resolve_symbols(db, user, config)
        if not symbols:
            continue
        try:
            quotes = {quote.symbol: quote for quote in provider.get_realtime_quotes(symbols)}
        except Exception:
            logger.exception("Realtime quote fetch failed user_id=%s strategy_config_id=%s", user.id, config.id)
            continue
        for symbol in symbols:
            try:
                bars = provider.get_recent_daily_bars(symbol, "CN", 90, "qfq")
            except Exception:
                logger.exception("Recent daily bars fetch failed user_id=%s strategy_config_id=%s symbol=%s", user.id, config.id, symbol)
                continue
            signals = _evaluate(template.key, config.params_json, symbol, quotes.get(symbol), bars)
            for signal in signals:
                if _write_signal(db, user, config, template, signal, force):
                    written += 1
    db.commit()
    monitoring_status.last_strategy_scan_at = utc_now()
    _write_status({"last_strategy_scan_at": monitoring_status.last_strategy_scan_at.isoformat(), "last_error": ""})
    return written


def record_monitoring_error(message: str) -> None:
    monitoring_status.last_error = message
    _write_status({"last_error": message})


def get_monitoring_status_snapshot() -> dict[str, Any]:
    data = get_redis_client().hgetall(MONITORING_STATUS_KEY)
    heartbeat = _parse_iso(data.get("scheduler_heartbeat_at"))
    scheduler_running = data.get("scheduler_running") == "true" and heartbeat is not None and (utc_now() - heartbeat).total_seconds() < max(120, settings.market_refresh_interval_seconds * 3)
    return {
        "scheduler_running": scheduler_running,
        "last_quote_refresh_at": _parse_iso(data.get("last_quote_refresh_at")) or monitoring_status.last_quote_refresh_at,
        "last_strategy_scan_at": _parse_iso(data.get("last_strategy_scan_at")) or monitoring_status.last_strategy_scan_at,
        "last_error": data.get("last_error") or monitoring_status.last_error,
    }


def _evaluate(template_key: str, params: dict[str, Any], symbol: str, quote: Quote | None, bars: list[Bar]) -> list[dict[str, Any]]:
    if not quote or len(bars) < 20:
        return []
    closes = [float(bar.close) for bar in bars]
    volumes = [float(bar.volume) for bar in bars]
    price = float(quote.last_price)

    if template_key == "trend_follow":
        short_n = int(params.get("short_ma_period", 20))
        long_n = int(params.get("long_ma_period", 60))
        momentum_n = int(params.get("momentum_period", 20))
        if len(closes) < max(short_n, long_n, momentum_n) + 1:
            return []
        short_ma = _avg(closes[-short_n:])
        long_ma = _avg(closes[-long_n:])
        momentum = price / closes[-momentum_n] - 1
        volume_ratio = float(quote.volume) / max(_avg(volumes[-20:]), 1)
        if price > short_ma > long_ma and momentum >= float(params.get("min_momentum_pct", 0)) / 100:
            severity = "strong" if volume_ratio >= float(params.get("volume_ratio_threshold", 1.0)) else "watch"
            return [_signal("trend_follow", severity, symbol, "趋势走强", f"{symbol} 当前价格高于 MA{short_n}/MA{long_n}，近{momentum_n}日动量 {momentum*100:.2f}%。", momentum * 100, {"short_ma": short_ma, "long_ma": long_ma, "volume_ratio": volume_ratio})]

    if template_key == "volume_breakout":
        window = int(params.get("breakout_window", 20))
        if len(closes) < window + 1:
            return []
        previous_high = max(closes[-window - 1 : -1])
        volume_ratio = float(quote.volume) / max(_avg(volumes[-window:]), 1)
        if price > previous_high:
            threshold = float(params.get("volume_ratio_threshold", 1.5))
            severity = "strong" if volume_ratio >= threshold else "watch"
            return [_signal("volume_breakout", f"breakout_{severity}", symbol, "放量突破关注", f"{symbol} 当前价格突破近{window}日高点，成交量比 {volume_ratio:.2f}。", volume_ratio, {"previous_high": previous_high, "volume_ratio": volume_ratio})]

    if template_key == "risk_warning":
        ma_n = int(params.get("ma_period", 20))
        volatility_n = int(params.get("volatility_window", 20))
        if len(closes) < max(ma_n, volatility_n) + 1:
            return []
        ma = _avg(closes[-ma_n:])
        returns = [closes[i] / closes[i - 1] - 1 for i in range(len(closes) - volatility_n, len(closes))]
        volatility = (_std(returns) * (252**0.5)) * 100
        peak = max(closes[-60:])
        drawdown = (price / peak - 1) * 100
        if price < ma or volatility >= float(params.get("volatility_threshold", 5)) or abs(drawdown) >= float(params.get("drawdown_threshold_pct", 10)):
            severity = "risk_high" if abs(drawdown) >= float(params.get("drawdown_threshold_pct", 10)) else "risk_medium"
            return [_signal("risk_warning", severity, symbol, "风险预警", f"{symbol} 价格/波动/回撤触发风险条件，当前回撤 {drawdown:.2f}%。", abs(drawdown), {"ma": ma, "volatility_pct": volatility, "drawdown_pct": drawdown})]

    if template_key == "etf_momentum_rotation":
        lookback = int(params.get("lookback_period", 20))
        if len(closes) < lookback + 1:
            return []
        momentum = price / closes[-lookback] - 1
        if momentum > 0:
            return [_signal("etf_momentum_rotation", "watch", symbol, "ETF 动量关注", f"{symbol} 近{lookback}日动量 {momentum*100:.2f}%，已纳入当前 ETF 池排序候选。", momentum * 100, {"momentum_pct": momentum * 100})]
    return []


def _signal(signal_type: str, severity: str, symbol: str, title: str, message: str, score: float, payload: dict[str, Any]) -> dict[str, Any]:
    return {"signal_type": signal_type, "severity": severity, "symbol": symbol, "title": title, "message": message, "score": score, "payload": payload}


def _write_signal(db: Session, user: User, config: UserStrategyConfig, template: StrategyTemplate, signal: dict[str, Any], force: bool) -> bool:
    cooldown_start = utc_now() - timedelta(seconds=settings.signal_cooldown_seconds)
    if not force:
        existing = db.scalar(
            select(StrategySignalModel)
            .where(
                StrategySignalModel.user_id == user.id,
                StrategySignalModel.strategy_config_id == config.id,
                StrategySignalModel.symbol == signal["symbol"],
                StrategySignalModel.signal_type == signal["signal_type"],
                StrategySignalModel.triggered_at >= cooldown_start,
            )
            .limit(1)
        )
        if existing is not None:
            return False
    db.add(
        StrategySignalModel(
            user_id=user.id,
            strategy_config_id=config.id,
            template_id=template.id,
            symbol=signal["symbol"],
            market="CN",
            signal_type=signal["signal_type"],
            severity=signal["severity"],
            title=signal["title"],
            message=signal["message"],
            score=Decimal(str(round(float(signal["score"]), 4))),
            payload_json={**signal["payload"], "provider": get_market_data_provider_name()},
            triggered_at=utc_now(),
        )
    )
    return True


def _resolve_symbols(db: Session, user: User, config: UserStrategyConfig) -> list[str]:
    scope = config.watch_scope_json or {}
    scope_type = scope.get("type", "all_watchlists")
    if scope_type in {"etf_pool", "instruments"}:
        key = "etf_pool" if scope_type == "etf_pool" else "instruments"
        return sorted({item.get("symbol") for item in scope.get(key, []) if item.get("symbol")})
    if scope_type == "watchlist_groups":
        group_ids = scope.get("watchlist_group_ids", [])
        items = db.scalars(select(WatchlistItem).where(WatchlistItem.user_id == user.id, WatchlistItem.group_id.in_(group_ids)))
    else:
        items = db.scalars(select(WatchlistItem).where(WatchlistItem.user_id == user.id))
    return sorted({item.symbol for item in items})


def _avg(values: list[float]) -> float:
    return sum(values) / len(values)


def _std(values: list[float]) -> float:
    avg = _avg(values)
    return (sum((value - avg) ** 2 for value in values) / len(values)) ** 0.5


def _write_status(values: dict[str, str]) -> None:
    try:
        get_redis_client().hset(MONITORING_STATUS_KEY, mapping=values)
        get_redis_client().expire(MONITORING_STATUS_KEY, max(300, settings.market_refresh_interval_seconds * 5))
    except Exception:
        logger.exception("Failed to write monitoring status to Redis")


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None
