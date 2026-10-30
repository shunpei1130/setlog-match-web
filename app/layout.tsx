import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL ?? "https://setlog-match-web.vercel.app"),
  title: "set-mob | 青学生と土曜日をシェア",
  description: "18歳以上の青学生限定。Setlogでお互いの土曜日を共有し、夜に連絡先を交換するかを選べます。青山学院大学およびSetlogの非公式サービスです。",
  applicationName: "set-mob",
  robots: process.env.APP_ENV === "review" ? { index: false, follow: false } : undefined,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "set-mob | 青学生と土曜日をシェア",
    description: "Setlogでお互いの一日を共有。連絡先は、お互いが交換を希望したときだけ。18歳以上の青学生限定の非公式サービスです。",
    images: [{ url: "/set-mob-banner.png", width: 1776, height: 887, alt: "set-mob 青学生限定の土曜マッチング" }],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "set-mob | 青学生と土曜日をシェア",
    description: "Setlogでお互いの一日を共有。連絡先は、お互いが交換を希望したときだけ。18歳以上の青学生限定の非公式サービスです。",
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
      <body>{process.env.APP_ENV === "review" ? <aside className="environment-banner" role="note">審査用の画面です。表示されるデータは架空のものです。</aside> : null}{children}</body>
    </html>
  );
}
