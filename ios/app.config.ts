import type { ExpoConfig } from "expo/config";
import { validateReleaseConfiguration } from "./release-config.cjs";

const release = validateReleaseConfiguration(process.env);

const config: ExpoConfig = {
  name: "set-mob",
  slug: "set-mob-ios",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/set-mob-icon.png",
  scheme: "setlogmatch",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "jp.setlog.match",
    supportsTablet: false,
    deploymentTarget: "17.6",
    config: { usesNonExemptEncryption: false },
    infoPlist: release ? {} : {
      NSLocalNetworkUsageDescription: "開発中に同じWi-Fi上のAPIへ接続します。",
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  owner: process.env.EXPO_ACCOUNT_OWNER || undefined,
  extra: process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {},
  web: {
    output: "static",
    favicon: "./assets/images/set-mob-icon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#f5f4ee",
        image: "./assets/images/set-mob-icon.png",
        imageWidth: 96,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
