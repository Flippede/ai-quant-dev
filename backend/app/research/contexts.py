from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID


@dataclass(frozen=True)
class BacktestAssumptions:
    initial_cash: float
    fee_rate: float
    slippage_rate: float
    execution_price_type: str = "close"
    adjustment_mode: str = "none"
    considers_suspension: bool = False
    considers_limit_up_down: bool = False
    rebalance_frequency: str = "weekly"
    data_source: str = "mock_daily_bars"

    def to_json(self) -> dict[str, Any]:
        return {
            "initial_cash": self.initial_cash,
            "fee_rate": self.fee_rate,
            "slippage_rate": self.slippage_rate,
            "execution_price_type": self.execution_price_type,
            "adjustment_mode": self.adjustment_mode,
            "considers_suspension": self.considers_suspension,
            "considers_limit_up_down": self.considers_limit_up_down,
            "rebalance_frequency": self.rebalance_frequency,
            "data_source": self.data_source,
            "implemented": {
                "fee": True,
                "slippage": True,
                "close_price_execution": True,
                "cash_position": True,
                "suspension": False,
                "limit_up_down": False,
                "corporate_actions_adjustment": False,
            },
        }


@dataclass(frozen=True)
class BacktestRequest:
    user_id: UUID
    strategy_config_id: UUID
    strategy_template_id: UUID
    template_key: str
    symbols: list[str]
    start_date: date
    end_date: date
    params: dict[str, Any]
    assumptions: BacktestAssumptions


@dataclass(frozen=True)
class BacktestTradeResult:
    symbol: str
    side: str
    trade_date: date
    price: float
    quantity: float
    amount: float
    fee: float
    pnl: float | None
    reason: str


@dataclass(frozen=True)
class BacktestResult:
    metrics: dict[str, Any]
    equity_curve: list[dict[str, Any]]
    trades: list[BacktestTradeResult]
    diagnostics: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
