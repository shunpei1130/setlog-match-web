import { ActionButton, Card, Eyebrow, Lead, Notice, Title } from "@/components/ui";
import { SafetyModal } from "@/components/safety-modal";
import { emptyDecision, hasDecision, toggleDecision } from "@/lib/decision";
import { colors, layout } from "@/theme";
import type { DecisionOption, MobileUser, PairDecision, RemotePair } from "@/types";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

const optionContent: Record<DecisionOption, { icon: string; title: string; copy: string }> = {
  instagram: { icon: "◎", title: "Instagramを交換したい", copy: "ふたりとも選んだ場合だけ交換します" },
  line: { icon: "▣", title: "LINEを交換したい", copy: "ふたりとも選んだ場合だけ交換します" },
  continue: { icon: "↻", title: "明日（日曜）も続けたい", copy: "ふたりとも選ぶと、同じ相手ともう一日" },
  none: { icon: "—", title: "今回はここで終える", copy: "連絡先を交換せず、今日で終了します" },
};

export function DecisionScreen({
  pair,
  user,
  busy,
  onSubmit,
  onRefresh,
  onBlock,
  onReport,
}: {
  pair: RemotePair;
  user: MobileUser;
  busy: boolean;
  onSubmit: (decision: PairDecision) => Promise<void>;
  onRefresh: () => Promise<void>;
  onBlock: () => Promise<void>;
  onReport: (reason: string, detail: string) => Promise<void>;
}) {
  const [decision, setDecision] = useState<PairDecision>(pair.decision ?? emptyDecision);
  const [error, setError] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [focused, setFocused] = useState<DecisionOption | null>(null);
  const pending = pair.decision?.answered || pair.result?.kind === "pending";

  useEffect(() => {
    const nextDecision = pair.decision;
    if (!nextDecision) return;
    const timeout = setTimeout(() => setDecision(nextDecision), 0);
    return () => clearTimeout(timeout);
  }, [pair.decision]);

  const choose = (option: DecisionOption) => {
    if (option === "instagram" && !user.instagramHandle) {
      setError("Instagramのユーザーネームが登録されていません。");
      return;
    }
    if (option === "line" && !user.lineContact) {
      setError("LINEの連絡先が登録されていません。");
      return;
    }
    setDecision((current) => toggleDecision(current, option));
    setError(null);
  };

  const submit = async () => {
    if (!pair.decisionOpen) {
      setError("回答できるのは22:00〜23:00です。");
      return;
    }
    if (!hasDecision(decision)) {
      setError("希望する項目か、「今回はここで終える」を選んでください。");
      return;
    }
    await onSubmit(decision);
  };

  return (
    <View style={styles.container}>
      <Eyebrow>今日の振り返り</Eyebrow>
      <Title>このあと、{`\n`}どうしたい？</Title>
      <Lead>{pair.candidate.nickname}さんとの一日を振り返って、希望する項目を選んでください。複数選べます。回答は相手に表示されません。</Lead>

      {pending ? (
        <>
          <Card accent>
            <Text style={styles.pendingMark}>✓ 回答済み</Text>
            <Text style={styles.pendingTitle}>回答を受け付けました</Text>
            <Text style={styles.pendingCopy}>相手の回答を待っています。回答は相手に表示されません。</Text>
          </Card>
          <ActionButton disabled={busy} onPress={() => void onRefresh()}>結果を確認する</ActionButton>
        </>
      ) : (
        <>
          {error ? <Notice onDismiss={() => setError(null)}>{error}</Notice> : null}
          <View accessibilityLabel="このあとの希望" style={styles.options}>
            {(Object.keys(optionContent) as DecisionOption[]).filter((option) => pair.kind !== "extension" || option !== "continue").map((option) => {
              const content = optionContent[option];
              const selected = decision[option];
              const unavailable = (option === "instagram" && !user.instagramHandle) || (option === "line" && !user.lineContact);
              return (
                <Pressable
                  key={option}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled: unavailable }}
                  disabled={unavailable}
                  onFocus={() => setFocused(option)}
                  onBlur={() => setFocused(null)}
                  onPress={() => choose(option)}
                  style={({ pressed }) => [
                    styles.option,
                    option === "none" && styles.optionMuted,
                    selected && styles.optionSelected,
                    unavailable && styles.optionUnavailable,
                    focused === option && Platform.OS === "web" && layout.focusRing,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.optionIcon, selected && styles.optionIconSelected]}><Text style={styles.optionIconText}>{content.icon}</Text></View>
                  <View style={styles.optionBody}>
                    <Text style={[styles.optionTitle, selected && styles.optionSelectedText]}>{content.title}</Text>
                    <Text style={[styles.optionCopy, selected && styles.optionSelectedText]}>{unavailable ? "連絡先が登録されていません" : content.copy}</Text>
                  </View>
                  <Text style={[styles.optionMark, selected && styles.optionSelectedText]}>{selected ? "✓" : "+"}</Text>
                </Pressable>
              );
            })}
          </View>
          <Card accent>
            <Text style={styles.privacyTitle}>お互いの希望が合ったときだけ</Text>
            <Text style={styles.privacyCopy}>ふたりとも選んだ連絡先だけを交換します。{pair.kind !== "extension" ? "「明日（日曜）も続けたい」を選んだ場合は、今回は連絡先を交換しません。" : ""}片方だけが選んだ項目や、終了の理由は表示されません。</Text>
          </Card>
          <ActionButton disabled={busy || !pair.decisionOpen} onPress={() => void submit()}>
            {busy ? "送信中…" : pair.decisionOpen ? "この内容で回答する" : "22時から回答できます"}
          </ActionButton>
        </>
      )}
      <ActionButton variant="danger" onPress={() => setSafetyOpen(true)}>困ったときは</ActionButton>
      <SafetyModal visible={safetyOpen} busy={busy} onClose={() => setSafetyOpen(false)} onBlock={onBlock} onReport={onReport} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 28 },
  options: { gap: 12, marginBottom: 20 },
  option: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surface, padding: 13, shadowColor: colors.ink, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 1, shadowRadius: 0 },
  optionSelected: { backgroundColor: colors.accentDark },
  optionMuted: { backgroundColor: colors.surfaceMuted },
  optionUnavailable: { opacity: 0.42 },
  optionIcon: { width: 42, height: 42, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  optionIconSelected: { backgroundColor: colors.accent },
  optionIconText: { color: colors.ink, fontSize: 18, fontWeight: "900" },
  optionBody: { flex: 1 },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  optionCopy: { color: colors.inkSoft, fontSize: 11, marginTop: 4 },
  optionMark: { color: colors.ink, fontSize: 20, fontWeight: "900" },
  optionSelectedText: { color: colors.surface },
  privacyTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  privacyCopy: { color: colors.ink, fontSize: 12, lineHeight: 19, marginTop: 5 },
  pendingMark: { color: colors.success, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  pendingTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: 9 },
  pendingCopy: { color: colors.inkSoft, fontSize: 13, lineHeight: 21, marginTop: 7 },
  pressed: { opacity: 0.72, transform: [{ translateY: 1 }] },
});
