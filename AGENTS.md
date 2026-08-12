# set-mob UI rules

## UI変更時の必須ルール

- UIを変更する前に`DESIGN_SYSTEM.md`を読む。
- 既存の色、余白、角丸、文字サイズのトークンを優先する。
- 新しいハードコード色、グラデーション、glassmorphism、過剰な影を追加しない。
- すべてをカードに入れず、画面ごとの主操作を1つにする。
- 390px幅のモバイル表示を基準に実装する。
- 入力、ボタン、モーダルにはラベル、focus-visible、十分なコントラストを付ける。
- UI実装後に主要画面をブラウザで確認し、不要な装飾と説明文を削る。
- 機能変更を伴わないUI作業では、API・DB・localStorageの契約を変更しない。

## 初期100人獲得に関する必須ルール

- 事業、集客、公開準備、運営に関する作業では、最初に`GROWTH_100_USERS.md`を読む。
- 同文書で表の上から最初にある「担当=`CODEX`、状態=`READY`」を優先し、運営者本人にしかできない作業だけを依頼する。
- 作業後は`GROWTH_100_USERS.md`の状態・判断ログと`GROWTH_METRICS.csv`を更新する。
- Instagramの自動収集、自動DM、一斉送信は行わない。
- 青山学院大学またはSetlogの公式・公認サービスと誤認される表現を、許諾なしに追加しない。
- 秘密情報、OTP、個人アカウントの認証情報をリポジトリへ保存しない。
- 公開ブランド名は`set-mob`。`Setlog`は連携先アプリを指す場合だけ使用し、公式・公認と誤認される表現を追加しない。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
