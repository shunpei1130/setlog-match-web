import { ActionButton, Card, Eyebrow, Field, Lead, Title } from "@/components/ui";
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
  onSaveInvite,
  onConfirmJoined,
}: {
  pair: RemotePair;
  busy: boolean;
  setlogOpen: boolean;
  onOpenSetlog: () => void;
  onCloseSetlog: () => void;
  onDecision: () => void;
  onBlock: () => Promise<void>;
  onReport: (reason: string, detail: string) => Promise<void>;
  onSaveInvite: (invite: string) => Promise<void>;
  onConfirmJoined: () => Promise<void>;
}) {
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState("");

  const copyCode = async () => {
    if (!pair.setlogCode) return;
    await Clipboard.setStringAsync(pair.setlogCode);
    setCopied(true);
  };

  if (setlogOpen) {
    return (
      <View style={styles.container}>
        <Eyebrow>Setlogで一日を共有</Eyebrow>
        <Title>いつもの一日を、{`\n`}見せ合おう。</Title>
        <Lead>12時から22時まで、Setlogで日常を共有します。連絡先を交換するかは、22時になってから選べます。</Lead>
        <Card accent>
          <Text style={styles.cardLabel}>今日の相手</Text>
          <View style={styles.roomRow}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{pair.candidate.nickname.slice(0, 1)}</Text></View>
            <View style={styles.roomBody}>
              <Text style={styles.roomTitle}>あなた × {pair.candidate.nickname}さん</Text>
              <Text style={styles.roomMeta}>12:00〜22:00</Text>
            </View>
          </View>
          <View style={styles.codeBox}>
            <Text style={styles.cardLabel}>招待コード</Text>
            {pair.setlogCode ? <Text selectable style={styles.code}>{pair.setlogCode}</Text> : <Text style={styles.ruleCopy}>{pair.invite?.suggestedCreator ? "Setlogで新しいログを作り、招待コードをここに入力して相手に送りましょう。" : "相手からの招待コードを待っています。あなたがSetlogでログを作って、招待することもできます。"}</Text>}
            {pair.setlogCode ? (
              <ActionButton variant="secondary" onPress={() => void copyCode()}>{copied ? "コピーしました" : "コードをコピーする"}</ActionButton>
            ) : null}
          </View>
          {pair.setlogUrl ? (
            <ActionButton variant={pair.decisionOpen ? "secondary" : "primary"} onPress={() => void Linking.openURL(pair.setlogUrl!)}>Setlogを開く</ActionButton>
          ) : null}
          {pair.setlogCode && !pair.invite?.joined ? <ActionButton disabled={busy} variant="secondary" onPress={() => void onConfirmJoined()}>Setlogに参加できました</ActionButton> : null}
          {pair.invite?.joined ? <Text style={styles.ruleCopy}>参加を確認しました。</Text> : null}
          {pair.invite?.canEdit ? <View style={styles.codeBox}><Field label={pair.setlogCode ? "招待コードを変更する" : "Setlogの招待リンク・招待コード"} value={invite} onChangeText={setInvite} autoCapitalize="none" autoCorrect={false} placeholder="招待リンクまたは英数字のコード" /><ActionButton variant={pair.setlogCode ? "secondary" : "primary"} disabled={busy || !invite.trim()} onPress={() => void onSaveInvite(invite)}>{busy ? "送信中…" : "招待コードを相手に送る"}</ActionButton></View> : null}
        </Card>
        <Card>
          <Text style={styles.nextLabel}>22時になったら</Text>
          <Text style={styles.nextTitle}>このあとどうするか、選ぼう。</Text>
          <Text style={styles.nextCopy}>{pair.kind === "extension" ? "連絡先を交換するか、今回はここで終えるかを選べます。" : "連絡先を交換する、明日も続ける、今回はここで終える、から選べます。"}回答は相手に表示されません。</Text>
        </Card>
        <ActionButton disabled={!pair.decisionOpen} onPress={onDecision}>
          {pair.decisionOpen ? "このあとの希望を選ぶ" : "22時から回答できます"}
        </ActionButton>
        <ActionButton variant="secondary" onPress={onCloseSetlog}>今日の相手に戻る</ActionButton>
        <Text style={styles.ruleCopy}>set-mobのブロック・通報では、Setlog側の共有は停止できません。退出・ブロックはSetlogで操作してください。</Text>
        <ActionButton variant="danger" onPress={() => setSafetyOpen(true)}>困ったときは</ActionButton>
        <SafetyModal visible={safetyOpen} busy={busy} onClose={() => setSafetyOpen(false)} onBlock={onBlock} onReport={onReport} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Eyebrow>今日の相手</Eyebrow>
      <Title>今日の相手が、{`\n`}決まりました。</Title>
      <Lead>お互いの希望が合いました。今日はこの方と、Setlogで一日を共有します。</Lead>
      <View style={styles.profile}>
        <View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{pair.candidate.nickname.slice(0, 1)}</Text></View>
        <View style={styles.profileBody}>
          <Text style={styles.profileName}>{pair.candidate.nickname}さん</Text>
          <Text style={styles.profileMeta}>{pair.candidate.faculty}</Text>
          <Text style={styles.profileMeta}>{pair.candidate.academicYear} / {genderLabel(pair.candidate.gender)}</Text>
        </View>
      </View>
      <View style={styles.timeline}>
        <Timeline time="12:00" title="今日の相手をお知らせ" copy="プロフィールを確認できます。" current={false} />
        <Timeline time="12〜22時" title="Setlogで一日を共有" copy="連絡先の交換を急がず、いつもの日常を見せ合いましょう。" current />
        <Timeline time="22:00" title="このあとの希望を選ぶ" copy="回答は相手に表示されません。" current={false} />
      </View>
      <Card accent>
        <Text style={styles.ruleTitle}>今日の参加は23時までです。</Text>
        <Text style={styles.ruleCopy}>22〜23時に、このあとの希望を選んでください。ふたりの回答がそろうと結果をお知らせします。</Text>
      </Card>
      <ActionButton onPress={pair.decisionOpen ? onDecision : onOpenSetlog}>{pair.decisionOpen ? "このあとの希望を選ぶ" : "Setlogで一日を共有する"}</ActionButton>
      {pair.decisionOpen ? <ActionButton variant="secondary" onPress={onOpenSetlog}>Setlogの参加情報を見る</ActionButton> : null}
      <ActionButton variant="danger" onPress={() => setSafetyOpen(true)}>困ったときは</ActionButton>
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
