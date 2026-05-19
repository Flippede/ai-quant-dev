"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  StrategyConfig,
  StrategyParamProperty,
  StrategyTemplate,
  WatchScope,
  createStrategyConfig,
  getCurrentUser,
  getRecentSignals,
  getStrategyConfigs,
  getStrategyTemplates,
  updateStrategyConfig,
} from "@/lib/api/client";

type WizardStep = 1 | 2 | 3 | 4;
type ScopeMode = "all_watchlists" | "instruments" | "etf_pool";

const templateCopy: Record<string, { oneLine: string; scenario: string; logic: string; risk: string; recommended?: boolean }> = {
  trend_follow: {
    oneLine: "跟随已有强趋势，不做主观抄底。",
    scenario: "适合趋势较清晰、价格沿均线抬升的股票或 ETF。",
    logic: "比较短长期均线、近阶段动量和成交活跃度，识别趋势走强状态。",
    risk: "震荡市容易反复触发，需要结合风险控制和观察周期。",
    recommended: true,
  },
  volume_breakout: {
    oneLine: "捕捉量价共振后的突破机会。",
    scenario: "适合关注阶段高点、成交放大和主题催化的标的。",
    logic: "检查近 N 日高点突破，并结合成交量或成交额放大确认。",
    risk: "假突破常见，突破后回落需要独立风控处理。",
  },
  etf_momentum_rotation: {
    oneLine: "在一组 ETF 里寻找阶段更强者。",
    scenario: "适合低频比较宽基、行业或主题 ETF 的相对强弱。",
    logic: "按回看周期计算 ETF 动量，选择排名靠前的标的。",
    risk: "轮动策略可能在快速切换行情中滞后，需关注回撤。",
    recommended: true,
  },
  risk_warning: {
    oneLine: "提醒已有标的出现异常波动或趋势弱化。",
    scenario: "适合对自选池或模拟持仓做风险扫描。",
    logic: "检查均线跌破、波动抬升、回撤扩大等风险状态。",
    risk: "它是预警工具，不是收益型交易策略。",
  },
};

const defaultEtfPool = [
  { symbol: "510300", market: "CN", asset_type: "etf", name: "沪深300ETF" },
  { symbol: "510500", market: "CN", asset_type: "etf", name: "中证500ETF" },
  { symbol: "159915", market: "CN", asset_type: "etf", name: "创业板ETF" },
];

export default function StrategiesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [configs, setConfigs] = useState<StrategyConfig[]>([]);
  const [todaySignals, setTodaySignals] = useState(0);
  const [latestSignalAt, setLatestSignalAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("all_watchlists");
  const [symbolsText, setSymbolsText] = useState("");
  const [configName, setConfigName] = useState("");
  const [paramText, setParamText] = useState<Record<string, string>>({});
  const [saveMode, setSaveMode] = useState<"save" | "enable" | "backtest">("save");
  const [submitting, setSubmitting] = useState(false);

  const enabledCount = configs.filter((config) => config.is_enabled).length;
  const selectedTemplate = templates.find((template) => template.key === selectedTemplateKey) ?? null;
  const initialSymbol = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("symbol") ?? "";

  async function loadData() {
    const [templateData, configData, signalData] = await Promise.all([getStrategyTemplates(), getStrategyConfigs(), getRecentSignals(20)]);
    setTemplates(templateData);
    setConfigs(configData);
    const today = new Date().toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" });
    setTodaySignals(signalData.filter((signal) => new Date(signal.triggered_at).toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" }) === today).length);
    setLatestSignalAt(signalData[0]?.triggered_at ?? null);
  }

  useEffect(() => {
    getCurrentUser()
      .then(async () => {
        await loadData();
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!loading && initialSymbol && templates.length > 0 && !wizardOpen) {
      openWizard(templates.find((template) => template.key === "trend_follow") ?? templates[0], initialSymbol);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, initialSymbol, templates.length]);

  function openWizard(template?: StrategyTemplate, presetSymbol?: string) {
    const nextTemplate = template ?? templates.find((item) => item.key === "etf_momentum_rotation") ?? templates[0];
    if (!nextTemplate) {
      return;
    }
    setError("");
    setMessage("");
    setWizardOpen(true);
    setWizardStep(template ? 2 : 1);
    setSelectedTemplateKey(nextTemplate.key);
    setConfigName(`${nextTemplate.name} 策略`);
    setParamText(paramsToText(nextTemplate.default_params_json));
    if (presetSymbol) {
      setScopeMode(nextTemplate.key === "etf_momentum_rotation" ? "etf_pool" : "instruments");
      setSymbolsText(`${presetSymbol},CN,${presetSymbol}`);
    } else if (nextTemplate.key === "etf_momentum_rotation") {
      setScopeMode("etf_pool");
      setSymbolsText(scopeListToText(defaultEtfPool));
    } else {
      setScopeMode("all_watchlists");
      setSymbolsText("");
    }
  }

  function chooseTemplate(template: StrategyTemplate) {
    setSelectedTemplateKey(template.key);
    setConfigName(`${template.name} 策略`);
    setParamText(paramsToText(template.default_params_json));
    if (template.key === "etf_momentum_rotation") {
      setScopeMode("etf_pool");
      setSymbolsText(scopeListToText(defaultEtfPool));
    } else if (initialSymbol) {
      setScopeMode("instruments");
      setSymbolsText(`${initialSymbol},CN,${initialSymbol}`);
    } else {
      setScopeMode("all_watchlists");
      setSymbolsText("");
    }
    setWizardStep(2);
  }

  async function handleCreate() {
    if (!selectedTemplate) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const config = await createStrategyConfig({
        template_key: selectedTemplate.key,
        name: configName || `${selectedTemplate.name} 策略`,
        params_json: parseParams(selectedTemplate, paramText),
        watch_scope_json: buildWatchScope(scopeMode, symbolsText),
        is_enabled: saveMode === "enable",
      });
      await loadData();
      setWizardOpen(false);
      setMessage(saveMode === "enable" ? "策略已保存并启用盯盘" : "策略已保存");
      if (saveMode === "backtest" && config.template_key === "etf_momentum_rotation") {
        router.push(`/backtests?config_id=${config.id}&symbols=${scopeSymbols(buildWatchScope(scopeMode, symbolsText)).join(",")}`);
      } else {
        router.push(`/strategies/configs/${config.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建策略失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleConfig(config: StrategyConfig) {
    setError("");
    try {
      await updateStrategyConfig(config.id, { is_enabled: !config.is_enabled });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新策略状态失败");
    }
  }

  return (
    <main className="min-h-screen">
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
        <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">Strategy Studio</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">策略工作室</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">从模板理解策略逻辑，配置扫描范围和参数，再进入回测或启用实时盯盘。</p>
          </div>
          <button className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_0_28px_rgba(32,214,199,0.18)]" onClick={() => openWizard()}>
            创建策略
          </button>
        </header>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

        <section className="grid gap-4 md:grid-cols-4">
          <StudioStat label="运行中策略" value={`${enabledCount}`} detail={`${configs.length} 个总配置`} />
          <StudioStat label="全部配置" value={`${configs.length}`} detail="用户私有策略" />
          <StudioStat label="今日信号" value={`${todaySignals}`} detail="来自已启用策略" />
          <StudioStat label="最近信号" value={latestSignalAt ? formatShortTime(latestSignalAt) : "-"} detail="Signals 联动" />
        </section>

        {loading ? <StudioSkeleton /> : null}

        {!loading ? (
          <>
            <section>
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">策略模板库</h2>
                  <p className="mt-1 text-sm text-slate-600">先选择一个符合目标的模板，再把它变成你的个人策略配置。</p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {templates.map((template) => (
                  <TemplateCard key={template.key} template={template} onCreate={() => openWizard(template)} onDetail={() => router.push(`/strategies/templates/${template.key}`)} />
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-panel p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">我的策略</h2>
                  <p className="mt-1 text-sm text-slate-600">管理启停、回测和信号联动。不同用户只能看到自己的配置。</p>
                </div>
                <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => openWizard()}>
                  新建
                </button>
              </div>

              {configs.length > 0 ? (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {configs.map((config) => (
                    <ConfigCard key={config.id} config={config} onToggle={() => toggleConfig(config)} onEdit={() => router.push(`/strategies/configs/${config.id}`)} onBacktest={() => router.push(backtestHref(config))} onSignals={() => router.push(`/signals?strategy_config_id=${config.id}`)} />
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-dashed border-cyan-300/20 bg-cyan-300/5 p-6">
                  <h3 className="font-semibold">还没有个人策略</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">建议从 ETF 动量轮动或趋势跟随开始。前者适合做真实历史回测，后者适合把自选标的纳入趋势盯盘。</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => openWizard(templates.find((template) => template.key === "etf_momentum_rotation") ?? templates[0])}>从 ETF 轮动开始</button>
                    <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => openWizard(templates.find((template) => template.key === "trend_follow") ?? templates[0])}>从趋势跟随开始</button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>

      {wizardOpen && selectedTemplate ? (
        <StrategyWizard
          configName={configName}
          paramText={paramText}
          saveMode={saveMode}
          scopeMode={scopeMode}
          selectedTemplate={selectedTemplate}
          step={wizardStep}
          submitting={submitting}
          symbolsText={symbolsText}
          templates={templates}
          onChooseTemplate={chooseTemplate}
          onClose={() => setWizardOpen(false)}
          onConfigName={setConfigName}
          onCreate={handleCreate}
          onParamText={setParamText}
          onSaveMode={setSaveMode}
          onScopeMode={setScopeMode}
          onStep={setWizardStep}
          onSymbolsText={setSymbolsText}
        />
      ) : null}
    </main>
  );
}

function TemplateCard({ template, onCreate, onDetail }: { template: StrategyTemplate; onCreate: () => void; onDetail: () => void }) {
  const copy = templateCopy[template.key] ?? { oneLine: template.description, scenario: "适合按模板规则进行策略扫描。", logic: template.description, risk: "策略仅用于辅助分析，不保证收益。" };
  return (
    <article className="rounded-lg border border-slate-200 bg-panel p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{categoryLabel(template.category)}</p>
          <h3 className="mt-2 text-xl font-semibold">{template.name}</h3>
          <p className="mt-2 text-sm text-slate-600">{copy.oneLine}</p>
        </div>
        {copy.recommended ? <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-accent">推荐</span> : null}
      </div>
      <div className="mt-5 grid gap-3 text-sm">
        <InfoBlock label="适用场景" value={copy.scenario} />
        <InfoBlock label="核心逻辑" value={copy.logic} />
        <InfoBlock label="风险提示" value={copy.risk} />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={onCreate}>使用此策略</button>
        <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={onDetail}>查看详情</button>
      </div>
    </article>
  );
}

function ConfigCard({ config, onToggle, onEdit, onBacktest, onSignals }: { config: StrategyConfig; onToggle: () => void; onEdit: () => void; onBacktest: () => void; onSignals: () => void }) {
  const backtestSupported = config.template_key === "etf_momentum_rotation";
  return (
    <article className="rounded-lg border border-slate-200 bg-[#0b1322]/72 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{config.name}</h3>
          <p className="mt-1 text-sm text-slate-600">{config.template_name} / {categoryLabel(config.template_category)}</p>
        </div>
        <span className={config.is_enabled ? "rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs text-emerald-300" : "rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500"}>{config.is_enabled ? "运行中" : "已停用"}</span>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <InfoRow label="扫描范围" value={scopeSummary(config.watch_scope_json)} />
        <InfoRow label="关键参数" value={paramSummary(config.params_json)} />
        <InfoRow label="最近更新" value={new Date(config.updated_at).toLocaleString()} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={onEdit}>编辑</button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={onToggle}>{config.is_enabled ? "停用" : "启用"}</button>
        <button className={backtestSupported ? "rounded-md border border-cyan-300/30 px-3 py-2 text-sm text-accent" : "rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-500 opacity-60"} disabled={!backtestSupported} onClick={onBacktest}>{backtestSupported ? "发起回测" : "回测待扩展"}</button>
        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={onSignals}>相关信号</button>
      </div>
    </article>
  );
}

function StrategyWizard(props: {
  configName: string;
  paramText: Record<string, string>;
  saveMode: "save" | "enable" | "backtest";
  scopeMode: ScopeMode;
  selectedTemplate: StrategyTemplate;
  step: WizardStep;
  submitting: boolean;
  symbolsText: string;
  templates: StrategyTemplate[];
  onChooseTemplate: (template: StrategyTemplate) => void;
  onClose: () => void;
  onConfigName: (value: string) => void;
  onCreate: () => void;
  onParamText: (value: Record<string, string>) => void;
  onSaveMode: (value: "save" | "enable" | "backtest") => void;
  onScopeMode: (value: ScopeMode) => void;
  onStep: (value: WizardStep) => void;
  onSymbolsText: (value: string) => void;
}) {
  const orderedKeys = props.selectedTemplate.schema_json.ui_order ?? Object.keys(props.selectedTemplate.schema_json.properties);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <section className="mx-auto my-6 max-w-5xl rounded-lg border border-slate-200 bg-[#07101d] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-accent">创建策略向导</p>
            <h2 className="mt-1 text-2xl font-semibold">{props.selectedTemplate.name}</h2>
          </div>
          <button className="rounded-md border border-slate-300 px-3 py-2 text-sm" onClick={props.onClose}>关闭</button>
        </header>

        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((step) => <button className={props.step === step ? "rounded-md bg-cyan-300/10 px-3 py-2 text-sm text-accent" : "rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-500"} key={step} onClick={() => props.onStep(step as WizardStep)}>Step {step}</button>)}
        </div>

        <div className="mt-5">
          {props.step === 1 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {props.templates.map((template) => <button className={props.selectedTemplate.key === template.key ? "rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-4 text-left" : "rounded-lg border border-slate-200 p-4 text-left"} key={template.key} onClick={() => props.onChooseTemplate(template)}><span className="font-semibold">{template.name}</span><span className="mt-2 block text-sm text-slate-600">{templateCopy[template.key]?.oneLine ?? template.description}</span></button>)}
            </div>
          ) : null}

          {props.step === 2 ? (
            <div className="grid gap-4">
              <label className="text-sm"><span className="font-medium text-slate-700">策略名称</span><input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={props.configName} onChange={(event) => props.onConfigName(event.target.value)} /></label>
              <div className="grid gap-3 md:grid-cols-3">
                {(["all_watchlists", "instruments", "etf_pool"] as ScopeMode[]).map((mode) => <button className={props.scopeMode === mode ? "rounded-md border border-cyan-300/30 bg-cyan-300/10 p-4 text-left text-accent" : "rounded-md border border-slate-200 p-4 text-left"} key={mode} onClick={() => props.onScopeMode(mode)}>{scopeModeLabel(mode)}</button>)}
              </div>
              {props.scopeMode !== "all_watchlists" ? <label className="text-sm"><span className="font-medium text-slate-700">标的列表，每行 symbol,market,name</span><textarea className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm" value={props.symbolsText} onChange={(event) => props.onSymbolsText(event.target.value)} /></label> : <p className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">将扫描当前用户全部自选池。</p>}
            </div>
          ) : null}

          {props.step === 3 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {orderedKeys.map((key) => <ParamEditor key={key} paramKey={key} schema={props.selectedTemplate.schema_json.properties[key]} value={props.paramText[key] ?? ""} onChange={(value) => props.onParamText({ ...props.paramText, [key]: value })} />)}
            </div>
          ) : null}

          {props.step === 4 ? (
            <div className="grid gap-4">
              <div className="rounded-md border border-slate-200 p-4 text-sm leading-6 text-slate-600">策略将保存为个人配置。保存后可以编辑、启用盯盘，ETF 动量轮动可直接进入回测。</div>
              <div className="grid gap-3 md:grid-cols-3">
                <button className={props.saveMode === "save" ? "rounded-md bg-cyan-300/10 p-4 text-left text-accent" : "rounded-md border border-slate-200 p-4 text-left"} onClick={() => props.onSaveMode("save")}>保存策略</button>
                <button className={props.saveMode === "enable" ? "rounded-md bg-cyan-300/10 p-4 text-left text-accent" : "rounded-md border border-slate-200 p-4 text-left"} onClick={() => props.onSaveMode("enable")}>保存并启用盯盘</button>
                <button className={props.saveMode === "backtest" ? "rounded-md bg-cyan-300/10 p-4 text-left text-accent" : "rounded-md border border-slate-200 p-4 text-left"} disabled={props.selectedTemplate.key !== "etf_momentum_rotation"} onClick={() => props.onSaveMode("backtest")}>先发起回测</button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="mt-6 flex justify-between border-t border-slate-200 pt-4">
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" disabled={props.step === 1} onClick={() => props.onStep(Math.max(1, props.step - 1) as WizardStep)}>上一步</button>
          {props.step < 4 ? <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" onClick={() => props.onStep((props.step + 1) as WizardStep)}>下一步</button> : <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={props.submitting} onClick={props.onCreate}>{props.submitting ? "保存中..." : "完成"}</button>}
        </footer>
      </section>
    </div>
  );
}

function ParamEditor({ paramKey, schema, value, onChange }: { paramKey: string; schema: StrategyParamProperty; value: string; onChange: (value: string) => void }) {
  if (schema.type === "boolean") {
    return <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm"><input checked={value === "true"} className="mt-1" type="checkbox" onChange={(event) => onChange(event.target.checked ? "true" : "false")} /><span><span className="block font-medium text-slate-700">{schema.title ?? paramKey}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{schema.description}</span></span></label>;
  }
  return <label className="text-sm"><span className="font-medium text-slate-700">{schema.title ?? paramKey}</span>{schema.enum ? <select className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>{schema.enum.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" max={schema.maximum} min={schema.minimum} type={schema.type === "string" ? "text" : "number"} value={value} onChange={(event) => onChange(event.target.value)} />}<span className="mt-1 block text-xs leading-5 text-slate-500">{schema.description}</span></label>;
}

function StudioStat({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className="rounded-lg border border-slate-200 bg-panel p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></article>; }
function StudioSkeleton() { return <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <div className="h-44 animate-pulse rounded-lg border border-slate-200 bg-slate-800/40" key={index} />)}</div>; }
function InfoBlock({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 leading-6">{value}</p></div>; }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="flex gap-3"><span className="w-20 shrink-0 text-slate-500">{label}</span><span className="min-w-0 flex-1">{value}</span></div>; }
function categoryLabel(category: string) { return ({ trend: "趋势", breakout: "突破", rotation: "轮动", risk: "风险" } as Record<string, string>)[category] ?? category; }
function scopeModeLabel(mode: ScopeMode) { return ({ all_watchlists: "全部自选池", instruments: "指定标的", etf_pool: "ETF 池" } as Record<ScopeMode, string>)[mode]; }
function paramsToText(params: Record<string, unknown>) { return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])); }
function parseParams(template: StrategyTemplate, values: Record<string, string>) { return Object.fromEntries(Object.entries(template.schema_json.properties).map(([key, schema]) => [key, parseValue(values[key], schema.type)])); }
function parseValue(value: string, type: string) { if (type === "boolean") return value === "true"; if (type === "integer") return Number.parseInt(value || "0", 10); if (type === "number") return Number(value || 0); return value ?? ""; }
function scopeListToText(items: Array<{ symbol: string; market: string; name?: string | null }>) { return items.map((item) => `${item.symbol},${item.market},${item.name ?? item.symbol}`).join("\n"); }
function buildWatchScope(mode: ScopeMode, text: string): WatchScope { if (mode === "all_watchlists") return { type: "all_watchlists" }; const instruments = text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [symbol, market = "CN", name = symbol] = line.split(",").map((item) => item.trim()); return { symbol, market, name, asset_type: mode === "etf_pool" ? "etf" : undefined }; }); return mode === "etf_pool" ? { type: "etf_pool", etf_pool: instruments } : { type: "instruments", instruments }; }
function scopeSymbols(scope: WatchScope) { return (scope.etf_pool ?? scope.instruments ?? []).map((item) => item.symbol); }
function scopeSummary(scope: WatchScope) { if (scope.type === "all_watchlists") return "全部自选池"; if (scope.type === "etf_pool") return `ETF 池 ${(scope.etf_pool ?? []).map((item) => item.symbol).join(",")}`; if (scope.type === "instruments") return `指定标的 ${(scope.instruments ?? []).map((item) => item.symbol).join(",")}`; return "指定自选分组"; }
function paramSummary(params: Record<string, unknown>) { return Object.entries(params).slice(0, 3).map(([key, value]) => `${key}=${String(value)}`).join(" / ") || "默认参数"; }
function backtestHref(config: StrategyConfig) { const symbols = scopeSymbols(config.watch_scope_json); return `/backtests?config_id=${config.id}${symbols.length ? `&symbols=${symbols.join(",")}` : ""}`; }
function formatShortTime(value: string) { return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
