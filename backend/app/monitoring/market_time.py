from datetime import time

from app.core.timezone import market_now

MORNING_OPEN = time(9, 30)
MORNING_CLOSE = time(11, 30)
AFTERNOON_OPEN = time(13, 0)
AFTERNOON_CLOSE = time(15, 0)


def is_cn_market_session_now() -> bool:
    now = market_now()
    if now.weekday() >= 5:
        return False

    current = now.time()
    return MORNING_OPEN <= current <= MORNING_CLOSE or AFTERNOON_OPEN <= current <= AFTERNOON_CLOSE

