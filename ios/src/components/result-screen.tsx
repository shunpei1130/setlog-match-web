import { ActionButton, Card, Eyebrow, Lead, Title } from "@/components/ui";
import { colors } from "@/theme";
import type { PairResult, RemotePair } from "@/types";
import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export function ResultScreen({ pair, onSignOut, onCancelExtension, onNext }: { pair: RemotePair; onSignOut: () => Promise<void>; onCancelExtension?: () => Promise<void>; onNext?: () => Promise<void> }) {
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
          <Eyebrow>連絡先の交換</Eyebrow>
          <Title>ふたりとも、{`\n`}交換を希望しました。</Title>
          <Lead>お互いが選んだ連絡先だけを表示しています。片方だけが選んだ項目は表示されません。</Lead>
          {result.items.includes("instagram") && result.contacts?.instagram ? (
            <ContactCard label="Instagram" value={`@${result.contacts.instagram}`} copied={copied === "Instagram"} onCopy={() => void copy("Instagram", result.contacts!.instagram!)} />
          ) : null}
          {result.items.includes("line") && result.contacts?.line ? (
            <ContactCard label="LINE" value={result.contacts.line} copied={copied === "LINE"} onCopy={() => void copy("LINE", result.contacts!.line!)} />
          ) : null}
        </>
      ) : result.kind === "continued" ? (
        <>
          <Eyebrow>{pair.extension?.status === "cancelled" ? "日曜の参加" : "明日も、同じ相手と"}</Eyebrow>
          <Title>{pair.extension?.status === "cancelled" ? "日曜の参加は、" : "日曜日も、"}{`\n`}{pair.extension?.status === "cancelled" ? "キャンセルされました。" : "同じ相手と。"}</Title>
          <Lead>{pair.extension?.status === "cancelled" ? "同じ相手との日曜の参加を取り消しました。" : "ふたりとも、明日も続けることを希望しました。日曜12時から、同じSetlogのログで一日を共有します。"}</Lead>
          <Card accent>
            <Text style={styles.resultIcon}>↻</Text>
            <Text style={styles.resultTitle}>{pair.extension?.status === "cancelled" ? "日曜の参加予定はありません" : "日曜の参加を予約しました"}</Text>
            <Text style={styles.resultCopy}>相手にも同じ結果をお知らせしています。</Text>
          </Card>
        </>
      ) : (
        <>
          <Eyebrow>今日の参加は終了しました</Eyebrow>
          <Title>今日は、{`\n`}ここまで。</Title>
          <Lead>連絡先の交換や、翌日の参加はありません。お互いの回答や終了の理由は表示されません。</Lead>
          <Card accent>
            <Text style={styles.resultIcon}>○</Text>
            <Text style={styles.resultTitle}>一日の共有、おつかれさまでした</Text>
            <Text style={styles.resultCopy}>この相手が再び紹介されることはありません。</Text>
          </Card>
        </>
      )}
      {pair.extension?.canCancel && onCancelExtension ? <ActionButton variant="secondary" onPress={() => void onCancelExtension()}>日曜の参加をキャンセルする</ActionButton> : null}
      {(result.kind !== "continued" || pair.extension?.status === "cancelled") && onNext ? <ActionButton variant="secondary" onPress={() => void onNext()}>次の土曜の参加を確認する</ActionButton> : null}
      <Text style={styles.resultCopy}>set-mobのブロック・通報では、Setlog側の共有は停止できません。退出・ブロックはSetlogで操作してください。</Text>
      <ActionButton onPress={() => void onSignOut()}>ログアウトする</ActionButton>
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

export function EndedScreen({ notice, onSignOut, onNext }: { notice: string | null; onSignOut: () => Promise<void>; onNext?: () => Promise<void> }) {
  return (
    <View style={styles.container}>
      <Eyebrow>今日の参加は終了しました</Eyebrow>
      <Title>今回のやり取りは、{`\n`}ここで終了です。</Title>
      <Lead>{notice ?? "相手のプロフィールや連絡先は、これ以上表示されません。"}</Lead>
      <Card accent>
        <Text style={styles.resultIcon}>✓</Text>
        <Text style={styles.resultTitle}>この相手は再び紹介されません</Text>
        <Text style={styles.resultCopy}>set-mobのブロック・通報では、Setlog側の共有は停止できません。退出・ブロックはSetlogで操作してください。</Text>
      </Card>
      {onNext ? <ActionButton onPress={() => void onNext()}>次の土曜の参加を確認する</ActionButton> : null}
      <ActionButton variant="secondary" onPress={() => void onSignOut()}>ログアウトする</ActionButton>
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
