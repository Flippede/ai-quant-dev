import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Quant Watch",
  description: "Private AI quantitative watch platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

