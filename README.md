# Setlog Match Web

青学生限定・毎週土曜開催を初期想定にした、Setlog連携型マッチングアプリのWeb MVPです。

## MVPで体験できること

- いつでもできる次回土曜への事前登録
- 土曜の開始ボタンから始めるマッチング
- デモ候補者3人のレコメンドと希望順位入力
- Day Pair成立
- Setlog接続モック
- 夜の非公開判定
- 一致した連絡先だけの開示
- 不成立・ブロック・通報フロー

実ユーザー認証・データベース・メール送信・決済・Setlog公式APIは未接続です。画面の状態はブラウザの `localStorage` に保存されます。

## ローカルで起動

```bash
npm install
npm run dev
```

ビルドと受入テストは次で実行できます。

```bash
npm test
npm run lint
```

## Vercelデプロイ

Vercelでは `vercel.json` の `next build` を使ってNext.jsアプリとしてビルドします。公開URLはデモ用で、ブラウザごとのローカル状態を使います。

## プロジェクト構成

- `app/page.tsx`: MVPの画面状態と一連のユーザーフロー
- `app/globals.css`: モバイル優先のUIとレスポンシブスタイル
- `app/layout.tsx`: メタデータとアプリ全体のレイアウト
- `tests/rendered-html.test.mjs`: ビルド後HTMLの受入テスト
- `db/`・`worker/`: 将来のCloudflare連携用の任意サーフェス
