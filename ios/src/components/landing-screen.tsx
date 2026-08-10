import { ActionButton, Card, Eyebrow, Lead, Title } from "@/components/ui";
import { colors } from "@/theme";
import { StyleSheet, Text, View } from "react-native";

export function LandingScreen({ onStart }: { onStart: () => void }) {
  return (
    <View style={styles.container}>
      <Eyebrow>AOYAMA STUDENTS / SATURDAY</Eyebrow>
      <Title>知らない誰かの、{`\n`}土曜日を読む。</Title>
      <Lead>
        連絡先から始めない、青学生限定の一日。毎週土曜、ひとりのDay PairとSetlogで日常を共有します。
      </Lead>
      <ActionButton onPress={onStart}>次の土曜に事前登録する →</ActionButton>
      <Card accent>
        <Text style={styles.cardLabel}>NEXT SATURDAY</Text>
        <Text style={styles.time}>12:00</Text>
        <Text style={styles.cardTitle}>一日だけのDay Pair</Text>
        <Text style={styles.cardCopy}>夜までは連絡先を聞かず、22時にお互いが非公開で選びます。</Text>
      </Card>
      <View style={styles.rules}>
        <Rule number="01" title="青学生限定" body="学校メールで所属を確認します。" />
        <Rule number="02" title="回答は非公開" body="片方だけの希望や順位は表示しません。" />
        <Rule number="03" title="いつでも終了できる" body="ブロックと通報は理由の説明なしで使えます。" />
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
