"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  StrategyConfig,
  StrategyTemplate,
  createStrategyConfig,
  getCurrentUser,
  getStrategyConfigs,
  getStrategyTemplates,
} from "@/lib/api/client";

export default function StrategiesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [configs, setConfigs] = useState<StrategyConfig[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadData() {
    const [templateData, configData] = await Promise.all([getStrategyTemplates(), getStrategyConfigs()]);
    setTemplates(templateData);
    setConfigs(configData);
  }

  useEffect(() => {
    getCurrentUser()
      .then(loadData)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleCreate(template: StrategyTemplate) {
    setError("");
    setMessage("");
    try {
      const config = await createStrategyConfig({
        template_key: template.key,
        name: `${template.name} 配置`,
        params_json: template.default_params_json,
        watch_scope_json:
          template.key === "etf_momentum_rotation"
            ? {
                type: "etf_pool",
                etf_pool: [
                  { symbol: "510300", market: "CN", asset_type: "etf", name: "沪深300ETF" },
                  { symbol: "510500", market: "CN", asset_type: "etf", name: "中证500ETF" },
                  { symbol: "159915", market: "CN", asset_type: "etf", name: "创业板ETF" },
                ],
              }
            : { type: "all_watchlists" },
      });
      await loadData();
      setMessage("策略配置已创建");
      router.push(`/strategies/configs/${config.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建策略配置失败");
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
            <p className="text-sm font-medium text-accent">Strategies</p>
            <h1 className="mt-2 text-3xl font-semibold">策略中心</h1>
          </div>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/dashboard")}>
            返回首页
          </button>
        </header>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

        <section className="rounded-lg border border-slate-200 bg-panel">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold">我的策略配置</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {configs.map((config) => (
              <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto]" key={config.id}>
                <div>
                  <p className="font-medium">{config.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {config.template_name} / {categoryLabel(config.template_category)} / {config.monitor_interval_sec}s
                  </p>
                </div>
                <span className={config.is_enabled ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-slate-500"}>
                  {config.is_enabled ? "已启用" : "已停用"}
                </span>
                <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={() => router.push(`/strategies/configs/${config.id}`)}>
                  编辑
                </button>
              </div>
            ))}
            {configs.length === 0 ? <p className="p-5 text-sm text-slate-500">暂无个人策略配置，可从下方模板创建。</p> : null}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">系统内置策略模板</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {templates.map((template) => (
              <article className="rounded-lg border border-slate-200 bg-panel p-5" key={template.key}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-500">{categoryLabel(template.category)}</p>
                    <h3 className="mt-1 text-lg font-semibold">{template.name}</h3>
                  </div>
                  <span className="text-xs text-slate-500">v{template.version}</span>
                </div>
                <p className="mt-3 min-h-16 text-sm leading-6 text-slate-600">{template.description}</p>
                <div className="mt-5 flex gap-2">
                  <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => handleCreate(template)}>
                    创建配置
                  </button>
                  <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push(`/strategies/templates/${template.key}`)}>
                    查看模板
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    trend: "趋势",
    breakout: "突破",
    rotation: "轮动",
    risk: "风险",
  };
  return labels[category] ?? category;
}
