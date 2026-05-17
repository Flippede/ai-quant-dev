from app.ai.prompts.common import SYSTEM_GUARDRAILS, json_instruction


def build_prompt(user_prompt: str, risk_preference: str | None, asset_focus: str | None) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_GUARDRAILS},
        {
            "role": "user",
            "content": f"""
用户交易想法：{user_prompt}
风险偏好：{risk_preference or "未指定"}
资产偏好：{asset_focus or "未指定"}

现有模板：trend_follow, volume_breakout, etf_momentum_rotation, risk_warning。
请输出策略思路、适用场景、买入条件、卖出条件、风控建议、推荐模板和建议参数草案。
{json_instruction(["summary", "recommended_template", "recommended_params", "market_suitability", "risk_notes", "next_steps"])}
""",
        },
    ]
