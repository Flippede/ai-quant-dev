from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class StrategySignal:
    symbol: str
    signal_type: str
    severity: str
    title: str
    message: str
    score: float | None = None
    payload: dict[str, Any] = field(default_factory=dict)


class StrategyPlugin(ABC):
    key: str
    version: str

    @abstractmethod
    def validate_params(self, params: dict[str, Any]) -> None:
        raise NotImplementedError

