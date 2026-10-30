# set-mob iOS

Expo SDK 57、React Native、TypeScript、Expo Routerで実装した参加者向けアプリです。管理機能は既存Web版を使用します。

## 必要環境

- Node.js 22.13以上
- iPhone / iOS 17.6以上（連携先Setlogの必要環境に合わせる）
- npm
- 実機確認にはExpo Go、ネイティブ開発ビルドにはEAS CLIとApple Developer Programの資格情報

WindowsではiOS Simulatorを起動できないため、Expo GoまたはEASのdevelopment buildをiPhoneへ入れて確認します。

## 起動

```powershell
cd ios
Copy-Item .env.example .env.local
npm install
npm start
```

`.env.local`の`EXPO_PUBLIC_API_BASE_URL`には、末尾のスラッシュを付けずにAPIのURLを設定します。iPhone実機からWindows上の開発APIへ接続する場合、`localhost`ではなく同じLANから到達できるPCのIPv4アドレスを使います。

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:3001
```

HTTPのLAN接続は開発時だけにします。本番・previewでは`EXPO_PUBLIC_API_BASE_URL`と`EXPO_PUBLIC_REVIEW_API_BASE_URL`の両方に、異なる公開HTTPSオリジンを指定します。`release-config.cjs`が未設定・localhost・仮URL・同一接続先を拒否します。アプリ内に秘密情報は含めません。

## LINE Login

LINE DevelopersのLogin channelには、既存Web APIのHTTPS callbackを登録します。

```text
https://YOUR_API_HOST/api/line/callback
```

iOSアプリは`POST /api/mobile/line/login`から一回限り・10分有効のstate付き認可URLを取得します。callback処理後、APIは`setlogmatch://line-callback?status=...`へ戻します。Bundle IDは`jp.setlog.match`、URLスキームは`setlogmatch`です。

LINE LoginとMessaging APIの環境変数はすべてWeb/API側に設定し、`ios/.env.local`へは置かないでください。

## 確認コマンド

```powershell
npm test
npm run typecheck
npx expo-doctor
npm run export:ios
```

`npm run export:ios`の成果物は`dist/`へ生成されます。

同コマンドはMetroのキャッシュも消去します。プレビュー用HTTP URLから公開HTTPS URLへ切り替える際に、以前の接続先が書き出しへ残ることを防ぎます。公開用は本番・審査の別々のURLを明示し、`SET_MOB_RELEASE=true`で設定を検証してください。本番APIの新機能反映と実機確認は別途必要です。

## EAS Build

`eas.json`には次のプロファイルがあります。

- `development`: development clientを使う内部配布
- `preview`: 内部配布用のrelease build
- `production`: App Store向けbuild

```powershell
npm install --global eas-cli
eas login
eas build:configure
eas build --platform ios --profile development
eas build --platform ios --profile preview
eas build --platform ios --profile production
```

2026-10-22の運営者指示で、Expoログインと署名付きビルドは一旦保留しています。再開時はExpoにログインし、既存プロジェクトの`EAS_PROJECT_ID`と必要なら`EXPO_ACCOUNT_OWNER`を設定してからビルドします。`eas build:configure`が変更を提案した場合は、Bundle IDと既存プロファイルを維持してください。

設定・ヘルプには規約、安全、問い合わせ、アカウント削除と審査用ログインがあります。審査用ログインは専用APIへ切り替わり、トークンと入力途中の保存先も本番から分離されます。審査用のユーザー名・パスワードを`EXPO_PUBLIC_*`やソースへ入れないでください。

Setlogのログ作成・招待参加・退出は各参加者がSetlogで操作します。set-mobでのブロックはSetlog側の共有を停止しません。[実機・TestFlight・App Storeの公開チェック](../operations/IOS_V1_RELEASE.md)に、未確認事項と再開手順をまとめています。
