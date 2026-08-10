import { BusyButton, Card, Eyebrow, Lead, Title } from "@/components/ui";
import { colors } from "@/theme";
import type { EventState } from "@/types";
import { StyleSheet, Text, View } from "react-native";

export function WaitingScreen({
  event,
  busy,
  onStart,
}: {
  event: EventState;
  busy: boolean;
  onStart: () => Promise<void>;
}) {
  return (
    <View style={styles.container}>
      <Eyebrow>03 / RESERVED</Eyebrow>
      <Title>次の土曜を、{`\n`}待っています。</Title>
      <Lead>参加枠を確保しました。運営がDay Pairを公開すると、ここから今日の相手を確認できます。</Lead>
      <Card accent>
        <View style={styles.cardHeader}>
          <Text style={styles.status}>● 事前登録済み</Text>
          <Text style={styles.issue}>NEXT SATURDAY</Text>
        </View>
        <Text style={styles.time}>12:00</Text>
        <Text style={styles.timeLabel}>マッチング開始</Text>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>金曜21:00にLINEで案内</Text>
          <Text style={styles.sectionCopy}>「明日はマッチング！」と参加確認をお送りします。</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.countLabel}>初回募集 / {event.capacity}人限定</Text>
          <Text style={styles.count}>残り {event.remaining} 枠</Text>
          <Text style={styles.sectionCopy}>現在{event.count}人が次回土曜に参加予定です。</Text>
        </View>
      </Card>
      <BusyButton busy={busy} busyLabel="ペアを確認中…" onPress={() => void onStart()}>
        土曜のマッチングを開始する →
      </BusyButton>
      <Text style={styles.note}>ペアが未公開の場合は、この画面でそのままお待ちください。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 28 },
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
