import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "setlog match | 青学生限定の土曜体験",
  description: "写真で選ぶ前に、その人の普通の土曜日を見る。Setlog連携型マッチングアプリのMVPデモ。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
