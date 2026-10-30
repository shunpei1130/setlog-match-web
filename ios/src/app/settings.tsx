import { ActionButton, Field, Lead, Notice, Page, Title } from "@/components/ui";
import { useApp } from "@/context/app-context";
import { API_BASE_URL, REVIEW_API_BASE_URL } from "@/lib/api";
import { colors } from "@/theme";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

const scenarios = [
  ["registration", "参加登録"], ["paired", "今日の相手・Setlogへの招待"], ["decision", "今日の振り返り"],
  ["disclosed", "連絡先の交換"], ["unmatched", "相手が見つからなかった場合"], ["extension", "日曜も続ける場合"], ["ended", "回答期限を過ぎた場合"],
] as const;

export default function SettingsScreen() {
  const app = useApp();
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const goHome = () => router.dismissTo("/");
  const deleteAccount = async () => {
    setDeleting(true);
    try {
      if (await app.deleteAccount()) goHome();
    } finally {
      setDeleting(false);
    }
  };
  const open = (path: string) => void Linking.openURL(`${API_BASE_URL}${path}`);
  return <Page>
    <View style={styles.content}>
      <Title>設定・ヘルプ</Title>
      {app.notice ? <Notice onDismiss={app.dismissNotice}>{app.notice}</Notice> : null}
      <Lead>set-mobは独立して運営しており、青山学院大学・Setlogの公式・公認サービスではありません。</Lead>
      {([ ["利用規約", "/terms"], ["プライバシーポリシー", "/privacy"], ["安全ガイド", "/safety"], ["問い合わせ", "/contact"] ] as const).map(([label, path]) => <ActionButton key={path} variant="secondary" onPress={() => open(path)}>{label}</ActionButton>)}
      <Text style={styles.copy}>Setlogの利用には、Setlogのアカウントと対応するiPhoneが必要です。set-mobのブロック・通報では、Setlog側の共有は停止できません。退出・ブロックはSetlogで操作してください。</Text>
      {app.user ? <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>アカウント削除</Text>
        <Text style={styles.copy}>プロフィール・参加登録・回答・連絡先を削除します。日曜の参加予約も取り消されます。この操作は取り消せません。</Text>
        <Field label="確認のため「削除する」と入力" value={confirmation} onChangeText={setConfirmation} autoCorrect={false} />
        <ActionButton variant="danger" disabled={app.busy || deleting || confirmation !== "削除する"} onPress={() => void deleteAccount()}>{deleting ? "削除中…" : "アカウントを削除する"}</ActionButton>
      </View> : null}
      {app.isReview ? <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>審査用アカウント</Text>
        <Text style={styles.copy}>架空データの専用環境です。状態を切り替えると、このアカウントの確認用データをリセットします。</Text>
        {scenarios.map(([scenario, label]) => <ActionButton key={scenario} variant="secondary" disabled={app.busy} onPress={() => void app.reviewScenario(scenario).then(() => goHome())}>{label}</ActionButton>)}
        <ActionButton variant="secondary" disabled={app.busy} onPress={() => void app.signOut().then(() => goHome())}>審査を終了して本番へ戻る</ActionButton>
      </View> : !app.user && REVIEW_API_BASE_URL ? <View style={styles.section}>
        <ActionButton variant="secondary" onPress={() => setShowReview((shown) => !shown)}>審査用ログイン</ActionButton>
        {showReview ? <><Field label="審査用ユーザー名" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} /><Field label="審査用パスワード" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" /><ActionButton variant="secondary" disabled={app.busy || !username || !password} onPress={() => void app.reviewLogin(username, password).then((ok) => { setPassword(""); if (ok) goHome(); })}>審査用アカウントでログイン</ActionButton></> : null}
      </View> : null}
      <ActionButton onPress={() => goHome()}>参加画面へ戻る</ActionButton>
    </View>
  </Page>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 32, gap: 8 },
  section: { marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: colors.line, gap: 12 },
  heading: { fontSize: 20, fontWeight: "800", color: colors.ink },
  copy: { fontSize: 13, lineHeight: 21, color: colors.inkSoft, marginBottom: 12 },
});
