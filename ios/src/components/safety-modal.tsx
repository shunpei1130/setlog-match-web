import { ActionButton, Field, OptionGrid } from "@/components/ui";
import { colors } from "@/theme";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const reasons = [
  { value: "harassment", label: "嫌がらせ" },
  { value: "identity", label: "所属・本人確認" },
  { value: "solicitation", label: "勧誘・金銭" },
  { value: "other", label: "その他" },
] as const;

export function SafetyModal({
  visible,
  busy,
  onClose,
  onBlock,
  onReport,
}: {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onBlock: () => Promise<void>;
  onReport: (reason: string, detail: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const report = async () => {
    if (!reason) {
      setError("通報理由を選択してください。");
      return;
    }
    await onReport(reason, detail);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable accessibilityRole="button" accessibilityLabel="安全メニューを閉じる" style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheet}>
        <SafeAreaView edges={["bottom"]}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>SAFETY FIRST</Text>
                <Text accessibilityRole="header" style={styles.title}>すぐに離れて大丈夫。</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="閉じる" hitSlop={8} onPress={onClose} style={styles.close}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.copy}>返信や理由の説明は必要ありません。ブロックすると相手を非表示にし、通報すると運営へ共有します。</Text>
            <ActionButton disabled={busy} variant="danger" onPress={() => void onBlock()}>相手をブロックして終了する</ActionButton>
            <View style={styles.divider} />
            <OptionGrid label="通報理由" options={reasons} value={reason} onChange={(value) => { setReason(value); setError(null); }} />
            <Field label="補足（任意）" multiline maxLength={1000} value={detail} onChangeText={setDetail} placeholder="気になったことを書いてください" />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <ActionButton disabled={busy} variant="secondary" onPress={() => void report()}>運営に通報して終了する</ActionButton>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", inset: 0, backgroundColor: "rgba(22, 53, 49, 0.72)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "90%", backgroundColor: colors.paper, borderTopWidth: 6, borderTopColor: colors.accent },
  content: { padding: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.accentDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 28, lineHeight: 33, fontWeight: "900", letterSpacing: -1.2, marginTop: 5 },
  close: { width: 44, height: 44, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  closeText: { color: colors.ink, fontSize: 24, fontWeight: "900" },
  copy: { color: colors.inkSoft, fontSize: 13, lineHeight: 21, marginVertical: 14 },
  divider: { height: 2, backgroundColor: colors.ink, marginVertical: 20 },
  error: { color: colors.danger, fontSize: 12, fontWeight: "800" },
});
