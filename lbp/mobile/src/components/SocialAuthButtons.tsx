import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from "firebase/auth";
import { firebaseAuth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { GOOGLE_OAUTH_CLIENT_IDS } from "../config";
import { colors, radius, spacing } from "../theme";

// Mirrors the website's "Continue with Google" / "Continue with Apple"
// buttons (lbp/frontend/src/firebase-auth.ts's signInWithSocial +
// lbp/frontend/src/ui.tsx's social() calls) - same Firebase project, same
// POST /api/auth/firebase backend call, same login-vs-register `intent`.
// Shown on both LoginScreen and SignupScreen (intent differs).
//
// NOT VERIFIED END TO END, more so than most of this app: this is the one
// piece that needed real npm-package research I couldn't do (no internet
// access here) rather than just reading main.py/ui.tsx. Specifically:
// - expo-auth-session's Google provider API (useAuthRequest's options,
//   what shape `promptAsync()` resolves to) has changed across versions -
//   written from the documented pattern I know, but double-check against
//   the installed "expo-auth-session" version's own docs/types before
//   relying on it. UPDATE from the first real device run: one assumption
//   here was flat-out wrong - Google.useAuthRequest() does NOT quietly
//   return a null request when its client ID is missing, it THROWS and
//   crashes the screen. Worked around below with a `googleConfigured` flag
//   computed separately from the real config, since the throw itself can't
//   be avoided (see the comment by useAuthRequest's call below).
// - Google's own brand guidelines want their actual "G" logo on this
//   button, not the plain text placeholder below - swap in the real
//   asset before shipping to real users.
// Apple's side (expo-apple-authentication + AppleAuthenticationButton) is
// a much more stable, narrower API and less likely to have drifted.
WebBrowser.maybeCompleteAuthSession();

type Intent = "login" | "register";

export default function SocialAuthButtons({ intent }: { intent: Intent }) {
  const { socialLogin } = useAuth();
  const { t } = useI18n();
  // Separate loading flags per provider (not one shared `busy` value) so an
  // in-flight Google sign-in doesn't leave the Apple button silently
  // tappable (AppleAuthenticationButton has no `disabled` prop - it's only
  // "disabled" here by not being rendered while its own flow is running),
  // and vice versa. Without this, tapping the other provider mid-flow could
  // fire a second concurrent signInWithCredential/socialLogin call.
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  // Whether Google sign-in is actually usable - computed from the REAL
  // config values, before the placeholder fallback below. Drives the
  // button's disabled state; the placeholder is never reachable through it.
  const googleConfigured = Boolean(
    GOOGLE_OAUTH_CLIENT_IDS.ios || GOOGLE_OAUTH_CLIENT_IDS.android || GOOGLE_OAUTH_CLIENT_IDS.web
  );

  // Confirmed on a real device run: contrary to this file's original
  // assumption, Google.useAuthRequest() doesn't quietly return a null
  // request when its platform-specific client ID is missing - it THROWS
  // ("Client Id property `androidClientId` must be defined...", from
  // expo-auth-session's invariantClientId), crashing the whole screen.
  // Hooks can't be called conditionally, so the missing ID can't just be
  // skipped - `clientId` below is a catch-all fallback that same invariant
  // check also accepts, purely to stop the crash. It's inert: `request`
  // still gets created, but the button is disabled via `googleConfigured`
  // (the real values) before anyone could ever tap it into using this
  // placeholder for an actual request.
  const [request, , promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_OAUTH_CLIENT_IDS.ios || undefined,
    androidClientId: GOOGLE_OAUTH_CLIENT_IDS.android || undefined,
    webClientId: GOOGLE_OAUTH_CLIENT_IDS.web || undefined,
    clientId: "not-configured",
  });

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  // Backend detail strings from auth_firebase() in main.py - see src/api/auth.ts.
  // Both "account inactive" and "unverified email" come back as HTTP 403, but
  // they're different situations (and the app has no key for the unverified-
  // email case, since Google/Apple emails are pre-verified and it "shouldn't
  // normally happen") - only show the account-inactive message when the
  // response body actually says ACCOUNT_INACTIVE, otherwise fall back to the
  // generic message rather than mislabeling an unrelated 403.
  function describeSocialError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 409) return t("auth.socialErrorConflict");
      if (err.status === 403 && err.message.includes("ACCOUNT_INACTIVE")) return t("auth.socialErrorInactive");
      // Don't surface err.message here for other statuses - it's the raw
      // response body (often a JSON blob like {"detail":"..."}), not
      // user-facing text.
      return t("auth.socialErrorDefault");
    }
    return t("auth.socialErrorDefault");
  }

  async function handleGoogle() {
    if (!request || !googleConfigured || !firebaseAuth || googleBusy || appleBusy) return;
    setError(null);
    setGoogleBusy(true);
    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        // "cancel"/"dismiss" - the person just closed the sheet, not an error.
        return;
      }
      const idToken = result.authentication?.idToken ?? result.params?.id_token;
      if (!idToken) {
        setError(t("auth.socialErrorDefault"));
        return;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(firebaseAuth, credential);
      const firebaseIdToken = await userCredential.user.getIdToken();
      await socialLogin(firebaseIdToken, userCredential.user.displayName, intent);
    } catch (err) {
      setError(describeSocialError(err));
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleApple() {
    if (!firebaseAuth || googleBusy || appleBusy) return;
    setError(null);
    setAppleBusy(true);
    try {
      // Firebase's Apple OAuthProvider wants a raw nonce plus its SHA-256
      // hash sent to Apple - standard replay-protection pattern from
      // Firebase's own "Sign in with Apple" docs. The raw nonce must come
      // from a cryptographically secure random source (it's a replay-
      // protection value, not just a cache key) - Math.random() is not
      // safe for this, so use expo-crypto's CSPRNG instead.
      const rawNonce = Array.from(await Crypto.getRandomBytesAsync(32))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
      if (!appleCredential.identityToken) {
        setError(t("auth.socialErrorDefault"));
        return;
      }
      const provider = new OAuthProvider("apple.com");
      const credential = provider.credential({ idToken: appleCredential.identityToken, rawNonce });
      const userCredential = await signInWithCredential(firebaseAuth, credential);
      const firebaseIdToken = await userCredential.user.getIdToken();
      const appleDisplayName = appleCredential.fullName
        ? [appleCredential.fullName.givenName, appleCredential.fullName.familyName].filter(Boolean).join(" ") || null
        : null;
      await socialLogin(firebaseIdToken, appleDisplayName || userCredential.user.displayName, intent);
    } catch (err: unknown) {
      // Apple's own cancel error - not a real error, don't show anything.
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ERR_REQUEST_CANCELED") {
        return;
      }
      setError(describeSocialError(err));
    } finally {
      setAppleBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t("auth.orContinueWith")}</Text>
        <View style={styles.dividerLine} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={styles.googleButton}
        onPress={handleGoogle}
        disabled={!request || !googleConfigured || !firebaseAuth || googleBusy || appleBusy}
      >
        {googleBusy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.googleButtonText}>{t("auth.continueGoogle")}</Text>
        )}
      </Pressable>

      {Platform.OS === "ios" && appleAvailable && firebaseAuth ? (
        appleBusy || googleBusy ? (
          <View style={[styles.appleButton, styles.appleButtonLoading]}>
            <ActivityIndicator color={colors.white} />
          </View>
        ) : (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.pill}
            style={styles.appleButton}
            onPress={handleApple}
          />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg, gap: spacing.sm },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 12, color: colors.textMuted, textTransform: "uppercase" },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
  googleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.bgSoft,
  },
  googleButtonText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  appleButton: { height: 48 },
  appleButtonLoading: { backgroundColor: "#000", borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
