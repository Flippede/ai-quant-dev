from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.core import StrategyTemplate, User, UserStrategyConfig
from app.schemas.strategies import StrategyConfigPublic, WatchScope
from app.strategies import StrategyParamValidationError, strategy_registry


class StrategyConfigError(Exception):
    pass


def list_templates(db: Session) -> list[StrategyTemplate]:
    return list(
        db.scalars(
            select(StrategyTemplate)
            .where(StrategyTemplate.is_active.is_(True))
            .order_by(StrategyTemplate.category, StrategyTemplate.name)
        )
    )


def get_template_by_key(db: Session, key: str) -> StrategyTemplate | None:
    return db.scalar(
        select(StrategyTemplate)
        .where(StrategyTemplate.key == key, StrategyTemplate.is_active.is_(True))
        .order_by(StrategyTemplate.version.desc())
        .limit(1)
    )


def list_configs(db: Session, user: User) -> list[StrategyConfigPublic]:
    configs = list(
        db.scalars(
            select(UserStrategyConfig)
            .where(UserStrategyConfig.user_id == user.id)
            .order_by(UserStrategyConfig.updated_at.desc(), UserStrategyConfig.created_at.desc())
        )
    )
    templates = _template_map(db, configs)
    return [_config_public(config, templates[config.template_id]) for config in configs]


def strategy_summary(db: Session, user: User) -> dict[str, Any]:
    total_count = db.scalar(select(func.count()).select_from(UserStrategyConfig).where(UserStrategyConfig.user_id == user.id)) or 0
    enabled_count = (
        db.scalar(
            select(func.count())
            .select_from(UserStrategyConfig)
            .where(UserStrategyConfig.user_id == user.id, UserStrategyConfig.is_enabled.is_(True))
        )
        or 0
    )
    recent = list_configs(db, user)[:3]
    return {"total_count": total_count, "enabled_count": enabled_count, "recent_configs": recent}


def create_config(
    db: Session,
    user: User,
    template_key: str,
    name: str | None,
    params: dict[str, Any] | None,
    watch_scope: dict[str, Any] | None,
    monitor_interval_sec: int,
    risk_level: str | None,
    is_enabled: bool,
) -> StrategyConfigPublic:
    template = get_template_by_key(db, template_key)
    if template is None:
        raise StrategyConfigError("Strategy template not found")
    merged_params = {**template.default_params_json, **(params or {})}
    _validate_params(template.key, merged_params)
    normalized_scope = _validate_watch_scope(watch_scope)

    config = UserStrategyConfig(
        user_id=user.id,
        template_id=template.id,
        name=(name or f"{template.name} 配置").strip(),
        params_json=merged_params,
        watch_scope_json=normalized_scope,
        monitor_interval_sec=monitor_interval_sec,
        risk_level=risk_level,
        is_enabled=is_enabled,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return _config_public(config, template)


def get_config(db: Session, user: User, config_id: UUID) -> StrategyConfigPublic | None:
    config = _get_owned_config(db, user, config_id)
    if config is None:
        return None
    template = db.get(StrategyTemplate, config.template_id)
    if template is None:
        raise StrategyConfigError("Strategy template not found")
    return _config_public(config, template)


def update_config(
    db: Session,
    user: User,
    config_id: UUID,
    payload_fields: set[str],
    name: str | None,
    params: dict[str, Any] | None,
    watch_scope: dict[str, Any] | None,
    monitor_interval_sec: int | None,
    risk_level: str | None,
    is_enabled: bool | None,
) -> StrategyConfigPublic | None:
    config = _get_owned_config(db, user, config_id)
    if config is None:
        return None
    template = db.get(StrategyTemplate, config.template_id)
    if template is None:
        raise StrategyConfigError("Strategy template not found")

    if "name" in payload_fields and name is not None:
        config.name = name.strip()
    if "params_json" in payload_fields:
        merged_params = {**template.default_params_json, **(params or {})}
        _validate_params(template.key, merged_params)
        config.params_json = merged_params
    if "watch_scope_json" in payload_fields:
        config.watch_scope_json = _validate_watch_scope(watch_scope)
    if monitor_interval_sec is not None:
        config.monitor_interval_sec = monitor_interval_sec
    if "risk_level" in payload_fields:
        config.risk_level = risk_level
    if is_enabled is not None:
        config.is_enabled = is_enabled

    db.commit()
    db.refresh(config)
    return _config_public(config, template)


def delete_config(db: Session, user: User, config_id: UUID) -> bool:
    config = _get_owned_config(db, user, config_id)
    if config is None:
        return False
    db.delete(config)
    db.commit()
    return True


def _validate_params(template_key: str, params: dict[str, Any]) -> None:
    try:
        strategy_registry.require(template_key).validate_params(params)
    except (KeyError, StrategyParamValidationError) as exc:
        raise StrategyConfigError(str(exc)) from exc


def _validate_watch_scope(watch_scope: dict[str, Any] | None) -> dict[str, Any]:
    try:
        scope = WatchScope.model_validate(watch_scope or {"type": "all_watchlists"})
    except Exception as exc:
        raise StrategyConfigError("Invalid watch_scope_json") from exc

    if scope.type == "watchlist_groups" and not scope.watchlist_group_ids:
        raise StrategyConfigError("watchlist_groups scope requires watchlist_group_ids")
    if scope.type == "instruments" and not scope.instruments:
        raise StrategyConfigError("instruments scope requires instruments")
    if scope.type == "etf_pool" and not scope.etf_pool:
        raise StrategyConfigError("etf_pool scope requires etf_pool")
    return scope.model_dump(mode="json")


def _get_owned_config(db: Session, user: User, config_id: UUID) -> UserStrategyConfig | None:
    return db.scalar(select(UserStrategyConfig).where(UserStrategyConfig.id == config_id, UserStrategyConfig.user_id == user.id))


def _template_map(db: Session, configs: list[UserStrategyConfig]) -> dict[UUID, StrategyTemplate]:
    template_ids = {config.template_id for config in configs}
    if not template_ids:
        return {}
    templates = list(db.scalars(select(StrategyTemplate).where(StrategyTemplate.id.in_(template_ids))))
    return {template.id: template for template in templates}


def _config_public(config: UserStrategyConfig, template: StrategyTemplate) -> StrategyConfigPublic:
    return StrategyConfigPublic(
        id=config.id,
        user_id=config.user_id,
        template_id=config.template_id,
        template_key=template.key,
        template_name=template.name,
        template_category=template.category,
        name=config.name,
        params_json=config.params_json,
        watch_scope_json=config.watch_scope_json,
        is_enabled=config.is_enabled,
        monitor_interval_sec=config.monitor_interval_sec,
        risk_level=config.risk_level,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )
