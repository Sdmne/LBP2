import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Ports the website's Trust & Safety page (frontend/src/ui.tsx's
// TrustSafety() component / TRUST_TEXT copy) into the app - audit
// 2026-09-13 (site-vs-app-audit-2026-09-13.docx, item 6) found the site
// has a dedicated Trust & Safety page and the app has no equivalent.
// Reached from Settings ("Trust & Safety" row, next to Terms & Privacy
// Policy). Fully static content, same as TermsScreen.tsx - no backend
// endpoint needed.
export default function TrustSafetyScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const checks: { heading: string; body: string }[] = [
    { heading: t("trustSafety.check1Heading"), body: t("trustSafety.check1Body") },
    { heading: t("trustSafety.check2Heading"), body: t("trustSafety.check2Body") },
    { heading: t("trustSafety.check3Heading"), body: t("trustSafety.check3Body") },
    { heading: t("trustSafety.check4Heading"), body: t("trustSafety.check4Body") },
    { heading: t("trustSafety.check5Heading"), body: t("trustSafety.check5Body") },
    { heading: t("trustSafety.check6Heading"), body: t("trustSafety.check6Body") },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <Text style={styles.intro}>{t("trustSafety.intro")}</Text>
      {checks.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
      <View style={[styles.section, styles.noteSection]}>
        <Text style={styles.heading}>{t("trustSafety.noteHeading")}</Text>
        <Text style={styles.body}>{t("trustSafety.noteBody")}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20, marginBottom: spacing.md },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  noteSection: { backgroundColor: colors.tintPink },
  heading: { fontSize: 16, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20 },
});
