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
  const [inviteInput, setInviteInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [openedSetlog, setOpenedSetlog] = useState(false);

  // Reset the invite panel's local state when a different invite arrives
  // (e.g. the partner replaces the code). Adjusting state during render is
  // the React-recommended pattern for prop-derived resets.
  const [lastInviteCode, setLastInviteCode] = useState(pair.setlogCode);
  if (lastInviteCode !== pair.setlogCode) {
    setLastInviteCode(pair.setlogCode);
    setEditing(false);
    setOpenedSetlog(false);
    setCopied(false);
  }

  const copyCode = async () => {
    if (!pair.setlogCode) return;
    await Clipboard.setStringAsync(pair.setlogCode);
    setCopied(true);
  };

  const openSetlog = async () => {
    setOpenedSetlog(true);
    if (pair.setlogUrl) await Linking.openURL(pair.setlogUrl);
  };

  const invite = pair.invite;
  const inviteReady = invite ? invite.status === "ready" : Boolean(pair.setlogCode);
  const submittedByMe = invite?.submittedByMe ?? false;
  const joined = invite?.joined ?? false;
  const partnerJoined = Boolean(inviteReady && submittedByMe && invite && !invite.canEdit);
  const step2Done = joined || partnerJoined;
  const inviteStep = !inviteReady ? 1 : step2Done ? 3 : 2;

  const renderInvitePanel = () => {
    if (!inviteReady) {
      const mine = Boolean(invite?.suggestedCreator);
      return (
        <View style={styles.panel}>
          <TurnPill mine={mine} />
          <Text style={styles.ruleCopy}>{mine
            ? "Setlogで今日のログを作り、招待コードをここに貼ってください。先に送った人が共有者になります。"
            : "相手が招待を共有する番です。待っていても、あなたが先に共有しても大丈夫です。"}</Text>
          <Field label="Setlogの招待リンク・招待コード" value={inviteInput} onChangeText={setInviteInput} autoCapitalize="none" autoCorrect={false} placeholder="例：https://setlog.kr/invite/…" />
          <Text style={styles.helpCopy}>Setlogの共有文を、set-mob公式LINEに送っても登録できます。</Text>
          <ActionButton disabled={busy || !inviteInput.trim()} onPress={() => void onSaveInvite(inviteInput)}>{busy ? "送信中…" : "招待コードを相手に送る"}</ActionButton>
        </View>
      );
    }
    if (joined) {
      return <DoneBlock title="Setlogに参加しました" copy="招待を共有した相手にも伝わっています。一日を共有したら、22時にここへ戻ってきてください。" />;
    }
    if (submittedByMe && partnerJoined) {
      return <DoneBlock title="相手がSetlogに参加しました" copy="一日を共有したら、22時にここへ戻ってきてください。" />;
    }
    if (submittedByMe && invite?.canEdit) {
      if (editing) {
        return (
          <View style={styles.panel}>
            <Field label="Setlogの招待コードかリンク" value={inviteInput} onChangeText={setInviteInput} autoCapitalize="none" autoCorrect={false} placeholder="例：https://setlog.kr/invite/…" />
            <ActionButton disabled={busy || !inviteInput.trim()} onPress={() => void onSaveInvite(inviteInput)}>{busy ? "送信中…" : "招待を変更して送り直す"}</ActionButton>
            <ActionButton variant="secondary" onPress={() => setEditing(false)}>変更しない</ActionButton>
          </View>
        );
      }
      return (
        <View style={styles.panel}>
          <TurnPill mine={false} />
          <Text style={styles.cardLabel}>送った招待コード</Text>
          <Text selectable style={styles.code}>{pair.setlogCode}</Text>
          <Text style={styles.ruleTitle}>相手の参加を待っています</Text>
          <Text style={styles.ruleCopy}>相手がSetlogに参加すると、LINEでお知らせします。</Text>
          <ActionButton variant="secondary" disabled={busy} onPress={() => void onConfirmJoined()}>Setlogに参加した</ActionButton>
          <ActionButton variant="secondary" onPress={() => { setInviteInput(pair.setlogUrl ?? ""); setEditing(true); }}>招待を変更する</ActionButton>
        </View>
      );
    }
    if (!submittedByMe) {
      return (
        <View style={styles.panel}>
          <TurnPill mine />
          <Text style={styles.ruleCopy}>コードを使ってSetlogに参加したら、「Setlogに参加した」を押してください。相手に伝わります。</Text>
          <Text style={styles.cardLabel}>Setlogの招待コード</Text>
          <Text selectable style={styles.code}>{pair.setlogCode}</Text>
          {!openedSetlog ? (
            <>
              <ActionButton onPress={() => void openSetlog()}>Setlogを開く</ActionButton>
              <ActionButton variant="secondary" onPress={() => void copyCode()}>{copied ? "コピーしました" : "コードをコピーする"}</ActionButton>
            </>
          ) : (
            <>
              <ActionButton disabled={busy} onPress={() => void onConfirmJoined()}>Setlogに参加した</ActionButton>
              <ActionButton variant="secondary" onPress={() => void openSetlog()}>Setlogを開く</ActionButton>
              <ActionButton variant="secondary" onPress={() => void copyCode()}>{copied ? "コピーしました" : "コードをコピーする"}</ActionButton>
            </>
          )}
        </View>
      );
    }
    return (
      <View style={styles.panel}>
        <Text style={styles.cardLabel}>送った招待コード</Text>
        <Text selectable style={styles.code}>{pair.setlogCode}</Text>
        <Text style={styles.ruleCopy}>招待は共有済みです。相手の参加確認は23:00までできます。</Text>
      </View>
    );
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
          <InviteSteps current={inviteStep} />
          {renderInvitePanel()}
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

function TurnPill({ mine }: { mine: boolean }) {
  return (
    <View style={[styles.pill, mine ? styles.pillMine : styles.pillPartner]}>
      <Text style={styles.pillText}>{mine ? "今はあなたの番です" : "相手の番です"}</Text>
    </View>
  );
}

function DoneBlock({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.doneRow}>
      <Text style={styles.doneMark}>✓</Text>
      <View style={styles.doneBody}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function InviteSteps({ current }: { current: number }) {
  const steps = [
    { n: 1, title: "招待を共有する" },
    { n: 2, title: "Setlogで参加する" },
    { n: 3, title: "22:00〜23:00に回答する" },
  ];
  return (
    <View style={styles.steps} accessibilityLabel={`共有の手順、ステップ${current}`}>
      {steps.map((step) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <View key={step.n} style={styles.stepRow}>
            <Text style={[styles.stepLabel, done && styles.stepDone, active && styles.stepActive]}>{done ? `STEP ${step.n} ✓` : `STEP ${step.n}`}</Text>
            <Text style={[styles.stepTitle, !active && !done && styles.stepUpcoming]}>{step.title}</Text>
          </View>
        );
      })}
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
  code: { color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: 2, marginTop: 6 },
  panel: { paddingTop: 16 },
  pill: { alignSelf: "flex-start", borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 10 },
  pillMine: { backgroundColor: colors.accent },
  pillPartner: { backgroundColor: colors.surfaceMuted },
  pillText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  helpCopy: { color: colors.inkSoft, fontSize: 11, lineHeight: 17, marginBottom: 6 },
  steps: { paddingTop: 16, gap: 8 },
  stepRow: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  stepLabel: { width: 66, color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  stepActive: { color: colors.accentDark },
  stepDone: { color: colors.success },
  stepTitle: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  stepUpcoming: { color: colors.inkSoft, fontWeight: "700" },
  doneRow: { flexDirection: "row", gap: 10, paddingTop: 16 },
  doneMark: { color: colors.success, fontSize: 18, fontWeight: "900" },
  doneBody: { flex: 1 },
  nextLabel: { color: colors.accentDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  nextTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 7 },
  nextCopy: { color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginTop: 5 },
});
