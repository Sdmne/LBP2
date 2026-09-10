import { Alert } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fetchLikes } from "../api/likes";
import { ApiError } from "../api/client";
import type { RootStackParamList } from "../navigation/RootNavigator";

type FamilyPlanNav = { navigate: NativeStackNavigationProp<RootStackParamList>["navigate"] };

// Shared by ExploreScreen's "Family Plan" tile and MeProfileScreen's
// "Family Room" menu row (Alena: "нигде не вижу в меню family room" - the
// tile was the only way in, and easy to miss/not read as "this is where
// Family Room lives"). Real routing either way: fetch actual matches (same
// GET /api/member/likes call LikesScreen's "Matches" tab uses) and branch -
// nobody to plan with yet -> alert pointing at Browse instead of a dead
// tap; exactly one match -> straight into that person's Family Room, no
// picker needed; 2+ -> FamilyPlanPickerScreen. See that screen's own
// comment for why FamilyRoom itself needs a specific matched profile's id
// and can't just be a plain menu destination.
export async function openFamilyPlan(navigation: FamilyPlanNav, t: (key: string, vars?: Record<string, string | number>) => string) {
  try {
    const res = await fetchLikes();
    const matches = res.matches;
    if (matches.length === 0) {
      Alert.alert(t("familyPlan.noMatches.title"), t("familyPlan.noMatches.body"), [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("familyPlan.noMatches.browse"), onPress: () => navigation.navigate("MainTabs", { screen: "Catalog" }) },
      ]);
    } else if (matches.length === 1) {
      navigation.navigate("FamilyRoom", { profileId: matches[0].id, displayName: matches[0].displayName });
    } else {
      navigation.navigate("FamilyPlanPicker");
    }
  } catch (err) {
    Alert.alert(t("familyPlan.loadErrorTitle"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
  }
}

// The 10 fixed Family Plan sections (Alena's reference mockup, "Your
// Family Plan"). Order + keys must match FAMILY_PLAN_SECTION_KEYS in
// backend/main.py exactly - this is the client's copy for ordering the
// list and looking up i18n labels ("familyPlan.section.<key>.title" /
// ".desc" in translations.ts), the backend is what actually validates a
// section_key server-side.
export const FAMILY_PLAN_SECTION_KEYS = [
  "values-motivation",
  "parenting-roles",
  "legal-custody",
  "financial-planning",
  "living-arrangements",
  "health-insurance",
  "education",
  "communication",
  "extended-family",
  "emergency-planning",
] as const;

export type FamilyPlanSectionKey = (typeof FAMILY_PLAN_SECTION_KEYS)[number];
