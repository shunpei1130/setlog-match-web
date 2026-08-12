# Instagram営業候補リスト

このディレクトリは、set-mob本体のAPI・DB・localStorageから分離した営業用の台帳です。
初版はCSVを人が確認しながら更新します。Instagramのスクレイピング、フォロワーの自動取得、自動DM、一斉送信は行いません。

## ファイル

- `instagram-leads.csv`: 1行1アカウントの営業候補台帳。必須成果列は `display_name`、`profile_url`、`follower_count`。
- `search-dictionary.csv`: ハッシュタグ・検索語と探索経路の辞書
- `../scripts/validate-instagram-leads.mjs`: CSVの形式、重複、確度、DM対象条件を確認する検証スクリプト

## 使い方

1. Instagramアプリで公開プロフィールを手動確認する。
2. `instagram-leads.csv`に1アカウントずつ追記する。
3. `evidence_url`にはプロフィールURLまたは関連する公開投稿・ハブアカウントのURLを記録する。
4. `aoyama_evidence`には「プロフィールに青学と明記」「青学祭の投稿にタグ付け」など、短い根拠を書く。
5. `follower_count`には表示を数値にした値、`follower_count_display`には画面に表示された元の値（例: `1.2万`）を記録する。
6. `confidence`をA/B/Cで判定する。
7. `npm run sales:validate`で入力途中のエラーを確認する。
8. 1000件を完成判定するときは `npm run sales:validate:strict` を実行する。

## 判定基準

### 青学との関連

- `A`: プロフィール名・自己紹介・公式投稿などに、青学／青山学院／AGU等が明記されている。
- `B`: プロフィールに明記はないが、信頼できる青学関連アカウント、サークル、イベントとの関係が確認できる。
- `C`: 青山・表参道・AGUなど曖昧な信号だけ。候補には残すが、初回DM対象にはしない。

最終成果物は、重複を除いた公開アカウント1000件、A/Bが800件以上、Cが200件以下を満たすこと。

### DM対象

次の全条件を満たす行だけをDM候補とする。

- `public_status=public`
- `confidence=A` または `confidence=B`
- `adult_service_eligibility=eligible`
- `dm_status=candidate`

18歳以上サービスの対象可否が不明な個人アカウントは台帳に残してもDM対象にしません。年齢・性別などを推定して補完しないでください。

## 探索配分

完成時の主な発見経路は、以下を各250件の目標にします。経路が重複する場合は、最初に発見した経路を `discovery_channel` に記録し、別経路は `notes` に追記します。

- `hashtag`: ハッシュタグ検索
- `hub_followers`: 青学関連ハブの公開フォロワー
- `circle_event`: サークル・イベント・メンション・タグ
- `keyword_search`: プロフィール、表示名、検索エンジンによる補助検索

最初に1500〜1800件を仮登録し、重複・非公開・根拠不足を除いて1000件に絞ります。

## 記録しない情報

氏名、電話番号、メールアドレス、性別、推定年齢、住所、学校メールなどはこの台帳に記録しません。公開プロフィール上の表示名は、アカウント識別に必要な範囲でのみ記録します。

## Instagram利用上の注意

ハッシュタグ検索や公開プロフィール確認は、Instagramの画面で手動に行います。公開情報であっても、第三者の自動収集・大量保存・一斉接触を前提にしないでください。

参照:

- [Meta Automated Data Collection Terms](https://www.facebook.com/legal/automated_data_collection_terms)
- [Instagramでハッシュタグを使う](https://www.facebook.com/help/351460621611097/?locale=en_GB)
- [検索エンジンに公開Instagram投稿が表示される条件](https://www.facebook.com/help/147542625391305)
