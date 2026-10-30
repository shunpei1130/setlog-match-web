import { ActionButton, Card, Eyebrow, Lead, Title } from "@/components/ui";
import { colors } from "@/theme";
import { StyleSheet, Text, View } from "react-native";

export function LandingScreen({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.container}>
      <Eyebrow>青学生の、土曜日。</Eyebrow>
      <Title>知らない青学生と、{`\n`}土曜日をシェア。</Title>
      <Lead>
        18歳以上の青学生限定。条件が合ったひとりと、Setlogで一日を共有します。参加は無料です。
      </Lead>
      <ActionButton onPress={onStart}>次の土曜に参加する</ActionButton>
      <Card accent>
        <Text style={styles.cardLabel}>次の土曜日</Text>
        <Text style={styles.time}>12:00</Text>
        <Text style={styles.cardTitle}>一日だけ、同じ相手と。</Text>
        <Text style={styles.cardCopy}>22時になったら、連絡先の交換や翌日も続けるかを選べます。回答は相手に表示されません。</Text>
      </Card>
      <View style={styles.rules}>
        <Rule number="01" title="青学生限定" body="大学のメールアドレスで確認します。" />
        <Rule number="02" title="お互いの希望が合ったときだけ" body="ふたりとも選んだ連絡先だけを交換します。" />
        <Rule number="03" title="いつでも終了できる" body="相手に理由を説明せず、ブロック・通報できます。" />
      </View>
    </View>
  );
}

function Rule({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <View style={styles.rule}>
      <Text style={styles.ruleNumber}>{number}</Text>
      <View style={styles.ruleBody}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleCopy}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 44 },
  cardLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  time: { color: colors.ink, fontSize: 76, lineHeight: 82, fontWeight: "900", letterSpacing: -6, marginTop: 8 },
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 4 },
  cardCopy: { color: colors.inkSoft, fontSize: 13, lineHeight: 21, marginTop: 7 },
  rules: { borderTopWidth: 2, borderTopColor: colors.ink, marginTop: 10 },
  rule: { minHeight: 88, flexDirection: "row", gap: 12, borderBottomWidth: 2, borderBottomColor: colors.ink, paddingVertical: 14 },
  ruleNumber: { color: colors.accentDark, fontSize: 11, fontWeight: "900", width: 30 },
  ruleBody: { flex: 1 },
  ruleTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  ruleCopy: { color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginTop: 4 },
});
