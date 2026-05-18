import Link from "next/link";

const features = [
  {
    title: "策略中心",
    eyebrow: "Strategy",
    text: "用内置策略模板快速搭建趋势、突破、ETF 轮动与风险预警逻辑，参数清晰可控。",
  },
  {
    title: "真实历史回测",
    eyebrow: "Backtest",
    text: "支持 Mock 与 AKShare 真实历史日线，清楚展示数据源、复权、假设与数据质量。",
  },
  {
    title: "实时策略信号",
    eyebrow: "Signals",
    text: "交易时段自动刷新行情与扫描已启用策略，信号持久化并按用户隔离。",
  },
  {
    title: "看盘工作台",
    eyebrow: "Workbench",
    text: "K 线、指标与策略信号联动的轻量工作台将在后续阶段开放。",
  },
];

const workflow = ["选标的", "配策略", "跑回测", "启用盯盘"];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.055)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(ellipse_at_top,rgba(32,214,199,0.16),rgba(37,99,235,0.08)_42%,transparent_72%)]" />
        <div className="absolute inset-x-0 top-[34rem] h-[420px] bg-[linear-gradient(90deg,transparent,rgba(99,102,241,0.12),transparent)] blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#050812]/82 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-8">
          <Link className="flex items-center gap-3" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-sm font-semibold text-accent shadow-[0_0_30px_rgba(32,214,199,0.18)]">
              QB
            </span>
            <span className="text-base font-semibold tracking-wide">QuantBeacon</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-slate-600 lg:flex">
            <a href="#product">产品</a>
            <a href="#features">功能</a>
            <a href="#strategy">策略</a>
            <a href="#backtest">回测</a>
            <a href="#workbench">看盘工作台</a>
            <a href="#about">关于</a>
          </div>
          <Link className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white" href="/login">
            进入平台
          </Link>
        </nav>
      </header>

      <section id="product" className="relative z-10 mx-auto grid min-h-[calc(100vh-74px)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-20">
        <div>
          <p className="w-fit rounded-md border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-sm font-medium text-accent">
            AI Quant Trading Workbench
          </p>
          <h1 className="mt-7 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-normal text-foreground sm:text-6xl lg:text-7xl">
            让量化交易变得清晰、简单、可执行
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            自选池、策略中心、真实回测、实时信号与 AI 解释，一站式完成从想法到盯盘的量化工作流。
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link className="rounded-md bg-accent px-5 py-3 text-center text-sm font-semibold text-white" href="/login">
              进入平台
            </Link>
            <a className="rounded-md border border-slate-300 px-5 py-3 text-center text-sm font-semibold" href="#features">
              查看功能
            </a>
          </div>
          <div className="mt-10 grid max-w-xl grid-cols-3 gap-3 text-sm">
            <Metric value="4" label="内置策略模板" />
            <Metric value="AKShare" label="真实行情接入" />
            <Metric value="AI" label="策略解释辅助" />
          </div>
        </div>

        <HeroMockup />
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Core Modules</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">从策略设计到实时预警，保持同一套逻辑闭环</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article className="rounded-lg border border-slate-200 bg-panel p-5" id={feature.title === "看盘工作台" ? "workbench" : undefined} key={feature.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{feature.eyebrow}</p>
              <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="strategy" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-8">
        <div className="rounded-lg border border-slate-200 bg-panel p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Workflow</p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">把复杂流程压缩成四步</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                QuantBeacon 不试图替你预测未来，而是把标的、策略、数据、回测和信号组织成可以验证、可以复盘、可以执行的流程。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {workflow.map((item, index) => (
                <div className="rounded-md border border-slate-200 bg-[#0b1322]/70 p-4" key={item}>
                  <p className="text-xs text-slate-500">0{index + 1}</p>
                  <p className="mt-8 font-semibold">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="backtest" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <ProductScreen />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Product Preview</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">不是菜单堆叠，而是交易工作流入口</h2>
            <p className="mt-5 text-base leading-8 text-slate-600">
              首页聚焦今天市场如何、策略是否触发信号、下一步该进入哪里；内部页面保持统一深色卡片、表单和表格体系。
            </p>
          </div>
        </div>
      </section>

      <section id="about" className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-8">
        <div className="rounded-lg border border-cyan-300/20 bg-[#0b1322]/78 p-8 text-center shadow-[0_24px_90px_rgba(20,184,166,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent">Start Now</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-5xl">开始使用 QuantBeacon</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600">
            用更清晰的系统管理自选、策略、回测和信号，把量化交易从零散操作变成稳定工作台。
          </p>
          <Link className="mt-8 inline-flex rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white" href="/login">
            进入工作台
          </Link>
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-[#0b1322]/70 p-3">
      <p className="text-lg font-semibold text-accent">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative min-h-[520px]">
      <div className="absolute inset-x-6 top-10 rounded-lg border border-cyan-300/20 bg-[#0d1628]/92 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-accent">Live Signals</p>
            <h3 className="mt-1 text-lg font-semibold">今日机会</h3>
          </div>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">3 new</span>
        </div>
        <div className="mt-4 space-y-3">
          <SignalLine symbol="510300" title="ETF 动量排名提升" pct="+1.82%" />
          <SignalLine symbol="159915" title="趋势跟随信号增强" pct="+2.14%" />
          <SignalLine symbol="512100" title="风险波动升高" pct="-0.76%" down />
        </div>
      </div>

      <div className="absolute bottom-10 left-0 w-[78%] rounded-lg border border-slate-200 bg-[#101827]/95 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.36)]">
        <div className="flex items-center justify-between">
          <p className="font-semibold">真实历史回测</p>
          <span className="text-xs text-blue-700">AKShare</span>
        </div>
        <div className="mt-5 h-36 rounded-md border border-slate-200 bg-[#080d18] p-4">
          <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 420 140">
            <path d="M0 104 C45 96 66 112 104 88 C142 64 166 72 202 58 C246 40 274 62 312 36 C348 12 378 22 420 8" fill="none" stroke="#20d6c7" strokeLinecap="round" strokeWidth="3" />
            <path d="M0 104 C45 96 66 112 104 88 C142 64 166 72 202 58 C246 40 274 62 312 36 C348 12 378 22 420 8 L420 140 L0 140Z" fill="rgba(32,214,199,0.12)" />
          </svg>
        </div>
      </div>

      <div className="absolute bottom-0 right-2 w-[48%] rounded-lg border border-indigo-300/20 bg-[#0b1322]/95 p-4 shadow-[0_20px_70px_rgba(37,99,235,0.18)]">
        <p className="text-xs uppercase tracking-[0.18em] text-blue-700">Scheduler</p>
        <p className="mt-2 text-2xl font-semibold text-emerald-700">Running</p>
        <p className="mt-2 text-xs text-slate-500">AKShare provider / Asia Shanghai</p>
      </div>
    </div>
  );
}

function SignalLine({ symbol, title, pct, down = false }: { symbol: string; title: string; pct: string; down?: boolean }) {
  return (
    <div className="grid grid-cols-[80px_1fr_auto] items-center gap-3 rounded-md border border-slate-200 bg-[#0b1322]/72 p-3 text-sm">
      <span className="font-semibold">{symbol}</span>
      <span className="text-slate-600">{title}</span>
      <span className={down ? "text-emerald-700" : "text-red-600"}>{pct}</span>
    </div>
  );
}

function ProductScreen() {
  return (
    <div className="rounded-lg border border-slate-200 bg-[#0b1322]/88 p-4 shadow-[0_28px_100px_rgba(0,0,0,0.38)]">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" />
        <span className="ml-3 text-xs text-slate-500">quantbeacon.cc/dashboard</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {["市场", "自选", "信号", "策略", "调度"].map((item, index) => (
          <div className="rounded-md border border-slate-200 bg-panel p-3" key={item}>
            <p className="text-xs text-slate-500">{item}</p>
            <p className="mt-5 text-lg font-semibold text-accent">{index === 2 ? "6" : index === 4 ? "盘中" : "OK"}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-md border border-slate-200 bg-panel p-4">
          <p className="font-semibold">今日机会 / 最新策略信号</p>
          <div className="mt-4 space-y-2">
            <SignalLine symbol="510300" title="ETF 动量轮动建议关注" pct="+1.82%" />
            <SignalLine symbol="159915" title="放量突破观察" pct="+2.14%" />
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-panel p-4">
          <p className="font-semibold">快速操作</p>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>添加自选</p>
            <p>创建策略</p>
            <p>发起回测</p>
            <p>AI 策略助手</p>
          </div>
        </div>
      </div>
    </div>
  );
}
