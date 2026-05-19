"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CurrentUser, getCurrentUser, logout } from "@/lib/api/client";

const navItems = [
  { label: "工作台", href: "/dashboard" },
  { label: "看盘", href: "/market" },
  { label: "自选", href: "/watchlist" },
  { label: "策略", href: "/strategies" },
  { label: "回测", href: "/backtests" },
  { label: "信号", href: "/signals" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!accountRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen]);

  async function handleLogout() {
    setAccountOpen(false);
    setMenuOpen(false);
    await logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-[#050812]/86 backdrop-blur-xl">
      <nav className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link className="flex shrink-0 items-center gap-3" href="/dashboard" prefetch>
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-cyan-300/25 bg-cyan-300/10 text-sm font-semibold text-accent shadow-[0_0_28px_rgba(32,214,199,0.18)]">
            QB
          </span>
          <span className="text-base font-semibold tracking-wide text-foreground">QuantBeacon</span>
        </Link>

        <div className="hidden items-center gap-1 rounded-md border border-slate-200 bg-[#0b1322]/72 p-1 lg:flex">
          {navItems.map((item) => (
            <Link className={navClass(pathname, item.href)} href={item.href} key={item.href} prefetch>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link className={secondaryClass(pathname === "/ai/strategy-advisor")} href="/ai/strategy-advisor" prefetch>
            AI助手
          </Link>
          {user?.role === "admin" ? (
            <Link className={secondaryClass(pathname === "/admin/users")} href="/admin/users" prefetch>
              用户管理
            </Link>
          ) : null}
          <div className="relative" ref={accountRef}>
            <button
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              className={[
                "flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition",
                accountOpen ? "border-cyan-300/25 bg-cyan-300/10 text-accent" : "border-slate-300 text-slate-600 hover:bg-slate-50",
              ].join(" ")}
              onClick={() => setAccountOpen((current) => !current)}
              type="button"
            >
              <span>{user?.username ?? "Account"}</span>
              <span className={accountOpen ? "text-xs transition-transform rotate-180" : "text-xs transition-transform"}>⌄</span>
            </button>
            {accountOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-md border border-slate-200 bg-[#0b1322] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.35)]" role="menu">
                <Link className="block rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-50" href="/change-password" onClick={() => setAccountOpen(false)} prefetch role="menuitem">
                  修改密码
                </Link>
                <button className="block w-full rounded-md px-3 py-2 text-left text-sm text-red-300 hover:bg-red-300/10" onClick={handleLogout} role="menuitem" type="button">
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <button className="rounded-md border border-slate-300 px-3 py-2 text-sm lg:hidden" onClick={() => setMenuOpen((current) => !current)}>
          菜单
        </button>
      </nav>

      {menuOpen ? (
        <div className="border-t border-slate-200 bg-[#050812]/96 px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:px-8 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
            {navItems.map((item) => (
              <Link className={mobileNavClass(pathname, item.href)} href={item.href} key={item.href} onClick={() => setMenuOpen(false)} prefetch>
                {item.label}
              </Link>
            ))}
            <Link className={mobileNavClass(pathname, "/ai/strategy-advisor")} href="/ai/strategy-advisor" onClick={() => setMenuOpen(false)} prefetch>
              AI助手
            </Link>
            {user?.role === "admin" ? (
              <Link className={mobileNavClass(pathname, "/admin/users")} href="/admin/users" onClick={() => setMenuOpen(false)} prefetch>
                用户管理
              </Link>
            ) : null}
            <Link className={mobileNavClass(pathname, "/change-password")} href="/change-password" onClick={() => setMenuOpen(false)} prefetch>
              修改密码
            </Link>
            <button className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-sm font-medium text-red-700" onClick={handleLogout}>
              退出登录
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function navClass(pathname: string, href: string) {
  const active = isActive(pathname, href);
  return [
    "rounded-md px-4 py-2 text-sm font-medium",
    active ? "bg-cyan-300/10 text-accent shadow-[inset_0_0_0_1px_rgba(32,214,199,0.18)]" : "text-slate-600 hover:bg-slate-50",
  ].join(" ");
}

function secondaryClass(active: boolean) {
  return [
    "rounded-md px-3 py-2 text-sm font-medium",
    active ? "border border-cyan-300/20 bg-cyan-300/10 text-accent" : "text-slate-600 hover:bg-slate-50",
  ].join(" ");
}

function mobileNavClass(pathname: string, href: string) {
  const active = isActive(pathname, href);
  return [
    "rounded-md border px-3 py-2 text-sm font-medium",
    active ? "border-cyan-300/25 bg-cyan-300/10 text-accent" : "border-slate-200 text-slate-600",
  ].join(" ");
}
