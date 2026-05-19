"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BacktestRun, StrategyConfig, createBacktest, getBacktests, getCurrentUser, getStrategyConfigs } from "@/lib/api/client";

type DataSource = "mock_daily_bars" | "akshare_daily_bars";
type AdjustmentMode = "none" | "qfq" | "hfq";

export default function BacktestsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<StrategyConfig[]>([]);
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [strategyConfigId, setStrategyConfigId] = useState(() => initialQueryValue("config_id"));
  const [symbolsText, setSymbolsText] = useState(() => initialQueryValue("symbols") || "510300,510500,159915,512880");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-12-31");
  const [initialCash, setInitialCash] = useState(100000);
  const [feeRate, setFeeRate] = useState(0.0003);
  const [slippageRate, setSlippageRate] = useState(0.0005);
  const [dataSource, setDataSource] = useState<DataSource>("akshare_daily_bars");
  const [adjustmentMode, setAdjustmentMode] = useState<AdjustmentMode>("qfq");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const supportedConfigs = useMemo(() => configs.filter((config) => config.template_key === "etf_momentum_rotation"), [configs]);
  const selectedConfig = configs.find((config) => config.id === strategyConfigId) ?? null;
  const selectedSupported = selectedConfig?.template_key === "etf_momentum_rotation";
  const latestRun = runs[0] ?? null;
  const successfulRuns = runs.filter((run) => run.status === "succeeded");

  async function loadData() {
    const [configData, runData] = await Promise.all([getStrategyConfigs(), getBacktests()]);
    setConfigs(configData);
    setRuns(runData);
    const queryConfigId = initialQueryValue("config_id");
    const queryConfig = configData.find((config) => config.id === queryConfigId);
    const firstSupported = configData.find((config) => config.template_key === "etf_momentum_rotation");
    if (queryConfig?.template_key === "etf_momentum_rotation") {
      setStrategyConfigId(queryConfig.id);
      const scopedSymbols = scopeSymbols(queryConfig);
      if (!initialQueryValue("symbols") && scopedSymbols.length > 0) {
        setSymbolsText(scopedSymbols.join(","));
      }
    } else if (!strategyConfigId && firstSupported) {
      setStrategyConfigId(firstSupported.id);
      const scopedSymbols = scopeSymbols(firstSupported);
      if (!initialQueryValue("symbols") && scopedSymbols.length > 0) {
        setSymbolsText(scopedSymbols.join(","));
      }
    }
  }

  useEffect(() => {
    getCurrentUser()
      .then(loadData)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!selectedSupported) {
      setError("当前阶段仅支持 ETF 动量轮动策略回测。");
      return;
    }
    setSubmitting(true);
    try {
      const run = await createBacktest({
        strategy_config_id: strategyConfigId,
        symbols: symbolsText.split(",").map((item) => item.trim()).filter(Boolean),
        start_date: startDate,
        end_date: endDate,
        initial_cash: initialCash,
        fee_rate: feeRate,
        slippage_rate: slippageRate,
        data_source: dataSource,
        execution_price_type: "close",
        adjustment_mode: adjustmentMode,
      });
      router.push(`/backtests/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发起回测失败");
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  function handleConfigChange(configId: string) {
    setStrategyConfigId(configId);
    const config = configs.find((item) => item.id === configId);
    const scopedSymbols = config ? scopeSymbols(config) : [];
    if (scopedSymbols.length > 0) {
      setSymbolsText(scopedSymbols.join(","));
    }
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">Backtest Lab</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">回测中心</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">验证策略，而不是凭感觉交易。先看收益、回撤与数据质量，再决定是否启用或调整策略。</p>
          </div>
          <button className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white" onClick={() => document.getElementById("new-backtest")?.scrollIntoView({ behavior: "smooth" })}>
            发起新回测
          </button>
        </header>

        {initialQueryValue("config_id") && selectedConfig ? (
          <p className="rounded-md border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-accent">正在基于「{selectedConfig.name}」发起回测。</p>
        ) : null}
        {initialQueryValue("symbols") ? <p className="rounded-md border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-accent">已从看盘工作台带入标的池：{initialQueryValue("symbols")}</p> : null}
        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="历史回测" value={loading ? "-" : String(runs.length)} detail={`${successfulRuns.length} 条成功完成`} />
          <MetricCard label="最近状态" value={latestRun?.status ?? "-"} detail={latestRun ? formatShortTime(latestRun.created_at) : "暂无记录"} />
          <MetricCard label="最近收益" value={formatPct(latestRun?.metrics_json.total_return_pct)} detail={latestRun?.strategy_config_name ?? latestRun?.strategy_template_name ?? "等待回测"} />
          <MetricCard label="最近回撤" value={formatPct(latestRun?.metrics_json.max_drawdown_pct)} detail={latestRun ? `${latestRun.start_date} 至 ${latestRun.end_date}` : "等待回测"} />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <form className="rounded-lg border border-slate-200 bg-panel p-5" id="new-backtest" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-4">
              <p className="text-sm font-medium text-accent">New Validation</p>
              <h2 className="text-xl font-semibold">发起 ETF 动量轮动回测</h2>
              <p className="text-sm leading-6 text-slate-600">当前完整收益型回测优先支持 ETF 动量轮动。趋势、突破和风险预警更偏盯盘扫描，收益回测后续扩展。</p>
            </div>

            <div className="mt-5 grid gap-5">
              <FormBlock title="A. 选择策略" description="从你已创建的策略配置中选择一个支持回测的配置。">
                <label className="text-sm">
                  <span className="font-medium text-slate-700">策略配置</span>
                  <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={strategyConfigId} onChange={(event) => handleConfigChange(event.target.value)} required>
                    <option value="">请选择 ETF 动量轮动配置</option>
                    {configs.map((config) => (
                      <option disabled={config.template_key !== "etf_momentum_rotation"} key={config.id} value={config.id}>
                        {config.name}{config.template_key !== "etf_momentum_rotation" ? "（暂不支持收益回测）" : ""}
                      </option>
                    ))}
                  </select>
                  {supportedConfigs.length === 0 ? <span className="mt-2 block text-xs text-red-600">请先在策略中心创建 ETF 动量轮动配置。</span> : null}
                  {selectedConfig && !selectedSupported ? <span className="mt-2 block text-xs text-amber-700">该策略当前不支持收益回测，请选择 ETF 动量轮动配置。</span> : null}
                </label>
              </FormBlock>

              <FormBlock title="B. 选择标的池" description="ETF 池决定轮动排序和持仓切换范围。">
                <label className="text-sm">
                  <span className="font-medium text-slate-700">ETF 池，逗号分隔</span>
                  <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={symbolsText} onChange={(event) => setSymbolsText(event.target.value)} />
                  <span className="mt-2 block text-xs text-slate-500">示例：510300,510500,159915。若从看盘页进入，会自动带入当前标的。</span>
                </label>
              </FormBlock>

              <FormBlock title="C. 回测周期与数据" description="真实历史回测默认使用 AKShare 日线和前复权价格序列。">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="开始日期"><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field>
                  <Field label="结束日期"><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
                  <Field label="数据源">
                    <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={dataSource} onChange={(event) => setDataSource(event.target.value as DataSource)}>
                      <option value="akshare_daily_bars">AKShare 真实历史数据</option>
                      <option value="mock_daily_bars">Mock 测试数据</option>
                    </select>
                  </Field>
                  <Field label="复权模式">
                    <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={adjustmentMode} onChange={(event) => setAdjustmentMode(event.target.value as AdjustmentMode)}>
                      <option value="qfq">前复权</option>
                      <option value="none">不复权</option>
                      <option value="hfq">后复权</option>
                    </select>
                  </Field>
                </div>
              </FormBlock>

              <FormBlock title="D. 交易假设" description="这些假设会写入回测记录，便于之后解释结果可信度。">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="初始资金"><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="number" value={initialCash} onChange={(event) => setInitialCash(Number(event.target.value))} /></Field>
                  <Field label="手续费率"><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" step="0.0001" type="number" value={feeRate} onChange={(event) => setFeeRate(Number(event.target.value))} /></Field>
                  <Field label="滑点率"><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" step="0.0001" type="number" value={slippageRate} onChange={(event) => setSlippageRate(Number(event.target.value))} /></Field>
                </div>
              </FormBlock>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">回测结果只说明历史区间内的策略表现，不代表未来收益承诺。</p>
              <button className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={!strategyConfigId || !selectedSupported || submitting} type="submit">
                {submitting ? "回测中..." : "发起回测"}
              </button>
            </div>
          </form>

          <aside className="grid gap-5">
            <section className="rounded-lg border border-slate-200 bg-panel p-5">
              <h2 className="font-semibold">最近回测摘要</h2>
              {latestRun ? (
                <div className="mt-4 grid gap-3 text-sm">
                  <InfoRow label="策略" value={latestRun.strategy_config_name ?? latestRun.strategy_template_name ?? latestRun.id} />
                  <InfoRow label="标的" value={latestRun.symbols_json.slice(0, 4).join(", ")} />
                  <InfoRow label="收益" value={formatPct(latestRun.metrics_json.total_return_pct)} />
                  <InfoRow label="回撤" value={formatPct(latestRun.metrics_json.max_drawdown_pct)} />
                  <button className="mt-2 rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push(`/backtests/${latestRun.id}`)}>查看详情</button>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-600">暂无历史回测。先选择一个 ETF 动量轮动策略配置发起验证。</p>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-panel p-5">
              <h2 className="font-semibold">当前支持能力</h2>
              <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
                <p>完整支持：ETF 动量轮动收益回测。</p>
                <p>数据源：Mock 测试日线、AKShare 真实历史日线。</p>
                <p>暂不支持：趋势跟随、放量突破、风险预警的完整收益回测。</p>
              </div>
            </section>

            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
              <h2 className="font-semibold">回测前提醒</h2>
              <p className="mt-2">请重点看收益和回撤是否匹配，而不是只看最终收益。若数据质量存在 warning，应优先进入详情页查看实际区间、bar 数量和缺失数据。</p>
            </section>
          </aside>
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">历史回测记录</h2>
              <p className="mt-1 text-sm text-slate-600">用卡片快速判断结果质量，进入详情页查看收益曲线、交易记录和数据假设。</p>
            </div>
          </div>
          {runs.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {runs.map((run) => <RunCard key={run.id} run={run} onDetail={() => router.push(`/backtests/${run.id}`)} onRepeat={() => repeatRun(run, setStrategyConfigId, setSymbolsText, setStartDate, setEndDate, setDataSource, setAdjustmentMode)} onEditStrategy={() => run.strategy_config_id ? router.push(`/strategies/configs/${run.strategy_config_id}`) : router.push("/strategies")} />)}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-cyan-300/20 bg-cyan-300/5 p-6">
              <h3 className="font-semibold">还没有回测记录</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">从 ETF 动量轮动策略开始，选择一组 ETF 和历史区间，验证它在真实行情中的表现。</p>
              <button className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => router.push("/strategies")}>去创建策略</button>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function RunCard({ run, onDetail, onRepeat, onEditStrategy }: { run: BacktestRun; onDetail: () => void; onRepeat: () => void; onEditStrategy: () => void }) {
  const warnings = Array.isArray(run.assumptions_json.warnings) ? run.assumptions_json.warnings : [];
  return (
    <article className="rounded-lg border border-slate-200 bg-[#0b1322]/72 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{run.strategy_config_name ?? run.strategy_template_name ?? run.id}</h3>
          <p className="mt-1 text-sm text-slate-600">{run.start_date} 至 {run.end_date} / {run.symbols_json.slice(0, 4).join(", ")}</p>
        </div>
        <span className={run.status === "succeeded" ? "rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-300" : "rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs text-amber-300"}>{run.status}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MiniMetric label="累计收益" value={formatPct(run.metrics_json.total_return_pct)} />
        <MiniMetric label="最大回撤" value={formatPct(run.metrics_json.max_drawdown_pct)} />
        <MiniMetric label="交易次数" value={String(run.metrics_json.trade_count ?? "-")} />
        <MiniMetric label="数据源" value={run.data_source === "akshare_daily_bars" ? "AKShare" : "Mock"} />
      </div>
      {warnings.length > 0 ? <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">存在数据质量提示，建议查看详情。</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" onClick={onDetail}>查看详情</button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={onRepeat}>再次回测</button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={onEditStrategy}>调整策略</button>
      </div>
    </article>
  );
}

function FormBlock({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-[#0b1322]/64 p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm"><span className="font-medium text-slate-700">{label}</span>{children}</label>;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-lg border border-slate-200 bg-panel p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></article>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"><span className="text-slate-500">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function repeatRun(
  run: BacktestRun,
  setStrategyConfigId: (value: string) => void,
  setSymbolsText: (value: string) => void,
  setStartDate: (value: string) => void,
  setEndDate: (value: string) => void,
  setDataSource: (value: DataSource) => void,
  setAdjustmentMode: (value: AdjustmentMode) => void,
) {
  if (run.strategy_config_id) {
    setStrategyConfigId(run.strategy_config_id);
  }
  setSymbolsText(run.symbols_json.join(","));
  setStartDate(run.start_date);
  setEndDate(run.end_date);
  setDataSource(run.data_source);
  setAdjustmentMode(run.adjustment_mode);
  document.getElementById("new-backtest")?.scrollIntoView({ behavior: "smooth" });
}

function scopeSymbols(config: StrategyConfig) {
  return (config.watch_scope_json.etf_pool ?? config.watch_scope_json.instruments ?? []).map((item) => item.symbol);
}

function initialQueryValue(key: string) {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

function formatPct(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "-";
}

function formatShortTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
