# Setlog Match Web

青学生限定で、毎週土曜に開催するSetlog連携型マッチングアプリのWeb MVPです。

## Neon DB

待機人数と次回土曜の事前登録はNeon Postgresに保存します。初回募集は100人限定で、LINE登録済み・キャンセルされていない登録だけが定員を消費します。

接続文字列は`.env.local`または公開環境の`DATABASE_URL`に設定してください。秘密情報はGitHubへ保存しません。

```powershell
Copy-Item .env.example .env.local
npm run db:generate
npm run db:migrate
```

DB未接続の環境では、待機人数を0人と表示せず「人数を取得できません」と表示します。

## MVPで体験できること

- いつでもできる次回土曜への事前登録
- 青学メールアドレス（`@aoyama.jp` または `@aoyama.ac.jp`）による所属確認
- LINE登録モックと、毎週金曜21:00の「明日はマッチング！」案内プレビュー
- 初回100人の定員管理と残り枠表示
- 土曜のマッチング開始、3人のレコメンド、希望順位
- Day Pair成立、Setlog接続モック、夜の非公開判定
- 一致した連絡先だけの開示、不成立、ブロック、通報

LINE Login / LIFF、友だち追加、実際のメッセージ送信は未接続です。公開環境ではLINE登録が必須ですが、`localhost`と`127.0.0.1`ではテスト用にスキップできます。

実ユーザー認証、本人確認、プロフィールDB、メール送信、決済、Setlog公式APIは未接続です。画面状態はブラウザの`localStorage`に保存されます。

## ローカルで起動

```powershell
npm install
npm run dev
```

検証:

```powershell
npm test
npm run lint
npm run build
```

## 主なファイル

- `app/page.tsx`: MVPの画面状態とユーザーフロー
- `app/globals.css`: モバイル優先のUIとレスポンシブスタイル
- `app/layout.tsx`: メタデータとアプリ全体のレイアウト
- `app/api/events/`: 待機人数取得と事前登録API
- `db/`、`drizzle/`: Neon Postgresのスキーマとマイグレーション
- `tests/rendered-html.test.mjs`: ビルド後HTMLと主要仕様のテスト
