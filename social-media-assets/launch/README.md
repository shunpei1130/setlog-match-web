# set-mob パートナー用ローンチキット

## 掲載素材

- `story-01-discovery.png`: 体験の説明
- `story-02-safety.png`: 安全・相互同意
- `story-03-call-to-action.png`: 初回100人募集とQR
- `post-01-launch.png`: 正方形投稿
- `launch-kit-preview.png`: 4点の確認用一覧

QRは次の計測URLへ遷移する。

`https://setlog-match-web.vercel.app/?ref=partner-kit&utm_source=instagram&utm_medium=partner&utm_campaign=first100`

提携先ごとに掲載する際は、`sales/partner-shortlist.csv`の`ref_code`へ差し替えた専用URLを渡す。投稿前に運営者がQRと最新のプロフィール表示を確認する。

## 紹介文

> 18歳以上の青学生限定。友人／恋愛／どちらでもを自分で選び、土曜の一日をきっかけにつながる独立サービス「set-mob」。連絡先は双方が同じ手段を選んだ場合だけ開示されます。初回100人の招待受付中。

## FAQ

### 青山学院大学やSetlogの公式サービスですか？

いいえ。set-mobは長谷川峻平が独立運営するサービスです。Setlogは一日の共有に使う連携先アプリです。

### 恋愛目的だけですか？

いいえ。「友人」「恋愛」「どちらでも」から本人が選びます。目的と希望する相手が双方で一致するペアだけを運営が作成します。

### 連絡先は公開されますか？

InstagramまたはLINEを双方が同じ手段で選んだ場合だけ、登録済みの連絡先を相手へ表示します。

### 参加条件は？

18歳以上の青学生で、メール認証、LINE連携、友だち追加、安全ルールへの同意が必要です。

### キャンセルできますか？

開催前まで参加画面からキャンセルできます。

## 生成情報

背景イラストはCodexの組み込み画像生成を使い、次の趣旨で生成した。

> 青学生の土曜日を示す、匿名の二人が別々の時間を過ごし一本の線でつながる、紙面風のフラットな編集イラスト。set-mobの既存色のみ。文字・ロゴ・大学固有の建物・恋愛記号なし。

日本語、ロゴ、QRは`python scripts/build-launch-kit.py`で決定的に合成している。
