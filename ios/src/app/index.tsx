import { AuthScreen } from "@/components/auth-screen";
import { DecisionScreen } from "@/components/decision-screen";
import { LandingScreen } from "@/components/landing-screen";
import { PairScreen } from "@/components/pair-screen";
import { RegistrationScreen } from "@/components/registration-screen";
import { EndedScreen, ResultScreen } from "@/components/result-screen";
import { AppHeader, Notice, Page, Progress } from "@/components/ui";
import { WaitingScreen } from "@/components/waiting-screen";
import { useApp } from "@/context/app-context";
import { colors } from "@/theme";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";

export default function HomeScreen() {
  const app = useApp();

  return (
    <Page>
      <AppHeader signedIn={Boolean(app.user)} onSignOut={() => void app.signOut()} onSettings={() => router.push("/settings" as Href)} />
      {app.isReview ? <Notice>審査用アカウント / 架空データ</Notice> : null}
      <Progress phase={app.phase === "waiting" && app.event?.matchingStatus === "unmatched" ? "result" : app.phase} />
      {app.notice && app.phase !== "ended" ? <Notice onDismiss={app.dismissNotice}>{app.notice}</Notice> : null}
      {app.phase === "booting" ? <LoadingScreen /> : null}
      {app.phase === "landing" ? <LandingScreen onStart={app.beginAuth} /> : null}
      {app.phase === "auth" ? (
        <AuthScreen busy={app.busy} onBack={app.backToLanding} onVerify={app.verifyCode} />
      ) : null}
      {app.phase === "registration" && app.user ? (
        <RegistrationScreen
          key={app.event?.eventKey}
          user={app.user}
          initialProfile={app.event?.registration ?? app.event?.previousRegistration}
          line={app.line}
          busy={app.busy}
          onConnectLine={app.connectLine}
          onRefresh={() => app.refresh()}
          onRegister={app.register}
        />
      ) : null}
      {app.phase === "waiting" && app.event ? (
        <WaitingScreen
          event={app.event}
          busy={app.busy}
          onStart={app.startMatching}
          onCancel={app.cancelRegistration}
          onNext={app.nextEvent}
        />
      ) : null}
      {app.phase === "pair" && app.pair ? (
        <PairScreen
          pair={app.pair}
          busy={app.busy}
          setlogOpen={app.setlogOpen}
          onOpenSetlog={app.openSetlog}
          onSaveInvite={app.saveInvite}
          onConfirmJoined={app.confirmJoined}
          onCloseSetlog={app.closeSetlog}
          onDecision={app.openDecision}
          onBlock={app.blockPair}
          onReport={app.reportPair}
        />
      ) : null}
      {app.phase === "decision" && app.pair && app.user ? (
        <DecisionScreen
          pair={app.pair}
          user={app.user}
          busy={app.busy}
          onSubmit={app.submitDecision}
          onRefresh={() => app.refresh()}
          onBlock={app.blockPair}
          onReport={app.reportPair}
        />
      ) : null}
      {app.phase === "result" && app.pair?.result ? (
        <ResultScreen pair={app.pair} onSignOut={app.signOut} onCancelExtension={app.cancelExtension} onNext={app.nextEvent} />
      ) : null}
      {app.phase === "ended" ? <EndedScreen notice={app.notice} onSignOut={app.signOut} onNext={app.nextEvent} /> : null}
    </Page>
  );
}

function LoadingScreen() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="読み込み中" style={styles.loading}>
      <ActivityIndicator color={colors.accentDark} size="large" />
      <Text style={styles.loadingText}>参加状況を確認しています…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 480, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { color: colors.inkSoft, fontSize: 13, fontWeight: "800" },
});
