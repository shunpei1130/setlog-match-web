import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "setlog.auth-token";
export const REGISTRATION_DRAFT_KEY = "setlog.registration-draft-v1";
let webToken: string | null = null;

export async function readAccessToken() {
  if (Platform.OS === "web") return webToken;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function saveAccessToken(token: string) {
  if (Platform.OS === "web") {
    webToken = token;
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearAccessToken() {
  if (Platform.OS === "web") {
    webToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function readRegistrationDraft<T>() {
  const raw = await AsyncStorage.getItem(REGISTRATION_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    await AsyncStorage.removeItem(REGISTRATION_DRAFT_KEY);
    return null;
  }
}

export async function saveRegistrationDraft(value: unknown) {
  await AsyncStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify(value));
}

export async function clearRegistrationDraft() {
  await AsyncStorage.removeItem(REGISTRATION_DRAFT_KEY);
}
