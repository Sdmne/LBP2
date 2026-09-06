import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as authApi from "../api/auth";
import { ApiError } from "../api/client";
import { setSessionToken } from "../api/session";
import type { PublicUser } from "../api/types";

const TOKEN_STORAGE_KEY = "lbp_session_token";

type AuthContextValue = {
  user: PublicUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  socialLogin: (idToken: string, displayName: string | null, intent: "login" | "register") => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        // Only an explicit authentication rejection invalidates the saved session.
        // Transient network/server failures must not erase credentials.
        if (err instanceof ApiError && err.status === 401) {
          setSessionToken(null);
          await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY).catch(() => {});
        }
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
      async login(email, password) {
        const res = await authApi.login(email, password);
        setSessionToken(res.sessionToken);
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.sessionToken);
        setUser(res.user);
      },
      async signup(email, password, displayName) {
        const res = await authApi.signup(email, password, displayName);
        setSessionToken(res.sessionToken);
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.sessionToken);
        setUser(res.user);
      },
      async socialLogin(idToken, displayName, intent) {
        const res = await authApi.authenticateWithFirebase(idToken, displayName, intent);
        setSessionToken(res.sessionToken);
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, res.sessionToken);
        setUser(res.user);
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
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
