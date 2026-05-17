# Architecture Constraints

## Time

- Market logic timezone is always `Asia/Shanghai`.
- Database timestamps should be timezone-aware and stored consistently by PostgreSQL.
- Scheduler windows, market session checks, and future trading-calendar logic must not depend on browser timezone or host local timezone.

## Market Data Growth

- `market_snapshots` is a latest-snapshot table keyed by `(symbol, market)`.
- It is not a high-frequency append-only raw tick table.
- `intraday_bars` stores aggregated minute bars keyed by `(symbol, market, freq, ts)`.
- V1 does not store unbounded tick data.
- Future cleanup policies should be added before real providers are enabled.

## User Isolation

- Private business tables must include `user_id`.
- API queries must filter by the authenticated `current_user.id`.
- Frontend-provided `user_id` must never be trusted as the owner scope.

## Backtest Transparency

Backtest results must display assumptions alongside metrics:

- fee assumption
- slippage assumption
- execution price assumption
- adjustment mode
- suspension / limit-up / limit-down handling
- rebalance frequency

V1 may use a simplified model, but the assumptions must be visible to users.

## Third-party Quant Libraries

- QuantStats is optional; keep the core backtest engine independent from report libraries.
- Qlib, Hikyuu, QUANTAXIS, and vn.py are reference projects only at this stage.
