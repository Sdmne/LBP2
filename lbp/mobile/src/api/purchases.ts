import { api } from "./client";

// The six one-time RevenueCat consumables sold on the Purchases screen
// (item 19). These identifier strings MUST exactly match the "Product
// identifier" Alena creates in App Store Connect / Google Play Console /
// the RevenueCat dashboard - REVENUECAT_PRODUCT_EFFECTS in backend/main.py
// dispatches purely on this string, nothing else ties a webhook event to
// its effect.
export type PurchaseProductId =
  | "lbp_boost_1x"
  | "lbp_superlike_1x"
  | "lbp_rewind_1x"
  | "lbp_likes_unlock_48h"
  | "lbp_compat_report_unlock_1x"
  | "lbp_extra_likes_pack_10";

// Mirrors member_purchases_status() in main.py exactly.
export type PurchasesStatus = {
  boostActive: boolean;
  boostActiveUntil: string | null;
  superLikeCredits: number;
  rewindCredits: number;
  likesUnlocked: boolean;
  likesUnlockedUntil: string | null;
  compatReportUnlockCredits: number;
  bonusLikesToday: number;
};

export function fetchPurchasesStatus() {
  return api.get<PurchasesStatus>("/api/member/purchases/status");
}
