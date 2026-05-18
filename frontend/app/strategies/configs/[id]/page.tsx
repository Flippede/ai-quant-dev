"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AIResponse,
  StrategyConfig,
  StrategyTemplate,
  WatchScope,
  deleteStrategyConfig,
  explainStrategyConfig,
  getCurrentUser,
  getStrategyConfig,
  getStrategyTemplate,
  updateStrategyConfig,
} from "@/lib/api/client";

export default function StrategyConfigDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [config, setConfig] = useState<StrategyConfig | null>(null);
  const [template, setTemplate] = useState<StrategyTemplate | null>(null);
  const [name, setName] = useState("");
  const [paramText, setParamText] = useState<Record<string, string>>({});
  const [scopeType, setScopeType] = useState<WatchScope["type"]>("all_watchlists");
  const [scopeText, setScopeText] = useState("");
  const [monitorInterval, setMonitorInterval] = useState(60);
  const [riskLevel, setRiskLevel] = useState<"low" | "medium" | "high">("medium");
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const orderedParamKeys = useMemo(() => {
    if (!template) {
      return [];
    }
    return template.schema_json.ui_order ?? Object.keys(template.schema_json.properties);
  }, [template]);

  async function loadData() {
    const configData = await getStrategyConfig(params.id);
    const templateData = await getStrategyTemplate(configData.template_key);
    setConfig(configData);
    setTemplate(templateData);
    setName(configData.name);
    setMonitorInterval(configData.monitor_interval_sec);
    setRiskLevel(configData.risk_level ?? "medium");
    setIsEnabled(configData.is_enabled);
    setParamText(
      Object.fromEntries(
        Object.keys(templateData.schema_json.properties).map((key) => [key, formatParamValue(configData.params_json[key])]),
      ),
    );
    setScopeType(configData.watch_scope_json.type);
    setScopeText(scopeToText(configData.watch_scope_json));
  }

  useEffect(() => {
    getCurrentUser()
      .then(loadData)
      .catch(() => router.replace("/login"));
  }, [params.id, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!template) {
      return;
    }
    setError("");
    setMessage("");
    try {
      const paramsJson = Object.fromEntries(
        orderedParamKeys.map((key) => [key, parseParamValue(paramText[key], template.schema_json.properties[key].type)]),
      );
      const updated = await updateStrategyConfig(params.id, {
        name,
        params_json: paramsJson,
        watch_scope_json: textToScope(scopeType, scopeText),
        monitor_interval_sec: monitorInterval,
        risk_level: riskLevel,
        is_enabled: isEnabled,
      });
      setConfig(updated);
      setMessage("策略配置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function handleDelete() {
    if (!config || !window.confirm(`删除策略配置「${config.name}」？`)) {
      return;
    }
    try {
      await deleteStrategyConfig(config.id);
      router.push("/strategies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function handleAIExplain() {
    setError("");
    setAiLoading(true);
    try {
      setAiResult(await explainStrategyConfig(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 解释失败");
    } finally {
      setAiLoading(false);
    }
  }

  if (!config || !template) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading...</main>;
  }

  return (
    <main className="min-h-screen">
      <form className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8" onSubmit={handleSubmit}>
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Strategy Config</p>
            <h1 className="mt-2 text-3xl font-semibold">{config.template_name}</h1>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/strategies")} type="button">
              返回策略中心
            </button>
            <button className="rounded-md border border-red-300 px-4 py-2 text-sm text-red-700" onClick={handleDelete} type="button">
              删除
            </button>
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" disabled={aiLoading} onClick={handleAIExplain} type="button">
              {aiLoading ? "解释中..." : "AI解释当前策略"}
            </button>
            <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
              保存
            </button>
          </div>
        </header>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}
        {aiResult ? (
          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <h2 className="font-semibold">AI 策略解释</h2>
            <p className="mt-1 text-xs text-slate-500">Provider: {aiResult.provider} / Model: {aiResult.model ?? "-"}</p>
            <AIResultBlock result={aiResult} />
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="font-semibold">基础配置</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium text-slate-700">策略名称</span>
              <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">监控间隔秒数</span>
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                min={10}
                type="number"
                value={monitorInterval}
                onChange={(event) => setMonitorInterval(Number(event.target.value))}
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-slate-700">风险等级</span>
              <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as typeof riskLevel)}>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </label>
            <label className="flex items-center gap-3 pt-7 text-sm font-medium text-slate-700">
              <input checked={isEnabled} type="checkbox" onChange={(event) => setIsEnabled(event.target.checked)} />
              启用策略
            </label>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="font-semibold">策略参数</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {orderedParamKeys.map((key) => {
              const schema = template.schema_json.properties[key];
              if (schema.type === "boolean") {
                return (
                  <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm" key={key}>
                    <input
                      checked={paramText[key] === "true"}
                      className="mt-1"
                      type="checkbox"
                      onChange={(event) => setParamText({ ...paramText, [key]: event.target.checked ? "true" : "false" })}
                    />
                    <span>
                      <span className="block font-medium text-slate-700">{schema.title ?? key}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{schema.description}</span>
                    </span>
                  </label>
                );
              }
              return (
                <label className="text-sm" key={key}>
                  <span className="font-medium text-slate-700">{schema.title ?? key}</span>
                  {schema.enum ? (
                    <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={paramText[key] ?? ""} onChange={(event) => setParamText({ ...paramText, [key]: event.target.value })}>
                      {schema.enum.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2"
                      max={schema.maximum}
                      min={schema.minimum}
                      type={schema.type === "string" ? "text" : "number"}
                      value={paramText[key] ?? ""}
                      onChange={(event) => setParamText({ ...paramText, [key]: event.target.value })}
                    />
                  )}
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{schema.description}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="font-semibold">扫描范围</h2>
          <div className="mt-4 grid gap-4">
            <label className="text-sm">
              <span className="font-medium text-slate-700">范围类型</span>
              <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={scopeType} onChange={(event) => setScopeType(event.target.value as WatchScope["type"])}>
                <option value="all_watchlists">当前用户全部自选池</option>
                <option value="watchlist_groups">指定自选分组 ID</option>
                <option value="instruments">指定具体标的</option>
                <option value="etf_pool">ETF 自定义池</option>
              </select>
            </label>
            {scopeType !== "all_watchlists" ? (
              <label className="text-sm">
                <span className="font-medium text-slate-700">{scopeType === "watchlist_groups" ? "分组 ID，逗号分隔" : "标的列表，每行 symbol,market,name"}</span>
                <textarea
                  className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
                  value={scopeText}
                  onChange={(event) => setScopeText(event.target.value)}
                />
              </label>
            ) : null}
          </div>
        </section>
      </form>
    </main>
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

function formatAIValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => `- ${String(item)}`).join("\n");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value ?? "");
}

function formatParamValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function parseParamValue(value: string | undefined, type: string) {
  if (value === "") {
    return null;
  }
  if (type === "integer") {
    return Number.parseInt(value ?? "0", 10);
  }
  if (type === "number") {
    return Number(value);
  }
  if (type === "boolean") {
    return value === "true";
  }
  return value ?? "";
}

function scopeToText(scope: WatchScope) {
  if (scope.type === "watchlist_groups") {
    return (scope.watchlist_group_ids ?? []).join(",");
  }
  const items = scope.type === "etf_pool" ? scope.etf_pool : scope.instruments;
  return (items ?? []).map((item) => [item.symbol, item.market, item.name ?? ""].join(",")).join("\n");
}

function textToScope(type: WatchScope["type"], text: string): WatchScope {
  if (type === "all_watchlists") {
    return { type };
  }
  if (type === "watchlist_groups") {
    return { type, watchlist_group_ids: text.split(",").map((item) => item.trim()).filter(Boolean) };
  }
  const instruments = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [symbol, market = "CN", name = ""] = line.split(",").map((part) => part.trim());
      return { symbol, market, name };
    });
  return type === "etf_pool" ? { type, etf_pool: instruments } : { type, instruments };
}
