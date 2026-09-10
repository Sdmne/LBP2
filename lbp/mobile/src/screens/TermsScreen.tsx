import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Matches the prototype's #scr-terms: a plain Terms & Privacy Policy detail
// page (Terms of Service / Privacy Policy / Identity Verification /
// Contact sections), reached both from Settings ("Terms & Privacy Policy"
// row, .as-terms in #scr-app-settings) and from the Welcome screen's
// existing footer disclaimer text, which was previously just static
// (non-tappable) text. Fully static content - no backend endpoint for
// this, matching the prototype (which has the same hardcoded copy).
export default function TermsScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const sections: { heading: string; body: string }[] = [
    { heading: t("terms.serviceHeading"), body: t("terms.serviceBody") },
    { heading: t("terms.privacyHeading"), body: t("terms.privacyBody") },
    { heading: t("terms.verificationHeading"), body: t("terms.verificationBody") },
    { heading: t("terms.contactHeading"), body: t("terms.contactBody") },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      {sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heading: { fontSize: 16, fontWeight: "800", color: colors.ink, marginBottom: spacing.xs },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20 },
});
