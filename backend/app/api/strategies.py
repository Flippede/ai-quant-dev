from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.core import User
from app.schemas.strategies import (
    CreateStrategyConfigRequest,
    StrategyConfigPublic,
    StrategySummaryPublic,
    StrategyTemplatePublic,
    UpdateStrategyConfigRequest,
)
from app.services.strategy_service import (
    StrategyConfigError,
    create_config,
    delete_config,
    get_config,
    get_template_by_key,
    list_configs,
    list_templates,
    strategy_summary,
    update_config,
)

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


@router.get("/templates", response_model=list[StrategyTemplatePublic])
def get_strategy_templates(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list:
    return list_templates(db)


@router.get("/templates/{key}", response_model=StrategyTemplatePublic)
def get_strategy_template(key: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    template = get_template_by_key(db, key)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.get("/configs", response_model=list[StrategyConfigPublic])
def get_strategy_configs(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_configs(db, current_user)


@router.get("/summary", response_model=StrategySummaryPublic)
def get_strategy_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return strategy_summary(db, current_user)


@router.post("/configs", response_model=StrategyConfigPublic, status_code=status.HTTP_201_CREATED)
def create_strategy_config(
    payload: CreateStrategyConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return create_config(
            db,
            current_user,
            payload.template_key,
            payload.name,
            payload.params_json,
            payload.watch_scope_json,
            payload.monitor_interval_sec,
            payload.risk_level,
            payload.is_enabled,
        )
    except StrategyConfigError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/configs/{config_id}", response_model=StrategyConfigPublic)
def get_strategy_config(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = get_config(db, current_user, config_id)
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")
    return config


@router.patch("/configs/{config_id}", response_model=StrategyConfigPublic)
def patch_strategy_config(
    config_id: UUID,
    payload: UpdateStrategyConfigRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        config = update_config(
            db,
            current_user,
            config_id,
            payload.model_fields_set,
            payload.name,
            payload.params_json,
            payload.watch_scope_json,
            payload.monitor_interval_sec,
            payload.risk_level,
            payload.is_enabled,
        )
    except StrategyConfigError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if config is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")
    return config


@router.delete("/configs/{config_id}")
def delete_strategy_config(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not delete_config(db, current_user, config_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")
    return {"status": "ok"}
