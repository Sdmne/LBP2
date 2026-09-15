import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as authApi from "../api/auth";
import { ApiError } from "../api/client";
import { setSessionToken } from "../api/session";
import type { PublicUser } from "../api/types";
// TEMP DISABLED for OTA safety (2026-09-12, item 16): expo-notifications/
// expo-device are not yet installed and the currently-installed app
// binaries do not contain that native module - calling the real
// implementation from an `eas update` (JS-only) push would fail on every
// launch for already-installed users. Stubbed to no-ops here so this OTA
// update is safe; the real implementation in utils/pushNotifications.ts is
// untouched - re-wire these two lines back to it together with the next
// `eas build` (after `npx expo install expo-notifications expo-device`).
// See pending-mobile-tasks.md item 16.
async function registerForPushNotifications(): Promise<string | null> {
  return null;
}
async function unregisterCurrentPushToken(_token: string | null): Promise<void> {}

const TOKEN_STORAGE_KEY = "lbp_session_token";

// UPDATE (Sept 2026): GET /api/auth/me (authApi.me()) already returns
// profileVerified/isPremium alongside the base PublicUser fields (see
// api/auth.ts), but this context's `user` type was narrower than what it
// actually stores at runtime, so MeProfileScreen couldn't show a verified
// badge or current-plan status - both real fields the backend already
// sends, just not exposed. Widened to match reality instead of adding a
// second fetch.
type AuthUser = PublicUser & { profileVerified?: boolean; isPremium?: boolean; profileCompleteness?: number };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  // True once, right after a signup/social-signup that should walk the
  // person through the profile questionnaire (#scr-signup-1..5) before
  // anything else - local signups always need it (mobile signup has never
  // collected profileType/DOB/etc.), social signups only when
  // AuthResponse.isNewUser is true (an existing social account logging in
  // again already has a profile). RootNavigator pushes ProfileWizardScreen
  // once when this flips true, then clears it. Does not fire while the
  // person is behind the email-verification gate below (see RootNavigator).
  pendingProfileWizard: boolean;
  clearPendingProfileWizard: () => void;
  // True right after a signup whose confirmation email failed to actually
  // send (AuthResponse.emailSent === false - main.py's auth_signup() has
  // sent this back all along, but nothing on the mobile side ever read it
  // before: VerifyCodeScreen just showed the code-entry UI with a resend
  // countdown as if the first email was on its way, so someone whose very
  // first send failed (SMTP misconfigured, etc.) had no way to know the
  // "waiting for a code" screen was waiting for something that was never
  // sent - found from Alena's own report, "не приходит код" on a fresh
  // signup). VerifyCodeScreen reads this once on mount to show the same
  // "delivery failed" notice immediately instead of a silent countdown.
  initialEmailSendFailed: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  socialLogin: (idToken: string, displayName: string | null, intent: "login" | "register") => Promise<void>;
  logout: () => Promise<void>;
  // Re-fetches GET /api/auth/me and updates `user` in place.
  refreshUser: () => Promise<void>;
  // UPDATE (Sept 2026): email verification is now a blocking gate, matching
  // the original design (#scr-verify-code) - an authenticated-but-unverified
  // user sees only VerifyCodeScreen (see RootNavigator's three-way render
  // branch), driven directly off user.emailVerified rather than a one-shot
  // pendingEmailVerification flag. confirmEmailCode/resendEmailVerification
  // back that screen; deleteAccount backs DeleteAccountScreen (Settings >
  // Delete account).
  confirmEmailCode: (code: string) => Promise<void>;
  resendEmailVerification: (locale?: string) => Promise<string>;
  deleteAccount: (reason: string, details?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingProfileWizard, setPendingProfileWizard] = useState(false);
  const [initialEmailSendFailed, setInitialEmailSendFailed] = useState(false);
  // Item 16 - the Expo push token this device last registered, so logout()
  // can unregister the exact same one. A ref, not state - nothing on
  // screen ever needs to read it, and it must survive without triggering
  // re-renders.
  const pushTokenRef = useRef<string | null>(null);
  async function syncPushToken() {
    pushTokenRef.current = await registerForPushNotifications();
  }

  // On app start: if we have a saved token, verify it's still valid against
  // the real backend (GET /api/auth/me) rather than trusting it blindly -
  // sessions can be revoked/expired server-side.
  useEffect(() => {
    (async () => {
      try {
        const savedToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
        if (!savedToken) return;
        setSessionToken(savedToken);
        const { user: freshUser } = await authApi.me();
        setUser(freshUser);
        void syncPushToken();
      } catch (err) {
        // Invalid/expired token - clear it and fall through to the login screen.
        setSessionToken(null);
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY).catch(() => {});
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      pendingProfileWizard,
      clearPendingProfileWizard() {
        setPendingProfileWizard(false);
      },
      initialEmailSendFailed,
      async login(email, password) {
        const res = await authApi.login(email, password);
        setSessionToken(res.sessionToken);
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.sessionToken);
        setUser(res.user);
        setPendingProfileWizard(false);
        void syncPushToken();
      },
      async signup(email, password, displayName) {
        const res = await authApi.signup(email, password, displayName);
        setSessionToken(res.sessionToken);
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.sessionToken);
        setUser(res.user);
        setPendingProfileWizard(true);
        setInitialEmailSendFailed(res.emailSent === false);
        void syncPushToken();
      },
      async socialLogin(idToken, displayName, intent) {
        const res = await authApi.authenticateWithFirebase(idToken, displayName, intent);
        setSessionToken(res.sessionToken);
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.sessionToken);
        setUser(res.user);
        // Only a brand-new social account needs the wizard - one that already
        // existed (a returning Google/Apple login) already has a profile.
        setPendingProfileWizard(!!res.isNewUser);
        void syncPushToken();
      },
      async refreshUser() {
        const { user: freshUser } = await authApi.me();
        setUser(freshUser);
      },
      async confirmEmailCode(code) {
        const res = await authApi.confirmEmailCode(code);
        setUser(res.user);
      },
      async resendEmailVerification(locale = "en") {
        const res = await authApi.resendEmailVerification(locale);
        return res.status;
      },
      async deleteAccount(reason, details = "") {
        await authApi.requestAccountDeletion(reason, details);
        setSessionToken(null);
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY).catch(() => {});
        setUser(null);
      },
      async logout() {
        await unregisterCurrentPushToken(pushTokenRef.current);
        pushTokenRef.current = null;
        try {
          await authApi.logout();
        } catch (err) {
          // Best-effort - even if the network call fails, still clear local
          // state so the person isn't stuck "logged in" on this device.
          if (!(err instanceof ApiError)) throw err;
        }
        setSessionToken(null);
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY).catch(() => {});
        setUser(null);
      },
    }),
    [user, isLoading, pendingProfileWizard, initialEmailSendFailed],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
