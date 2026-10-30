import {
  ActionButton,
  BusyButton,
  Card,
  CheckRow,
  Eyebrow,
  Field,
  Lead,
  Notice,
  OptionGrid,
  Title,
} from "@/components/ui";
import { clearRegistrationDraft, readRegistrationDraft, saveRegistrationDraft } from "@/lib/storage";
import { colors } from "@/theme";
import type { EventRegistration, LineStatus, MobileUser, RegistrationInput } from "@/types";
import * as Linking from "expo-linking";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

type Draft = {
  nickname: string;
  faculty: string;
  academicYear: string;
  gender: string;
  purpose: string;
  preferredGender: string;
  ageConfirmed: boolean;
  rulesAccepted: boolean;
};

const emptyDraft: Draft = {
  nickname: "",
  faculty: "",
  academicYear: "",
  gender: "",
  purpose: "",
  preferredGender: "any",
  ageConfirmed: false,
  rulesAccepted: false,
};

const years = ["1年", "2年", "3年", "4年", "修士1年", "修士2年", "その他"].map((value) => ({ value, label: value }));
const genders = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "other", label: "その他" },
] as const;
const purposes = [
  { value: "friend", label: "友人" },
  { value: "romance", label: "恋愛" },
  { value: "either", label: "どちらでも" },
] as const;
const preferredGenders = [
  { value: "any", label: "問わない" },
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
  { value: "other", label: "その他" },
] as const;
const INSTAGRAM_PATTERN = /^[A-Za-z0-9._]{1,40}$/;

export function RegistrationScreen({
  user,
  line,
  busy,
  initialProfile,
  onConnectLine,
  onRefresh,
  onRegister,
}: {
  user: MobileUser;
  line: LineStatus | null;
  busy: boolean;
  initialProfile?: EventRegistration | null;
  onConnectLine: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onRegister: (input: RegistrationInput) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    ...emptyDraft,
    ...(initialProfile ? {
      nickname: initialProfile.nickname ?? "", faculty: initialProfile.faculty ?? "",
      academicYear: initialProfile.academicYear ?? "", gender: initialProfile.gender ?? "",
      purpose: initialProfile.purpose, preferredGender: initialProfile.preferredGender,
    } : {}),
  }));
  const [instagramHandle, setInstagramHandle] = useState(user.instagramHandle ?? "");
  const [lineContact, setLineContact] = useState(user.lineContact ?? "");
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void readRegistrationDraft<Draft>().then((saved) => {
      if (active && saved) setDraft({ ...emptyDraft, ...saved });
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (hydrated) void saveRegistrationDraft(draft);
  }, [draft, hydrated]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const submit = async () => {
    const nickname = draft.nickname.trim();
    const faculty = draft.faculty.trim();
    const instagram = instagramHandle.trim().replace(/^@/, "");
    if (!nickname || !faculty || !draft.academicYear || !draft.gender || !draft.purpose || !draft.preferredGender) {
      setError("プロフィールと、参加の目的・相手の性別の希望を入力してください。");
      return;
    }
    if (nickname.length > 20 || faculty.length > 40) {
      setError("ニックネームは20文字、学部は40文字以内で入力してください。");
      return;
    }
    if (instagram && !INSTAGRAM_PATTERN.test(instagram)) {
      setError("Instagramのユーザーネームを確認してください。");
      return;
    }
    if (lineContact.trim().length > 120) {
      setError("LINEの連絡先は120文字以内で入力してください。");
      return;
    }
    if (!draft.ageConfirmed || !draft.rulesAccepted) {
      setError("18歳以上であることと、安全ルールへの同意を確認してください。");
      return;
    }
    if (!line?.linked || !line.followed) {
      setError("LINEを連携し、set-mobの公式アカウントを友だち追加してください。");
      return;
    }
    const success = await onRegister({
      profile: {
        nickname,
        faculty,
        academicYear: draft.academicYear,
        gender: draft.gender,
      },
      preferences: {
        purpose: draft.purpose as RegistrationInput["preferences"]["purpose"],
        preferredGender: draft.preferredGender as RegistrationInput["preferences"]["preferredGender"],
      },
      contacts: {
        instagramHandle: instagram || null,
        lineContact: lineContact.trim() || null,
      },
      ageConfirmed: draft.ageConfirmed,
      rulesAccepted: draft.rulesAccepted,
    });
    if (success) await clearRegistrationDraft();
  };

  return (
    <View style={styles.container}>
      <Eyebrow>参加登録</Eyebrow>
      <Title>土曜に向けて、{`\n`}あなたのことを。</Title>
      <Lead>プロフィールと相手の希望を教えてください。連絡先は、ふたりとも交換を希望した場合だけ相手に表示されます。</Lead>
      {error ? <Notice onDismiss={() => setError(null)}>{error}</Notice> : null}

      <Card accent>
        <Text style={styles.verifiedLabel}>確認済みの大学メール</Text>
        <Text style={styles.verifiedEmail}>{user.email}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>プロフィール</Text>
        <Field label="ニックネーム（必須）" value={draft.nickname} maxLength={20} onChangeText={(value) => update("nickname", value)} />
        <Field label="学部（必須）" value={draft.faculty} maxLength={40} placeholder="例：経済学部" onChangeText={(value) => update("faculty", value)} />
        <OptionGrid label="学年（必須）" options={years} value={draft.academicYear} onChange={(value) => update("academicYear", value)} />
        <OptionGrid label="性別（必須）" options={genders} value={draft.gender} onChange={(value) => update("gender", value)} />
        <OptionGrid label="参加の目的（必須）" options={purposes} value={draft.purpose} onChange={(value) => update("purpose", value)} />
        <OptionGrid label="相手の性別の希望（必須）" options={preferredGenders} value={draft.preferredGender} onChange={(value) => update("preferredGender", value)} />
        <Text style={styles.sectionCopy}>お互いの希望が合う相手を紹介します。条件に合う相手がいない場合は、今回は参加できないことがあります。</Text>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>連絡先（任意）</Text>
        <Text style={styles.sectionCopy}>22時に、交換したい連絡先を選べます。ふたりとも選んだものだけを交換します。</Text>
        <Field label="Instagramのユーザーネーム" autoCapitalize="none" placeholder="例：your_name" value={instagramHandle} onChangeText={setInstagramHandle} />
        <Field label="LINEの連絡先" autoCapitalize="none" placeholder="LINE IDなど" value={lineContact} onChangeText={setLineContact} />
      </Card>

      <Card accent>
        <Text style={styles.sectionTitle}>LINEで参加案内を受け取る</Text>
        <Text style={styles.sectionCopy}>金曜21時に案内を送ります。LINE連携と、set-mobの公式アカウントの友だち追加が必要です。</Text>
        <View style={styles.lineStatus}>
          <View style={styles.lineBadge}><Text style={styles.lineBadgeText}>LINE</Text></View>
          <View style={styles.lineStatusBody}>
            <Text style={styles.lineStatusTitle}>{line?.linked ? "LINE連携済み" : "LINE未連携"}</Text>
            <Text style={styles.lineStatusCopy}>{line?.followed ? "友だち追加済み" : "set-mobの公式アカウントを友だち追加してください"}</Text>
          </View>
        </View>
        {!line?.linked ? (
          <BusyButton busy={busy} busyLabel="LINEを開いています…" onPress={() => void onConnectLine()}>
            LINEを連携する
          </BusyButton>
        ) : null}
        {line?.linked && !line.followed && line.officialAccountUrl ? (
          <ActionButton variant="secondary" onPress={() => void Linking.openURL(line.officialAccountUrl!)}>
            set-mobを友だち追加する
          </ActionButton>
        ) : null}
        {line?.linked && !line.followed ? (
          <ActionButton variant="secondary" onPress={() => void onRefresh()}>友だち追加を確認する</ActionButton>
        ) : null}
      </Card>

      <CheckRow
        checked={draft.ageConfirmed}
        title="18歳以上です"
        description="18歳以上の青学生が参加できます。"
        onPress={() => update("ageConfirmed", !draft.ageConfirmed)}
      />
      <CheckRow
        checked={draft.rulesAccepted}
        title="安全ルールに同意します"
        description="勧誘・金銭の要求・嫌がらせをせず、相手が終了を選んだときは尊重します。"
        onPress={() => update("rulesAccepted", !draft.rulesAccepted)}
      />
      <BusyButton busy={busy} busyLabel="保存中…" onPress={() => void submit()}>
        参加登録を完了する
      </BusyButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 28 },
  verifiedLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  verifiedEmail: { color: colors.ink, fontSize: 16, fontWeight: "900", marginTop: 7 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginBottom: 5 },
  sectionCopy: { color: colors.inkSoft, fontSize: 12, lineHeight: 19, marginBottom: 16 },
  lineStatus: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 2, borderTopColor: colors.ink, paddingTop: 14 },
  lineBadge: { width: 48, height: 40, backgroundColor: colors.success, borderWidth: 2, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  lineBadgeText: { color: colors.surface, fontSize: 10, fontWeight: "900" },
  lineStatusBody: { flex: 1 },
  lineStatusTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
  lineStatusCopy: { color: colors.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 3 },
});
