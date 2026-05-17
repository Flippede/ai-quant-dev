"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AIResponse, StrategySignal, explainSignal, getCurrentUser, getSignals } from "@/lib/api/client";

export default function SignalsPage() {
  const router = useRouter();
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [severity, setSeverity] = useState("");
  const [signalType, setSignalType] = useState("");
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiResults, setAiResults] = useState<Record<string, AIResponse>>({});
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);

  async function loadSignals() {
    setSignals(await getSignals({ severity, signal_type: signalType, symbol, limit: 100 }));
  }

  useEffect(() => {
    getCurrentUser()
      .then(loadSignals)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await loadSignals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载信号失败");
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

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading...</main>;
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Signals</p>
            <h1 className="mt-2 text-3xl font-semibold">策略信号</h1>
          </div>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/")}>
            返回首页
          </button>
        </header>

        <form className="grid gap-3 rounded-lg border border-slate-200 bg-panel p-4 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={handleFilter}>
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="标的代码" value={symbol} onChange={(event) => setSymbol(event.target.value)} />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="">全部等级</option>
            <option value="watch">watch</option>
            <option value="strong">strong</option>
            <option value="breakout_watch">breakout_watch</option>
            <option value="breakout_strong">breakout_strong</option>
            <option value="risk_medium">risk_medium</option>
            <option value="risk_high">risk_high</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={signalType} onChange={(event) => setSignalType(event.target.value)}>
            <option value="">全部类型</option>
            <option value="trend_follow">trend_follow</option>
            <option value="volume_breakout">volume_breakout</option>
            <option value="etf_momentum_rotation">etf_momentum_rotation</option>
            <option value="risk_warning">risk_warning</option>
          </select>
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
            筛选
          </button>
        </form>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <section className="rounded-lg border border-slate-200 bg-panel">
          <div className="divide-y divide-slate-100">
            {signals.map((signal) => (
              <article className="grid gap-3 p-4 md:grid-cols-[150px_120px_1fr_180px]" key={signal.id}>
                <div className="text-sm text-slate-500">{new Date(signal.triggered_at).toLocaleString()}</div>
                <div>
                  <p className="font-medium">{signal.symbol}</p>
                  <p className="text-xs text-slate-500">{signal.market}</p>
                </div>
                <div>
                  <p className="font-medium">{signal.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{signal.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{signal.strategy_config_name ?? signal.template_name ?? signal.signal_type}</p>
                  {aiResults[signal.id] ? <AIResultBlock result={aiResults[signal.id]} /> : null}
                </div>
                <div className="text-sm">
                  <p className="font-medium">{signal.severity}</p>
                  <p className="mt-1 text-slate-500">{signal.score === null ? "-" : signal.score.toFixed(2)}</p>
                  <button className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-xs" disabled={aiLoadingId === signal.id} onClick={() => handleExplain(signal.id)}>
                    {aiLoadingId === signal.id ? "解释中..." : "AI解释"}
                  </button>
                </div>
              </article>
            ))}
            {signals.length === 0 ? <p className="p-5 text-sm text-slate-500">暂无信号。</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function AIResultBlock({ result }: { result: AIResponse }) {
  if (!result.parsed_json) {
    return <p className="mt-3 whitespace-pre-wrap rounded-md border border-slate-200 p-3 text-sm leading-6 text-slate-700">{result.content}</p>;
  }
  return (
    <div className="mt-3 grid gap-2 rounded-md border border-slate-200 p-3">
      {Object.entries(result.parsed_json).map(([key, value]) => (
        <div className="text-sm" key={key}>
          <p className="font-medium text-slate-700">{key}</p>
          <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">{formatAIValue(value)}</p>
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
