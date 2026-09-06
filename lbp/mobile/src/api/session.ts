// Tiny in-memory holder for the current session token, shared between the
// API client (src/api/client.ts, which reads it to set the Authorization
// header) and the auth context (src/context/AuthContext.tsx, which is the
// only thing allowed to write it). Kept separate from both to avoid a
// circular import between them.
//
// The backend (lbp/backend/main.py) normally authenticates the *website*
// via an HttpOnly session cookie it sets on login - a native app can't read
// HttpOnly cookies, so this app instead reads the "sessionToken" field that
// was added to the login/signup/firebase JSON responses specifically for
// native clients, stores it here + in SecureStore, and sends it back as
// "Authorization: Bearer <token>" on every request. The backend's
// request_session_tokens() already accepted a Bearer header before that
// change - only the JSON response needed to start exposing the raw token.

let currentToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getSessionToken(): string | null {
  return currentToken;
}

export function setSessionToken(token: string | null): void {
  currentToken = token;
  listeners.forEach((listener) => listener(token));
}

export function subscribeToSessionToken(listener: (token: string | null) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
