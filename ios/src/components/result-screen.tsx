import { ActionButton, Card, Eyebrow, Lead, Title } from "@/components/ui";
import { colors } from "@/theme";
import type { PairResult, RemotePair } from "@/types";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export function ResultScreen({ pair, onSignOut }: { pair: RemotePair; onSignOut: () => Promise<void> }) {
  const result = pair.result as PairResult;
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopied(label);
  };

  return (
    <View style={styles.container}>
      {result.kind === "disclosed" ? (
        <>
          <Eyebrow>06 / MUTUAL MATCH</Eyebrow>
          <Title>お互いに、{`\n`}同じものを選びました。</Title>
          <Lead>一致した連絡先だけを開示します。片方だけが選んだ項目は表示されません。</Lead>
          {result.items.includes("instagram") && result.contacts?.instagram ? (
            <ContactCard label="Instagram" value={`@${result.contacts.instagram}`} copied={copied === "Instagram"} onCopy={() => void copy("Instagram", result.contacts!.instagram!)} />
          ) : null}
          {result.items.includes("line") && result.contacts?.line ? (
            <ContactCard label="LINE" value={result.contacts.line} copied={copied === "LINE"} onCopy={() => void copy("LINE", result.contacts!.line!)} />
          ) : null}
        </>
      ) : result.kind === "continued" ? (
        <>
          <Eyebrow>06 / ONE MORE DAY</Eyebrow>
          <Title>もう一日だけ、{`\n`}続けてみる。</Title>
          <Lead>連絡先を交換する前に、次回もう一度だけSetlogで一日を共有します。</Lead>
          <Card accent>
            <Text style={styles.resultIcon}>↻</Text>
            <Text style={styles.resultTitle}>次回のDay Pair候補にしました</Text>
            <Text style={styles.resultCopy}>相手にも同じ結果だけが表示されます。</Text>
          </Card>
        </>
      ) : (
        <>
          <Eyebrow>06 / DAY PAIR COMPLETE</Eyebrow>
          <Title>今回のDay Pairは、{`\n`}ここで終了です。</Title>
          <Lead>相手の選択内容や不成立の理由は、お互いに表示されません。</Lead>
          <Card accent>
            <Text style={styles.resultIcon}>○</Text>
            <Text style={styles.resultTitle}>後腐れなく、今日はここまで</Text>
            <Text style={styles.resultCopy}>この相手は再推薦されません。</Text>
          </Card>
        </>
      )}
      <ActionButton onPress={() => void onSignOut()}>完了してログアウト</ActionButton>
    </View>
  );
}

function ContactCard({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <Card>
      <Text style={styles.contactLabel}>{label}</Text>
      <Text selectable style={styles.contactValue}>{value}</Text>
      <ActionButton variant="secondary" onPress={onCopy}>{copied ? "コピーしました" : "コピーする"}</ActionButton>
    </Card>
  );
}

export function EndedScreen({ notice, onSignOut }: { notice: string | null; onSignOut: () => Promise<void> }) {
  return (
    <View style={styles.container}>
      <Eyebrow>SAFETY FIRST</Eyebrow>
      <Title>接続を、{`\n`}終了しました。</Title>
      <Lead>{notice ?? "このDay Pairは終了しました。相手の情報はこれ以上表示されません。"}</Lead>
      <Card accent>
        <Text style={styles.resultIcon}>✓</Text>
        <Text style={styles.resultTitle}>あなたの判断を尊重します</Text>
        <Text style={styles.resultCopy}>再推薦と通知は停止されています。</Text>
      </Card>
      <ActionButton onPress={() => void onSignOut()}>最初の画面へ</ActionButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 34 },
  resultIcon: { color: colors.ink, fontSize: 30, fontWeight: "900" },
  resultTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 8 },
  resultCopy: { color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginTop: 5 },
  contactLabel: { color: colors.accentDark, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  contactValue: { color: colors.ink, fontSize: 23, fontWeight: "900", marginTop: 9 },
});
