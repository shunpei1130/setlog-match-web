import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "set-mob",
  slug: "set-mob-ios",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/set-mob-icon.png",
  scheme: "setmob",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "jp.setmob.app",
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
  },
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
