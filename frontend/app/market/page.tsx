"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DailyBar,
  Instrument,
  Quote,
  StrategySignal,
  WatchlistGroup,
  addWatchlistSymbol,
  getCurrentUser,
  getMarketBars,
  getMarketQuotes,
  getSignals,
  getWatchlistGroups,
  searchInstruments,
} from "@/lib/api/client";
import { AppHeader } from "@/components/app-header";
import { ColorType, IChartApi, Time, createChart } from "lightweight-charts";

type SelectedInstrument = {
  symbol: string;
  market: string;
  name: string;
  asset_type?: string;
};

type RangePreset = "3d" | "1w" | "1m" | "3m" | "6m" | "1y" | "all";

const rangePresets: Array<{ key: RangePreset; label: string }> = [
  { key: "3d", label: "近3日" },
  { key: "1w", label: "近1周" },
  { key: "1m", label: "近1月" },
  { key: "3m", label: "近3月" },
  { key: "6m", label: "近6月" },
  { key: "1y", label: "近1年" },
  { key: "all", label: "全部" },
];

const fallbackInstrument: SelectedInstrument = {
  symbol: "510300",
  market: "CN",
  name: "沪深300ETF",
  asset_type: "etf",
};

export default function MarketWorkspacePage() {
  const router = useRouter();
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [selected, setSelected] = useState<SelectedInstrument>(fallbackInstrument);
  const [adjustMode, setAdjustMode] = useState<"none" | "qfq" | "hfq">("qfq");
  const [rangePreset, setRangePreset] = useState<RangePreset>("1y");
  const [bars, setBars] = useState<DailyBar[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [signals, setSignals] = useState<StrategySignal[]>([]);
  const [keyword, setKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const watchItems = useMemo(() => groups.flatMap((group) => group.items.map((item) => ({ ...item, groupName: group.name }))), [groups]);
  const firstGroupId = groups[0]?.id ?? "";

  useEffect(() => {
    getCurrentUser()
      .then(async () => {
        const data = await getWatchlistGroups();
        setGroups(data);
        const first = data.flatMap((group) => group.items)[0];
        if (first) {
          setSelected({
            symbol: first.symbol,
            market: first.market,
            name: first.name_snapshot ?? first.symbol,
            asset_type: first.asset_type,
          });
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const loadMarketData = useCallback(async (instrument: SelectedInstrument, adjust: typeof adjustMode, range: RangePreset) => {
    setChartLoading(true);
    setError("");
    setMessage("");
    try {
      const dateRange = dateRangeForPreset(range);
      const [barData, quoteData, signalData] = await Promise.all([
        getMarketBars({
          symbol: instrument.symbol,
          market: instrument.market,
          adjust,
          start_date: dateRange.startDate,
          end_date: dateRange.endDate,
        }),
        getMarketQuotes([instrument.symbol]),
        getSignals({ symbol: instrument.symbol, limit: 8 }),
      ]);
      setBars(barData.bars);
      setQuote(quoteData[0] ?? null);
      setSignals(signalData);
    } catch (err) {
      setBars([]);
      setQuote(null);
      setSignals([]);
      setError(err instanceof Error ? err.message : "行情数据加载失败");
    } finally {
      setChartLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected.symbol) {
      return;
    }
    // The chart is synchronized with the selected instrument and adjustment mode.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMarketData(selected, adjustMode, rangePreset);
  }, [selected, adjustMode, rangePreset, loadMarketData]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      setSearchResults(await searchInstruments(keyword));
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    }
  }

  async function handleAddToWatchlist() {
    if (!firstGroupId) {
      setError("请先在自选页创建至少一个分组");
      return;
    }
    setError("");
    try {
      await addWatchlistSymbol(firstGroupId, selected.symbol, selected.market);
      setGroups(await getWatchlistGroups());
      setMessage(`${selected.symbol} 已加入 ${groups[0]?.name ?? "自选分组"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加入自选失败");
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading...</main>;
  }

  return (
    <main className="min-h-screen">
      <AppHeader />
      <section className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-accent">Market Workspace</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">看盘工作台</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">从行情图表进入信号、回测和策略配置，让日常看盘形成闭环。</p>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap gap-2 text-sm">
              {(["1d", "60min", "30min", "15min"] as const).map((period) => (
                <button
                  className={period === "1d" ? "rounded-md bg-accent px-3 py-2 font-medium text-white" : "rounded-md border border-slate-300 px-3 py-2 text-slate-500 opacity-60"}
                  disabled={period !== "1d"}
                  key={period}
                  type="button"
                >
                  {period === "1d" ? "日线" : `${period} 即将支持`}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">当前仅展示日线；盘中分时和分钟K线将在后续接入。</p>
          </div>
        </header>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="rounded-lg border border-slate-200 bg-panel p-4">
            <h2 className="font-semibold">标的与自选</h2>
            <form className="mt-4 flex gap-2" onSubmit={handleSearch}>
              <input className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="代码 / 名称" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
              <button className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white" type="submit">
                搜索
              </button>
            </form>
            {searchResults.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-500">搜索结果</p>
                {searchResults.slice(0, 6).map((instrument) => (
                  <InstrumentButton
                    active={instrument.symbol === selected.symbol}
                    key={`${instrument.market}-${instrument.symbol}`}
                    name={instrument.name}
                    symbol={instrument.symbol}
                    meta={`${instrument.asset_type} / ${instrument.exchange ?? instrument.market}`}
                    onClick={() => setSelected(instrumentToSelected(instrument))}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <div key={group.id}>
                    <p className="mb-2 text-xs font-medium text-slate-500">{group.name}</p>
                    <div className="space-y-2">
                      {watchItems.filter((item) => item.group_id === group.id).map((item) => (
                        <InstrumentButton
                          active={item.symbol === selected.symbol}
                          key={item.id}
                          name={item.name_snapshot ?? item.symbol}
                          symbol={item.symbol}
                          meta={`${item.asset_type} / ${item.quote ? formatSignedPct(item.quote.pct_change) : "-"}`}
                          onClick={() => setSelected({ symbol: item.symbol, market: item.market, name: item.name_snapshot ?? item.symbol, asset_type: item.asset_type })}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm leading-6 text-slate-600">暂无自选分组，当前默认显示 510300。</div>
              )}
            </div>
          </aside>

          <section className="min-w-0 rounded-lg border border-slate-200 bg-panel p-4">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm text-slate-500">{selected.market} / {selected.asset_type ?? "instrument"}</p>
                <h2 className="mt-1 text-2xl font-semibold">{quote?.name ?? selected.name} <span className="text-slate-500">{selected.symbol}</span></h2>
              </div>
              <div className="flex flex-col gap-2 lg:items-end">
                <div className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-slate-200 bg-[#0b1322]/70 p-1 text-sm">
                  {rangePresets.map((preset) => (
                    <button
                      className={rangePreset === preset.key ? "whitespace-nowrap rounded-md bg-cyan-300/10 px-3 py-2 text-accent" : "whitespace-nowrap rounded-md px-3 py-2 text-slate-600"}
                      key={preset.key}
                      onClick={() => setRangePreset(preset.key)}
                      type="button"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex rounded-md border border-slate-200 bg-[#0b1322]/70 p-1 text-sm">
                  {(["none", "qfq", "hfq"] as const).map((mode) => (
                    <button className={adjustMode === mode ? "rounded-md bg-cyan-300/10 px-3 py-2 text-accent" : "rounded-md px-3 py-2 text-slate-600"} key={mode} onClick={() => setAdjustMode(mode)} type="button">
                      {mode === "none" ? "不复权" : mode === "qfq" ? "前复权" : "后复权"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="relative mt-4 h-[560px] overflow-hidden rounded-md border border-slate-200 bg-[#080d18]">
              {chartLoading ? <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#080d18]/72 text-sm text-slate-600">加载历史行情...</div> : null}
              {bars.length > 0 ? <MarketChart bars={bars} /> : <div className="flex h-full items-center justify-center text-sm text-slate-600">暂无可展示的历史 K 线数据</div>}
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-panel p-4">
            <h2 className="font-semibold">量化联动</h2>
            <QuotePanel quote={quote} fallback={selected} />
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">最近策略信号</h3>
                <button className="text-sm text-accent" onClick={() => router.push(`/signals?symbol=${selected.symbol}`)}>
                  查看
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {signals.length > 0 ? (
                  signals.slice(0, 5).map((signal) => (
                    <button className="w-full rounded-md border border-slate-200 p-3 text-left text-sm hover:bg-slate-50" key={signal.id} onClick={() => router.push(`/signals?symbol=${selected.symbol}`)}>
                      <span className="block font-medium">{signal.title}</span>
                      <span className="mt-1 block text-xs text-slate-500">{signal.severity} / {new Date(signal.triggered_at).toLocaleString()}</span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-600">当前标的暂无近期信号。</p>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              <button className="rounded-md border border-slate-300 px-4 py-2 text-left text-sm" onClick={handleAddToWatchlist}>
                加入自选
              </button>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-left text-sm" onClick={() => router.push(`/signals?symbol=${selected.symbol}`)}>
                查看该标的信号
              </button>
              <button className="rounded-md border border-slate-300 px-4 py-2 text-left text-sm" onClick={() => router.push(`/backtests?symbols=${selected.symbol}`)}>
                发起回测
              </button>
              <button className="rounded-md bg-accent px-4 py-2 text-left text-sm font-medium text-white" onClick={() => router.push("/strategies")}>
                创建相关策略
              </button>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function MarketChart({ bars }: { bars: DailyBar[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#080d18" },
        textColor: "#91a0b8",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
      },
      crosshair: {
        vertLine: { color: "rgba(32, 214, 199, 0.45)" },
        horzLine: { color: "rgba(32, 214, 199, 0.45)" },
      },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#fb7185",
      downColor: "#34d399",
      borderUpColor: "#fb7185",
      borderDownColor: "#34d399",
      wickUpColor: "#fb7185",
      wickDownColor: "#34d399",
    });
    candleSeries.setData(bars.map((bar) => ({ time: bar.trade_date as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close })));

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volumeSeries.setData(
      bars.map((bar) => ({
        time: bar.trade_date as Time,
        value: bar.volume,
        color: bar.close >= bar.open ? "rgba(251,113,133,0.35)" : "rgba(52,211,153,0.35)",
      })),
    );

    addMaLine(chart, bars, 5, "#fbbf24");
    addMaLine(chart, bars, 10, "#60a5fa");
    addMaLine(chart, bars, 20, "#20d6c7");
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars]);

  return <div className="h-full w-full" ref={containerRef} />;
}

function addMaLine(chart: IChartApi, bars: DailyBar[], period: number, color: string) {
  const series = chart.addLineSeries({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
  const data = bars
    .map((bar, index) => {
      if (index + 1 < period) {
        return null;
      }
      const slice = bars.slice(index + 1 - period, index + 1);
      const value = slice.reduce((sum, item) => sum + item.close, 0) / period;
      return { time: bar.trade_date as Time, value };
    })
    .filter((item): item is { time: Time; value: number } => item !== null);
  series.setData(data);
}

function InstrumentButton({ active, name, symbol, meta, onClick }: { active: boolean; name: string; symbol: string; meta: string; onClick: () => void }) {
  return (
    <button className={active ? "w-full rounded-md border border-cyan-300/25 bg-cyan-300/10 p-3 text-left" : "w-full rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50"} onClick={onClick}>
      <span className="block font-medium">{name}</span>
      <span className="mt-1 block text-xs text-slate-500">{symbol} / {meta}</span>
    </button>
  );
}

function QuotePanel({ quote, fallback }: { quote: Quote | null; fallback: SelectedInstrument }) {
  return (
    <div className="mt-4 rounded-md border border-slate-200 bg-[#0b1322]/70 p-4">
      <p className="text-sm text-slate-500">{quote?.name ?? fallback.name}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold">{quote ? quote.last_price.toFixed(3) : "-"}</p>
        <p className={quote && quote.pct_change < 0 ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-red-600"}>
          {quote ? formatSignedPct(quote.pct_change) : "-"}
        </p>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <InfoRow label="成交量" value={quote ? formatNumber(quote.volume) : "-"} />
        <InfoRow label="成交额" value={quote ? formatNumber(quote.amount) : "-"} />
        <InfoRow label="更新时间" value={quote ? new Date(quote.updated_at).toLocaleString() : "-"} />
        {quote?.is_stale ? <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">数据可能延迟</p> : null}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function instrumentToSelected(instrument: Instrument): SelectedInstrument {
  return {
    symbol: instrument.symbol,
    market: instrument.market,
    name: instrument.name,
    asset_type: instrument.asset_type,
  };
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function dateRangeForPreset(preset: RangePreset) {
  return {
    startDate: startDateForPreset(preset),
    endDate: todayString(),
  };
}

function startDateForPreset(preset: RangePreset) {
  if (preset === "all") {
    return "2005-01-01";
  }
  if (preset === "3d") {
    return dateDaysAgo(7);
  }
  if (preset === "1w") {
    return dateDaysAgo(14);
  }
  if (preset === "1m") {
    return dateMonthsAgo(1);
  }
  if (preset === "3m") {
    return dateMonthsAgo(3);
  }
  if (preset === "6m") {
    return dateMonthsAgo(6);
  }
  return dateMonthsAgo(12);
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function dateMonthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().slice(0, 10);
}

function formatSignedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatNumber(value: number) {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(2)}万`;
  }
  return value.toFixed(0);
}
