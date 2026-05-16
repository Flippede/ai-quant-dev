from typing import Any

from app.strategies.base import StrategyPlugin, StrategyTemplateDefinition


def number_schema(
    label: str,
    default: int | float | bool | str | None,
    description: str,
    value_type: str = "number",
    minimum: int | float | None = None,
    maximum: int | float | None = None,
    enum: list[str] | None = None,
) -> dict[str, Any]:
    schema: dict[str, Any] = {
        "type": value_type,
        "title": label,
        "description": description,
        "default": default,
    }
    if minimum is not None:
        schema["minimum"] = minimum
    if maximum is not None:
        schema["maximum"] = maximum
    if enum is not None:
        schema["enum"] = enum
    return schema


def param_schema(properties: dict[str, dict[str, Any]], required: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "version": 1,
        "ui_order": list(properties),
        "required": required,
        "additionalProperties": False,
        "properties": properties,
    }


BUILTIN_STRATEGY_DEFINITIONS: list[StrategyTemplateDefinition] = [
    StrategyTemplateDefinition(
        key="trend_follow",
        name="趋势跟随策略",
        version="1.0.0",
        category="trend",
        description="用于识别趋势走强状态的股票或 ETF。它不是预测必涨，而是把均线、动量与成交活跃度组合成趋势筛选条件。",
        default_params={
            "short_ma_period": 20,
            "long_ma_period": 60,
            "momentum_period": 20,
            "min_momentum_pct": 0,
            "volume_ratio_threshold": 1.0,
        },
        param_schema=param_schema(
            {
                "short_ma_period": number_schema("短期均线周期", 20, "短期移动平均线窗口。", "integer", 2, 250),
                "long_ma_period": number_schema("长期均线周期", 60, "长期移动平均线窗口，应大于短期均线周期。", "integer", 5, 500),
                "momentum_period": number_schema("动量周期", 20, "计算阶段涨跌幅的回看窗口。", "integer", 2, 250),
                "min_momentum_pct": number_schema("最低动量百分比", 0, "进入趋势候选所需的最低阶段涨幅。", "number", -100, 300),
                "volume_ratio_threshold": number_schema("成交量放大倍数", 1.0, "相对近期均量的最低成交活跃倍数。", "number", 0, 20),
            },
            ["short_ma_period", "long_ma_period", "momentum_period", "min_momentum_pct", "volume_ratio_threshold"],
        ),
        supported_modes=["backtest", "monitor"],
    ),
    StrategyTemplateDefinition(
        key="volume_breakout",
        name="放量突破策略",
        version="1.0.0",
        category="breakout",
        description="用于发现盘中或阶段性突破关键高点且成交活跃的标的。突破只代表触发条件成立，不代表后续一定上涨。",
        default_params={
            "breakout_window": 20,
            "volume_ratio_threshold": 1.5,
            "amount_ratio_threshold": None,
            "require_market_filter": True,
        },
        param_schema=param_schema(
            {
                "breakout_window": number_schema("突破窗口", 20, "用于判断阶段高点的回看窗口。", "integer", 2, 250),
                "volume_ratio_threshold": number_schema("成交量放大倍数", 1.5, "相对近期均量的最低倍数。", "number", 0, 30),
                "amount_ratio_threshold": number_schema("成交额放大倍数", None, "可选的成交额活跃度过滤条件。", "number", 0, 30),
                "require_market_filter": number_schema("启用市场过滤", True, "是否要求市场环境过滤通过。", "boolean"),
            },
            ["breakout_window", "volume_ratio_threshold", "require_market_filter"],
        ),
        supported_modes=["backtest", "monitor"],
    ),
    StrategyTemplateDefinition(
        key="etf_momentum_rotation",
        name="ETF 动量轮动策略",
        version="1.0.0",
        category="rotation",
        description="用于在指定 ETF 池中比较动量强弱并给出排序。它适合做轮动候选筛选，不直接处理下单或调仓执行。",
        default_params={
            "lookback_period": 20,
            "secondary_lookback_period": 60,
            "top_n": 1,
            "rebalance_frequency": "weekly",
            "use_cash_when_all_negative": True,
        },
        param_schema=param_schema(
            {
                "lookback_period": number_schema("主动量周期", 20, "主要动量排序回看窗口。", "integer", 2, 250),
                "secondary_lookback_period": number_schema("辅助动量周期", 60, "可选的辅助动量确认窗口。", "integer", 2, 500),
                "top_n": number_schema("入选数量", 1, "每次轮动保留的前 N 个 ETF。", "integer", 1, 20),
                "rebalance_frequency": number_schema("再平衡频率", "weekly", "候选排序更新频率。", "string", enum=["weekly", "monthly"]),
                "use_cash_when_all_negative": number_schema("全负动量转现金", True, "当 ETF 池动量全部为负时是否空仓观望。", "boolean"),
            },
            ["lookback_period", "top_n", "rebalance_frequency", "use_cash_when_all_negative"],
        ),
        supported_modes=["backtest", "monitor"],
    ),
    StrategyTemplateDefinition(
        key="risk_warning",
        name="风险预警策略",
        version="1.0.0",
        category="risk",
        description="用于对自选标的或未来模拟持仓识别趋势恶化与波动风险。它只生成风险条件判断，不生成自动预警日志。",
        default_params={
            "ma_period": 20,
            "volatility_window": 20,
            "volatility_threshold": 5.0,
            "drawdown_threshold_pct": 10.0,
            "enable_trend_break_warning": True,
        },
        param_schema=param_schema(
            {
                "ma_period": number_schema("均线周期", 20, "趋势破位判断使用的均线窗口。", "integer", 2, 250),
                "volatility_window": number_schema("波动率窗口", 20, "计算波动水平的回看窗口。", "integer", 2, 250),
                "volatility_threshold": number_schema("波动率阈值", 5.0, "触发波动风险关注的阈值。", "number", 0, 100),
                "drawdown_threshold_pct": number_schema("回撤阈值百分比", 10.0, "触发回撤风险关注的跌幅阈值。", "number", 0, 100),
                "enable_trend_break_warning": number_schema("启用趋势破位提示", True, "是否启用跌破趋势均线类风险条件。", "boolean"),
            },
            ["ma_period", "volatility_window", "volatility_threshold", "drawdown_threshold_pct", "enable_trend_break_warning"],
        ),
        supported_modes=["backtest", "monitor"],
    ),
]


class BuiltinStrategyPlugin(StrategyPlugin):
    def __init__(self, definition: StrategyTemplateDefinition):
        self.definition = definition
        self.key = definition.key
        self.version = definition.version
