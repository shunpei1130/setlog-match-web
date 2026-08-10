# Setlog Match Web

青学生限定で、毎週土曜に開催するSetlog連携型マッチングアプリです。参加者は青学メールで認証し、LINEで案内を受け取り、運営が公開したDay PairとSetlog参加情報を確認します。

## Neon DB

待機人数と次回土曜の事前登録はNeon Postgresに保存します。初回募集は100人限定で、LINE登録済み・キャンセルされていない登録だけが定員を消費します。

接続文字列と外部サービスの認証情報は`.env.local`または公開環境の環境変数に設定してください。秘密情報はGitHubへ保存しません。

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
- 青学メールの6桁コード認証、LINE Login／友だち追加確認
- 運営画面からの参加者確認、ペア登録、Setlogコード公開
- 相互同意後だけのInstagram／LINE連絡先開示

Setlog本体の公開APIは使わず、運営が登録したURL／参加コードを公開します。LINE、Resend、Neonの認証情報が未設定の環境では、該当操作を設定エラーとして扱います。`localhost`と`127.0.0.1`では、テスト用にメール認証とLINE登録をスキップできます。

画面の入力途中だけブラウザの`localStorage`に保存し、認証・参加登録・ペア・意思決定・安全報告はNeon Postgresに保存します。運営画面は`ADMIN_EMAILS`に登録されたメールアドレスだけが利用できます。

## 環境変数

`.env.example`を`.env.local`へコピーし、最低限`DATABASE_URL`を設定してください。本番では以下も必要です。

- `RESEND_API_KEY` / `EMAIL_FROM`
- `APP_BASE_URL` / `AUTH_SECRET_PEPPER`
- `ADMIN_EMAILS`
- `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` / `LINE_MESSAGING_CHANNEL_SECRET`
- `LINE_LOGIN_REDIRECT_URI` / `LINE_MESSAGING_ACCESS_TOKEN`
- `LIFF_ID` / `LINE_OFFICIAL_ACCOUNT_URL`
- `CRON_SECRET`

Vercel Cronは毎週金曜21:00 JSTに`/api/cron/line-reminder`を呼び出します。LINE DevelopersのWebhook URLには`/api/line/webhook`を設定してください。

## ローカルで起動

```powershell
npm install
npm run dev
```

Node.jsは`.nvmrc`に合わせて22.13.0以上を使用してください。

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
- `app/api/auth/`、`app/api/line/`: メール認証とLINE連携API
- `app/api/admin/`、`app/admin/`: 運営画面とペア公開API
- `app/api/pairs/`: Day Pair、意思決定、連絡先開示、安全API
- `db/`、`drizzle/`: Neon Postgresのスキーマとマイグレーション
- `tests/rendered-html.test.mjs`: ビルド後HTMLと主要仕様のテスト
