import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  NavigationContainer,
  useNavigationContainerRef,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { RESOURCES_CATEGORIES } from "../data/resources";
import { colors } from "../theme";
import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ChatScreen from "../screens/ChatScreen";
import ProfileDetailScreen from "../screens/ProfileDetailScreen";
import SettingsScreen from "../screens/SettingsScreen";
import PhotosScreen from "../screens/PhotosScreen";
import VerificationScreen from "../screens/VerificationScreen";
import VideoVerificationScreen from "../screens/VideoVerificationScreen";
import CommunityScreen from "../screens/CommunityScreen";
import CommunityGroupScreen from "../screens/CommunityGroupScreen";
import CommunityPostScreen from "../screens/CommunityPostScreen";
import SubscriptionScreen from "../screens/SubscriptionScreen";
import LikesPaywallScreen from "../screens/LikesPaywallScreen";
import AiAdvisorScreen from "../screens/AiAdvisorScreen";
import PrivacyScreen from "../screens/PrivacyScreen";
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import ReportProfileScreen from "../screens/ReportProfileScreen";
import DirectoryDetailScreen from "../screens/DirectoryDetailScreen";
import FavouritesScreen from "../screens/FavouritesScreen";
import ResourcesScreen from "../screens/ResourcesScreen";
import ResourceCategoryScreen from "../screens/ResourceCategoryScreen";
import ResourceToolScreen from "../screens/ResourceToolScreen";
import DirectoryScreen from "../screens/DirectoryScreen";
import KnowledgeHubScreen from "../screens/KnowledgeHubScreen";
import KnowledgeArticleScreen from "../screens/KnowledgeArticleScreen";
import CompatibilityQuizScreen from "../screens/CompatibilityQuizScreen";
import FamilyRoomScreen from "../screens/FamilyRoomScreen";
import PregnancyRoomScreen from "../screens/PregnancyRoomScreen";
import CoParentingAgreementScreen from "../screens/CoParentingAgreementScreen";
import CostCalculatorScreen from "../screens/CostCalculatorScreen";
import SafetyCheckInScreen from "../screens/SafetyCheckInScreen";
import FamilyPlanPickerScreen from "../screens/FamilyPlanPickerScreen";
import CompatibilityAnswersScreen from "../screens/CompatibilityAnswersScreen";
import CompatibilityReportScreen from "../screens/CompatibilityReportScreen";
import TermsScreen from "../screens/TermsScreen";
import TrustSafetyScreen from "../screens/TrustSafetyScreen";
import FiltersScreen from "../screens/FiltersScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import VerifyCodeScreen from "../screens/VerifyCodeScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";
import ProfileWizardScreen from "../screens/ProfileWizardScreen";
import ReferralScreen from "../screens/ReferralScreen";
import MainTabs, { type MainTabsParamList } from "./MainTabs";
import type { CatalogFilters } from "../api/catalogFilters";
import type { CommunityPost } from "../api/community";

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  // NavigatorScreenParams lets screens pushed on top of MainTabs (like
  // ResourceCategory/ResourceTool below) jump to a specific tab - e.g.
  // navigate("MainTabs", { screen: "Resources" }) - rather than just
  // undefined, which only supported opening MainTabs at whatever tab it
  // last had focused.
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;
  Chat: { conversationId: number; title: string };
  ProfileDetail: { profileId: number };
  Settings: undefined;
  Photos: undefined;
  Verification: undefined;
  VideoVerification: undefined;
  Community: undefined;
  CommunityGroup: { groupId: number; groupName: string };
  CommunityPost: { post: CommunityPost; groupId: number };
  Subscription: undefined;
  LikesPaywall: undefined;
  AiAdvisor: undefined;
  Privacy: undefined;
  BlockedUsers: undefined;
  ReportProfile: { profileId: number; displayName?: string | null };
  DirectoryDetail: { kind: "clinics" | "lawyers"; slugOrId: string | number; name?: string | null; isFavourite?: boolean };
  Favourites: undefined;
  // Sept 2026: Resources and Directory moved here from being MainTabs tabs
  // (see MainTabs.tsx) - reached now from ExploreScreen's "Guides &
  // professionals" list and MeProfileScreen, pushed with a header like any
  // other stack screen.
  Resources: undefined;
  ResourceCategory: { slug: string };
  ResourceTool: { categorySlug: string; toolSlug: string };
  Directory: { initialKind?: "clinics" | "lawyers" } | undefined;
  // Real Knowledge Hub (GET /api/public/articles) - see api/articles.ts and
  // KnowledgeHubScreen.tsx for why this hits the live endpoint directly.
  KnowledgeHub: undefined;
  KnowledgeArticle: { slug: string; title?: string | null };
  CompatibilityQuiz: undefined;
  // "Family Plan & Shared Family Room" (Family Builder Pro) - opened from
  // ProfileDetailScreen for a given matched profile. displayName is passed
  // through just for the header title; the screen itself refetches
  // everything else from GET /api/member/family-room/{profileId}.
  FamilyRoom: { profileId: number; displayName?: string | null };
  // Pregnancy Room - lab results/ultrasounds/prescriptions shared with the
  // same matched partner, opened from a card inside FamilyRoomScreen.
  // Same params shape and same server-side gate (Premium + active match).
  PregnancyRoom: { profileId: number; displayName?: string | null };
  // Co-Parenting Agreement (premium roadmap step 5) - the "sign" layer on
  // top of the 10-section Family Plan, opened from a card inside
  // FamilyRoomScreen. Same params shape and same server-side gate
  // (Family Builder Pro + active match) as FamilyRoom/PregnancyRoom.
  CoParentingAgreement: { profileId: number; displayName?: string | null };
  CostCalculator: undefined;
  SafetyCheckIn: undefined;
  // Picker shown when Explore's "Family Plan" tile has 2+ real matches to
  // choose from (0 matches -> Alert + Browse CTA, 1 match -> straight to
  // FamilyRoom, both handled in ExploreScreen.tsx without ever routing
  // here) - see FamilyPlanPickerScreen.tsx for the full story.
  // Item 10 follow-up - Alena: "Pregnancy только же в моем профиле сделать
  // чуть ниже под family room" - added a Pregnancy Room shortcut to her own
  // profile menu (MeProfileScreen.tsx), right under Family Room. It needs
  // the same match-picker flow as Family Room when there are 2+ matches,
  // so this screen now takes an optional target to know which room to land
  // in - see openPregnancyRoom()/openFamilyPlan() in utils/familyPlan.ts.
  FamilyPlanPicker: { target?: "PregnancyRoom" } | undefined;
  // Persisted two-sided compatibility questionnaire (Family Builder
  // Pro's "Compatibility Score" / "Detailed Compatibility Report") -
  // answering it is free for everyone (no params); the two-sided
  // report needs a profile to compare against, same shape as FamilyRoom.
  CompatibilityAnswers: undefined;
  CompatibilityReport: { profileId: number; displayName?: string | null };
  // Static Terms & Privacy Policy page (#scr-terms) - reached from both
  // Settings (post-login) and Welcome (pre-login), so it's registered in
  // both the authenticated and unauthenticated stack branches below.
  Terms: undefined;
  TrustSafety: undefined;
  // Catalog filters (#scr-filters) - pushed from CatalogScreen's header
  // button, seeded with the tab's current filters; applying navigates back
  // into MainTabs/Catalog with fresh params rather than returning a value.
  Filters: { initial: CatalogFilters };
  // Edit profile (#scr-edit-profile) - pushed from MeProfileScreen's new
  // "Edit profile" row. No params - the screen fetches its own data via
  // GET /api/member/me (see api/profile.ts).
  EditProfile: undefined;
  // Blocking email-verification gate (#scr-verify-code) - an
  // authenticated-but-unverified user sees only this screen (see the
  // render branch below, driven off user.emailVerified), no skip. No
  // params - reads the signed-in user's email from AuthContext.
  VerifyCode: undefined;
  // Delete-account flow (Settings > Delete account) - collects a reason and
  // a typed "DELETE" confirmation, then calls AuthContext.deleteAccount.
  DeleteAccount: undefined;
  // Profile questionnaire wizard (#scr-signup-1..5/-2b/-4b) - pushed
  // automatically once, right after a fresh signup/new social signup
  // needs it (see AuthContext's pendingProfileWizard and the useEffect
  // below). Does not fire while the VerifyCode gate is active (it isn't
  // registered as a screen there) - see the guard on that effect.
  // No params - internally step-managed, reads the signed-in user's
  // displayName from AuthContext to prefill the name field.
  ProfileWizard: undefined;
  // Premium roadmap step 4 - "Invite friends" (MeProfileScreen's new row).
  // No params - reads/writes GET/POST /api/member/referral(/redeem).
  Referral: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const {
    user,
    isAuthenticated,
    isLoading,
    pendingProfileWizard,
    clearPendingProfileWizard,
  } = useAuth();
  const { t } = useI18n();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  // One-shot post-signup push for the profile wizard. Guarded against the
  // blocking VerifyCode gate (user signed in but !user.emailVerified) -
  // ProfileWizard isn't registered as a screen while that gate is showing
  // (see the render branch below), so navigating there would no-op/fail;
  // once the person clears verification this effect's own re-run (user
  // changes on confirmEmailCode) picks the wizard back up.
  useEffect(() => {
    if (!isAuthenticated || !pendingProfileWizard) return;
    if (user && !user.emailVerified) return;
    if (!navigationRef.isReady()) return;
    navigationRef.navigate("ProfileWizard");
    clearPendingProfileWizard();
  }, [isAuthenticated, pendingProfileWizard, user, navigationRef, clearPendingProfileWizard]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.gradientStart} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {/* Alena repeatedly reported screens missing a back button/title at
          the top (first surfaced on Subscription - see that screen's own
          headerLeft override below, kept for redundancy). Rather than
          trust every individual screen to remember an explicit headerLeft,
          set one default here for the whole stack: any screen that turns
          headerShown on gets a guaranteed, consistently-styled back arrow
          (native-stack's own default back button isn't reliable across
          platforms/themes here), and it's a no-op for headerShown:false
          screens. canGoBack() guards the rare case of a headerShown:true
          screen with nothing to go back to. */}
      <Stack.Navigator
        screenOptions={({ navigation }) => ({
          headerShown: false,
          headerLeft: () =>
            navigation.canGoBack() ? (
              <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={{ paddingRight: 12 }}>
                <Feather name="arrow-left" size={22} color={colors.ink} />
              </Pressable>
            ) : null,
        })}
      >
        {isAuthenticated && user && !user.emailVerified ? (
          <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
        ) : isAuthenticated ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={({ route }) => ({ headerShown: true, title: route.params.title })}
            />
            <Stack.Screen
              name="ProfileDetail"
              component={ProfileDetailScreen}
              options={{ headerShown: true, title: t("nav.profileDetailTitle") }}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: t("nav.settingsTitle") }} />
            <Stack.Screen name="AiAdvisor" component={AiAdvisorScreen} options={{ headerShown: true, title: t("nav.aiAdvisorTitle") }} />
            <Stack.Screen name="Photos" component={PhotosScreen} options={{ headerShown: true, title: t("nav.photosTitle") }} />
            <Stack.Screen
              name="Verification"
              component={VerificationScreen}
              options={{ headerShown: true, title: t("nav.verificationTitle") }}
            />
            <Stack.Screen
              name="VideoVerification"
              component={VideoVerificationScreen}
              options={{ headerShown: true, title: t("nav.videoVerificationTitle") }}
            />
            <Stack.Screen
              name="Community"
              component={CommunityScreen}
              options={{ headerShown: true, title: t("community.title") }}
            />
            <Stack.Screen
              name="CommunityGroup"
              component={CommunityGroupScreen}
              options={({ route }) => ({ headerShown: true, title: route.params.groupName })}
            />
            <Stack.Screen
              name="CommunityPost"
              component={CommunityPostScreen}
              options={{ headerShown: true, title: t("community.postTitle") }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={({ navigation }) => ({
                headerShown: true,
                title: t("nav.subscriptionTitle"),
                // Alena: "только добавить кнопку назад" - headerShown:true
                // should already give the native default back arrow, but
                // she couldn't find one on this screen specifically, so
                // this makes it explicit/guaranteed rather than relying on
                // native-stack's default.
                headerLeft: () => (
                  <Pressable
                    onPress={() => navigation.goBack()}
                    hitSlop={12}
                    style={{ paddingRight: 12 }}
                  >
                    <Feather name="arrow-left" size={22} color={colors.ink} />
                  </Pressable>
                ),
              })}
            />
            {/* Item 0(b) - polished paywall reachable from the Likes
                screen's upgrade entry points. Modal presentation + its
                own in-screen close (X) button, no native header. */}
            <Stack.Screen
              name="LikesPaywall"
              component={LikesPaywallScreen}
              options={{ headerShown: false, presentation: "modal" }}
            />
            <Stack.Screen
              name="Privacy"
              component={PrivacyScreen}
              options={{ headerShown: true, title: t("nav.privacyTitle") }}
            />
            <Stack.Screen
              name="BlockedUsers"
              component={BlockedUsersScreen}
              options={{ headerShown: true, title: t("nav.blockedUsersTitle") }}
            />
            <Stack.Screen
              name="ReportProfile"
              component={ReportProfileScreen}
              options={{ headerShown: true, title: t("nav.reportTitle") }}
            />
            <Stack.Screen
              name="DirectoryDetail"
              component={DirectoryDetailScreen}
              options={({ route }) => ({ headerShown: true, title: route.params.name || t("nav.detailsFallback") })}
            />
            <Stack.Screen name="Favourites" component={FavouritesScreen} options={{ headerShown: true, title: t("nav.savedTitle") }} />
            <Stack.Screen name="Referral" component={ReferralScreen} options={{ headerShown: true, title: t("nav.referralTitle") }} />
            <Stack.Screen name="Resources" component={ResourcesScreen} options={{ headerShown: true, title: t("nav.resourcesTitle") }} />
            <Stack.Screen
              name="ResourceCategory"
              component={ResourceCategoryScreen}
              options={({ route }) => ({
                headerShown: true,
                title: RESOURCES_CATEGORIES.find((c) => c.slug === route.params.slug)?.eyebrow || t("nav.resourcesTitle"),
              })}
            />
            <Stack.Screen
              name="ResourceTool"
              component={ResourceToolScreen}
              options={({ route }) => ({
                headerShown: true,
                title:
                  RESOURCES_CATEGORIES.find((c) => c.slug === route.params.categorySlug)
                    ?.tools.find((tool) => tool.slug === route.params.toolSlug)?.title || t("nav.resourcesTitle"),
              })}
            />
            <Stack.Screen
              name="Directory"
              component={DirectoryScreen}
              options={({ route }) => ({
                headerShown: true,
                title: route.params?.initialKind === "lawyers" ? t("directory.lawyers") : t("directory.clinics"),
              })}
            />
            <Stack.Screen name="KnowledgeHub" component={KnowledgeHubScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="KnowledgeArticle"
              component={KnowledgeArticleScreen}
              options={({ route }) => ({ headerShown: true, title: route.params.title || t("nav.knowledgeHubTitle") })}
            />
            <Stack.Screen
              name="CompatibilityQuiz"
              component={CompatibilityQuizScreen}
              options={{ headerShown: true, title: t("nav.quizTitle") }}
            />
            <Stack.Screen
              name="FamilyRoom"
              component={FamilyRoomScreen}
              options={{ headerShown: true, title: t("nav.familyRoomTitle") }}
            />
            <Stack.Screen
              name="PregnancyRoom"
              component={PregnancyRoomScreen}
              options={{ headerShown: true, title: t("nav.pregnancyRoomTitle") }}
            />
            <Stack.Screen
              name="CoParentingAgreement"
              component={CoParentingAgreementScreen}
              options={{ headerShown: true, title: t("nav.agreementTitle") }}
            />
            <Stack.Screen
              name="CostCalculator"
              component={CostCalculatorScreen}
              options={{ headerShown: true, title: t("nav.costCalculatorTitle") }}
            />
            <Stack.Screen
              name="SafetyCheckIn"
              component={SafetyCheckInScreen}
              options={{ headerShown: true, title: t("nav.safetyCheckInTitle") }}
            />
            <Stack.Screen
              name="FamilyPlanPicker"
              component={FamilyPlanPickerScreen}
              options={{ headerShown: true, title: t("nav.familyRoomTitle") }}
            />
            <Stack.Screen
              name="CompatibilityAnswers"
              component={CompatibilityAnswersScreen}
              options={{ headerShown: true, title: t("nav.compatibilityAnswersTitle") }}
            />
            <Stack.Screen
              name="CompatibilityReport"
              component={CompatibilityReportScreen}
              options={{ headerShown: true, title: t("nav.compatibilityReportTitle") }}
            />
            <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: true, title: t("nav.termsTitle") }} />
            <Stack.Screen name="TrustSafety" component={TrustSafetyScreen} options={{ headerShown: true, title: t("nav.trustSafetyTitle") }} />
            <Stack.Screen name="Filters" component={FiltersScreen} options={{ headerShown: true, title: t("nav.filtersTitle") }} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, title: t("nav.editProfileTitle") }} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ headerShown: true, title: t("nav.deleteAccountTitle") }} />
            {/* headerShown: false - the wizard builds its own in-content header
                (back chevron + step-specific title + progress indicator),
                matching the prototype's ob-header/wiz-stepper rather than the
                native stack header used by every other screen here. */}
            <Stack.Screen name="ProfileWizard" component={ProfileWizardScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} options={{ headerShown: true, title: t("nav.termsTitle") }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
