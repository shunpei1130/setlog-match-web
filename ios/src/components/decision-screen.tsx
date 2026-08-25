import { ActionButton, Card, Eyebrow, Lead, Notice, Title } from "@/components/ui";
import { SafetyModal } from "@/components/safety-modal";
import { emptyDecision, hasDecision, toggleDecision } from "@/lib/decision";
import { colors } from "@/theme";
import type { DecisionOption, MobileUser, PairDecision, RemotePair } from "@/types";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const optionContent: Record<DecisionOption, { icon: string; title: string; copy: string }> = {
  instagram: { icon: "◎", title: "Instagram", copy: "お互いに選んだら開示" },
  line: { icon: "▣", title: "LINE", copy: "お互いに選んだら開示" },
  continue: { icon: "↻", title: "もう一日Setlogする", copy: "次回、もう一日だけ共有" },
  none: { icon: "—", title: "何も教えない", copy: "相手には何も伝えない" },
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
  const pending = pair.decision?.answered || pair.result?.kind === "pending";

  useEffect(() => {
    const nextDecision = pair.decision;
    if (!nextDecision) return;
    const timeout = setTimeout(() => setDecision(nextDecision), 0);
    return () => clearTimeout(timeout);
  }, [pair.decision]);

  const choose = (option: DecisionOption) => {
    if (option === "instagram" && !user.instagramHandle) {
      setError("Instagramは事前登録で未設定です。");
      return;
    }
    if (option === "line" && !user.lineContact) {
      setError("LINEの連絡先は事前登録で未設定です。");
      return;
    }
    setDecision((current) => toggleDecision(current, option));
    setError(null);
  };

  const submit = async () => {
    if (!pair.decisionOpen) {
      setError("非公開判定は土曜22時から回答できます。");
      return;
    }
    if (!hasDecision(decision)) {
      setError("いずれかを選ぶか、「何も教えない」を選択してください。");
      return;
    }
    await onSubmit(decision);
  };

  return (
    <View style={styles.container}>
      <Eyebrow>05 / PRIVATE DECISION</Eyebrow>
      <Title>続けたいものだけ、{`\n`}静かに選ぶ。</Title>
      <Lead>{pair.candidate.nickname}さんとの一日を振り返り、続けたいものを選んでください。</Lead>

      {pending ? (
        <>
          <Card accent>
            <Text style={styles.pendingMark}>✓ ANSWERED</Text>
            <Text style={styles.pendingTitle}>回答を受け付けました</Text>
            <Text style={styles.pendingCopy}>相手の回答を待っています。回答内容や片方だけの希望は表示されません。</Text>
          </Card>
          <ActionButton disabled={busy} onPress={() => void onRefresh()}>結果を確認する</ActionButton>
        </>
      ) : (
        <>
          {error ? <Notice onDismiss={() => setError(null)}>{error}</Notice> : null}
          <View accessibilityLabel="開示する項目" style={styles.options}>
            {(Object.keys(optionContent) as DecisionOption[]).map((option) => {
              const content = optionContent[option];
              const selected = decision[option];
              const unavailable = (option === "instagram" && !user.instagramHandle) || (option === "line" && !user.lineContact);
              return (
                <Pressable
                  key={option}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled: unavailable }}
                  disabled={unavailable}
                  onPress={() => choose(option)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    option === "none" && styles.optionMuted,
                    unavailable && styles.optionUnavailable,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.optionIcon, selected && styles.optionIconSelected]}><Text style={styles.optionIconText}>{content.icon}</Text></View>
                  <View style={styles.optionBody}>
                    <Text style={[styles.optionTitle, selected && styles.optionSelectedText]}>{content.title}</Text>
                    <Text style={[styles.optionCopy, selected && styles.optionSelectedText]}>{unavailable ? "事前登録で未設定" : content.copy}</Text>
                  </View>
                  <Text style={[styles.optionMark, selected && styles.optionSelectedText]}>{selected ? "✓" : "+"}</Text>
                </Pressable>
              );
            })}
          </View>
          <Card accent>
            <Text style={styles.privacyTitle}>非公開のまま判定します</Text>
            <Text style={styles.privacyCopy}>相手の回答、片方だけが希望した事実、不成立の理由は表示しません。</Text>
          </Card>
          <ActionButton disabled={busy || !pair.decisionOpen} onPress={() => void submit()}>
            {busy ? "送信中…" : pair.decisionOpen ? "この内容で送信する →" : "22時から回答できます"}
          </ActionButton>
        </>
      )}
      <ActionButton variant="danger" onPress={() => setSafetyOpen(true)}>困ったとき・安全メニュー</ActionButton>
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
