import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as authApi from "../api/auth";
import { ApiError } from "../api/client";
import { setSessionToken } from "../api/session";
import type { PublicUser } from "../api/types";

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
      async login(email, password) {
        const res = await authApi.login(email, password);
        setSessionToken(res.sessionToken);
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.sessionToken);
        setUser(res.user);
        setPendingProfileWizard(false);
      },
      async signup(email, password, displayName) {
        const res = await authApi.signup(email, password, displayName);
        setSessionToken(res.sessionToken);
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.sessionToken);
        setUser(res.user);
        setPendingProfileWizard(true);
      },
      async socialLogin(idToken, displayName, intent) {
        const res = await authApi.authenticateWithFirebase(idToken, displayName, intent);
        setSessionToken(res.sessionToken);
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.sessionToken);
        setUser(res.user);
        // Only a brand-new social account needs the wizard - one that already
        // existed (a returning Google/Apple login) already has a profile.
        setPendingProfileWizard(!!res.isNewUser);
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
    [user, isLoading, pendingProfileWizard],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
