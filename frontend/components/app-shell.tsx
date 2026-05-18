"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";

const appRoutes = [
  "/dashboard",
  "/market",
  "/watchlist",
  "/strategies",
  "/backtests",
  "/signals",
  "/ai/strategy-advisor",
  "/admin/users",
  "/change-password",
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showAppHeader = appRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return (
    <>
      {showAppHeader ? <AppHeader /> : null}
      {children}
    </>
  );
}
