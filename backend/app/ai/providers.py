from dataclasses import dataclass
import json
from typing import Any
from urllib import request

from app.core.config import settings


@dataclass(frozen=True)
class AIResponse:
    content: str
    metadata: dict[str, Any]


class AIProviderError(Exception):
    pass


class BaseAIProvider:
    provider_name = "base"
    model = "unknown"

    def generate(self, messages: list[dict[str, str]], response_format: str = "json_object") -> AIResponse:
        raise NotImplementedError


class MockAIProvider(BaseAIProvider):
    provider_name = "mock"
    model = "mock-ai"

    def generate(self, messages: list[dict[str, str]], response_format: str = "json_object") -> AIResponse:
        user_text = " ".join(message["content"] for message in messages if message["role"] == "user")
        template = _recommended_template(user_text)
        payload = {
            "summary": "这是 MockAIProvider 生成的示例分析，用于在未配置真实模型时验证完整流程。",
            "recommended_template": template,
            "recommended_params": _recommended_params(template),
            "market_suitability": "适合用作策略想法整理、参数讨论和风险检查，不能代表收益保证。",
            "risk_notes": ["AI 输出仅供辅助分析。", "需要结合回测、实时信号和人工判断。"],
            "next_steps": ["检查参数是否符合你的交易周期。", "先用 mock 与真实历史数据分别回测。", "观察实时信号是否符合预期。"],
            "analysis": "当前上下文已被整理为结构化说明。若是真实模型，可进一步结合更多市场背景做解释。",
        }
        return AIResponse(json.dumps(payload, ensure_ascii=False), {"mock": True})


class OpenAICompatibleProvider(BaseAIProvider):
    provider_name = "openai_compatible"

    def __init__(self) -> None:
        if not settings.ai_base_url or not settings.ai_api_key:
            raise AIProviderError("AI_BASE_URL and AI_API_KEY are required for openai_compatible provider")
        self.model = settings.ai_model
        self.endpoint = settings.ai_base_url.rstrip("/") + "/chat/completions"

    def generate(self, messages: list[dict[str, str]], response_format: str = "json_object") -> AIResponse:
        body: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": settings.ai_max_output_tokens,
        }
        if response_format == "json_object":
            body["response_format"] = {"type": "json_object"}
        req = request.Request(
            self.endpoint,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {settings.ai_api_key}"},
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=settings.ai_timeout_seconds) as response:
                data = json.loads(response.read().decode("utf-8"))
        except Exception as exc:
            raise AIProviderError(f"AI provider request failed: {exc}") from exc
        try:
            content = data["choices"][0]["message"]["content"]
        except Exception as exc:
            raise AIProviderError("AI provider response missing choices[0].message.content") from exc
        return AIResponse(content, {"raw_usage": data.get("usage")})


def get_ai_provider() -> BaseAIProvider:
    if settings.ai_provider == "openai_compatible":
        return OpenAICompatibleProvider()
    return MockAIProvider()


def _recommended_template(text: str) -> str:
    lowered = text.lower()
    if "etf" in lowered or "轮动" in text:
        return "etf_momentum_rotation"
    if "突破" in text or "放量" in text:
        return "volume_breakout"
    if "风险" in text or "预警" in text:
        return "risk_warning"
    return "trend_follow"


def _recommended_params(template: str) -> dict[str, Any]:
    defaults = {
        "etf_momentum_rotation": {"lookback_period": 20, "secondary_lookback_period": 60, "top_n": 1, "rebalance_frequency": "weekly", "use_cash_when_all_negative": True},
        "volume_breakout": {"breakout_window": 20, "volume_ratio_threshold": 1.5, "require_market_filter": True},
        "risk_warning": {"ma_period": 20, "volatility_window": 20, "volatility_threshold": 5, "drawdown_threshold_pct": 10, "enable_trend_break_warning": True},
        "trend_follow": {"short_ma_period": 20, "long_ma_period": 60, "momentum_period": 20, "min_momentum_pct": 0, "volume_ratio_threshold": 1.0},
    }
    return defaults.get(template, {})
