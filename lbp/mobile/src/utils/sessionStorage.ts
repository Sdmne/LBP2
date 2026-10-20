import * as SecureStore from "expo-secure-store";
import { logout } from "../api/auth";

export const TOKEN_STORAGE_KEY = "lbp_session_token";

export class SessionStorageError extends Error {
  constructor(readonly sessionRevoked: boolean, readonly accountCreated = false) {
    super("SESSION_STORAGE_FAILED");
    this.name = "SessionStorageError";
  }
}

export function describeSessionStorageError(error: SessionStorageError, t: (key: string) => string): string {
  const message = t(error.accountCreated ? "auth.accountCreatedStorageError" : "auth.sessionStorageError");
  return error.sessionRevoked ? message : `${message} ${t("auth.sessionCleanupError")}`;
}

export async function persistSessionToken(token: string, accountCreated = false): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
  } catch {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let sessionRevoked = false;
    try {
      await logout(token, controller.signal);
      sessionRevoked = true;
    } catch {
      // Report an incomplete rollback without masking the storage failure.
    } finally {
      clearTimeout(timeout);
    }
    // A native write can fail after changing storage. Remove that token while
    // preserving any previously saved token when it is still readable.
    try {
      const saved = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      if (saved === token) await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY).catch(() => {});
    }
    throw new SessionStorageError(sessionRevoked, accountCreated);
  }
}
