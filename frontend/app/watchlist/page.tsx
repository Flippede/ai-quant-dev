"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Instrument,
  WatchlistGroup,
  addWatchlistItem,
  createWatchlistGroup,
  deleteWatchlistGroup,
  deleteWatchlistItem,
  getCurrentUser,
  getWatchlistGroups,
  searchInstruments,
  updateWatchlistGroup,
  updateWatchlistItem,
} from "@/lib/api/client";

export default function WatchlistPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [results, setResults] = useState<Instrument[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0],
    [groups, selectedGroupId],
  );

  async function loadGroups() {
    const data = await getWatchlistGroups();
    setGroups(data);
    if (!selectedGroupId && data[0]) {
      setSelectedGroupId(data[0].id);
    }
  }

  useEffect(() => {
    getCurrentUser()
      .then(loadGroups)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const group = await createWatchlistGroup(newGroupName);
      setNewGroupName("");
      setSelectedGroupId(group.id);
      await loadGroups();
      setMessage("分组已创建");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建分组失败");
    }
  }

  async function handleRenameGroup(group: WatchlistGroup) {
    const name = window.prompt("分组名称", group.name);
    if (!name || name === group.name) {
      return;
    }
    setError("");
    try {
      await updateWatchlistGroup(group.id, { name });
      await loadGroups();
      setMessage("分组已更新");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新分组失败");
    }
  }

  async function handleDeleteGroup(group: WatchlistGroup) {
    if (!window.confirm(`删除分组「${group.name}」及其中所有标的？`)) {
      return;
    }
    setError("");
    try {
      await deleteWatchlistGroup(group.id);
      setSelectedGroupId("");
      await loadGroups();
      setMessage("分组已删除");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除分组失败");
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      setResults(await searchInstruments(searchKeyword));
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
    }
  }

  async function handleAdd(instrument: Instrument) {
    if (!selectedGroup) {
      setError("请先创建分组");
      return;
    }
    setError("");
    try {
      await addWatchlistItem(selectedGroup.id, instrument);
      await loadGroups();
      setMessage(`${instrument.name} 已添加`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  }

  async function handleDeleteItem(itemId: string) {
    setError("");
    try {
      await deleteWatchlistItem(itemId);
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function handleNote(itemId: string, currentNote: string | null) {
    const note = window.prompt("备注", currentNote ?? "");
    if (note === null) {
      return;
    }
    try {
      await updateWatchlistItem(itemId, { note });
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "备注更新失败");
    }
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Watchlist</p>
            <h1 className="mt-2 text-3xl font-semibold">自选池</h1>
          </div>
          <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/dashboard")}>
            返回首页
          </button>
        </header>

        <form className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-panel p-4 sm:flex-row" onSubmit={handleCreateGroup}>
          <input
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="新分组名称"
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
          />
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
            新建分组
          </button>
        </form>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-lg border border-slate-200 bg-panel p-4">
            <h2 className="text-sm font-semibold text-slate-600">分组</h2>
            <div className="mt-3 space-y-2">
              {groups.map((group) => (
                <div className="flex items-center gap-2" key={group.id}>
                  <button
                    className={`min-w-0 flex-1 rounded-md px-3 py-2 text-left text-sm ${
                      selectedGroup?.id === group.id ? "bg-slate-900 text-white" : "border border-slate-200"
                    }`}
                    onClick={() => setSelectedGroupId(group.id)}
                  >
                    {group.name} ({group.items.length})
                  </button>
                  <button className="rounded-md border border-slate-300 px-2 py-2 text-xs" onClick={() => handleRenameGroup(group)}>
                    改
                  </button>
                  <button className="rounded-md border border-slate-300 px-2 py-2 text-xs" onClick={() => handleDeleteGroup(group)}>
                    删
                  </button>
                </div>
              ))}
              {groups.length === 0 ? <p className="text-sm text-slate-500">暂无分组</p> : null}
            </div>
          </aside>

          <section className="space-y-5">
            <form className="rounded-lg border border-slate-200 bg-panel p-4" onSubmit={handleSearch}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="搜索股票 / ETF / 指数，例如 300、ETF、贵州"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                />
                <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
                  搜索
                </button>
              </div>
              {results.length > 0 ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {results.map((instrument) => (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3" key={`${instrument.market}-${instrument.symbol}`}>
                      <div className="min-w-0">
                        <p className="font-medium">{instrument.name}</p>
                        <p className="text-xs text-slate-500">
                          {instrument.symbol} / {instrument.asset_type}
                        </p>
                      </div>
                      <button className="rounded-md border border-slate-300 px-3 py-1 text-sm" onClick={() => handleAdd(instrument)} type="button">
                        添加
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </form>

            <section className="rounded-lg border border-slate-200 bg-panel">
              <div className="border-b border-slate-200 p-4">
                <h2 className="font-semibold">{selectedGroup?.name ?? "请选择分组"}</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {selectedGroup?.items.map((item) => (
                  <div className="grid gap-3 p-4 md:grid-cols-[1.2fr_0.8fr_auto]" key={item.id}>
                    <div>
                      <p className="font-medium">{item.name_snapshot ?? item.symbol}</p>
                      <p className="text-xs text-slate-500">
                        {item.symbol} / {item.asset_type}
                      </p>
                      {item.note ? <p className="mt-2 text-sm text-slate-600">{item.note}</p> : null}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{item.quote ? item.quote.last_price.toFixed(3) : "-"}</p>
                      <p className={item.quote && item.quote.pct_change >= 0 ? "text-red-600" : "text-emerald-700"}>
                        {item.quote ? `${item.quote.pct_change >= 0 ? "+" : ""}${item.quote.pct_change.toFixed(2)}%` : "-"}
                      </p>
                      {item.quote?.is_stale ? <p className="mt-1 text-xs text-amber-700">数据可能延迟</p> : null}
                      {item.quote ? <p className="mt-1 text-xs text-slate-500">{new Date(item.quote.updated_at).toLocaleString()}</p> : null}
                    </div>
                    <div className="flex gap-2 md:justify-end">
                      <button className="rounded-md border border-slate-300 px-3 py-1 text-sm" onClick={() => handleNote(item.id, item.note)}>
                        备注
                      </button>
                      <button className="rounded-md border border-slate-300 px-3 py-1 text-sm" onClick={() => handleDeleteItem(item.id)}>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                {selectedGroup && selectedGroup.items.length === 0 ? <p className="p-5 text-sm text-slate-500">当前分组暂无标的</p> : null}
              </div>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}
