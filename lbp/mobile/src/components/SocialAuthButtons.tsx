import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from "@firebase/auth";
import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
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

export default function SocialAuthButtons({ intent, variant = "full" }: { intent: Intent; variant?: "full" | "sheet" }) {
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
  const googleClientId = Platform.select({
    ios: GOOGLE_OAUTH_CLIENT_IDS.ios || GOOGLE_OAUTH_CLIENT_IDS.web,
    android: GOOGLE_OAUTH_CLIENT_IDS.android || GOOGLE_OAUTH_CLIENT_IDS.web,
    default: GOOGLE_OAUTH_CLIENT_IDS.web || GOOGLE_OAUTH_CLIENT_IDS.ios || GOOGLE_OAUTH_CLIENT_IDS.android,
  });

  // Whether Google sign-in is actually usable - computed from the REAL
  // config values, before the placeholder fallback below. Drives the
  // button's disabled state; the placeholder is never reachable through it.
  const googleConfigured = Platform.OS === "web"
    ? Boolean(googleClientId)
    : Boolean(GOOGLE_OAUTH_CLIENT_IDS.web && googleClientId);

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
  // FIX HISTORY (2026-09-22):
  // Attempt 1 (reverted): by default, when no `redirectUri` is passed,
  // Google.useAuthRequest() builds its own native redirect as
  // `${Application.applicationId}:/oauthredirect` - i.e.
  // "com.letsBeParents.letsBeParents:/oauthredirect". That scheme wasn't
  // registered as an Android/iOS intent-filter anywhere (only app.json's
  // top-level `scheme`, "letsbeparents", was), so after Google finished
  // sign-in nothing on the device knew how to reopen the app - it fell
  // through to a bare google.com page. First fix attempt overrode
  // `redirectUri` to use the already-registered "letsbeparents" scheme
  // instead - that broke a DIFFERENT way: Google's own OAuth policy
  // rejects single-word custom schemes with no period ("doesn't comply
  // with Google's OAuth 2.0 policy for keeping apps secure", error 400),
  // since Google requires reverse-domain-style schemes specifically to
  // avoid collisions between apps.
  // Actual fix: keep using the library's default redirect (already valid,
  // reverse-domain style, since it's built from the applicationId) and
  // instead register the missing Android intent-filter / iOS
  // CFBundleURLTypes entry for "com.letsBeParents.letsBeParents" in
  // app.json, so the OS knows which app to hand the redirect back to.
  // See app.json's android.intentFilters / ios.infoPlist.CFBundleURLTypes.
  // FOLLOW-UP (2026-09-22): that fix registered the intent-filter but
  // Alena's own on-device test (a real <a href> link, opened in a real
  // browser, not Claude's sandboxed viewers - see the OAuth test page
  // delivered to her) showed tapping the link still did nothing.
  // AndroidManifest.xml (via `npx expo prebuild --platform android`)
  // confirmed the intent-filter WAS present with the exact declared
  // scheme, mixed-case, matching Application.applicationId. Suspected
  // root cause: Chrome/Android's URL canonicalization lowercases the
  // scheme of a tapped link before resolving which app handles it
  // (standard URL-normalization behavior), while Android's intent-filter
  // scheme match is a case-SENSITIVE string compare against exactly what
  // was declared in the manifest. A mixed-case scheme like
  // "com.letsBeParents.letsBeParents" registered in the manifest never
  // matches the lowercased "com.letsbeparents.letsbeparents" the browser
  // actually dispatches - so nothing happens, silently, exactly what she
  // saw. Can't just change the scheme's case globally: it's derived at
  // runtime from Application.applicationId, which is fixed to the real
  // (mixed-case) package name/bundle ID already published to the stores.
  // Fix: app.json's android.intentFilters now registers BOTH the
  // original mixed-case scheme AND an all-lowercase variant
  // ("com.letsbeparents.letsbeparents") in the same intent-filter's data
  // array, so whichever case the browser ends up dispatching, one entry
  // matches. iOS was left untouched here - only Android was ever shown
  // broken, and Apple's URL scheme matching is documented as
  // case-insensitive - but if Apple sign-in / redirect ever shows this
  // same silent-nothing symptom on iOS, this scheme-casing mismatch is
  // the first thing to check there too. NOT YET RE-VERIFIED ON DEVICE -
  // needs a fresh Android build (the installed build predates this
  // change) and a repeat of the same real-browser link test.
  const [request, , promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_OAUTH_CLIENT_IDS.ios || undefined,
    androidClientId: GOOGLE_OAUTH_CLIENT_IDS.android || undefined,
    webClientId: GOOGLE_OAUTH_CLIENT_IDS.web || undefined,
    clientId: googleClientId || "not-configured",
  });

  useEffect(() => {
    if (Platform.OS === "web" || !GOOGLE_OAUTH_CLIENT_IDS.web) return;
    GoogleSignin.configure({
      webClientId: GOOGLE_OAUTH_CLIENT_IDS.web,
      iosClientId: GOOGLE_OAUTH_CLIENT_IDS.ios || undefined,
      offlineAccess: false,
    });
  }, []);

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
    if (googleBusy || appleBusy) return;
    // TEMPORARY DIAGNOSTIC (2026-09-21): the button was tappable but did
    // nothing, with zero visible feedback - one of the silent early-return
    // conditions below was firing. Surfacing exactly which one, instead of
    // a plain `return`, so the next tap on a real device tells us what to
    // fix instead of guessing blind with no device log access. Remove this
    // block (restore the single silent `return` above) once Google sign-in
    // is confirmed working end to end.
    if (!firebaseAuth) {
      setError(t("auth.socialErrorDefault"));
      return;
    }
    if (!googleConfigured) {
      setError(t("auth.socialErrorDefault"));
      return;
    }
    if (Platform.OS === "web" && !request) {
      setError(t("auth.socialErrorDefault"));
      return;
    }
    setError(null);
    setGoogleBusy(true);
    try {
      let idToken: string | null | undefined;
      if (Platform.OS === "web") {
        const result = await promptAsync();
        if (result.type !== "success") return;
        idToken = result.authentication?.idToken ?? result.params?.id_token;
      } else {
        if (Platform.OS === "android") {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        }
        const result = await GoogleSignin.signIn();
        if (!isSuccessResponse(result)) return;
        idToken = result.data.idToken;
      }
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
    <View style={variant === "sheet" ? styles.wrapSheet : styles.wrap}>
      {variant === "full" ? (
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t("auth.orContinueWith")}</Text>
          <View style={styles.dividerLine} />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Alena: "вход с гугл не работает" - most likely cause given this
          screen's own comments: googleConfigured comes from
          EXPO_PUBLIC_GOOGLE_*_CLIENT_ID env vars read at BUILD time (see
          config.ts) - if those weren't set for whatever build she's
          testing, this button was always silently disabled with no visual
          difference at all, so tapping it just does nothing with zero
          feedback. Dimming it when that's the case at least makes "this
          isn't set up yet" visible instead of looking broken - see the
          README for what to actually check (the env vars themselves, not
          this code). */}
      <Pressable
        style={[
          variant === "sheet" ? styles.googleButtonSheet : styles.googleButton,
          !googleConfigured && styles.socialButtonDisabled,
        ]}
        onPress={handleGoogle}
        // TEMPORARY DIAGNOSTIC (2026-09-21): was `!request || !googleConfigured
        // || !firebaseAuth || googleBusy || appleBusy` - blocking the tap
        // entirely on those conditions meant it did nothing with zero
        // feedback when one was true. Only still blocking on the busy flags
        // (to prevent a double-tap firing two concurrent sign-in attempts) so
        // handleGoogle's own new diagnostic checks above always get to run
        // and show which condition is actually false. Restore the full
        // condition here once Google sign-in is confirmed working.
        disabled={googleBusy || appleBusy}
      >
        {googleBusy ? (
          <ActivityIndicator color={colors.text} />
        ) : variant === "sheet" ? (
          <>
            <Text style={styles.googleButtonSheetIcon}>{"G"}</Text>
            <Text style={styles.googleButtonSheetText}>{t("auth.continueGoogle")}</Text>
          </>
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
  // "sheet" variant (AuthMethodSheet.tsx): no divider (the sheet's own
  // "Continue with Email" row already establishes the pattern), no top
  // margin (sits directly under that row instead of the bottom of a form),
  // and the Google button matches that row's exact pill/border/height
  // instead of the boxier style used at the bottom of Login/Signup.
  wrapSheet: { marginTop: spacing.sm, gap: spacing.sm },
  googleButtonSheet: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 54,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleButtonSheetIcon: { fontSize: 16, fontWeight: "800", color: "#4285F4" },
  googleButtonSheetText: { color: colors.text, fontSize: 15, fontWeight: "700" },
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
  socialButtonDisabled: { opacity: 0.45 },
  appleButton: { height: 48 },
  appleButtonLoading: { backgroundColor: "#000", borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
});
