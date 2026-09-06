import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors } from "../theme";
import { useI18n } from "../i18n/I18nContext";
import CatalogScreen from "../screens/CatalogScreen";
import LikesScreen from "../screens/LikesScreen";
import MessagesScreen from "../screens/MessagesScreen";
import DirectoryScreen from "../screens/DirectoryScreen";
import ResourcesScreen from "../screens/ResourcesScreen";
import MeProfileScreen from "../screens/MeProfileScreen";

export type MainTabsParamList = {
  Catalog: undefined;
  Likes: undefined;
  Messages: undefined;
  Directory: undefined;
  Resources: undefined;
  Me: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

// Tabs mirror the real, currently-shipping routes in lbp/frontend/src/ui.tsx
// (/catalog, /likes, /messages, /profile, plus /clinics + /lawyers which are
// top-level nav links on the site - combined into one "Directory" tab here
// with a Clinics/Lawyers switch inside, see DirectoryScreen) rather than the
// reimagined Explore/People/Plan/Family IA from the redesign brief - that
// redesign isn't built in the real backend/frontend yet, so the app follows
// what actually exists today. Update this once the real IA changes.
//
// "Resources" is the one exception: on the site it's a header/footer link,
// not a primary nav item, and it was originally left out of this tab bar
// for the same reason (six tabs is already a lot for a phone-width bottom
// bar). Moved here by explicit request so the section has its own tab
// instead of being buried one level inside Profile - MeProfileScreen still
// links to it too (switches to this tab rather than pushing a duplicate
// screen), for anyone used to finding it there.
const ICONS: Record<keyof MainTabsParamList, string> = {
  Catalog: "🧭",
  Likes: "❤️",
  Messages: "💬",
  Directory: "🏥",
  Resources: "🧰",
  Me: "👤",
};

export default function MainTabs() {
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: colors.gradientStart,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICONS[route.name as keyof MainTabsParamList]}</Text>,
      })}
    >
      <Tab.Screen name="Catalog" component={CatalogScreen} options={{ title: t("nav.browse") }} />
      <Tab.Screen name="Likes" component={LikesScreen} options={{ title: t("nav.likes") }} />
      <Tab.Screen name="Messages" component={MessagesScreen} options={{ title: t("nav.messages") }} />
      <Tab.Screen name="Directory" component={DirectoryScreen} options={{ title: t("nav.directory") }} />
      <Tab.Screen name="Resources" component={ResourcesScreen} options={{ title: t("nav.resourcesTitle") }} />
      <Tab.Screen name="Me" component={MeProfileScreen} options={{ title: t("nav.profile") }} />
    </Tab.Navigator>
  );
}
