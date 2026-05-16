from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.timezone import utc_now
from app.models.core import BacktestRun, BacktestTrade, StrategyTemplate, User, UserStrategyConfig, WatchlistItem
from app.research.backtest_engine import BacktestEngine, BacktestInputError, BacktestUnsupportedStrategyError
from app.research.contexts import BacktestAssumptions, BacktestRequest
from app.schemas.backtests import BacktestRunPublic, BacktestTradePublic


class BacktestServiceError(Exception):
    pass


def create_backtest(
    db: Session,
    user: User,
    strategy_config_id: UUID,
    symbols: list[str] | None,
    start_date: date,
    end_date: date,
    initial_cash: float,
    fee_rate: float,
    slippage_rate: float,
    execution_price_type: str,
    adjustment_mode: str,
) -> BacktestRunPublic:
    config = db.scalar(select(UserStrategyConfig).where(UserStrategyConfig.id == strategy_config_id, UserStrategyConfig.user_id == user.id))
    if config is None:
        raise BacktestServiceError("Strategy config not found")
    template = db.get(StrategyTemplate, config.template_id)
    if template is None:
        raise BacktestServiceError("Strategy template not found")
    if template.key != "etf_momentum_rotation":
        raise BacktestServiceError(f"Strategy {template.key} is not supported for Phase 5 backtesting")

    resolved_symbols = _resolve_symbols(db, user, config, symbols)
    assumptions = BacktestAssumptions(
        initial_cash=initial_cash,
        fee_rate=fee_rate,
        slippage_rate=slippage_rate,
        execution_price_type=execution_price_type,
        adjustment_mode=adjustment_mode,
        rebalance_frequency=str(config.params_json.get("rebalance_frequency", "weekly")),
    )
    run = BacktestRun(
        user_id=user.id,
        strategy_config_id=config.id,
        strategy_template_id=template.id,
        symbols_json=resolved_symbols,
        start_date=start_date,
        end_date=end_date,
        params_snapshot_json=config.params_json,
        assumptions_json=assumptions.to_json(),
        status="pending",
        metrics_json={},
        equity_curve_json=[],
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    run.status = "running"
    run.started_at = utc_now()
    db.commit()
    db.refresh(run)

    try:
        result = BacktestEngine().run(
            BacktestRequest(
                user_id=user.id,
                strategy_config_id=config.id,
                strategy_template_id=template.id,
                template_key=template.key,
                symbols=resolved_symbols,
                start_date=start_date,
                end_date=end_date,
                params=config.params_json,
                assumptions=assumptions,
            )
        )
    except (BacktestInputError, BacktestUnsupportedStrategyError) as exc:
        run.status = "failed"
        run.error_message = str(exc)
        run.finished_at = utc_now()
        db.commit()
        db.refresh(run)
        raise BacktestServiceError(str(exc)) from exc
    except Exception as exc:
        run.status = "failed"
        run.error_message = "Backtest execution failed"
        run.finished_at = utc_now()
        db.commit()
        db.refresh(run)
        raise

    run.status = "succeeded"
    run.metrics_json = result.metrics
    run.equity_curve_json = result.equity_curve
    run.assumptions_json = {**run.assumptions_json, "diagnostics": result.diagnostics, "warnings": result.warnings}
    run.finished_at = utc_now()
    for trade in result.trades:
        db.add(
            BacktestTrade(
                user_id=user.id,
                backtest_run_id=run.id,
                symbol=trade.symbol,
                side=trade.side,
                trade_date=trade.trade_date,
                price=trade.price,
                quantity=trade.quantity,
                amount=trade.amount,
                fee=trade.fee,
                pnl=trade.pnl,
                reason=trade.reason,
            )
        )
    db.commit()
    db.refresh(run)
    return _run_public(db, run, template, config, include_details=True)


def list_backtests(db: Session, user: User) -> list[BacktestRunPublic]:
    runs = list(
        db.scalars(
            select(BacktestRun)
            .where(BacktestRun.user_id == user.id)
            .order_by(BacktestRun.created_at.desc())
        )
    )
    return [_run_public(db, run, include_details=False) for run in runs]


def get_backtest(db: Session, user: User, run_id: UUID) -> BacktestRunPublic | None:
    run = _get_owned_run(db, user, run_id)
    if run is None:
        return None
    return _run_public(db, run, include_details=True)


def delete_backtest(db: Session, user: User, run_id: UUID) -> bool:
    run = _get_owned_run(db, user, run_id)
    if run is None:
        return False
    db.execute(delete(BacktestTrade).where(BacktestTrade.user_id == user.id, BacktestTrade.backtest_run_id == run.id))
    db.delete(run)
    db.commit()
    return True


def backtest_summary(db: Session, user: User) -> dict[str, Any]:
    total_count = db.scalar(select(func.count()).select_from(BacktestRun).where(BacktestRun.user_id == user.id)) or 0
    recent_runs = list_backtests(db, user)[:3]
    return {"total_count": total_count, "recent_runs": recent_runs}


def _resolve_symbols(db: Session, user: User, config: UserStrategyConfig, symbols: list[str] | None) -> list[str]:
    explicit = [symbol.strip() for symbol in symbols or [] if symbol.strip()]
    if explicit:
        return sorted(dict.fromkeys(explicit))

    scope = config.watch_scope_json or {}
    scope_type = scope.get("type", "all_watchlists")
    if scope_type == "etf_pool":
        return _symbols_from_items(scope.get("etf_pool", []))
    if scope_type == "instruments":
        return _symbols_from_items(scope.get("instruments", []))
    if scope_type == "watchlist_groups":
        group_ids = scope.get("watchlist_group_ids", [])
        items = list(
            db.scalars(
                select(WatchlistItem).where(
                    WatchlistItem.user_id == user.id,
                    WatchlistItem.group_id.in_(group_ids),
                )
            )
        )
        return sorted({item.symbol for item in items})

    items = list(db.scalars(select(WatchlistItem).where(WatchlistItem.user_id == user.id, WatchlistItem.asset_type == "etf")))
    return sorted({item.symbol for item in items}) or ["510300", "510500", "159915", "512880"]


def _symbols_from_items(items: list[dict[str, Any]]) -> list[str]:
    return sorted(dict.fromkeys(str(item.get("symbol", "")).strip() for item in items if str(item.get("symbol", "")).strip()))


def _get_owned_run(db: Session, user: User, run_id: UUID) -> BacktestRun | None:
    return db.scalar(select(BacktestRun).where(BacktestRun.id == run_id, BacktestRun.user_id == user.id))


def _run_public(
    db: Session,
    run: BacktestRun,
    template: StrategyTemplate | None = None,
    config: UserStrategyConfig | None = None,
    include_details: bool = False,
) -> BacktestRunPublic:
    template = template or db.get(StrategyTemplate, run.strategy_template_id)
    config = config or (db.get(UserStrategyConfig, run.strategy_config_id) if run.strategy_config_id else None)
    trades = []
    if include_details:
        trade_rows = list(
            db.scalars(
                select(BacktestTrade)
                .where(BacktestTrade.user_id == run.user_id, BacktestTrade.backtest_run_id == run.id)
                .order_by(BacktestTrade.trade_date, BacktestTrade.created_at)
            )
        )
        trades = [BacktestTradePublic.model_validate(trade) for trade in trade_rows]

    return BacktestRunPublic(
        id=run.id,
        user_id=run.user_id,
        strategy_config_id=run.strategy_config_id,
        strategy_template_id=run.strategy_template_id,
        strategy_config_name=config.name if config else None,
        strategy_template_key=template.key if template else None,
        strategy_template_name=template.name if template else None,
        status=run.status,
        symbols_json=run.symbols_json,
        start_date=run.start_date,
        end_date=run.end_date,
        params_snapshot_json=run.params_snapshot_json,
        assumptions_json=run.assumptions_json,
        metrics_json=run.metrics_json,
        equity_curve_json=run.equity_curve_json,
        error_message=run.error_message,
        created_at=run.created_at,
        updated_at=run.updated_at,
        started_at=run.started_at,
        finished_at=run.finished_at,
        trades=trades,
    )
