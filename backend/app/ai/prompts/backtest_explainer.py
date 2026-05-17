import json

from app.ai.prompts.common import SYSTEM_GUARDRAILS, json_instruction


def build_prompt(context: dict) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_GUARDRAILS},
        {
            "role": "user",
            "content": f"""
请解读这次回测。必须明确数据源是 mock 还是真实 AKShare；如果有 warnings 必须纳入解释。
不能把历史回测表述为未来收益保证。
上下文 JSON：
{json.dumps(context, ensure_ascii=False, default=str)}

{json_instruction(["summary", "return_drawdown_reading", "trade_frequency_reading", "weak_market_phases", "data_quality_notes", "what_it_can_show", "what_it_cannot_show", "optimization_ideas", "risk_notes"])}
""",
        },
    ]
