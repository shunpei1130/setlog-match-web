import { StyleSheet } from "react-native";

export const colors = {
  paper: "#f5f4ee",
  surface: "#fffef9",
  surfaceMuted: "#ebece4",
  ink: "#163531",
  inkSoft: "#64716b",
  line: "#d7ddd5",
  accent: "#d8674f",
  accentDark: "#a94838",
  success: "#2f6b58",
  danger: "#a94838",
  white: "#ffffff",
} as const;

export const layout = StyleSheet.create({
  shadow: {
    shadowColor: colors.ink,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
});
