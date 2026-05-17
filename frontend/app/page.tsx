"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AIResponse,
  CurrentUser,
  BacktestSummary,
  MarketOverview,
  MonitoringStatus,
  StrategySignal,
  StrategySummary,
  WatchlistGroup,
  getCurrentUser,
  getBacktestSummary,
  getMarketOverview,
  getMonitoringStatus,
  getRecentSignals,
  getStrategySummary,
  getWatchlistGroups,
  generateDashboardSummary,
  logout,
} from "@/lib/api/client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [strategySummary, setStrategySummary] = useState<StrategySummary | null>(null);
  const [backtestSummary, setBacktestSummary] = useState<BacktestSummary | null>(null);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const [aiSummary, setAiSummary] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(async (currentUser) => {
        setUser(currentUser);
        const [overviewData, groupData, strategyData, backtestData, signalData, statusData] = await Promise.all([
          getMarketOverview(),
          getWatchlistGroups(),
          getStrategySummary(),
          getBacktestSummary(),
          getRecentSignals(6),
          getMonitoringStatus(),
        ]);
        setOverview(overviewData);
        setGroups(groupData);
        setStrategySummary(strategyData);
        setBacktestSummary(backtestData);
        setSignals(signalData);
        setMonitoringStatus(statusData);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  async function handleAISummary() {
    setAiError("");
    setAiLoading(true);
    try {
      setAiSummary(await generateDashboardSummary());
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI 摘要生成失败");
    } finally {
      setAiLoading(false);
    }
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
              市场概览、自选池和策略信号使用统一行情 Provider，最近成功快照会服务端持久化。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
              onClick={() => router.push("/ai/strategy-advisor")}
            >
              AI助手
            </button>
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
              onClick={() => router.push("/signals")}
            >
              信号
            </button>
            <button
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
              onClick={() => router.push("/backtests")}
            >
              回测中心
            </button>
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

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">AI 今日策略摘要</h2>
              <p className="mt-1 text-sm text-slate-600">基于当前用户策略、信号、回测和自选池生成，不代表投资承诺。</p>
            </div>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={aiLoading} onClick={handleAISummary}>
              {aiLoading ? "生成中..." : "生成今日策略摘要"}
            </button>
          </div>
          {aiError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{aiError}</p> : null}
          {aiSummary ? <AIResultBlock result={aiSummary} /> : null}
        </section>

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
              {quote.is_stale ? <p className="mt-2 text-xs font-medium text-amber-700">数据可能延迟</p> : null}
            </article>
          ))}
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">监控状态</h2>
              <p className="mt-1 text-sm text-slate-600">
                Provider: {monitoringStatus?.provider ?? "-"} / {monitoringStatus?.is_market_session ? "交易时段" : "非交易时段"}
              </p>
            </div>
            <span className={monitoringStatus?.scheduler_running ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-amber-700"}>
              {monitoringStatus?.scheduler_running ? "调度运行中" : "调度未运行"}
            </span>
          </div>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <span>行情刷新：{monitoringStatus?.last_quote_refresh_at ? new Date(monitoringStatus.last_quote_refresh_at).toLocaleString() : "-"}</span>
            <span>策略扫描：{monitoringStatus?.last_strategy_scan_at ? new Date(monitoringStatus.last_strategy_scan_at).toLocaleString() : "-"}</span>
            <span className="text-red-600">{monitoringStatus?.last_error ?? ""}</span>
          </div>
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
              <h2 className="text-lg font-semibold">今日策略信号</h2>
              <p className="mt-1 text-sm text-slate-600">最新趋势、突破、ETF 动量与风险预警。</p>
            </div>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => router.push("/signals")}>
              查看信号
            </button>
          </div>
          {signals.length > 0 ? (
            <div className="mt-5 divide-y divide-slate-100 rounded-md border border-slate-200">
              {signals.map((signal) => (
                <button className="grid w-full gap-2 p-3 text-left text-sm md:grid-cols-[120px_1fr_auto]" key={signal.id} onClick={() => router.push("/signals")}>
                  <span className="font-medium">{signal.symbol}</span>
                  <span>{signal.title}</span>
                  <span className="text-slate-500">{new Date(signal.triggered_at).toLocaleString()}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
              暂无策略信号。交易时段调度会自动扫描，也可由管理员手动触发一次扫描。
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

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">最近回测</h2>
              <p className="mt-1 text-sm text-slate-600">共 {backtestSummary?.total_count ?? 0} 条回测记录。</p>
            </div>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => router.push("/backtests")}>
              查看回测
            </button>
          </div>
          {backtestSummary && backtestSummary.recent_runs.length > 0 ? (
            <div className="mt-5 divide-y divide-slate-100 rounded-md border border-slate-200">
              {backtestSummary.recent_runs.map((run) => (
                <button className="grid w-full gap-2 p-3 text-left text-sm md:grid-cols-[1fr_auto_auto_auto_auto]" key={run.id} onClick={() => router.push(`/backtests/${run.id}`)}>
                  <span className="font-medium">{run.strategy_config_name ?? run.strategy_template_name ?? run.id}</span>
                  <span className={run.data_source === "akshare_daily_bars" ? "text-blue-700" : "text-slate-500"}>
                    {run.data_source === "akshare_daily_bars" ? "AKShare真实历史" : "Mock"}
                  </span>
                  <span>{formatPct(run.metrics_json.total_return_pct)}</span>
                  <span>{formatPct(run.metrics_json.max_drawdown_pct)}</span>
                  <span className="text-slate-500">{new Date(run.created_at).toLocaleString()}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">
              还没有回测记录。进入回测中心选择 ETF 动量轮动策略发起回测。
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function formatPct(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "-";
}

function AIResultBlock({ result }: { result: AIResponse }) {
  if (!result.parsed_json) {
    return <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{result.content}</p>;
  }
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {Object.entries(result.parsed_json).map(([key, value]) => (
        <div className="rounded-md border border-slate-200 p-3 text-sm" key={key}>
          <p className="font-medium text-slate-700">{key}</p>
          <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-600">{formatAIValue(value)}</p>
        </div>
      ))}
    </div>
  );
}

function formatAIValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => `- ${String(item)}`).join("\n");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value ?? "");
}
