import { api } from "./client";

// GET/POST /api/member/referral(/redeem) - member_referral_status()/
// member_referral_redeem() in main.py. Premium roadmap step 4: refer a
// friend, and once they get VERIFIED (not just signed up - a real,
// hard-to-farm milestone) you get an automatic 48-hour profile Boost,
// reusing the same Boost mechanism from step 3 (see api/boost.ts) rather
// than a separate reward system.
export type ReferralStatus = {
  code: string;
  referredCount: number;
  rewardedCount: number;
  redeemedCode: string | null;
};

export function fetchReferralStatus() {
  return api.get<ReferralStatus>("/api/member/referral");
}

export function redeemReferralCode(code: string) {
  return api.post<{ ok: true; referralId: number }>("/api/member/referral/redeem", { code });
}
