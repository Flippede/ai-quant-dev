from typing import Any
from uuid import UUID
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.prompts import backtest_explainer, dashboard_summary, signal_explainer, strategy_advisor, strategy_config_explainer
from app.ai.providers import AIProviderError, get_ai_provider
from app.core.config import settings
from app.core.redis import get_redis_client
from app.models.core import (
    AiConversation,
    AiMessage,
    BacktestRun,
    BacktestTrade,
    StrategySignal,
    StrategyTemplate,
    User,
    UserStrategyConfig,
    WatchlistItem,
)
from app.schemas.ai import AIConversationDetailPublic, AIConversationPublic, AIMessagePublic, AIResponsePublic


class AIServiceError(Exception):
    pass


def strategy_advisor_api(db: Session, user: User, user_prompt: str, risk_preference: str | None, asset_focus: str | None) -> AIResponsePublic:
    messages = strategy_advisor.build_prompt(user_prompt, risk_preference, asset_focus)
    return _run_ai(db, user, "strategy_advisor", None, "策略设计助手", messages, {"user_prompt": user_prompt, "risk_preference": risk_preference, "asset_focus": asset_focus})


def explain_strategy_config(db: Session, user: User, config_id: UUID) -> AIResponsePublic:
    config = db.scalar(select(UserStrategyConfig).where(UserStrategyConfig.id == config_id, UserStrategyConfig.user_id == user.id))
    if config is None:
        raise AIServiceError("Strategy config not found")
    template = db.get(StrategyTemplate, config.template_id)
    context = {"config": _strategy_config_context(config, template)}
    return _run_ai(db, user, "strategy_config_explanation", str(config_id), f"策略解释：{config.name}", strategy_config_explainer.build_prompt(context), context)


def explain_backtest(db: Session, user: User, run_id: UUID) -> AIResponsePublic:
    run = db.scalar(select(BacktestRun).where(BacktestRun.id == run_id, BacktestRun.user_id == user.id))
    if run is None:
        raise AIServiceError("Backtest not found")
    trades = list(db.scalars(select(BacktestTrade).where(BacktestTrade.backtest_run_id == run.id, BacktestTrade.user_id == user.id).order_by(BacktestTrade.trade_date).limit(20)))
    context = {
        "run": {
            "id": str(run.id),
            "status": run.status,
            "data_source": run.data_source,
            "adjustment_mode": run.adjustment_mode,
            "symbols": run.symbols_json,
            "start_date": run.start_date.isoformat(),
            "end_date": run.end_date.isoformat(),
            "metrics": run.metrics_json,
            "assumptions": run.assumptions_json,
            "equity_curve_summary": _equity_summary(run.equity_curve_json),
            "trade_count": len(trades),
            "sample_trades": [_trade_context(trade) for trade in trades[:8]],
        }
    }
    return _run_ai(db, user, "backtest_explanation", str(run_id), "回测解读", backtest_explainer.build_prompt(context), context)


def explain_signal(db: Session, user: User, signal_id: UUID) -> AIResponsePublic:
    signal = db.scalar(select(StrategySignal).where(StrategySignal.id == signal_id, StrategySignal.user_id == user.id))
    if signal is None:
        raise AIServiceError("Signal not found")
    config = db.get(UserStrategyConfig, signal.strategy_config_id) if signal.strategy_config_id else None
    template = db.get(StrategyTemplate, signal.template_id) if signal.template_id else None
    context = {
        "signal": {
            "symbol": signal.symbol,
            "signal_type": signal.signal_type,
            "severity": signal.severity,
            "title": signal.title,
            "message": signal.message,
            "score": float(signal.score) if signal.score is not None else None,
            "payload": signal.payload_json,
        },
        "strategy_config": _strategy_config_context(config, template) if config else None,
    }
    return _run_ai(db, user, "signal_explanation", str(signal_id), f"信号解释：{signal.symbol}", signal_explainer.build_prompt(context), context)


def dashboard_summary_api(db: Session, user: User) -> AIResponsePublic:
    configs = list(db.scalars(select(UserStrategyConfig).where(UserStrategyConfig.user_id == user.id).order_by(UserStrategyConfig.updated_at.desc()).limit(20)))
    signals = list(db.scalars(select(StrategySignal).where(StrategySignal.user_id == user.id).order_by(StrategySignal.triggered_at.desc()).limit(10)))
    backtests = list(db.scalars(select(BacktestRun).where(BacktestRun.user_id == user.id).order_by(BacktestRun.created_at.desc()).limit(5)))
    watch_items = list(db.scalars(select(WatchlistItem).where(WatchlistItem.user_id == user.id).limit(30)))
    context = {
        "enabled_strategy_count": sum(1 for config in configs if config.is_enabled),
        "strategies": [{"name": config.name, "enabled": config.is_enabled, "risk_level": config.risk_level} for config in configs[:8]],
        "recent_signals": [{"symbol": signal.symbol, "type": signal.signal_type, "severity": signal.severity, "title": signal.title} for signal in signals],
        "recent_backtests": [{"status": run.status, "data_source": run.data_source, "metrics": run.metrics_json} for run in backtests],
        "watchlist": [{"symbol": item.symbol, "asset_type": item.asset_type, "name": item.name_snapshot} for item in watch_items[:12]],
    }
    return _run_ai(db, user, "dashboard_summary", None, "Dashboard AI 摘要", dashboard_summary.build_prompt(context), context)


def list_conversations(db: Session, user: User) -> list[AIConversationPublic]:
    rows = list(db.scalars(select(AiConversation).where(AiConversation.user_id == user.id).order_by(AiConversation.updated_at.desc()).limit(100)))
    return [AIConversationPublic.model_validate(row) for row in rows]


def get_conversation(db: Session, user: User, conversation_id: UUID) -> AIConversationDetailPublic | None:
    conversation = db.scalar(select(AiConversation).where(AiConversation.id == conversation_id, AiConversation.user_id == user.id))
    if conversation is None:
        return None
    messages = list(db.scalars(select(AiMessage).where(AiMessage.conversation_id == conversation.id, AiMessage.user_id == user.id).order_by(AiMessage.created_at)))
    return AIConversationDetailPublic(**AIConversationPublic.model_validate(conversation).model_dump(), messages=[AIMessagePublic.model_validate(message) for message in messages])


def _run_ai(db: Session, user: User, context_type: str, context_id: str | None, title: str, prompt_messages: list[dict[str, str]], metadata: dict[str, Any]) -> AIResponsePublic:
    _enforce_rate_limit(user.id)
    try:
        provider = get_ai_provider()
    except AIProviderError as exc:
        raise AIServiceError(str(exc)) from exc
    conversation = AiConversation(user_id=user.id, title=title[:200], provider=provider.provider_name, model=provider.model, context_type=context_type, context_id=context_id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    user_content = prompt_messages[-1]["content"]
    db.add(AiMessage(user_id=user.id, conversation_id=conversation.id, role="user", content=user_content, metadata_json={"context": metadata}))
    try:
        ai_response = provider.generate(prompt_messages)
    except AIProviderError as exc:
        db.add(AiMessage(user_id=user.id, conversation_id=conversation.id, role="assistant", content=str(exc), metadata_json={"error": True}))
        db.commit()
        raise AIServiceError(str(exc)) from exc
    parsed = _parse_json(ai_response.content)
    db.add(AiMessage(user_id=user.id, conversation_id=conversation.id, role="assistant", content=ai_response.content, metadata_json={"parsed_json": parsed, **ai_response.metadata}))
    db.commit()
    return AIResponsePublic(conversation_id=conversation.id, content=ai_response.content, parsed_json=parsed, provider=provider.provider_name, model=provider.model)


def _enforce_rate_limit(user_id) -> None:
    redis = get_redis_client()
    key = f"ai:rate:{user_id}"
    count = redis.incr(key)
    if count == 1:
        redis.expire(key, settings.ai_rate_limit_window_seconds)
    if count > settings.ai_rate_limit_max_requests:
        raise AIServiceError("AI request rate limit exceeded. Please wait before trying again.")


def _parse_json(content: str) -> dict[str, Any] | None:
    try:
        data = json.loads(content)
        return data if isinstance(data, dict) else None
    except Exception:
        start = content.find("{")
        end = content.rfind("}")
        if start >= 0 and end > start:
            try:
                data = json.loads(content[start : end + 1])
                return data if isinstance(data, dict) else None
            except Exception:
                return None
    return None


def _strategy_config_context(config: UserStrategyConfig | None, template: StrategyTemplate | None) -> dict[str, Any]:
    if config is None:
        return {}
    return {
        "id": str(config.id),
        "name": config.name,
        "template_key": template.key if template else None,
        "template_name": template.name if template else None,
        "template_description": template.description if template else None,
        "params": config.params_json,
        "watch_scope": config.watch_scope_json,
        "is_enabled": config.is_enabled,
        "monitor_interval_sec": config.monitor_interval_sec,
        "risk_level": config.risk_level,
    }


def _trade_context(trade: BacktestTrade) -> dict[str, Any]:
    return {"symbol": trade.symbol, "side": trade.side, "date": trade.trade_date.isoformat(), "amount": float(trade.amount), "pnl": float(trade.pnl) if trade.pnl is not None else None, "reason": trade.reason}


def _equity_summary(curve: list[dict[str, Any]]) -> dict[str, Any]:
    if not curve:
        return {}
    return {"points": len(curve), "first": curve[0], "last": curve[-1], "min_equity": min(point["equity"] for point in curve), "max_equity": max(point["equity"] for point in curve)}
