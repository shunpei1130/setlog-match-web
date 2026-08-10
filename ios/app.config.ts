import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Setlog Match",
  slug: "setlog-match-ios",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "setlogmatch",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "jp.setlog.match",
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#f5f4ee",
        image: "./assets/images/icon.png",
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
