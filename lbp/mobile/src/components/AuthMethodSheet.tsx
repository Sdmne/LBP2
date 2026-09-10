import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SocialAuthButtons from "./SocialAuthButtons";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";

type Intent = "login" | "register";

// Prototype's intermediate "Continue with Email / Continue with Google"
// bottom sheet between Welcome and the real Login/Signup forms - a
// previous pass at this screen (see the removed comment in
// WelcomeScreen.tsx's git history) deliberately skipped it since
// Login/Signup already had their own Google/Apple buttons at the bottom of
// the form. Alena sent the prototype's actual screenshot asking for the
// sheet specifically, so it's real - built for real now instead.
//
// "Continue with Email" just navigates to the existing Login/Signup screen
// (no new form needed - that's what those screens already are).
// "Continue with Google" reuses SocialAuthButtons' existing Google/Apple
// logic (real OAuth hook, error handling, socialLogin() call) rather than
// duplicating it - `variant="sheet"` switches its layout to a single
// full-width row matching this sheet's own "Continue with Email" row,
// instead of the bordered-box + "OR CONTINUE WITH" divider style it uses
// at the bottom of the Login/Signup forms.
export default function AuthMethodSheet({
  visible,
  intent,
  onClose,
  onContinueWithEmail,
}: {
  visible: boolean;
  intent: Intent;
  onClose: () => void;
  onContinueWithEmail: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          <View style={styles.handle} />

          <Pressable style={styles.row} onPress={onContinueWithEmail}>
            <Text style={styles.rowIcon}>{"@"}</Text>
            <Text style={styles.rowText}>{t("welcome.continueEmail")}</Text>
          </Pressable>

          <SocialAuthButtons intent={intent} variant="sheet" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(2,8,23,0.45)" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: spacing.md },
  // Alena: "тут надо ровно" - this row had no justifyContent, so its icon
  // + text sat flush against the left edge (padding.md in from it), while
  // SocialAuthButtons' "Continue with Google" row right below it (variant
  // "sheet", styles.googleButtonSheet) is justifyContent:"center" - two
  // pill buttons of the same width, directly stacked, with two different
  // content alignments. Centered to match.
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
  },
  rowIcon: { fontSize: 16, fontWeight: "700", color: colors.ink, width: 20, textAlign: "center" },
  rowText: { fontSize: 15, fontWeight: "700", color: colors.ink },
});
