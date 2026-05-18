"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StrategyTemplate, createStrategyConfig, getCurrentUser, getStrategyTemplate } from "@/lib/api/client";
import { AppHeader } from "@/components/app-header";

export default function StrategyTemplateDetailPage() {
  const router = useRouter();
  const params = useParams<{ key: string }>();
  const [template, setTemplate] = useState<StrategyTemplate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser()
      .then(() => getStrategyTemplate(params.key))
      .then(setTemplate)
      .catch(() => router.replace("/login"));
  }, [params.key, router]);

  async function handleCreate() {
    if (!template) {
      return;
    }
    setError("");
    try {
      const config = await createStrategyConfig({
        template_key: template.key,
        name: `${template.name} 配置`,
        params_json: template.default_params_json,
        watch_scope_json: defaultScope(template.key),
      });
      router.push(`/strategies/configs/${config.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建策略配置失败");
    }
  }

  if (!template) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading...</main>;
  }

  return (
    <main className="min-h-screen">
      <AppHeader />
      <section className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Template</p>
            <h1 className="mt-2 text-3xl font-semibold">{template.name}</h1>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/strategies")}>
              返回策略中心
            </button>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={handleCreate}>
              创建个人配置
            </button>
          </div>
        </header>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="font-semibold">策略说明</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{template.description}</p>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-slate-500">分类</dt>
              <dd className="mt-1 font-medium">{template.category}</dd>
            </div>
            <div>
              <dt className="text-slate-500">版本</dt>
              <dd className="mt-1 font-medium">{template.version}</dd>
            </div>
            <div>
              <dt className="text-slate-500">模式</dt>
              <dd className="mt-1 font-medium">{template.schema_json.supported_modes?.join(" / ") ?? "-"}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="font-semibold">默认参数</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {Object.entries(template.schema_json.properties).map(([key, schema]) => (
              <div className="grid gap-2 py-3 sm:grid-cols-[220px_1fr_120px]" key={key}>
                <div>
                  <p className="font-medium">{schema.title ?? key}</p>
                  <p className="text-xs text-slate-500">{key}</p>
                </div>
                <p className="text-sm text-slate-600">{schema.description}</p>
                <code className="text-sm text-slate-700">{String(template.default_params_json[key])}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="font-semibold">适合场景与风险说明</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            该模板用于筛选、排序或风险识别，不负责下单，不保证收益，也不代表标的一定上涨。后续回测和盯盘阶段会复用同一套参数和扫描范围。
          </p>
        </section>
      </section>
    </main>
  );
}

function defaultScope(key: string) {
  if (key !== "etf_momentum_rotation") {
    return { type: "all_watchlists" as const };
  }
  return {
    type: "etf_pool" as const,
    etf_pool: [
      { symbol: "510300", market: "CN", asset_type: "etf", name: "沪深300ETF" },
      { symbol: "510500", market: "CN", asset_type: "etf", name: "中证500ETF" },
      { symbol: "159915", market: "CN", asset_type: "etf", name: "创业板ETF" },
    ],
  };
}
