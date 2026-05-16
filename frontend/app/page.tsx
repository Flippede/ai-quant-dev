const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const phaseItems = [
  "Docker Compose: frontend / backend / postgres / redis",
  "FastAPI health check",
  "SQLAlchemy 2.x + Alembic baseline",
  "MockProvider-only market data boundary",
  "Asia/Shanghai market-time constraint",
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="border-b border-slate-200 pb-5">
          <p className="text-sm font-medium text-accent">Phase 1</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
            AI 量化盯盘平台
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            当前是项目基础骨架：服务、配置、数据库迁移框架和最小可运行页面已就位。
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <h2 className="text-lg font-semibold">已纳入的基础约束</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {phaseItems.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-panel p-5">
            <h2 className="text-lg font-semibold">后端检查</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              启动后访问 FastAPI health 接口确认 API 服务与市场时区配置。
            </p>
            <a
              className="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"
              href={`${apiBaseUrl}/health`}
            >
              打开 /health
            </a>
          </section>
        </div>
      </section>
    </main>
  );
}

