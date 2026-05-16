"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BacktestRun, StrategyConfig, createBacktest, getBacktests, getCurrentUser, getStrategyConfigs } from "@/lib/api/client";

export default function BacktestsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<StrategyConfig[]>([]);
  const [runs, setRuns] = useState<BacktestRun[]>([]);
  const [strategyConfigId, setStrategyConfigId] = useState("");
  const [symbolsText, setSymbolsText] = useState("510300,510500,159915,512880");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-12-31");
  const [initialCash, setInitialCash] = useState(100000);
  const [feeRate, setFeeRate] = useState(0.0003);
  const [slippageRate, setSlippageRate] = useState(0.0005);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const supportedConfigs = useMemo(() => configs.filter((config) => config.template_key === "etf_momentum_rotation"), [configs]);

  async function loadData() {
    const [configData, runData] = await Promise.all([getStrategyConfigs(), getBacktests()]);
    setConfigs(configData);
    setRuns(runData);
    const firstSupported = configData.find((config) => config.template_key === "etf_momentum_rotation");
    if (!strategyConfigId && firstSupported) {
      setStrategyConfigId(firstSupported.id);
    }
  }

  useEffect(() => {
    getCurrentUser()
      .then(loadData)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
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
        execution_price_type: "close",
        adjustment_mode: "none",
      });
      router.push(`/backtests/${run.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发起回测失败");
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading...</main>;
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Backtests</p>
            <h1 className="mt-2 text-3xl font-semibold">回测中心</h1>
          </div>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/")}>
            返回首页
          </button>
        </header>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <form className="rounded-lg border border-slate-200 bg-panel p-5" onSubmit={handleSubmit}>
          <h2 className="font-semibold">发起 ETF 动量轮动回测</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-slate-700">策略配置</span>
              <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={strategyConfigId} onChange={(event) => setStrategyConfigId(event.target.value)} required>
                {supportedConfigs.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.name}
                  </option>
                ))}
              </select>
              {supportedConfigs.length === 0 ? <span className="mt-1 block text-xs text-red-600">请先在策略中心创建 ETF 动量轮动配置。</span> : null}
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">ETF 池，逗号分隔</span>
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={symbolsText} onChange={(event) => setSymbolsText(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">开始日期</span>
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">结束日期</span>
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">初始资金</span>
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" type="number" value={initialCash} onChange={(event) => setInitialCash(Number(event.target.value))} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">手续费率</span>
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" step="0.0001" type="number" value={feeRate} onChange={(event) => setFeeRate(Number(event.target.value))} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">滑点率</span>
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" step="0.0001" type="number" value={slippageRate} onChange={(event) => setSlippageRate(Number(event.target.value))} />
            </label>
          </div>
          <button className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={!strategyConfigId || submitting} type="submit">
            {submitting ? "回测中..." : "发起回测"}
          </button>
        </form>

        <section className="rounded-lg border border-slate-200 bg-panel">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold">历史回测记录</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {runs.map((run) => (
              <button className="grid w-full gap-2 p-4 text-left text-sm hover:bg-slate-50 md:grid-cols-[1fr_auto_auto_auto]" key={run.id} onClick={() => router.push(`/backtests/${run.id}`)}>
                <span className="font-medium">{run.strategy_config_name ?? run.strategy_template_name ?? run.id}</span>
                <span>{run.status}</span>
                <span>{formatPct(run.metrics_json.total_return_pct)}</span>
                <span className="text-slate-500">{new Date(run.created_at).toLocaleString()}</span>
              </button>
            ))}
            {runs.length === 0 ? <p className="p-5 text-sm text-slate-500">暂无回测记录。</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function formatPct(value: unknown) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "-";
}
