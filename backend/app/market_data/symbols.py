def normalize_market(market: str | None) -> str:
    return "CN"


def infer_exchange(symbol: str) -> str | None:
    if symbol.startswith(("5", "6", "9")):
        return "SH"
    if symbol.startswith(("0", "1", "2", "3")):
        return "SZ"
    if symbol.startswith(("4", "8")):
        return "BJ"
    return None


def normalize_symbol(symbol: str) -> str:
    return symbol.strip().lower().removeprefix("sh").removeprefix("sz").removeprefix("bj").upper()


def provider_code(symbol: str, provider: str, asset_type: str | None = None) -> str:
    clean = normalize_symbol(symbol)
    if provider == "akshare_index":
        exchange = infer_exchange(clean)
        prefix = {"SH": "sh", "SZ": "sz", "BJ": "bj"}.get(exchange, "")
        return f"{prefix}{clean}"
    return clean
