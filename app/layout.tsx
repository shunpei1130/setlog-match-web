import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL ?? "https://setlog-match-web.vercel.app"),
  title: "set-mob | 青学生限定の土曜マッチング",
  description: "18歳以上の青学生限定。友人・恋愛・どちらでもから選び、土曜の一日をきっかけにつながるマッチングサービス。",
  applicationName: "set-mob",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "set-mob | 青学生限定の土曜マッチング",
    description: "友人・恋愛・どちらでも。土曜の一日から、安心してつながる。",
    images: [{ url: "/set-mob-banner.png", width: 1776, height: 887, alt: "set-mob 青学生限定の土曜マッチング" }],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "set-mob | 青学生限定の土曜マッチング",
    description: "友人・恋愛・どちらでも。土曜の一日から、安心してつながる。",
    images: ["/set-mob-banner.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f4ee",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
