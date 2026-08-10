# Setlog Match iOS

Expo SDK 57、React Native、TypeScript、Expo Routerで実装した参加者向けアプリです。管理機能は既存Web版を使用します。

## 必要環境

- Node.js 22.13以上
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

HTTPのLAN接続は開発時だけにし、本番・previewではHTTPS URLを使ってください。アプリ内に秘密情報は含めません。

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

署名、実ビルド、TestFlight提出はこのリポジトリの実装範囲外です。`eas build:configure`が`app.config.ts`や`eas.json`へ変更を提案した場合は、Bundle IDと既存プロファイルを維持してください。
