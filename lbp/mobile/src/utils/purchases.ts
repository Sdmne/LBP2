import { Platform } from "react-native";
import Constants from "expo-constants";
// KNOWN GAP - same shape as utils/pushNotifications.ts's expo-notifications
// note (item 16). `react-native-purchases` is NOT yet in package.json:
// this session's sandboxed shell has no network path to the npm registry
// (registry.npmjs.org is blocked for this org on both this cloud
// workspace and the device bridge to Alena's Mac), so the correct
// SDK-57-compatible version couldn't be resolved/installed here. Before
// this file compiles or runs on a real device: (1) run
// `npx expo install react-native-purchases` once on a machine with npm
// access (resolves the correct version automatically - never hand-edit a
// guessed version into package.json), then (2) a full new `eas build` is
// needed (same as item 16's push notifications) since this is a brand-new
// native module - a plain `eas update` cannot ship it.
import type { PurchaseProductId } from "../api/purchases";

// Alena, 2026-09-15: "revenue cat у нас есть и подключен к старому сайту" -
// reusing that same RevenueCat project for these six products. These are
// the project's public SDK keys (RevenueCat dashboard -> Project settings
// -> API keys - NOT the webhook secret, which stays server-side only, and
// NOT a product identifier either). Filled in via app.json's
// extra.revenueCat once Alena has them from the dashboard; every function
// below is a safe no-op until then, same "inert until configured"
// philosophy as pushNotifications.ts.
const REVENUE_CAT_CONFIG = (Constants.expoConfig?.extra as
  | { revenueCat?: { iosApiKey?: string; androidApiKey?: string } }
  | undefined
)?.revenueCat;

const API_KEY = Platform.OS === "ios" ? REVENUE_CAT_CONFIG?.iosApiKey : REVENUE_CAT_CONFIG?.androidApiKey;

let configured = false;
type PurchasesStoreProduct = { identifier: string; priceString: string };
type PurchasesModule = {
  configure(options: { apiKey: string; appUserID: string }): void;
  logIn(appUserID: string): Promise<unknown>;
  logOut(): Promise<unknown>;
  getProducts(ids: string[]): Promise<PurchasesStoreProduct[]>;
  purchaseStoreProduct(product: PurchasesStoreProduct): Promise<unknown>;
};
async function loadPurchases(): Promise<PurchasesModule | null> {
  try {
    return ((await import("react-native-purchases")) as { default: PurchasesModule }).default;
  } catch {
    return null;
  }
}

// Alena, 2026-09-15: "в андроид нет возможности пока делать покупки" - the
// RevenueCat/store side (products in Google Play Console) is only set up
// for iOS right now. PurchasesScreen checks this (not just Platform.OS
// alone) so flipping it back on later, once Android products exist too,
// is a one-line change here rather than a screen rewrite.
export function purchasesAvailableForPlatform(): boolean {
  return Platform.OS === "ios";
}

// Called once after login/signup and on the app-start session check (same
// spots AuthContext already calls registerForPushNotifications()) so the
// RevenueCat SDK's appUserID matches String(profileId) - exactly what the
// webhook handler expects as event.app_user_id in main.py.
export async function initPurchases(profileId: number): Promise<void> {
  if (!API_KEY || !purchasesAvailableForPlatform()) return;
  const Purchases = await loadPurchases();
  if (!Purchases) return;
  try {
    if (!configured) {
      Purchases.configure({ apiKey: API_KEY, appUserID: String(profileId) });
      configured = true;
    } else {
      await Purchases.logIn(String(profileId));
    }
  } catch {
    // Best-effort, same philosophy as pushNotifications.ts - a purchases
    // SDK hiccup must never block sign-in.
  }
}

// Called from AuthContext's logout(), mirroring unregisterCurrentPushToken().
export async function resetPurchases(): Promise<void> {
  if (!configured) return;
  const Purchases = await loadPurchases();
  if (!Purchases) return;
  try {
    await Purchases.logOut();
  } catch {
    // best-effort
  }
}

// Fetches the real store product for each id (real localized price/
// currency, whatever Alena sets up in App Store Connect) so
// PurchasesScreen can show a real price instead of the static translated
// approximate price. Returns {} (not a throw) whenever purchases aren't
// configured/available yet, so callers can always fall back to the
// translated purchases.*Price strings.
export async function fetchProductPrices(
  ids: PurchaseProductId[],
): Promise<Partial<Record<PurchaseProductId, string>>> {
  if (!API_KEY || !purchasesAvailableForPlatform()) return {};
  const Purchases = await loadPurchases();
  if (!Purchases) return {};
  try {
    const products: PurchasesStoreProduct[] = await Purchases.getProducts(ids);
    const map: Partial<Record<PurchaseProductId, string>> = {};
    for (const product of products) {
      if ((ids as string[]).includes(product.identifier)) {
        map[product.identifier as PurchaseProductId] = product.priceString;
      }
    }
    return map;
  } catch {
    return {};
  }
}

export type PurchaseResult = { ok: true } | { ok: false; cancelled: boolean; error: string };

// Every one of the six PurchaseProductId items is a plain one-time
// "non-subscription" consumable, not a RevenueCat Offering/Package - so
// this goes straight through getProducts()/purchaseStoreProduct() rather
// than the Offerings API most subscription tutorials show. Granting the
// actual credit/effect (superLikeCredits++, boostActiveUntil, etc.)
// happens server-side via REVENUECAT_PRODUCT_EFFECTS's webhook dispatch
// (backend/main.py) once the store confirms payment - this function only
// confirms the purchase went through on-device. The caller should
// re-fetch fetchPurchasesStatus() a moment after a successful result,
// since the webhook is usually near-instant but not guaranteed to beat
// this response back to the client.
export async function purchaseProduct(productId: PurchaseProductId): Promise<PurchaseResult> {
  if (!API_KEY) {
    return { ok: false, cancelled: false, error: "not_configured" };
  }
  const Purchases = await loadPurchases();
  if (!Purchases) {
    return { ok: false, cancelled: false, error: "not_configured" };
  }
  try {
    const products = await Purchases.getProducts([productId]);
    const product = products[0];
    if (!product) {
      return { ok: false, cancelled: false, error: "not_available" };
    }
    await Purchases.purchaseStoreProduct(product);
    return { ok: true };
  } catch (err: any) {
    if (err?.userCancelled) {
      return { ok: false, cancelled: true, error: "" };
    }
    return { ok: false, cancelled: false, error: err?.message || "purchase_failed" };
  }
}
