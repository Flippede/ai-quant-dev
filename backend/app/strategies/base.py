from abc import ABC
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class StrategyTemplateDefinition:
    key: str
    name: str
    version: str
    category: str
    description: str
    default_params: dict[str, Any]
    param_schema: dict[str, Any]
    supported_modes: list[str]
    is_builtin: bool = True
    is_active: bool = True


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
    definition: StrategyTemplateDefinition

    def validate_params(self, params: dict[str, Any]) -> None:
        validate_params_with_schema(params, self.definition.param_schema)

    def describe(self, params: dict[str, Any]) -> str:
        self.validate_params(params)
        return self.definition.description

    def evaluate_for_backtest(self, *args: Any, **kwargs: Any) -> list[StrategySignal]:
        raise NotImplementedError("Backtest evaluation is not implemented for this strategy plugin")

    def evaluate_for_monitor(self, *args: Any, **kwargs: Any) -> list[StrategySignal]:
        raise NotImplementedError("Monitor evaluation is not implemented for this strategy plugin")


class StrategyParamValidationError(ValueError):
    pass


def validate_params_with_schema(params: dict[str, Any], schema: dict[str, Any]) -> None:
    if not isinstance(params, dict):
        raise StrategyParamValidationError("params_json must be an object")

    properties = schema.get("properties", {})
    required = set(schema.get("required", []))
    unknown = set(params) - set(properties)
    if unknown:
        raise StrategyParamValidationError(f"Unknown parameter: {sorted(unknown)[0]}")

    for field_name in required:
        if field_name not in params or params[field_name] is None:
            raise StrategyParamValidationError(f"Missing required parameter: {field_name}")

    for field_name, value in params.items():
        field_schema = properties.get(field_name)
        if field_schema is None or value is None:
            continue
        _validate_value(field_name, value, field_schema)


def _validate_value(field_name: str, value: Any, field_schema: dict[str, Any]) -> None:
    expected_type = field_schema.get("type")
    if expected_type == "integer":
        if not isinstance(value, int) or isinstance(value, bool):
            raise StrategyParamValidationError(f"{field_name} must be an integer")
    elif expected_type == "number":
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise StrategyParamValidationError(f"{field_name} must be a number")
    elif expected_type == "boolean":
        if not isinstance(value, bool):
            raise StrategyParamValidationError(f"{field_name} must be a boolean")
    elif expected_type == "string":
        if not isinstance(value, str):
            raise StrategyParamValidationError(f"{field_name} must be a string")

    if "minimum" in field_schema and value < field_schema["minimum"]:
        raise StrategyParamValidationError(f"{field_name} must be >= {field_schema['minimum']}")
    if "maximum" in field_schema and value > field_schema["maximum"]:
        raise StrategyParamValidationError(f"{field_name} must be <= {field_schema['maximum']}")
    if "enum" in field_schema and value not in field_schema["enum"]:
        raise StrategyParamValidationError(f"{field_name} must be one of {field_schema['enum']}")
