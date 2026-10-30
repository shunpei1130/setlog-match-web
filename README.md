# set-mob Web

営業リスト、ソースコード、事業方針、運営資料の入口は [プロジェクト案内](PROJECT_HUB.md) にまとめています。

18歳以上の青学生を対象に、土曜の一日をきっかけにつながる無料の独立運営サービスです。参加目的は「友人／恋愛／どちらでも」から選べます。iOSを先に完成・検証し、実機E2E→TestFlight→App Store→本格営業の順に進めます。

set-mobは青山学院大学・Setlogの公式・公認サービスではありません。Setlogの公開APIや自動操作は使わず、参加者が作成したログの招待コードをペア内で共有します。

## Neon DB

待機人数と次回土曜の事前登録はNeon Postgresに保存します。初回募集は100人限定で、LINE登録済み・キャンセルされていない登録だけが定員を消費します。

接続文字列と外部サービスの認証情報は`.env.local`または公開環境の環境変数に設定してください。秘密情報はGitHubへ保存しません。

```powershell
Copy-Item .env.example .env.local
npm run db:generate
npm run db:migrate
```

DB未接続の環境では、待機人数を0人と表示せず「人数を取得できません」と表示します。

## iOS v1の機能

- いつでもできる次回土曜への事前登録
- 青学メールアドレス（`@aoyama.jp` または `@aoyama.ac.jp`）による所属確認
- LINE Login・友だち追加確認と、毎週金曜21:00の案内
- 初回100人の定員管理と残り枠表示
- 土曜12:00締切の自動マッチング。双方の目的・希望条件を守り、ブロック・通報・過去の相手を除き、できるだけ多くのペアを作成
- ペア内のSetlog招待URL／コード共有と参加確認。相手の参加確認後はコード変更不可
- 22〜23時の非公開判定。双方の回答が揃うと即時に結果を確定
- 一致した連絡先だけの開示、不成立、ブロック、通報
- 青学メールの6桁コード認証、LINE Login／友だち追加確認
- 双方が継続を希望した場合だけ、同じ相手で日曜12時へ延長。片方の開始前取消・ブロック・通報で両方の延長を終了
- 相互同意後だけのInstagram／LINE連絡先開示
- サーバーからの参加状態・プロフィール復元、未成立後の次回登録、アプリ内のアカウント削除
- 本番DBと分離した審査用アカウントと7種類の確認状態

LINE、Resend、Neonの認証情報が未設定の環境では該当操作を設定エラーとして扱います。開発ビルドのループバックURLには既存のUIデモが残っています。実DBのWebフローは`/?live`で確認でき、本番ビルドでは認証・LINEのスキップを拒否します。デモの3人推薦・順位入力は本番の自動マッチングでは使いません。

2026-10-22時点で、新しいスキーマは分離したNeonブランチで検証しています。既存の本番DBと本番アプリにはまだ適用していません。署名付きiOSビルド・TestFlight・App Store提出も未実施です。[公開手順と検証記録](operations/IOS_V1_RELEASE.md)を参照してください。

画面の入力途中だけブラウザの`localStorage`に保存し、認証・参加登録・ペア・意思決定・安全報告はNeon Postgresに保存します。運営画面は`ADMIN_EMAILS`に登録されたメールアドレスだけが利用できます。

## 環境変数

`.env.example`を`.env.local`へコピーし、最低限`DATABASE_URL`を設定してください。本番では以下も必要です。

- `RESEND_API_KEY` / `EMAIL_FROM`
- `APP_BASE_URL` / `AUTH_SECRET_PEPPER`
- `ADMIN_EMAILS` / `AUTH_EMAIL_EXCEPTIONS`
- `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` / `LINE_MESSAGING_CHANNEL_SECRET`
- `LINE_LOGIN_REDIRECT_URI` / `LINE_MESSAGING_ACCESS_TOKEN`
- `LIFF_ID` / `LINE_OFFICIAL_ACCOUNT_URL`
- `CRON_SECRET`
- `AUTO_MATCHING_ENABLED=true`（`0008`適用後に有効化）

Vercel Cronは土曜12:00 JSTに`/api/cron/event-matching`、金曜21:00 JSTに`/api/cron/line-reminder`を呼び出します。Cronの遅延・重複に備え、参加状況の取得でもマッチングを実行し、DBのトランザクション・一意制約で重複を防ぎます。LINE DevelopersのWebhook URLには`/api/line/webhook`を設定してください。

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

## 運営

- 運営者: 長谷川峻平
- 問い合わせ: `s.hasegawa1130@gmail.com`
