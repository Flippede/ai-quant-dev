"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BacktestRun, deleteBacktest, getBacktest, getCurrentUser } from "@/lib/api/client";

export default function BacktestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [run, setRun] = useState<BacktestRun | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser()
      .then(() => getBacktest(params.id))
      .then(setRun)
      .catch(() => router.replace("/login"));
  }, [params.id, router]);

  const linePoints = useMemo(() => (run ? equityPolyline(run.equity_curve_json) : ""), [run]);

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

  if (!run) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading...</main>;
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Backtest Result</p>
            <h1 className="mt-2 text-3xl font-semibold">{run.strategy_config_name ?? run.strategy_template_name}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {run.start_date} 至 {run.end_date} / {run.symbols_json.join(", ")}
            </p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/backtests")}>
              返回回测中心
            </button>
            <button className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700" onClick={handleDelete}>
              删除
            </button>
          </div>
        </header>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard label="总收益" value={formatPct(run.metrics_json.total_return_pct)} />
          <MetricCard label="年化收益" value={formatPct(run.metrics_json.annualized_return_pct)} />
          <MetricCard label="最大回撤" value={formatPct(run.metrics_json.max_drawdown_pct)} />
          <MetricCard label="最终权益" value={formatMoney(run.metrics_json.final_equity)} />
          <MetricCard label="波动率" value={formatPct(run.metrics_json.volatility_pct)} />
          <MetricCard label="Sharpe" value={formatNumber(run.metrics_json.sharpe_ratio)} />
          <MetricCard label="交易次数" value={String(run.metrics_json.trade_count ?? "-")} />
          <MetricCard label="胜率" value={formatPct(run.metrics_json.win_rate_pct)} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="font-semibold">收益曲线</h2>
          <svg className="mt-4 h-72 w-full overflow-visible rounded-md border border-slate-200 bg-white" preserveAspectRatio="none" viewBox="0 0 800 260">
            <polyline fill="none" points={linePoints} stroke="#2563eb" strokeWidth="3" />
          </svg>
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="font-semibold">回测假设</h2>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            {Object.entries(run.assumptions_json)
              .filter(([key]) => key !== "diagnostics" && key !== "warnings" && key !== "implemented")
              .map(([key, value]) => (
                <div className="rounded-md border border-slate-200 p-3" key={key}>
                  <p className="text-xs text-slate-500">{key}</p>
                  <p className="mt-1 font-medium">{String(value)}</p>
                </div>
              ))}
          </div>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">
            {Array.isArray(run.assumptions_json.warnings) ? run.assumptions_json.warnings.join(" ") : "Phase 5 使用 deterministic mock daily bars，尚未考虑停牌、涨跌停和复权处理。"}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold">交易记录</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
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
              <tbody className="divide-y divide-slate-100">
                {run.trades.map((trade) => (
                  <tr key={trade.id}>
                    <td className="px-4 py-3">{trade.trade_date}</td>
                    <td className="px-4 py-3">{trade.symbol}</td>
                    <td className="px-4 py-3">{trade.side}</td>
                    <td className="px-4 py-3">{trade.price.toFixed(4)}</td>
                    <td className="px-4 py-3">{trade.quantity.toFixed(2)}</td>
                    <td className="px-4 py-3">{trade.amount.toFixed(2)}</td>
                    <td className="px-4 py-3">{trade.fee.toFixed(2)}</td>
                    <td className="px-4 py-3">{trade.pnl === null ? "-" : trade.pnl.toFixed(2)}</td>
                    <td className="px-4 py-3">{trade.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-panel p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </article>
  );
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

function formatPct(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "-";
}

function formatNumber(value: unknown) {
  return typeof value === "number" ? value.toFixed(2) : "-";
}

function formatMoney(value: unknown) {
  return typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-";
}
