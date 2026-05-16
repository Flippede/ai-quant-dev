"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CurrentUser, getCurrentUser, logout } from "@/lib/api/client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-slate-600">Loading...</main>;
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
              AI 量化盯盘平台
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              当前已进入受保护后台。Phase 2 只提供认证与用户管理底座。
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user.role === "admin" ? (
              <button
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
                onClick={() => router.push("/admin/users")}
              >
                用户管理
              </button>
            ) : null}
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="text-lg font-semibold">当前用户</h2>
          <dl className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Username</dt>
              <dd className="mt-1 font-medium text-foreground">{user.username}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd className="mt-1 font-medium text-foreground">{user.role}</dd>
            </div>
          </dl>
        </section>
      </section>
    </main>
  );
}

