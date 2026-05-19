"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AIResponse, MonitoringStatus, StrategyConfig, StrategySignal, explainSignal, getCurrentUser, getMonitoringStatus, getSignals, getStrategyConfigs } from "@/lib/api/client";

type TimeRange = "today" | "7d" | "30d" | "all";
type SortOrder = "desc" | "asc";
type SignalClass = "opportunity" | "risk" | "monitor";

const timeRangeOptions: Array<{ key: TimeRange; label: string }> = [
  { key: "today", label: "今日" },
  { key: "7d", label: "近7日" },
  { key: "30d", label: "近30日" },
  { key: "all", label: "全部" },
];

export default function SignalsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [allRecentSignals, setAllRecentSignals] = useState<StrategySignal[]>([]);
  const [configs, setConfigs] = useState<StrategyConfig[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringStatus | null>(null);
  const [severity, setSeverity] = useState("");
  const [signalType, setSignalType] = useState("");
  const [strategyConfigId, setStrategyConfigId] = useState(initialQueryValue("strategy_config_id"));
  const [symbol, setSymbol] = useState(initialQueryValue("symbol"));
  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [aiResults, setAiResults] = useState<Record<string, AIResponse>>({});
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);

  const sortedSignals = useMemo(() => sortSignals(signals, sortOrder), [signals, sortOrder]);
  const todaySignals = useMemo(() => allRecentSignals.filter(isTodayShanghai), [allRecentSignals]);
  const overview = useMemo(() => buildOverview(todaySignals), [todaySignals]);
  const focusSignals = useMemo(() => {
    const source = symbol ? sortedSignals : sortSignals(todaySignals.length > 0 ? todaySignals : allRecentSignals, "desc");
    return source.slice(0, 4);
  }, [allRecentSignals, sortedSignals, symbol, todaySignals]);

  async function loadPage() {
    const range = timeRangeToApi(timeRange);
    const [filtered, recent, configData, monitoringResult] = await Promise.all([
      getSignals({ severity, signal_type: signalType, strategy_config_id: strategyConfigId, symbol: normalizeSymbol(symbol), ...range, limit: 200 }),
      getSignals({ limit: 200 }),
      getStrategyConfigs(),
      getMonitoringStatus().catch(() => null),
    ]);
    setSignals(filtered);
    setAllRecentSignals(recent);
    setConfigs(configData);
    setMonitoring(monitoringResult);
  }

  useEffect(() => {
    getCurrentUser()
      .then(loadPage)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleFilter(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setFilterLoading(true);
    try {
      const range = timeRangeToApi(timeRange);
      const data = await getSignals({ severity, signal_type: signalType, strategy_config_id: strategyConfigId, symbol: normalizeSymbol(symbol), ...range, limit: 200 });
      setSignals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载信号失败");
    } finally {
      setFilterLoading(false);
    }
  }

  async function handleExplain(signalId: string) {
    setError("");
    setAiLoadingId(signalId);
    try {
      const result = await explainSignal(signalId);
      setAiResults((previous) => ({ ...previous, [signalId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 解释信号失败");
    } finally {
      setAiLoadingId(null);
    }
  }

  function clearFilters() {
    setSeverity("");
    setSignalType("");
    setStrategyConfigId("");
    setSymbol("");
    setTimeRange("today");
    setSortOrder("desc");
    setError("");
    getSignals({ ...timeRangeToApi("today"), limit: 200 }).then(setSignals).catch(() => setError("清空筛选后加载失败"));
  }

  function applyTimeRange(nextRange: TimeRange) {
    setTimeRange(nextRange);
    setError("");
    setFilterLoading(true);
    getSignals({ severity, signal_type: signalType, strategy_config_id: strategyConfigId, symbol: normalizeSymbol(symbol), ...timeRangeToApi(nextRange), limit: 200 })
      .then(setSignals)
      .catch(() => setError("切换时间范围后加载失败"))
      .finally(() => setFilterLoading(false));
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <section className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-8">
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-panel" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-panel" key={index} />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-panel" />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_10%_0%,rgba(32,214,199,0.16),transparent_32%),linear-gradient(135deg,rgba(11,19,34,0.96),rgba(5,8,18,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">Signal Center</p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">信号中心</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600">集中查看策略发现的机会、风险与异动，并快速跳转到看盘、策略配置、回测或 AI 解释。</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="rounded-md border border-slate-200 px-2.5 py-1">Scheduler: {monitoring?.scheduler_running ? "运行中" : "未知"}</span>
                <span className="rounded-md border border-slate-200 px-2.5 py-1">最近扫描: {monitoring?.last_strategy_scan_at ? formatTime(monitoring.last_strategy_scan_at) : "-"}</span>
                <span className="rounded-md border border-slate-200 px-2.5 py-1">行情时段: {monitoring?.is_market_session ? "交易时段" : "非交易时段"}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" onClick={() => router.push("/market")}>
                返回看盘
              </button>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/strategies")}>
                查看运行中策略
              </button>
            </div>
          </div>
        </header>

        {symbol ? (
          <div className="flex flex-col gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-accent">当前正在查看 {normalizeSymbol(symbol)} 的相关信号。</p>
            <button className="rounded-md border border-cyan-300/25 px-3 py-2 text-sm text-accent" onClick={() => { setSymbol(""); getSignals({ severity, signal_type: signalType, strategy_config_id: strategyConfigId, ...timeRangeToApi(timeRange), limit: 200 }).then(setSignals).catch(() => setError("清除标的筛选后加载失败")); }}>
              清除标的过滤
            </button>
          </div>
        ) : null}

        {error ? <p className="rounded-md border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-200">{error}</p> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <OverviewCard label="今日信号" value={String(overview.total)} detail="按 Asia/Shanghai 日期统计" />
          <OverviewCard label="机会类" value={String(overview.opportunity)} detail="趋势、突破、动量等提示" tone="good" />
          <OverviewCard label="风险类" value={String(overview.risk)} detail="风险预警或高风险等级" tone="warn" />
          <OverviewCard label="涉及标的" value={String(overview.symbols)} detail="今日触发信号的标的数量" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-xl border border-slate-200 bg-panel p-5">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
              <p className="text-sm font-medium text-accent">Today Focus</p>
              <h2 className="text-xl font-semibold">今日重点信号</h2>
              <p className="text-sm leading-6 text-slate-600">优先展示今日信号；如果今日暂无信号，则展示最近信号，帮助快速进入看盘或策略复盘。</p>
            </div>
            {focusSignals.length > 0 ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {focusSignals.map((signal) => (
                  <FocusSignalCard aiLoadingId={aiLoadingId} aiResult={aiResults[signal.id]} key={signal.id} onExplain={handleExplain} onRoute={router.push} signal={signal} />
                ))}
              </div>
            ) : (
              <EmptyState
                actionLabel="进入看盘工作台"
                description="系统正常运行时，并不一定每天都会触发新信号。你可以去看运行中的策略，或进入看盘工作台查看标的状态。"
                onAction={() => router.push("/market")}
                title="今日暂无新信号"
              />
            )}
          </section>

          <aside className="rounded-xl border border-slate-200 bg-panel p-5">
            <h2 className="font-semibold">信号分类规则</h2>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
              <p><span className="text-emerald-300">机会类</span>：趋势跟随、放量突破、ETF 动量等偏机会发现的提示。</p>
              <p><span className="text-amber-200">风险类</span>：risk_warning 或 risk_high / risk_medium 等风险等级。</p>
              <p><span className="text-cyan-200">观察类</span>：watch、info 或无法明确归类的技术事件。</p>
              <p className="rounded-md border border-slate-200 bg-[#0b1322]/72 p-3 text-xs leading-5">信号是策略提示，不是买卖承诺。请结合行情、回测和自身风险承受能力判断。</p>
            </div>
          </aside>
        </section>

        <section className="rounded-xl border border-slate-200 bg-panel p-5">
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
            <p className="text-sm font-medium text-accent">Signal Stream</p>
            <h2 className="text-xl font-semibold">全部信号流</h2>
            <p className="text-sm text-slate-600">按标的、策略、类型和时间范围筛选。默认按触发时间倒序。</p>
          </div>

          <form className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]" onSubmit={handleFilter}>
            <input className="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm" placeholder="标的代码，例如 510300" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
            <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm" value={strategyConfigId} onChange={(event) => setStrategyConfigId(event.target.value)}>
              <option value="">全部策略配置</option>
              {configs.map((config) => (
                <option key={config.id} value={config.id}>{config.name}</option>
              ))}
            </select>
            <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm" value={signalType} onChange={(event) => setSignalType(event.target.value)}>
              <option value="">全部信号类型</option>
              <option value="trend_follow">趋势跟随</option>
              <option value="volume_breakout">放量突破</option>
              <option value="etf_momentum_rotation">ETF 动量轮动</option>
              <option value="risk_warning">风险预警</option>
            </select>
            <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm" value={severity} onChange={(event) => setSeverity(event.target.value)}>
              <option value="">全部等级</option>
              <option value="info">info</option>
              <option value="watch">watch</option>
              <option value="strong">strong</option>
              <option value="breakout_watch">breakout_watch</option>
              <option value="breakout_strong">breakout_strong</option>
              <option value="risk_low">risk_low</option>
              <option value="risk_medium">risk_medium</option>
              <option value="risk_high">risk_high</option>
            </select>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={filterLoading} type="submit">
              {filterLoading ? "筛选中..." : "筛选"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {timeRangeOptions.map((option) => (
              <button
                className={timeRange === option.key ? "rounded-md border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm text-accent" : "rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600"}
                key={option.key}
                onClick={() => applyTimeRange(option.key)}
                type="button"
              >
                {option.label}
              </button>
            ))}
            <select className="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
              <option value="desc">时间倒序</option>
              <option value="asc">时间正序</option>
            </select>
            <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={clearFilters} type="button">
              清空筛选
            </button>
          </div>

          <div className="mt-5 divide-y divide-slate-200 rounded-lg border border-slate-200">
            {sortedSignals.map((signal) => (
              <SignalRow aiLoadingId={aiLoadingId} aiResult={aiResults[signal.id]} key={signal.id} onExplain={handleExplain} onRoute={router.push} signal={signal} />
            ))}
            {sortedSignals.length === 0 ? (
              <EmptyState
                actionLabel="清空筛选"
                description="当前筛选条件下没有匹配信号。可以放宽时间范围、清除标的或查看运行中的策略。"
                onAction={clearFilters}
                title="没有匹配的信号"
              />
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function FocusSignalCard({ aiLoadingId, aiResult, onExplain, onRoute, signal }: { aiLoadingId: string | null; aiResult?: AIResponse; onExplain: (signalId: string) => void; onRoute: (href: string) => void; signal: StrategySignal }) {
  const view = signalView(signal);
  return (
    <article className="rounded-lg border border-slate-200 bg-[#0b1322]/72 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold">{signal.symbol}</p>
          <p className="mt-1 text-xs text-slate-500">{signal.market} / {formatTime(signal.triggered_at)}</p>
        </div>
        <span className={`rounded-md border px-2 py-1 text-xs ${view.badgeClass}`}>{view.label}</span>
      </div>
      <h3 className="mt-4 font-semibold">{signal.title}</h3>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{signal.message}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded-md border border-slate-200 px-2 py-1">{signalTypeLabel(signal.signal_type)}</span>
        <span className="rounded-md border border-slate-200 px-2 py-1">{signal.strategy_config_name ?? signal.template_name ?? "策略信号"}</span>
        <span className="rounded-md border border-slate-200 px-2 py-1">score {signal.score === null ? "-" : signal.score.toFixed(2)}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" onClick={() => onRoute(`/market?symbol=${encodeURIComponent(signal.symbol)}`)}>去看盘</button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => onRoute(signal.strategy_config_id ? `/strategies/configs/${signal.strategy_config_id}` : "/strategies")}>相关策略</button>
        {supportsBacktest(signal) ? <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => onRoute(`/backtests?config_id=${signal.strategy_config_id ?? ""}&symbols=${signal.symbol}`)}>发起回测</button> : null}
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" disabled={aiLoadingId === signal.id} onClick={() => onExplain(signal.id)}>
          {aiLoadingId === signal.id ? "解释中..." : "AI解释"}
        </button>
      </div>
      {aiResult ? <AIResultBlock result={aiResult} /> : null}
    </article>
  );
}

function SignalRow({ aiLoadingId, aiResult, onExplain, onRoute, signal }: { aiLoadingId: string | null; aiResult?: AIResponse; onExplain: (signalId: string) => void; onRoute: (href: string) => void; signal: StrategySignal }) {
  const view = signalView(signal);
  return (
    <article className="grid gap-4 p-4 lg:grid-cols-[140px_120px_minmax(0,1fr)_220px]">
      <div className="text-sm text-slate-500">{formatTime(signal.triggered_at)}</div>
      <div>
        <button className="text-left font-semibold hover:text-accent" onClick={() => onRoute(`/market?symbol=${encodeURIComponent(signal.symbol)}`)}>{signal.symbol}</button>
        <p className="text-xs text-slate-500">{signal.market}</p>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md border px-2 py-1 text-xs ${view.badgeClass}`}>{view.label}</span>
          <span className="text-xs text-slate-500">{signalTypeLabel(signal.signal_type)}</span>
        </div>
        <h3 className="mt-2 font-semibold">{signal.title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{signal.message}</p>
        <p className="mt-1 text-xs text-slate-500">{signal.strategy_config_name ?? signal.template_name ?? signal.signal_type}</p>
        {aiResult ? <AIResultBlock result={aiResult} /> : null}
      </div>
      <div className="flex flex-wrap content-start gap-2 text-sm lg:justify-end">
        <button className="rounded-md border border-slate-300 px-3 py-2" onClick={() => onRoute(`/market?symbol=${encodeURIComponent(signal.symbol)}`)}>看盘</button>
        <button className="rounded-md border border-slate-300 px-3 py-2" onClick={() => onRoute(signal.strategy_config_id ? `/strategies/configs/${signal.strategy_config_id}` : "/strategies")}>策略</button>
        <button className="rounded-md border border-slate-300 px-3 py-2" onClick={() => onRoute(`/signals?symbol=${encodeURIComponent(signal.symbol)}`)}>同标的</button>
        <button className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50" disabled={aiLoadingId === signal.id} onClick={() => onExplain(signal.id)}>
          {aiLoadingId === signal.id ? "解释中" : "AI"}
        </button>
      </div>
    </article>
  );
}

function OverviewCard({ detail, label, tone = "neutral", value }: { detail: string; label: string; tone?: "neutral" | "good" | "warn"; value: string }) {
  const toneClass = tone === "good" ? "text-emerald-300" : tone === "warn" ? "text-amber-200" : "";
  return (
    <article className="rounded-lg border border-slate-200 bg-panel p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{label}</p>
      <p className={`mt-3 text-3xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

function EmptyState({ actionLabel, description, onAction, title }: { actionLabel: string; description: string; onAction: () => void; title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-cyan-300/20 bg-cyan-300/5 p-6">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
      <button className="mt-4 rounded-md border border-cyan-300/25 px-4 py-2 text-sm text-accent" onClick={onAction}>{actionLabel}</button>
    </div>
  );
}

function AIResultBlock({ result }: { result: AIResponse }) {
  if (!result.parsed_json) {
    return <p className="mt-3 whitespace-pre-wrap rounded-md border border-slate-200 bg-[#050812]/60 p-3 text-sm leading-6 text-slate-700">{result.content}</p>;
  }
  return (
    <div className="mt-3 grid gap-2 rounded-md border border-slate-200 bg-[#050812]/60 p-3">
      {Object.entries(result.parsed_json).map(([key, value]) => (
        <div className="text-sm" key={key}>
          <p className="font-medium text-slate-700">{key}</p>
          <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">{formatAIValue(value)}</p>
        </div>
      ))}
    </div>
  );
}

function signalView(signal: StrategySignal) {
  const signalClass = classifySignal(signal);
  if (signalClass === "risk") {
    return { label: signal.severity.includes("high") ? "高风险提示" : "风险提示", badgeClass: "border-amber-300/25 bg-amber-300/10 text-amber-200" };
  }
  if (signalClass === "opportunity") {
    return { label: signal.severity.includes("strong") ? "强机会观察" : "机会观察", badgeClass: "border-emerald-300/25 bg-emerald-300/10 text-emerald-300" };
  }
  return { label: "观察信号", badgeClass: "border-cyan-300/25 bg-cyan-300/10 text-accent" };
}

function classifySignal(signal: StrategySignal): SignalClass {
  const combined = `${signal.signal_type} ${signal.severity} ${signal.title}`.toLowerCase();
  if (combined.includes("risk") || combined.includes("warning") || combined.includes("drawdown")) {
    return "risk";
  }
  if (combined.includes("breakout") || combined.includes("momentum") || combined.includes("trend") || combined.includes("strong")) {
    return "opportunity";
  }
  return "monitor";
}

function buildOverview(signals: StrategySignal[]) {
  const symbols = new Set(signals.map((signal) => signal.symbol));
  return {
    total: signals.length,
    opportunity: signals.filter((signal) => classifySignal(signal) === "opportunity").length,
    risk: signals.filter((signal) => classifySignal(signal) === "risk").length,
    symbols: symbols.size,
  };
}

function supportsBacktest(signal: StrategySignal) {
  return signal.signal_type === "etf_momentum_rotation" && Boolean(signal.strategy_config_id);
}

function signalTypeLabel(type: string) {
  const labels: Record<string, string> = {
    etf_momentum_rotation: "ETF 动量轮动",
    risk_warning: "风险预警",
    trend_follow: "趋势跟随",
    volume_breakout: "放量突破",
  };
  return labels[type] ?? type;
}

function sortSignals(signals: StrategySignal[], order: SortOrder) {
  return signals.slice().sort((left, right) => {
    const compare = new Date(left.triggered_at).getTime() - new Date(right.triggered_at).getTime();
    return order === "asc" ? compare : -compare;
  });
}

function timeRangeToApi(range: TimeRange) {
  if (range === "all") {
    return {};
  }
  const now = new Date();
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (range === "7d") {
    start.setDate(start.getDate() - 7);
  } else {
    start.setDate(start.getDate() - 30);
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

function isTodayShanghai(signal: StrategySignal) {
  const today = new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
  return new Date(signal.triggered_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) === today;
}

function normalizeSymbol(value: string) {
  return value.trim();
}

function initialQueryValue(key: string) {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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
