"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AIResponse, BacktestRun, BacktestTrade, deleteBacktest, explainBacktest, getBacktest, getCurrentUser } from "@/lib/api/client";

type TradeSideFilter = "all" | "buy" | "sell";
type TradeSort = "desc" | "asc";

const TRADE_PAGE_SIZE = 20;

export default function BacktestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<BacktestRun | null>(null);
  const [error, setError] = useState("");
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [tradeSide, setTradeSide] = useState<TradeSideFilter>("all");
  const [tradeSort, setTradeSort] = useState<TradeSort>("desc");
  const [tradePage, setTradePage] = useState(1);

  useEffect(() => {
    getCurrentUser()
      .then(() => getBacktest(params.id))
      .then(setRun)
      .catch(() => router.replace("/login"));
  }, [params.id, router]);

  const linePoints = useMemo(() => (run ? equityPolyline(run.equity_curve_json) : ""), [run]);
  const warnings = useMemo(() => warningList(run), [run]);
  const dataQuality = useMemo(() => (run?.assumptions_json.data_quality ?? {}) as Record<string, unknown>, [run]);
  const resultNotes = useMemo(() => (run ? buildResultNotes(run, warnings) : []), [run, warnings]);
  const visibleTradeState = useMemo(() => {
    const trades = run ? filterAndSortTrades(run.trades, tradeSide, tradeSort) : [];
    const totalPages = Math.max(1, Math.ceil(trades.length / TRADE_PAGE_SIZE));
    const page = Math.min(tradePage, totalPages);
    return {
      page,
      totalPages,
      filteredCount: trades.length,
      trades: trades.slice((page - 1) * TRADE_PAGE_SIZE, page * TRADE_PAGE_SIZE),
    };
  }, [run, tradePage, tradeSide, tradeSort]);

  async function handleDelete() {
    if (!run || !window.confirm("删除这条回测记录？")) {
      return;
    }
    try {
      await deleteBacktest(run.id);
      router.push("/backtests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function handleAIExplain() {
    if (!run) {
      return;
    }
    setError("");
    setAiLoading(true);
    try {
      setAiResult(await explainBacktest(run.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 解读失败");
    } finally {
      setAiLoading(false);
    }
  }

  function repeatBacktest() {
    if (!run) {
      return;
    }
    const query = new URLSearchParams();
    if (run.strategy_config_id) {
      query.set("config_id", run.strategy_config_id);
    }
    if (run.symbols_json.length > 0) {
      query.set("symbols", run.symbols_json.join(","));
    }
    router.push(`/backtests?${query.toString()}`);
  }

  if (!run) {
    return (
      <main className="min-h-screen">
        <section className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-8">
          <div className="h-36 animate-pulse rounded-lg border border-slate-200 bg-panel" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-panel" key={index} />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-lg border border-slate-200 bg-panel" />
        </section>
      </main>
    );
  }

  const statusStyle = run.status === "succeeded" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-300" : run.status === "failed" ? "border-red-300/20 bg-red-300/10 text-red-300" : "border-amber-300/20 bg-amber-300/10 text-amber-300";
  const sourceLabel = dataSourceLabel(run.data_source);
  const title = run.strategy_config_name ?? run.strategy_template_name ?? "回测结果";

  return (
    <main className="min-h-screen">
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_20%_0%,rgba(32,214,199,0.16),transparent_34%),linear-gradient(135deg,rgba(11,19,34,0.96),rgba(5,8,18,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">Validation Report</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold sm:text-5xl">{title}</h1>
                <span className={`rounded-md border px-2.5 py-1 text-xs font-medium ${statusStyle}`}>{run.status}</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {symbolsSummary(run.symbols_json)} / {run.start_date} 至 {run.end_date}
              </p>
              <p className="mt-3 text-sm font-medium text-accent">{sourceLabel.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" onClick={repeatBacktest}>
                再次回测
              </button>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push(run.strategy_config_id ? `/strategies/configs/${run.strategy_config_id}` : "/strategies")}>
                调整策略
              </button>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/strategies")}>
                返回策略中心
              </button>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/backtests")}>
                回测中心
              </button>
            </div>
          </div>
        </header>

        {error ? <p className="rounded-md border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-200">{error}</p> : null}

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-slate-200 bg-panel p-5">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-accent">核心表现</p>
                <h2 className="mt-1 text-xl font-semibold">先看收益与风险是否匹配</h2>
              </div>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-sm disabled:opacity-50" disabled={aiLoading} onClick={handleAIExplain}>
                {aiLoading ? "解读中..." : "AI 解读本次回测"}
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard emphasis label="累计收益" tone={metricTone(metricValue(run.metrics_json.total_return_pct), "return")} value={formatPct(run.metrics_json.total_return_pct)} />
              <MetricCard emphasis label="年化收益" tone={metricTone(metricValue(run.metrics_json.annualized_return_pct), "return")} value={formatPct(run.metrics_json.annualized_return_pct)} />
              <MetricCard emphasis label="最大回撤" tone={metricTone(metricValue(run.metrics_json.max_drawdown_pct), "drawdown")} value={formatPct(run.metrics_json.max_drawdown_pct)} />
              <MetricCard emphasis label="夏普 / 胜率" value={`${formatNumber(run.metrics_json.sharpe_ratio)} / ${formatPct(run.metrics_json.win_rate_pct)}`} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-panel p-5">
            <div className="border-b border-slate-200 pb-4">
              <p className="text-sm font-medium text-accent">交易与资金</p>
              <h2 className="mt-1 text-xl font-semibold">资金、交易与数据口径</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <MetricCard label="交易次数" value={String(run.metrics_json.trade_count ?? run.trades.length ?? "-")} />
              <MetricCard label="初始资金" value={formatMoney(run.assumptions_json.initial_cash)} />
              <MetricCard label="结束资产" value={formatMoney(run.metrics_json.final_equity)} />
              <MetricCard label="数据 / 复权" value={`${sourceLabel.short} / ${adjustmentLabel(run.adjustment_mode)}`} />
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.6fr)]">
          <section className="rounded-xl border border-slate-200 bg-panel p-5">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-accent">Equity Curve</p>
                <h2 className="text-2xl font-semibold">收益曲线</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 text-right text-sm">
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-500">累计收益</p>
                  <p className="font-semibold">{formatPct(run.metrics_json.total_return_pct)}</p>
                </div>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-500">最大回撤</p>
                  <p className="font-semibold">{formatPct(run.metrics_json.max_drawdown_pct)}</p>
                </div>
              </div>
            </div>
            <svg className="mt-5 h-[360px] w-full overflow-visible rounded-lg border border-slate-200 bg-[#050812]" preserveAspectRatio="none" viewBox="0 0 800 260">
              <defs>
                <linearGradient id="equityGlow" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="45%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#20d6c7" />
                </linearGradient>
              </defs>
              {[40, 90, 140, 190, 240].map((y) => (
                <line key={y} stroke="rgba(148,163,184,0.14)" strokeWidth="1" x1="0" x2="800" y1={y} y2={y} />
              ))}
              <polyline fill="none" points={linePoints} stroke="url(#equityGlow)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
            </svg>
          </section>

          <aside className="grid gap-5">
            <section className="rounded-xl border border-slate-200 bg-panel p-5">
              <p className="text-sm font-medium text-accent">Result Readout</p>
              <h2 className="mt-1 text-xl font-semibold">规则化结果解读</h2>
              <div className="mt-4 grid gap-3">
                {resultNotes.map((note) => (
                  <p className="rounded-md border border-slate-200 bg-[#0b1322]/72 p-3 text-sm leading-6 text-slate-600" key={note}>
                    {note}
                  </p>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">以上是基于回测指标的产品内规则化提示，不构成投资建议，也不代表未来收益保证。</p>
            </section>

            {aiResult ? (
              <section className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-5">
                <h2 className="font-semibold">AI 回测解读</h2>
                <p className="mt-1 text-xs text-slate-500">Provider: {aiResult.provider} / Model: {aiResult.model ?? "-"}</p>
                <AIResultBlock result={aiResult} />
              </section>
            ) : null}
          </aside>
        </section>

        <DataAndAssumptions assumptionsOpen={assumptionsOpen} dataQuality={dataQuality} run={run} setAssumptionsOpen={setAssumptionsOpen} warnings={warnings} />

        <TradeRecords
          filteredCount={visibleTradeState.filteredCount}
          page={visibleTradeState.page}
          setPage={setTradePage}
          setSide={setTradeSide}
          setSort={setTradeSort}
          side={tradeSide}
          sort={tradeSort}
          totalCount={run.trades.length}
          totalPages={visibleTradeState.totalPages}
          trades={visibleTradeState.trades}
        />

        <section className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-panel p-5">
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" onClick={repeatBacktest}>
            基于此配置再次回测
          </button>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push(run.strategy_config_id ? `/strategies/configs/${run.strategy_config_id}` : "/strategies")}>
            查看相关策略配置
          </button>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={handleDelete}>
            删除这条回测
          </button>
        </section>
      </section>
    </main>
  );
}

function DataAndAssumptions({
  assumptionsOpen,
  dataQuality,
  run,
  setAssumptionsOpen,
  warnings,
}: {
  assumptionsOpen: boolean;
  dataQuality: Record<string, unknown>;
  run: BacktestRun;
  setAssumptionsOpen: (value: boolean) => void;
  warnings: unknown[];
}) {
  const fullAssumptions = Object.entries(run.assumptions_json).filter(([key]) => key !== "diagnostics" && key !== "implemented");
  return (
    <section className="rounded-xl border border-slate-200 bg-panel p-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Data & Assumptions</p>
          <h2 className="text-xl font-semibold">数据与假设</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">默认展示影响结果可信度的关键口径，完整字段可展开查看。</p>
        </div>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => setAssumptionsOpen(!assumptionsOpen)}>
          {assumptionsOpen ? "收起完整假设" : "展开完整假设"}
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <MetricCard label="数据源" value={dataSourceLabel(run.data_source).short} />
        <MetricCard label="Provider" value={String(run.assumptions_json.provider_name ?? "-")} />
        <MetricCard label="复权模式" value={adjustmentLabel(run.adjustment_mode)} />
        <MetricCard label="Bar 数量" value={String(dataQuality.bar_count ?? "-")} />
        <MetricCard label="请求区间" value={`${run.assumptions_json.requested_start_date ?? run.start_date} / ${run.assumptions_json.requested_end_date ?? run.end_date}`} />
        <MetricCard label="实际区间" value={`${run.assumptions_json.actual_start_date ?? "-"} / ${run.assumptions_json.actual_end_date ?? "-"}`} />
        <MetricCard label="手续费 / 滑点" value={`${formatRate(run.assumptions_json.fee_rate)} / ${formatRate(run.assumptions_json.slippage_rate)}`} />
        <MetricCard label="Warning" tone={warnings.length > 0 ? "warn" : "good"} value={warnings.length > 0 ? `${warnings.length} 条` : "无"} />
      </div>

      {warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
          {warnings.slice(0, assumptionsOpen ? warnings.length : 3).map((warning, index) => (
            <p key={`${String(warning)}-${index}`}>{String(warning)}</p>
          ))}
          {!assumptionsOpen && warnings.length > 3 ? <p>还有 {warnings.length - 3} 条提示，展开后查看完整内容。</p> : null}
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-slate-200 bg-[#0b1322]/72 p-3 text-sm text-slate-600">未发现数据源 warning。仍需注意：V1 回测尚未完整考虑停牌、涨跌停和全部公司行为影响。</p>
      )}

      {assumptionsOpen ? (
        <div className="mt-5 grid gap-3 text-sm md:grid-cols-3">
          {fullAssumptions.map(([key, value]) => (
            <div className="rounded-md border border-slate-200 bg-[#0b1322]/64 p-3" key={key}>
              <p className="text-xs text-slate-500">{key}</p>
              <p className="mt-1 break-words font-medium text-slate-700">{formatAssumptionValue(value)}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TradeRecords({
  filteredCount,
  page,
  setPage,
  setSide,
  setSort,
  side,
  sort,
  totalCount,
  totalPages,
  trades,
}: {
  filteredCount: number;
  page: number;
  setPage: (value: number) => void;
  setSide: (value: TradeSideFilter) => void;
  setSort: (value: TradeSort) => void;
  side: TradeSideFilter;
  sort: TradeSort;
  totalCount: number;
  totalPages: number;
  trades: BacktestTrade[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-panel">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-medium text-accent">Trade Ledger</p>
          <h2 className="text-xl font-semibold">交易记录</h2>
          <p className="mt-1 text-sm text-slate-600">默认每页展示 {TRADE_PAGE_SIZE} 条，避免大量交易记录吞掉分析内容。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm"
            value={side}
            onChange={(event) => {
              setSide(event.target.value as TradeSideFilter);
              setPage(1);
            }}
          >
            <option value="all">全部方向</option>
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </select>
          <select
            className="rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as TradeSort);
              setPage(1);
            }}
          >
            <option value="desc">日期倒序</option>
            <option value="asc">日期正序</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#050812] text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">日期</th>
              <th className="px-4 py-3">标的</th>
              <th className="px-4 py-3">方向</th>
              <th className="px-4 py-3">价格</th>
              <th className="px-4 py-3">数量</th>
              <th className="px-4 py-3">金额</th>
              <th className="px-4 py-3">费用</th>
              <th className="px-4 py-3">PnL</th>
              <th className="px-4 py-3">原因</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {trades.map((trade) => (
              <tr className="hover:bg-cyan-300/5" key={trade.id}>
                <td className="px-4 py-3">{trade.trade_date}</td>
                <td className="px-4 py-3 font-medium">{trade.symbol}</td>
                <td className="px-4 py-3">
                  <span className={trade.side === "buy" ? "rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-300" : "rounded-md border border-red-300/20 bg-red-300/10 px-2 py-1 text-xs text-red-300"}>
                    {trade.side === "buy" ? "买入" : "卖出"}
                  </span>
                </td>
                <td className="px-4 py-3">{trade.price.toFixed(4)}</td>
                <td className="px-4 py-3">{trade.quantity.toFixed(2)}</td>
                <td className="px-4 py-3">{trade.amount.toFixed(2)}</td>
                <td className="px-4 py-3">{trade.fee.toFixed(2)}</td>
                <td className="px-4 py-3">{trade.pnl === null ? "-" : trade.pnl.toFixed(2)}</td>
                <td className="min-w-64 px-4 py-3 text-slate-600">{trade.reason ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredCount === 0 ? <p className="p-5 text-sm text-slate-500">当前筛选条件下没有交易记录。</p> : null}
      <div className="flex flex-col gap-3 border-t border-slate-200 p-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          共 {totalCount} 条，当前筛选 {filteredCount} 条。第 {page} / {totalPages} 页
        </p>
        <div className="flex gap-2">
          <button className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-45" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            上一页
          </button>
          <button className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-45" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}

function AIResultBlock({ result }: { result: AIResponse }) {
  if (!result.parsed_json) {
    return <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{result.content}</p>;
  }
  return (
    <div className="mt-4 grid gap-3">
      {Object.entries(result.parsed_json).map(([key, value]) => (
        <div className="rounded-md border border-slate-200 p-3 text-sm" key={key}>
          <p className="font-medium text-slate-700">{key}</p>
          <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-600">{formatAIValue(value)}</p>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ emphasis = false, label, tone = "neutral", value }: { emphasis?: boolean; label: string; tone?: "neutral" | "good" | "bad" | "warn"; value: string }) {
  const toneClass = {
    bad: "text-red-300",
    good: "text-emerald-300",
    neutral: "",
    warn: "text-amber-200",
  }[tone];
  return (
    <article className={emphasis ? "rounded-lg border border-slate-200 bg-[#0b1322]/72 p-4" : "rounded-lg border border-slate-200 bg-[#0b1322]/50 p-3"}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`${emphasis ? "mt-2 text-2xl" : "mt-1 text-base"} font-semibold ${toneClass}`}>{value}</p>
    </article>
  );
}

function buildResultNotes(run: BacktestRun, warnings: unknown[]) {
  const totalReturn = metricValue(run.metrics_json.total_return_pct);
  const maxDrawdown = metricValue(run.metrics_json.max_drawdown_pct);
  const tradeCount = metricValue(run.metrics_json.trade_count) ?? run.trades.length;
  const sharpe = metricValue(run.metrics_json.sharpe_ratio);
  const notes: string[] = [];

  if (totalReturn === null) {
    notes.push("本次回测缺少累计收益指标，建议先确认回测状态和数据质量。");
  } else if (totalReturn > 0 && Math.abs(maxDrawdown ?? 0) >= 20) {
    notes.push("收益为正，但最大回撤偏高。这个结果需要重点评估资金波动承受能力，而不是只看最终收益。");
  } else if (totalReturn > 12 && Math.abs(maxDrawdown ?? 0) <= 12) {
    notes.push("本区间内收益和回撤关系相对克制，但仍需要结合不同市场阶段继续验证。");
  } else if (totalReturn <= 0) {
    notes.push("本区间内累计收益不理想，策略参数或标的池可能没有适配这段行情。");
  } else {
    notes.push("本区间内收益为正，建议继续观察最大回撤、交易频率和数据 warning 后再判断是否适合启用。");
  }

  if (sharpe !== null && sharpe < 0.5) {
    notes.push("风险收益指标偏弱，说明收益质量可能不够稳定。");
  } else if (sharpe !== null && sharpe >= 1) {
    notes.push("夏普指标相对较好，但仍不能替代对回撤和数据质量的检查。");
  }

  if (tradeCount > 80) {
    notes.push("交易次数较多，手续费和滑点假设会显著影响最终结果。");
  } else if (tradeCount === 0) {
    notes.push("本次回测没有产生交易，需要检查策略参数、标的池或回测区间是否过窄。");
  }

  if (warnings.length > 0) {
    notes.push("数据存在 warning，解读结果时应优先确认实际可用区间、缺失标的和 bar 数量。");
  }

  return notes;
}

function filterAndSortTrades(trades: BacktestTrade[], side: TradeSideFilter, sort: TradeSort) {
  return trades
    .filter((trade) => side === "all" || trade.side === side)
    .slice()
    .sort((left, right) => {
      const compare = left.trade_date.localeCompare(right.trade_date);
      return sort === "asc" ? compare : -compare;
    });
}

function equityPolyline(curve: BacktestRun["equity_curve_json"]) {
  if (curve.length === 0) {
    return "";
  }
  const values = curve.map((point) => point.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return curve
    .map((point, index) => {
      const x = curve.length === 1 ? 0 : (index / (curve.length - 1)) * 800;
      const y = 240 - ((point.equity - min) / span) * 220;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function warningList(run: BacktestRun | null) {
  if (!run) {
    return [];
  }
  const fromAssumptions = Array.isArray(run.assumptions_json.warnings) ? run.assumptions_json.warnings : [];
  const fromProvider = Array.isArray(run.assumptions_json.provider_warnings) ? run.assumptions_json.provider_warnings : [];
  return [...fromAssumptions, ...fromProvider];
}

function dataSourceLabel(source: BacktestRun["data_source"]) {
  if (source === "akshare_daily_bars") {
    return { description: "这是基于 AKShare 真实历史行情的回测", short: "AKShare 真实历史" };
  }
  return { description: "这是基于 Mock 测试数据的回测，适合系统流程验证", short: "Mock 测试数据" };
}

function symbolsSummary(symbols: string[]) {
  if (symbols.length <= 5) {
    return symbols.join(", ") || "-";
  }
  return `${symbols.slice(0, 5).join(", ")} 等 ${symbols.length} 个标的`;
}

function metricValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metricTone(value: number | null, type: "return" | "drawdown") {
  if (value === null) {
    return "neutral";
  }
  if (type === "drawdown") {
    return Math.abs(value) >= 20 ? "warn" : "good";
  }
  return value >= 0 ? "good" : "bad";
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

function formatAssumptionValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : value.map((item) => String(item)).join(", ");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value ?? "-");
}

function formatPct(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "-";
}

function formatNumber(value: unknown) {
  return typeof value === "number" ? value.toFixed(2) : "-";
}

function formatMoney(value: unknown) {
  return typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-";
}

function formatRate(value: unknown) {
  return typeof value === "number" ? `${(value * 100).toFixed(3)}%` : "-";
}

function adjustmentLabel(value: string) {
  if (value === "qfq") {
    return "前复权";
  }
  if (value === "hfq") {
    return "后复权";
  }
  return "不复权";
}
