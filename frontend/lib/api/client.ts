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
