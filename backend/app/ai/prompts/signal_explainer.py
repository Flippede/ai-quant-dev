import json

from app.ai.prompts.common import SYSTEM_GUARDRAILS, json_instruction


def build_prompt(context: dict) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_GUARDRAILS},
        {
            "role": "user",
            "content": f"""
请解释这个实时策略信号。只能基于 signal payload 和策略配置解释，不可编造触发原因。
上下文 JSON：
{json.dumps(context, ensure_ascii=False, default=str)}

请说明为什么触发、强度如何理解、是关注/风险/交易型提示、可能假信号、用户应如何理解。
{json_instruction(["summary", "trigger_reason", "severity_reading", "signal_category", "false_positive_risks", "how_to_use", "risk_notes"])}
""",
        },
    ]
