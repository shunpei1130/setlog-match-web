import { ActionButton, BusyButton, Card, Eyebrow, Lead, Title } from "@/components/ui";
import { colors } from "@/theme";
import type { EventState } from "@/types";
import { StyleSheet, Text, View } from "react-native";

export function WaitingScreen({
  event,
  busy,
  onStart,
  onCancel,
  onNext,
}: {
  event: EventState;
  busy: boolean;
  onStart: () => Promise<void>;
  onCancel: () => Promise<void>;
  onNext?: () => Promise<void>;
}) {
  const eventDate = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(event.startsAt));

  if (event.matchingStatus === "unmatched") return <View style={styles.container}><Eyebrow>今回の参加</Eyebrow><Title style={styles.unmatchedTitle}>今回は相手が{`\n`}見つかりませんでした。</Title><Lead>お互いの希望が合う相手がいなかったため、今回の参加は終了しました。また次の土曜に参加できます。</Lead>{onNext ? <ActionButton disabled={busy} onPress={() => void onNext()}>次の土曜の参加を確認する</ActionButton> : null}</View>;

  return (
    <View style={styles.container}>
      <Eyebrow>参加登録が完了しました</Eyebrow>
      <Title>{event.kind === "extension" ? "日曜日も、" : "土曜日の12時を、"}{`\n`}{event.kind === "extension" ? "同じ相手と。" : "お楽しみに。"}</Title>
      <Lead>{event.kind === "extension" ? "ふたりとも続けることを希望したので、同じ相手との日曜の参加を予約しました。" : "お互いの希望が合う相手がいれば、開始時刻にお知らせします。"}</Lead>
      <Card accent>
        <View style={styles.cardHeader}>
          <Text style={styles.status}>● 参加登録済み</Text>
          <Text style={styles.issue}>{eventDate}</Text>
        </View>
        <Text style={styles.time}>12:00</Text>
        <Text style={styles.timeLabel}>{event.kind === "extension" ? "同じ相手と、もう一日" : "今日の相手をお知らせ"}</Text>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{event.kind === "extension" ? "Setlogは、そのままで" : "金曜21時にLINEでご案内"}</Text>
          <Text style={styles.sectionCopy}>{event.kind === "extension" ? "同じSetlogのログと招待コードを使います。" : "連携したLINEに、土曜の参加案内が届きます。"}</Text>
        </View>
        {event.kind !== "extension" ? <View style={styles.section}>
          <Text style={styles.countLabel}>定員{event.capacity}人</Text>
          <Text style={styles.count}>残り {event.remaining} 枠</Text>
          <Text style={styles.sectionCopy}>現在{event.count}人が参加登録しています。</Text>
        </View> : null}
      </Card>
      <BusyButton busy={busy} busyLabel="ペアを確認中…" onPress={() => void onStart()}>
        今日の相手を確認する
      </BusyButton>
      {event.canCancel ? (
        <ActionButton
          disabled={busy}
          variant="secondary"
          onPress={() => void onCancel()}
        >
          {busy ? "キャンセル中…" : "今回の参加をキャンセルする"}
        </ActionButton>
      ) : null}
      <Text style={styles.note}>{event.matchingStatus === "processing" ? "お互いの希望が合う相手を探しています。少し待ってから、もう一度確認してください。" : "開始時刻になると、自動で参加状況を確認します。"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 28 },
  unmatchedTitle: { fontSize: 32, lineHeight: 38 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  status: { color: colors.success, fontSize: 11, fontWeight: "900" },
  issue: { color: colors.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  time: { color: colors.ink, fontSize: 54, lineHeight: 60, fontWeight: "900", letterSpacing: -3, marginTop: 22 },
  timeLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: "800", marginBottom: 18 },
  section: { borderTopWidth: 2, borderTopColor: colors.ink, paddingTop: 15, marginTop: 15 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  sectionCopy: { color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginTop: 4 },
  countLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  count: { color: colors.ink, fontSize: 27, fontWeight: "900", letterSpacing: -1, marginTop: 5 },
  note: { color: colors.inkSoft, fontSize: 11, lineHeight: 18, textAlign: "center", marginTop: 12 },
});
