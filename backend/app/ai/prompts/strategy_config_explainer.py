import json

from app.ai.prompts.common import SYSTEM_GUARDRAILS, json_instruction


def build_prompt(context: dict) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_GUARDRAILS},
        {
            "role": "user",
            "content": f"""
请解释这个用户自己的策略配置。
上下文 JSON：
{json.dumps(context, ensure_ascii=False, default=str)}

必须说明：策略在做什么、参数含义、参数偏激进还是保守、适合市场环境、局限。
{json_instruction(["summary", "parameter_reading", "aggressiveness", "market_suitability", "limitations", "risk_notes", "next_steps"])}
""",
        },
    ]
