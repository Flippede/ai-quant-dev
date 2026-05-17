import json

from app.ai.prompts.common import SYSTEM_GUARDRAILS, json_instruction


def build_prompt(context: dict) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_GUARDRAILS},
        {
            "role": "user",
            "content": f"""
请基于当前用户的策略、信号、回测和自选池，生成简短 Dashboard 摘要。
上下文 JSON：
{json.dumps(context, ensure_ascii=False, default=str)}

请说明当前主要监控什么、最近值得注意的信号/风险、回测状态和下一步关注点。
{json_instruction(["summary", "monitoring_focus", "notable_signals", "backtest_notes", "risk_notes", "next_steps"])}
""",
        },
    ]
