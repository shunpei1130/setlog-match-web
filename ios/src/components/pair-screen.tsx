import { ActionButton, Card, Eyebrow, Lead, Title } from "@/components/ui";
import { SafetyModal } from "@/components/safety-modal";
import { colors } from "@/theme";
import type { RemotePair } from "@/types";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export function PairScreen({
  pair,
  busy,
  setlogOpen,
  onOpenSetlog,
  onCloseSetlog,
  onDecision,
  onBlock,
  onReport,
}: {
  pair: RemotePair;
  busy: boolean;
  setlogOpen: boolean;
  onOpenSetlog: () => void;
  onCloseSetlog: () => void;
  onDecision: () => void;
  onBlock: () => Promise<void>;
  onReport: (reason: string, detail: string) => Promise<void>;
}) {
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!pair.setlogCode) return;
    await Clipboard.setStringAsync(pair.setlogCode);
    setCopied(true);
  };

  if (setlogOpen) {
    return (
      <View style={styles.container}>
        <Eyebrow>04 / SETLOG ROOM</Eyebrow>
        <Title>一日の普通を、{`\n`}見せ合う。</Title>
        <Lead>12:00から22:00までSetlogで土曜日を共有します。連絡先の話は、夜の判定までしなくて大丈夫です。</Lead>
        <Card accent>
          <Text style={styles.cardLabel}>TODAY&apos;S ROOM</Text>
          <View style={styles.roomRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{pair.candidate.nickname.slice(0, 1)}</Text></View>
            <View style={styles.roomBody}>
              <Text style={styles.roomTitle}>あなた × {pair.candidate.nickname}さん</Text>
              <Text style={styles.roomMeta}>12:00 — 22:00 / 一日のログ</Text>
            </View>
          </View>
          <View style={styles.codeBox}>
            <Text style={styles.cardLabel}>参加コード</Text>
            <Text selectable style={styles.code}>{pair.setlogCode ?? "未設定"}</Text>
            {pair.setlogCode ? (
              <ActionButton variant="secondary" onPress={() => void copyCode()}>{copied ? "コピーしました" : "コードをコピー"}</ActionButton>
            ) : null}
          </View>
          {pair.setlogUrl ? (
            <ActionButton onPress={() => void Linking.openURL(pair.setlogUrl!)}>Setlogを開く ↗</ActionButton>
          ) : null}
        </Card>
        <Card>
          <Text style={styles.nextLabel}>NEXT / 22:00</Text>
          <Text style={styles.nextTitle}>夜に非公開判定</Text>
          <Text style={styles.nextCopy}>Instagram、LINE、もう一日、何も教えない。回答内容は相手に表示されません。</Text>
        </Card>
        <ActionButton disabled={!pair.decisionOpen} onPress={onDecision}>
          {pair.decisionOpen ? "夜の判定へ進む →" : "22時から回答できます"}
        </ActionButton>
        <ActionButton variant="secondary" onPress={onCloseSetlog}>Day Pairへ戻る</ActionButton>
        <ActionButton variant="danger" onPress={() => setSafetyOpen(true)}>困ったとき・安全メニュー</ActionButton>
        <SafetyModal visible={safetyOpen} busy={busy} onClose={() => setSafetyOpen(false)} onBlock={onBlock} onReport={onReport} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Eyebrow>04 / TODAY&apos;S DAY PAIR</Eyebrow>
      <Title>今日の相手は、{`\n`}{pair.candidate.nickname}さん。</Title>
      <Lead>お互いの条件が合ったため、本日のDay Pairになりました。</Lead>
      <View style={styles.profile}>
        <View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{pair.candidate.nickname.slice(0, 1)}</Text></View>
        <View style={styles.profileBody}>
          <Text style={styles.profileName}>{pair.candidate.nickname}さん</Text>
          <Text style={styles.profileMeta}>{pair.candidate.faculty}</Text>
          <Text style={styles.profileMeta}>{pair.candidate.academicYear} / {genderLabel(pair.candidate.gender)}</Text>
        </View>
      </View>
      <View style={styles.timeline}>
        <Timeline time="12:00" title="Day Pair成立" copy="今日の相手だけをお知らせします。" current={false} />
        <Timeline time="12—22" title="Setlogで共有" copy="連絡先はまだ聞かず、普通の一日を見せ合います。" current />
        <Timeline time="22:00" title="非公開判定" copy="続けたいものをアプリだけで選びます。" current={false} />
      </View>
      <Card accent>
        <Text style={styles.ruleTitle}>このDay Pairは本日23時に終了します。</Text>
        <Text style={styles.ruleCopy}>続けるかどうかは、夜にお互いが非公開で選択します。</Text>
      </Card>
      <ActionButton onPress={onOpenSetlog}>Setlogにつなぐ ↗</ActionButton>
      <ActionButton variant="danger" onPress={() => setSafetyOpen(true)}>困ったとき・安全メニュー</ActionButton>
      <SafetyModal visible={safetyOpen} busy={busy} onClose={() => setSafetyOpen(false)} onBlock={onBlock} onReport={onReport} />
    </View>
  );
}

function Timeline({ time, title, copy, current }: { time: string; title: string; copy: string; current: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <Text style={styles.timelineTime}>{time}</Text>
      <View style={[styles.timelineDot, current && styles.timelineDotCurrent]} />
      <View style={styles.timelineBody}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function genderLabel(gender: string) {
  return gender === "male" ? "男性" : gender === "female" ? "女性" : "その他";
}

const styles = StyleSheet.create({
  container: { paddingTop: 28 },
  profile: { flexDirection: "row", alignItems: "center", gap: 15, borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.ink, paddingVertical: 18, marginBottom: 24 },
  avatarLarge: { width: 76, height: 76, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarLargeText: { color: colors.ink, fontSize: 29, fontWeight: "900" },
  profileBody: { flex: 1, gap: 3 },
  profileName: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  profileMeta: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  timeline: { marginBottom: 8 },
  timelineRow: { minHeight: 86, flexDirection: "row", alignItems: "flex-start" },
  timelineTime: { width: 58, color: colors.inkSoft, fontSize: 10, fontWeight: "800", paddingTop: 2 },
  timelineDot: { width: 12, height: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.ink, marginTop: 2, marginRight: 15 },
  timelineDotCurrent: { backgroundColor: colors.accent },
  timelineBody: { flex: 1, borderLeftWidth: 2, borderLeftColor: colors.ink, paddingLeft: 15, paddingBottom: 22, marginLeft: -22 },
  timelineTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  timelineCopy: { color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginTop: 5 },
  ruleTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  ruleCopy: { color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginTop: 5 },
  cardLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  roomRow: { flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 2, borderBottomColor: colors.ink, paddingVertical: 18 },
  avatar: { width: 58, height: 58, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  roomBody: { flex: 1 },
  roomTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  roomMeta: { color: colors.inkSoft, fontSize: 11, marginTop: 4 },
  codeBox: { paddingTop: 16 },
  code: { color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: 2, marginTop: 6 },
  nextLabel: { color: colors.accentDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  nextTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 7 },
  nextCopy: { color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginTop: 5 },
});
