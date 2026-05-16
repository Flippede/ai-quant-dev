export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type CurrentUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  is_active: boolean;
};

export type AdminUser = CurrentUser & {
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type Quote = {
  symbol: string;
  market: string;
  name: string;
  asset_type: "stock" | "etf" | "index";
  last_price: number;
  pct_change: number;
  volume: number;
  amount: number;
  updated_at: string;
};

export type MarketOverview = {
  indices: Quote[];
  updated_at: string;
};

export type Instrument = {
  symbol: string;
  market: string;
  name: string;
  asset_type: "stock" | "etf" | "index";
  exchange: string | null;
  is_active: boolean;
  metadata_json: Record<string, unknown>;
};

export type WatchlistItem = {
  id: string;
  group_id: string;
  symbol: string;
  market: string;
  asset_type: string;
  name_snapshot: string | null;
  sort_order: number;
  note: string | null;
  quote: Quote | null;
};

export type WatchlistGroup = {
  id: string;
  name: string;
  sort_order: number;
  items: WatchlistItem[];
};

export type StrategyTemplate = {
  id: string;
  key: string;
  name: string;
  version: string;
  category: string;
  description: string;
  default_params_json: Record<string, unknown>;
  schema_json: StrategyParamSchema;
  is_builtin: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StrategyParamProperty = {
  type: "integer" | "number" | "boolean" | "string";
  title?: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  enum?: string[];
};

export type StrategyParamSchema = {
  type: "object";
  version?: number;
  ui_order?: string[];
  required?: string[];
  properties: Record<string, StrategyParamProperty>;
  supported_modes?: string[];
};

export type StrategyConfig = {
  id: string;
  user_id: string;
  template_id: string;
  template_key: string;
  template_name: string;
  template_category: string;
  name: string;
  params_json: Record<string, unknown>;
  watch_scope_json: WatchScope;
  is_enabled: boolean;
  monitor_interval_sec: number;
  risk_level: "low" | "medium" | "high" | null;
  created_at: string;
  updated_at: string;
};

export type WatchScopeInstrument = {
  symbol: string;
  market: string;
  asset_type?: string | null;
  name?: string | null;
};

export type WatchScope = {
  type: "all_watchlists" | "watchlist_groups" | "instruments" | "etf_pool";
  watchlist_group_ids?: string[];
  instruments?: WatchScopeInstrument[];
  etf_pool?: WatchScopeInstrument[];
};

export type StrategySummary = {
  total_count: number;
  enabled_count: number;
  recent_configs: StrategyConfig[];
};

export type BacktestTrade = {
  id: string;
  backtest_run_id: string;
  symbol: string;
  side: "buy" | "sell";
  trade_date: string;
  price: number;
  quantity: number;
  amount: number;
  fee: number;
  pnl: number | null;
  reason: string | null;
  created_at: string;
};

export type BacktestRun = {
  id: string;
  user_id: string;
  strategy_config_id: string | null;
  strategy_template_id: string;
  strategy_config_name: string | null;
  strategy_template_key: string | null;
  strategy_template_name: string | null;
  status: "pending" | "running" | "succeeded" | "failed";
  symbols_json: string[];
  start_date: string;
  end_date: string;
  params_snapshot_json: Record<string, unknown>;
  assumptions_json: Record<string, unknown>;
  metrics_json: Record<string, number | string | null>;
  equity_curve_json: Array<{ date: string; equity: number; cash: number; positions: Record<string, number> }>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  trades: BacktestTrade[];
};

export type BacktestSummary = {
  total_count: number;
  recent_runs: BacktestRun[];
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail ?? message;
    } catch {
      // Keep the status-based message.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export function getCurrentUser() {
  return apiRequest<CurrentUser>("/api/auth/me");
}

export function logout() {
  return apiRequest<{ status: string }>("/api/auth/logout", { method: "POST" });
}

export function changePassword(oldPassword: string, newPassword: string) {
  return apiRequest<{ status: string; session_policy: string }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
}

export function getMarketOverview() {
  return apiRequest<MarketOverview>("/api/market/overview");
}

export function searchInstruments(keyword: string) {
  return apiRequest<Instrument[]>(`/api/instruments/search?q=${encodeURIComponent(keyword)}`);
}

export function getWatchlistGroups() {
  return apiRequest<WatchlistGroup[]>("/api/watchlist/groups");
}

export function createWatchlistGroup(name: string) {
  return apiRequest<WatchlistGroup>("/api/watchlist/groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function updateWatchlistGroup(groupId: string, payload: { name?: string; sort_order?: number }) {
  return apiRequest<WatchlistGroup>(`/api/watchlist/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteWatchlistGroup(groupId: string) {
  return apiRequest<{ status: string; delete_policy: string }>(`/api/watchlist/groups/${groupId}`, { method: "DELETE" });
}

export function addWatchlistItem(groupId: string, instrument: Instrument) {
  return apiRequest<WatchlistItem>("/api/watchlist/items", {
    method: "POST",
    body: JSON.stringify({ group_id: groupId, symbol: instrument.symbol, market: instrument.market }),
  });
}

export function updateWatchlistItem(itemId: string, payload: { note?: string | null; sort_order?: number }) {
  return apiRequest<WatchlistItem>(`/api/watchlist/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteWatchlistItem(itemId: string) {
  return apiRequest<{ status: string }>(`/api/watchlist/items/${itemId}`, { method: "DELETE" });
}

export function getStrategyTemplates() {
  return apiRequest<StrategyTemplate[]>("/api/strategies/templates");
}

export function getStrategyTemplate(key: string) {
  return apiRequest<StrategyTemplate>(`/api/strategies/templates/${encodeURIComponent(key)}`);
}

export function getStrategyConfigs() {
  return apiRequest<StrategyConfig[]>("/api/strategies/configs");
}

export function getStrategySummary() {
  return apiRequest<StrategySummary>("/api/strategies/summary");
}

export function createStrategyConfig(payload: {
  template_key: string;
  name?: string;
  params_json?: Record<string, unknown>;
  watch_scope_json?: WatchScope;
  monitor_interval_sec?: number;
  risk_level?: "low" | "medium" | "high";
  is_enabled?: boolean;
}) {
  return apiRequest<StrategyConfig>("/api/strategies/configs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getStrategyConfig(configId: string) {
  return apiRequest<StrategyConfig>(`/api/strategies/configs/${configId}`);
}

export function updateStrategyConfig(
  configId: string,
  payload: Partial<{
    name: string;
    params_json: Record<string, unknown>;
    watch_scope_json: WatchScope;
    monitor_interval_sec: number;
    risk_level: "low" | "medium" | "high" | null;
    is_enabled: boolean;
  }>,
) {
  return apiRequest<StrategyConfig>(`/api/strategies/configs/${configId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteStrategyConfig(configId: string) {
  return apiRequest<{ status: string }>(`/api/strategies/configs/${configId}`, { method: "DELETE" });
}

export function getBacktests() {
  return apiRequest<BacktestRun[]>("/api/backtests");
}

export function getBacktestSummary() {
  return apiRequest<BacktestSummary>("/api/backtests/summary");
}

export function createBacktest(payload: {
  strategy_config_id: string;
  symbols?: string[];
  start_date: string;
  end_date: string;
  initial_cash: number;
  fee_rate: number;
  slippage_rate: number;
  execution_price_type?: "close";
  adjustment_mode?: "none" | "qfq" | "hfq";
}) {
  return apiRequest<BacktestRun>("/api/backtests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getBacktest(runId: string) {
  return apiRequest<BacktestRun>(`/api/backtests/${runId}`);
}

export function deleteBacktest(runId: string) {
  return apiRequest<{ status: string }>(`/api/backtests/${runId}`, { method: "DELETE" });
}
