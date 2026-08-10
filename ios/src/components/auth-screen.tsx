import { ActionButton, BusyButton, Card, Eyebrow, Field, Lead, Notice, Title } from "@/components/ui";
import { ApiError, mobileApi } from "@/lib/api";
import { colors } from "@/theme";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

const EMAIL_ADDRESS_PATTERN = /^[^@\s]+@[^@\s]+$/i;

export function AuthScreen({
  busy,
  onBack,
  onVerify,
}: {
  busy: boolean;
  onBack: () => void;
  onVerify: (email: string, code: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requestCode = async () => {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_ADDRESS_PATTERN.test(normalized)) {
      setMessage("メールアドレスを入力してください。");
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const result = await mobileApi.requestCode(normalized);
      setSent(true);
      setMessage(result.retryAfter
        ? `すでに送信済みです。${result.retryAfter}秒後に再送できます。`
        : "6桁の認証コードを送信しました。");
    } catch (error) {
      setMessage(error instanceof ApiError && error.code === "AOYAMA_EMAIL_REQUIRED"
        ? "登録対象のメールアドレスを確認してください。"
        : "認証コードを送信できませんでした。");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Eyebrow>01 / SCHOOL EMAIL</Eyebrow>
      <Title>青学生であることを、{`\n`}メールで確認。</Title>
      <Lead>大学のメールアドレスへ6桁のコードを送ります。パスワードは使いません。</Lead>
      {message ? <Notice>{message}</Notice> : null}
      <Card>
        <Field
          label="登録メールアドレス"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="name@example.com"
          value={email}
          onChangeText={setEmail}
          editable={!sent}
        />
        {sent ? (
          <Field
            label="6桁の認証コード"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
          />
        ) : null}
        {sent ? (
          <BusyButton
            busy={busy}
            busyLabel="確認中…"
            disabled={code.length !== 6}
            onPress={() => void onVerify(email.trim().toLowerCase(), code)}
          >認証して続ける →</BusyButton>
        ) : (
          <BusyButton busy={sending} busyLabel="送信中…" onPress={() => void requestCode()}>
            認証コードを送る
          </BusyButton>
        )}
      </Card>
      <Text style={styles.privacy}>認証済みメールは所属確認と運営連絡にのみ使用します。</Text>
      <ActionButton variant="secondary" onPress={onBack}>最初の画面へ戻る</ActionButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 34 },
  privacy: { color: colors.inkSoft, fontSize: 11, lineHeight: 18, textAlign: "center", marginBottom: 8 },
});
