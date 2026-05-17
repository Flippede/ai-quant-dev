from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.core import User
from app.schemas.ai import AIConversationDetailPublic, AIConversationPublic, AIResponsePublic, StrategyAdvisorRequest
from app.services.ai_service import (
    AIServiceError,
    dashboard_summary_api,
    explain_backtest,
    explain_signal,
    explain_strategy_config,
    get_conversation,
    list_conversations,
    strategy_advisor_api,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/strategy-advisor", response_model=AIResponsePublic)
def strategy_advisor_endpoint(
    payload: StrategyAdvisorRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _handle_ai_error(
        lambda: strategy_advisor_api(db, current_user, payload.user_prompt, payload.risk_preference, payload.asset_focus)
    )


@router.post("/strategy-configs/{config_id}/explain", response_model=AIResponsePublic)
def explain_strategy_config_endpoint(
    config_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _handle_ai_error(lambda: explain_strategy_config(db, current_user, config_id))


@router.post("/backtests/{run_id}/explain", response_model=AIResponsePublic)
def explain_backtest_endpoint(
    run_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _handle_ai_error(lambda: explain_backtest(db, current_user, run_id))


@router.post("/signals/{signal_id}/explain", response_model=AIResponsePublic)
def explain_signal_endpoint(
    signal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _handle_ai_error(lambda: explain_signal(db, current_user, signal_id))


@router.post("/dashboard-summary", response_model=AIResponsePublic)
def dashboard_summary_endpoint(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _handle_ai_error(lambda: dashboard_summary_api(db, current_user))


@router.get("/conversations", response_model=list[AIConversationPublic])
def list_conversations_endpoint(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list_conversations(db, current_user)


@router.get("/conversations/{conversation_id}", response_model=AIConversationDetailPublic)
def get_conversation_endpoint(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversation = get_conversation(db, current_user, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI conversation not found")
    return conversation


def _handle_ai_error(fn):
    try:
        return fn()
    except AIServiceError as exc:
        detail = str(exc)
        lowered = detail.lower()
        if "not found" in lowered:
            code = status.HTTP_404_NOT_FOUND
        elif "rate limit" in lowered:
            code = status.HTTP_429_TOO_MANY_REQUESTS
        elif "provider" in lowered or "ai_" in lowered:
            code = status.HTTP_502_BAD_GATEWAY
        else:
            code = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=detail) from exc
