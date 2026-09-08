import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, type NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { RESOURCES_CATEGORIES } from "../data/resources";
import { colors } from "../theme";
import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import VerifyCodeScreen from "../screens/VerifyCodeScreen";
import ChatScreen from "../screens/ChatScreen";
import ProfileDetailScreen from "../screens/ProfileDetailScreen";
import SettingsScreen from "../screens/SettingsScreen";
import PhotosScreen from "../screens/PhotosScreen";
import VerificationScreen from "../screens/VerificationScreen";
import SubscriptionScreen from "../screens/SubscriptionScreen";
import BlockedUsersScreen from "../screens/BlockedUsersScreen";
import ReportProfileScreen from "../screens/ReportProfileScreen";
import DirectoryDetailScreen from "../screens/DirectoryDetailScreen";
import FavouritesScreen from "../screens/FavouritesScreen";
import ResourceCategoryScreen from "../screens/ResourceCategoryScreen";
import ResourceToolScreen from "../screens/ResourceToolScreen";
import CompatibilityQuizScreen from "../screens/CompatibilityQuizScreen";
import FamilyRoomScreen from "../screens/FamilyRoomScreen";
import CompatibilityAnswersScreen from "../screens/CompatibilityAnswersScreen";
import CompatibilityReportScreen from "../screens/CompatibilityReportScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";
import MainTabs, { type MainTabsParamList } from "./MainTabs";

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
  VerifyCode: undefined;
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
  Subscription: undefined;
  BlockedUsers: undefined;
  ReportProfile: { profileId: number; displayName?: string | null };
  DirectoryDetail: { kind: "clinics" | "lawyers"; slugOrId: string | number; name?: string | null; isFavourite?: boolean };
  Favourites: undefined;
  // "Resources" itself is now a MainTabs tab (see src/navigation/MainTabs.tsx),
  // not a root-stack screen - only its drill-down detail routes stay here,
  // reached by navigate() bubbling up from inside that tab.
  ResourceCategory: { slug: string };
  ResourceTool: { categorySlug: string; toolSlug: string };
  CompatibilityQuiz: undefined;
  // "Family Plan & Shared Family Room" (Family Builder Pro) - opened from
  // ProfileDetailScreen for a given matched profile. displayName is passed
  // through just for the header title; the screen itself refetches
  // everything else from GET /api/member/family-room/{profileId}.
  FamilyRoom: { profileId: number; displayName?: string | null };
  // Persisted two-sided compatibility questionnaire (Family Builder
  // Pro's "Compatibility Score" / "Detailed Compatibility Report") -
  // answering it is free for everyone (no params); the two-sided
  // report needs a profile to compare against, same shape as FamilyRoom.
  CompatibilityAnswers: undefined;
  CompatibilityReport: { profileId: number; displayName?: string | null };
  DeleteAccount: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { t } = useI18n();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.gradientStart} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
            <Stack.Screen name="Photos" component={PhotosScreen} options={{ headerShown: true, title: t("nav.photosTitle") }} />
            <Stack.Screen
              name="Verification"
              component={VerificationScreen}
              options={{ headerShown: true, title: t("nav.verificationTitle") }}
            />
            <Stack.Screen
              name="Subscription"
              component={SubscriptionScreen}
              options={{ headerShown: true, title: t("nav.subscriptionTitle") }}
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
              name="CompatibilityAnswers"
              component={CompatibilityAnswersScreen}
              options={{ headerShown: true, title: t("nav.compatibilityAnswersTitle") }}
            />
            <Stack.Screen
              name="CompatibilityReport"
              component={CompatibilityReportScreen}
              options={{ headerShown: true, title: t("nav.compatibilityReportTitle") }}
            />
            <Stack.Screen
              name="DeleteAccount"
              component={DeleteAccountScreen}
              options={{ headerShown: true, title: t("nav.deleteAccountTitle") }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
