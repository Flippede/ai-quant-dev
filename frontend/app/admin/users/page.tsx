"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminUser, apiRequest, getCurrentUser, logout } from "@/lib/api/client";

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});

  async function loadUsers() {
    const data = await apiRequest<AdminUser[]>("/api/admin/users");
    setUsers(data);
  }

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (user.role !== "admin") {
          router.replace("/");
          return;
        }
        return loadUsers();
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ username, password, role }),
      });
      setUsername("");
      setPassword("");
      setRole("user");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  async function postUserAction(userId: string, action: "enable" | "disable") {
    setError("");
    try {
      await apiRequest(`/api/admin/users/${userId}/${action}`, { method: "POST" });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  async function resetPassword(userId: string) {
    const nextPassword = resetPasswords[userId] ?? "";
    setError("");
    try {
      await apiRequest(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: nextPassword }),
      });
      setResetPasswords((current) => ({ ...current, [userId]: "" }));
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败");
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-accent">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold">用户管理</h1>
          </div>
          <div className="flex gap-3">
            <button className="rounded-md border border-slate-300 px-4 py-2 text-sm" onClick={() => router.push("/")}>
              返回后台
            </button>
            <button className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" onClick={handleLogout}>
              退出
            </button>
          </div>
        </header>

        <form className="grid gap-3 rounded-lg border border-slate-200 bg-panel p-5 md:grid-cols-[1fr_1fr_140px_auto]" onSubmit={handleCreate}>
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="initial password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={role}
            onChange={(event) => setRole(event.target.value as "user" | "admin")}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white" type="submit">
            创建用户
          </button>
        </form>

        {error ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <section className="overflow-x-auto rounded-lg border border-slate-200 bg-panel">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr className="border-b border-slate-100" key={user.id}>
                  <td className="px-4 py-3 font-medium">{user.username}</td>
                  <td className="px-4 py-3">{user.role}</td>
                  <td className="px-4 py-3">{user.is_active ? "enabled" : "disabled"}</td>
                  <td className="px-4 py-3">{user.last_login_at ?? "-"}</td>
                  <td className="flex flex-wrap gap-2 px-4 py-3">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-1"
                      onClick={() => postUserAction(user.id, user.is_active ? "disable" : "enable")}
                      type="button"
                    >
                      {user.is_active ? "禁用" : "启用"}
                    </button>
                    <input
                      className="w-40 rounded-md border border-slate-300 px-2 py-1"
                      placeholder="new password"
                      type="password"
                      value={resetPasswords[user.id] ?? ""}
                      onChange={(event) => setResetPasswords((current) => ({ ...current, [user.id]: event.target.value }))}
                    />
                    <button className="rounded-md border border-slate-300 px-3 py-1" onClick={() => resetPassword(user.id)} type="button">
                      重置密码
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}

