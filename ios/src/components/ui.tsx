import { colors, layout } from "@/theme";
import type { AppPhase } from "@/types";
import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Page({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AppHeader({ signedIn, onSignOut }: { signedIn: boolean; onSignOut: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.brand} accessibilityLabel="Setlog Match">
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>S</Text></View>
        <View>
          <Text style={styles.brandTitle}>setlog match</Text>
          <Text style={styles.brandCaption}>SATURDAY ISSUE</Text>
        </View>
      </View>
      {signedIn ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="サインアウト"
          hitSlop={8}
          onPress={onSignOut}
          style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}
        >
          <Text style={styles.headerActionText}>ログアウト</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const steps: Partial<Record<AppPhase, { current: number; label: string }>> = {
  registration: { current: 1, label: "事前登録" },
  waiting: { current: 2, label: "土曜を待つ" },
  pair: { current: 3, label: "Day Pair" },
  decision: { current: 4, label: "非公開判定" },
  result: { current: 5, label: "結果" },
};

export function Progress({ phase }: { phase: AppPhase }) {
  const step = steps[phase];
  if (!step) return null;
  return (
    <View style={styles.progress} accessibilityLabel={`${step.label}、全5段階中${step.current}段階`}>
      <View style={styles.progressRow}>
        <Text style={styles.micro}>SETLOG MATCH</Text>
        <Text style={styles.micro}>{step.current} / 5</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${step.current * 20}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{step.label}</Text>
    </View>
  );
}

export function Notice({ children, onDismiss }: PropsWithChildren<{ onDismiss?: () => void }>) {
  return (
    <Pressable
      accessibilityRole={onDismiss ? "button" : undefined}
      accessibilityLabel={onDismiss ? "お知らせを閉じる" : undefined}
      onPress={onDismiss}
      style={styles.notice}
    >
      <Text style={styles.noticeText}>{children}</Text>
    </Pressable>
  );
}

export function Eyebrow({ children }: PropsWithChildren) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Title({ children }: PropsWithChildren) {
  return <Text accessibilityRole="header" style={styles.title}>{children}</Text>;
}

export function Lead({ children }: PropsWithChildren) {
  return <Text style={styles.lead}>{children}</Text>;
}

export function Card({ children, accent = false }: PropsWithChildren<{ accent?: boolean }>) {
  return <View style={[styles.card, accent && styles.cardAccent, layout.shadow]}>{children}</View>;
}

type ActionButtonProps = PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  accessibilityLabel?: string;
}>;

export function ActionButton({
  children,
  onPress,
  disabled = false,
  variant = "primary",
  accessibilityLabel,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {typeof children === "string" ? (
        <Text style={[
          styles.buttonText,
          variant === "primary" && styles.buttonPrimaryText,
          variant === "danger" && styles.buttonDangerText,
        ]}>{children}</Text>
      ) : children}
    </Pressable>
  );
}

export function BusyButton({ busy, busyLabel, ...props }: ActionButtonProps & { busy: boolean; busyLabel: string }) {
  return (
    <ActionButton {...props} disabled={props.disabled || busy}>
      {busy ? <><ActivityIndicator color={colors.surface} /><Text style={styles.buttonPrimaryText}>{busyLabel}</Text></> : props.children}
    </ActionButton>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityState={{ disabled: props.editable === false }}
        placeholderTextColor="#9da8a1"
        style={[styles.input, props.multiline && styles.inputMultiline, error && styles.inputError]}
      />
      {error ? <Text accessibilityRole="alert" style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function OptionGrid<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: string;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionGrid}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
            >
              <Text style={[styles.optionText, selected && styles.optionSelectedText]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CheckRow({
  checked,
  title,
  description,
  onPress,
}: {
  checked: boolean;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.checkRow, checked && styles.checkRowChecked, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        <Text style={styles.checkboxMark}>{checked ? "✓" : ""}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.checkTitle}>{title}</Text>
        <Text style={styles.checkDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  page: { width: "100%", maxWidth: 680, alignSelf: "center", paddingHorizontal: 16, paddingBottom: 48 },
  header: { minHeight: 64, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: colors.ink, paddingVertical: 10 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 38, height: 38, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink },
  brandMarkText: { color: colors.surface, fontSize: 18, fontWeight: "900" },
  brandTitle: { color: colors.ink, fontSize: 14, fontWeight: "900", letterSpacing: -0.4 },
  brandCaption: { color: colors.inkSoft, fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  headerAction: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
  headerActionText: { color: colors.inkSoft, fontSize: 12, fontWeight: "800" },
  progress: { paddingVertical: 14 },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  micro: { color: colors.inkSoft, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  progressTrack: { height: 4, marginVertical: 9, backgroundColor: colors.line },
  progressFill: { height: 4, backgroundColor: colors.accent },
  progressLabel: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  notice: { borderWidth: 2, borderColor: colors.accentDark, backgroundColor: colors.surfaceMuted, padding: 13, marginBottom: 18 },
  noticeText: { color: colors.accentDark, fontSize: 13, fontWeight: "700", lineHeight: 21 },
  eyebrow: { color: colors.accentDark, fontSize: 11, fontWeight: "900", letterSpacing: 1.3, marginBottom: 12 },
  title: { color: colors.ink, fontSize: 40, fontWeight: "900", letterSpacing: -2.2, lineHeight: 43, marginBottom: 14 },
  lead: { color: colors.inkSoft, fontSize: 15, lineHeight: 26, marginBottom: 24 },
  card: { borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, padding: 16, marginBottom: 20 },
  cardAccent: { backgroundColor: colors.surfaceMuted },
  button: { minHeight: 56, borderWidth: 2, borderColor: colors.ink, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 10 },
  buttonPrimary: { backgroundColor: colors.ink },
  buttonSecondary: { backgroundColor: colors.surface },
  buttonDanger: { borderColor: colors.danger, backgroundColor: colors.surfaceMuted },
  buttonText: { color: colors.ink, fontSize: 14, fontWeight: "900", textAlign: "center" },
  buttonPrimaryText: { color: colors.surface },
  buttonDangerText: { color: colors.danger },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ translateY: 1 }] },
  field: { gap: 7, marginBottom: 16 },
  fieldLabel: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  input: { minHeight: 54, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, paddingHorizontal: 13, color: colors.ink, fontSize: 16 },
  inputMultiline: { minHeight: 104, paddingTop: 13, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  fieldError: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: { minHeight: 48, minWidth: 70, flexGrow: 1, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  optionSelected: { backgroundColor: colors.accent },
  optionText: { color: colors.ink, fontSize: 13, fontWeight: "800" },
  optionSelectedText: { fontWeight: "900" },
  checkRow: { minHeight: 72, flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, padding: 13, marginBottom: 10 },
  checkRowChecked: { backgroundColor: colors.success },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: colors.ink, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  checkboxChecked: { backgroundColor: colors.ink },
  checkboxMark: { color: colors.surface, fontSize: 13, fontWeight: "900" },
  checkTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  checkDescription: { color: colors.ink, fontSize: 12, lineHeight: 19, marginTop: 3 },
});
