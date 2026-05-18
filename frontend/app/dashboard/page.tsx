"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@/lib/api/client";
import { AppHeader } from "@/components/app-header";

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

  const watchlistItemCount = useMemo(() => groups.reduce((sum, group) => sum + group.items.length, 0), [groups]);
  const todaySignalCount = useMemo(() => {
    const today = new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
    return signals.filter((signal) => new Date(signal.triggered_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) === today).length;
  }, [signals]);
  const leadingIndex = overview?.indices[0] ?? null;
  const latestMarketTime = overview?.updated_at ?? leadingIndex?.updated_at ?? monitoringStatus?.last_quote_refresh_at;

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
    <main className="min-h-screen">
      <AppHeader />
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="border-b border-slate-200 pb-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">QuantBeacon</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-foreground sm:text-5xl">量化交易工作台</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              把行情、自选、策略信号与回测收敛到一个清晰入口，让每天的量化交易判断更轻、更快。
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatusCard
            accent="市场"
            title={leadingIndex?.name ?? "市场概览"}
            value={leadingIndex ? leadingIndex.last_price.toFixed(2) : "-"}
            detail={leadingIndex ? `${leadingIndex.symbol} ${formatSignedPct(leadingIndex.pct_change)}` : "等待行情快照"}
            tone={leadingIndex && leadingIndex.pct_change < 0 ? "down" : "up"}
          />
          <StatusCard accent="自选" title="自选池" value={`${watchlistItemCount}`} detail={`${groups.length} 个分组正在跟踪`} />
          <StatusCard accent="信号" title="今日策略信号" value={`${todaySignalCount}`} detail={`最近显示 ${signals.length} 条`} tone={todaySignalCount > 0 ? "warning" : "neutral"} />
          <StatusCard
            accent="策略"
            title="运行中策略"
            value={`${strategySummary?.enabled_count ?? 0}/${strategySummary?.total_count ?? 0}`}
            detail="启用 / 全部策略配置"
            tone={(strategySummary?.enabled_count ?? 0) > 0 ? "up" : "neutral"}
          />
          <StatusCard
            accent="调度"
            title={monitoringStatus?.scheduler_running ? "Scheduler 正常" : "Scheduler 待确认"}
            value={monitoringStatus?.is_market_session ? "盘中" : "非盘中"}
            detail={monitoringStatus?.provider ? `Provider ${monitoringStatus.provider}` : "等待状态"}
            tone={monitoringStatus?.scheduler_running ? "up" : "warning"}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-accent">Today Opportunities</p>
                <h2 className="mt-1 text-xl font-semibold">今日机会 / 最新策略信号</h2>
                <p className="mt-1 text-sm text-slate-600">
                  先看是否有新触发的关注、突破或风险预警，再决定进入信号页深挖。
                </p>
              </div>
              <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => router.push("/signals")}>
                查看全部信号
              </button>
            </div>

            {signals.length > 0 ? (
              <div className="mt-5 divide-y divide-slate-100 rounded-md border border-slate-200">
                {signals.map((signal) => (
                  <button
                    className="grid w-full gap-3 p-4 text-left text-sm hover:bg-slate-50 md:grid-cols-[120px_140px_1fr_auto]"
                    key={signal.id}
                    onClick={() => router.push("/signals")}
                  >
                    <span>
                      <span className="block text-base font-semibold">{signal.symbol}</span>
                      <span className="mt-1 block text-xs text-slate-500">{signal.market}</span>
                    </span>
                    <span className={`w-fit rounded-md border px-2.5 py-1 text-xs font-medium ${severityClass(signal.severity)}`}>
                      {signal.severity}
                    </span>
                    <span>
                      <span className="block font-medium">{signal.title}</span>
                      <span className="mt-1 block line-clamp-2 text-slate-600">{signal.strategy_config_name ?? signal.template_name ?? signal.signal_type}</span>
                    </span>
                    <span className="text-slate-500">{formatTime(signal.triggered_at)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-md border border-dashed border-slate-300 p-6 text-sm leading-6 text-slate-600">
                暂无最新策略信号。交易时段会按调度扫描已启用策略，非交易时段可从策略中心检查配置状态。
              </div>
            )}
          </section>

          <aside className="rounded-lg border border-slate-200 bg-panel p-5">
            <p className="text-sm font-medium text-accent">Quick Actions</p>
            <h2 className="mt-1 text-xl font-semibold">下一步操作</h2>
            <div className="mt-5 grid gap-3">
              <QuickAction title="添加自选" detail="维护股票、ETF 和指数观察池" onClick={() => router.push("/watchlist")} />
              <QuickAction title="创建策略" detail="从内置模板生成个人策略配置" onClick={() => router.push("/strategies")} />
              <QuickAction title="发起回测" detail="用 Mock 或 AKShare 历史日线验证策略" onClick={() => router.push("/backtests")} />
              <QuickAction title="AI 策略助手" detail="把交易想法整理成可配置方案" onClick={() => router.push("/ai/strategy-advisor")} />
              <div className="rounded-md border border-dashed border-slate-300 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">看盘工作台</p>
                    <p className="mt-1 text-sm text-slate-600">K线、指标与信号联动入口，Phase 9C 规划中。</p>
                  </div>
                  <span className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500">Soon</span>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">运行中策略</h2>
                <p className="mt-1 text-sm text-slate-600">
                  已创建 {strategySummary?.total_count ?? 0} 个，已启用 {strategySummary?.enabled_count ?? 0} 个。
                </p>
              </div>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/strategies")}>
                管理
              </button>
            </div>
            {strategySummary && strategySummary.recent_configs.length > 0 ? (
              <div className="mt-5 divide-y divide-slate-100 rounded-md border border-slate-200">
                {strategySummary.recent_configs.slice(0, 4).map((config) => (
                  <div className="grid gap-2 p-3 text-sm md:grid-cols-[1fr_auto_auto]" key={config.id}>
                    <span className="font-medium">{config.name}</span>
                    <span className="text-slate-500">{formatTime(config.updated_at)}</span>
                    <span className={config.is_enabled ? "font-medium text-emerald-700" : "font-medium text-slate-500"}>
                      {config.is_enabled ? "已启用" : "已停用"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="还没有策略配置。进入策略中心从内置模板创建个人策略。" />
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">最近回测</h2>
                <p className="mt-1 text-sm text-slate-600">共 {backtestSummary?.total_count ?? 0} 条回测记录，区分 Mock 与真实历史数据。</p>
              </div>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/backtests")}>
                查看
              </button>
            </div>
            {backtestSummary && backtestSummary.recent_runs.length > 0 ? (
              <div className="mt-5 divide-y divide-slate-100 rounded-md border border-slate-200">
                {backtestSummary.recent_runs.slice(0, 4).map((run) => (
                  <button
                    className="grid w-full gap-2 p-3 text-left text-sm hover:bg-slate-50 md:grid-cols-[1fr_auto_auto_auto]"
                    key={run.id}
                    onClick={() => router.push(`/backtests/${run.id}`)}
                  >
                    <span className="font-medium">{run.strategy_config_name ?? run.strategy_template_name ?? run.id}</span>
                    <span className={run.data_source === "akshare_daily_bars" ? "text-blue-700" : "text-slate-500"}>
                      {run.data_source === "akshare_daily_bars" ? "AKShare真实历史" : "Mock"}
                    </span>
                    <span>{formatPct(run.metrics_json.total_return_pct)}</span>
                    <span className="text-slate-500">{formatTime(run.created_at)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState text="还没有回测记录。进入回测中心选择 ETF 动量轮动策略发起回测。" />
            )}
          </section>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <h2 className="text-lg font-semibold">市场与调度</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <InfoRow label="行情更新时间" value={latestMarketTime ? new Date(latestMarketTime).toLocaleString() : "-"} />
              <InfoRow label="策略扫描" value={monitoringStatus?.last_strategy_scan_at ? new Date(monitoringStatus.last_strategy_scan_at).toLocaleString() : "-"} />
              <InfoRow label="交易时段" value={monitoringStatus?.is_market_session ? "是" : "否"} />
              {monitoringStatus?.last_error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{monitoringStatus.last_error}</p> : null}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">AI 今日策略摘要</h2>
                <p className="mt-1 text-sm text-slate-600">基于当前用户策略、信号、回测和自选池生成，不代表投资承诺。</p>
              </div>
              <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={aiLoading} onClick={handleAISummary}>
                {aiLoading ? "生成中..." : "生成摘要"}
              </button>
            </div>
            {aiError ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{aiError}</p> : null}
            {aiSummary ? <AIResultBlock result={aiSummary} /> : <p className="mt-4 text-sm leading-6 text-slate-600">需要时手动生成摘要，避免首页被过多说明性内容占满。</p>}
          </section>
        </section>
      </section>
    </main>
  );
}

function StatusCard({
  accent,
  title,
  value,
  detail,
  tone = "neutral",
}: {
  accent: string;
  title: string;
  value: string;
  detail: string;
  tone?: "neutral" | "up" | "down" | "warning";
}) {
  const toneClass = {
    neutral: "text-slate-600",
    up: "text-red-600",
    down: "text-emerald-700",
    warning: "text-amber-700",
  }[tone];
  return (
    <article className="rounded-lg border border-slate-200 bg-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{accent}</p>
      <h2 className="mt-2 text-sm font-medium text-slate-600">{title}</h2>
      <p className={`mt-3 text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function QuickAction({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button className="rounded-md border border-slate-200 p-4 text-left hover:bg-slate-50" onClick={onClick}>
      <span className="block font-medium">{title}</span>
      <span className="mt-1 block text-sm leading-6 text-slate-600">{detail}</span>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="mt-5 rounded-md border border-dashed border-slate-300 p-5 text-sm text-slate-600">{text}</div>;
}

function severityClass(severity: string) {
  const lower = severity.toLowerCase();
  if (lower.includes("risk") || lower.includes("high")) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (lower.includes("strong") || lower.includes("watch")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-slate-200 text-slate-600";
}

function formatPct(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "-";
}

function formatSignedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
