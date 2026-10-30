import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getApiEnvironment, setApiEnvironment } from "./api";

const TOKEN_KEY = "setlog.auth-token";
export const REGISTRATION_DRAFT_KEY = "setlog.registration-draft-v1";
let webToken: string | null = null;
const tokenKey = () => getApiEnvironment() === "review" ? `${TOKEN_KEY}.review` : TOKEN_KEY;
const draftKey = () => getApiEnvironment() === "review" ? `${REGISTRATION_DRAFT_KEY}.review` : REGISTRATION_DRAFT_KEY;

export async function restoreApiEnvironment() {
  setApiEnvironment(await AsyncStorage.getItem("set-mob.environment") === "review" ? "review" : "production");
}
export async function saveApiEnvironment(environment: "production" | "review") {
  setApiEnvironment(environment);
  await AsyncStorage.setItem("set-mob.environment", environment);
}

export async function readAccessToken() {
  if (Platform.OS === "web") return webToken;
  return SecureStore.getItemAsync(tokenKey());
}

export async function saveAccessToken(token: string) {
  if (Platform.OS === "web") {
    webToken = token;
    return;
  }
  await SecureStore.setItemAsync(tokenKey(), token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearAccessToken() {
  if (Platform.OS === "web") {
    webToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(tokenKey());
}

export async function readRegistrationDraft<T>() {
  const raw = await AsyncStorage.getItem(draftKey());
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await AsyncStorage.removeItem(draftKey());
    return null;
  }
}

export async function saveRegistrationDraft(value: unknown) {
  await AsyncStorage.setItem(draftKey(), JSON.stringify(value));
}

export async function clearRegistrationDraft() {
  await AsyncStorage.removeItem(draftKey());
}
