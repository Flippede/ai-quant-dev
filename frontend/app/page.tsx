"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CurrentUser,
  MarketOverview,
  StrategySummary,
  WatchlistGroup,
  getCurrentUser,
  getMarketOverview,
  getStrategySummary,
  getWatchlistGroups,
  logout,
} from "@/lib/api/client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [strategySummary, setStrategySummary] = useState<StrategySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(async (currentUser) => {
        setUser(currentUser);
        const [overviewData, groupData, strategyData] = await Promise.all([getMarketOverview(), getWatchlistGroups(), getStrategySummary()]);
        setOverview(overviewData);
        setGroups(groupData);
        setStrategySummary(strategyData);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading...</main>;
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              AI 量化盯盘平台
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              市场概览与自选池摘要基于 Mock 行情源，关键数据已服务端持久化。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
              onClick={() => router.push("/strategies")}
            >
              策略中心
            </button>
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
              onClick={() => router.push("/watchlist")}
            >
              自选池
            </button>
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
              onClick={() => router.push("/change-password")}
            >
              修改密码
            </button>
            {user.role === "admin" ? (
              <button
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
                onClick={() => router.push("/admin/users")}
              >
                用户管理
              </button>
            ) : null}
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {overview?.indices.map((quote) => (
            <article className="rounded-lg border border-slate-200 bg-panel p-5" key={quote.symbol}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{quote.symbol}</p>
                  <h2 className="mt-1 text-lg font-semibold">{quote.name}</h2>
                </div>
                <span className={quote.pct_change >= 0 ? "text-sm font-medium text-red-600" : "text-sm font-medium text-emerald-700"}>
                  {quote.pct_change >= 0 ? "+" : ""}
                  {quote.pct_change.toFixed(2)}%
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold">{quote.last_price.toFixed(2)}</p>
              <p className="mt-2 text-xs text-slate-500">{new Date(quote.updated_at).toLocaleString()}</p>
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">我的自选池</h2>
              <p className="mt-1 text-sm text-slate-600">
                共 {groups.length} 个分组，{groups.reduce((sum, group) => sum + group.items.length, 0)} 个标的。
              </p>
            </div>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => router.push("/watchlist")}>
              管理自选
            </button>
          </div>
          {groups.length === 0 || groups.every((group) => group.items.length === 0) ? (
            <div className="mt-5 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
              还没有自选标的。进入自选池页面创建分组并添加股票或 ETF。
            </div>
          ) : (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {groups.map((group) => (
                <div className="rounded-md border border-slate-200 p-4" key={group.id}>
                  <h3 className="font-medium">{group.name}</h3>
                  <div className="mt-3 space-y-2">
                    {group.items.slice(0, 4).map((item) => (
                      <div className="flex items-center justify-between text-sm" key={item.id}>
                        <span>{item.name_snapshot ?? item.symbol}</span>
                        <span className={item.quote && item.quote.pct_change >= 0 ? "text-red-600" : "text-emerald-700"}>
                          {item.quote ? `${item.quote.pct_change >= 0 ? "+" : ""}${item.quote.pct_change.toFixed(2)}%` : "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">我的策略摘要</h2>
              <p className="mt-1 text-sm text-slate-600">
                已创建 {strategySummary?.total_count ?? 0} 个策略，已启用 {strategySummary?.enabled_count ?? 0} 个。
              </p>
            </div>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => router.push("/strategies")}>
              管理策略
            </button>
          </div>
          {strategySummary && strategySummary.recent_configs.length > 0 ? (
            <div className="mt-5 divide-y divide-slate-100 rounded-md border border-slate-200">
              {strategySummary.recent_configs.map((config) => (
                <div className="grid gap-2 p-3 text-sm md:grid-cols-[1fr_auto_auto]" key={config.id}>
                  <span className="font-medium">{config.name}</span>
                  <span className="text-slate-500">{new Date(config.updated_at).toLocaleString()}</span>
                  <span className={config.is_enabled ? "font-medium text-emerald-700" : "font-medium text-slate-500"}>
                    {config.is_enabled ? "已启用" : "已停用"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
              还没有策略配置。进入策略中心从内置模板创建个人策略。
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
