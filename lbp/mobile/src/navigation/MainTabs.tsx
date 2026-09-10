import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { colors } from "../theme";
import { useI18n } from "../i18n/I18nContext";
import ExploreScreen from "../screens/ExploreScreen";
import CatalogScreen from "../screens/CatalogScreen";
import LikesScreen from "../screens/LikesScreen";
import MessagesScreen from "../screens/MessagesScreen";
import MeProfileScreen from "../screens/MeProfileScreen";
import type { CatalogFilters } from "../api/catalogFilters";

export type MainTabsParamList = {
  Explore: undefined;
  // appliedFilters/appliedAt: FiltersScreen (pushed on the root stack, see
  // RootNavigator) navigates back here with fresh params rather than
  // passing a callback through params (not serializable). appliedAt is a
  // timestamp so CatalogScreen's consuming effect fires even when the same
  // filters are re-applied.
  Catalog: { appliedFilters?: CatalogFilters; appliedAt?: number } | undefined;
  Likes: undefined;
  Messages: undefined;
  Me: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

// Sept 2026: replaced the old 6-tab layout (Catalog/Likes/Messages/
// Directory/Resources/Me, which mirrored the site's then-current routes 1:1
// - see git history for that version's rationale) with the new prototype's
// 5-tab IA (Explore/People/Likes/Messages/Me), per Alena's explicit choice
// to switch rather than add Explore alongside the old tabs. Directory and
// Resources are no longer tabs - they're still real screens, just pushed
// from RootNavigator now (from ExploreScreen's "Guides & professionals"
// list, or MeProfileScreen for Resources) instead of living in the tab bar.
//
// UPDATE (Sept 2026, later same day): swapped the emoji glyphs for real
// Feather line icons (matches the prototype's own thin outline SVGs far
// more closely than emoji ever could) now that @expo/vector-icons is
// actually installed.
const ICON_NAMES: Record<keyof MainTabsParamList, keyof typeof Feather.glyphMap> = {
  Explore: "compass",
  Catalog: "users",
  Likes: "heart",
  Messages: "message-circle",
  Me: "user",
};

const TAB_BAR_HEIGHT = 60;

// UPDATE (Sept 2026, THIRD attempt at this same bug): every previous fix
// (tabIconWrap centering, then tabBarButton's justifyContent override,
// then giving that button an explicit height) still shipped Alena
// screenshots of the icon pinned to the top of the pill, even after she
// confirmed the published commit hash matched and closed/reopened the app
// five times - ruling out both a stale build AND an update-propagation
// delay. Each of those fixes patched one more layer of react-navigation's
// OWN internal tab-bar rendering (BottomTabBar's row -> BottomTabItem's
// wrapper -> its button), and something in that chain kept not resolving
// on-device the way the library's own source predicts - never fully
// root-caused, because there's no way to inspect live layout from here.
// Rather than patch a fourth layer of an internals stack that's proven
// unreliable to reason about blind, this replaces the tab bar's rendering
// entirely via the documented `tabBar` escape hatch (the actual JSX, not
// just style/button props) - a plain, from-scratch row of Pressables this
// code fully owns, with zero dependency on BottomTabBar/BottomTabItem's
// internal layout at any point.
function CustomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View
      style={[
        styles.bar,
        {
          bottom: 22 + insets.bottom,
        },
      ]}
    >
      <BlurView
        intensity={80}
        tint="light"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,0.35)" }]}
      />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const iconName = ICON_NAMES[route.name as keyof MainTabsParamList];
          const color = focused ? colors.pink : "#a3a3a3";

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key]?.options.title}
              style={styles.item}
            >
              <Feather name={iconName} size={22} color={color} style={{ opacity: focused ? 1 : 0.85 }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: TAB_BAR_HEIGHT,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "rgba(2,8,23,1)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 12,
  },
  row: {
    flex: 1,
    flexDirection: "row",
  },
  // Every item is explicitly TAB_BAR_HEIGHT tall and centers its own icon
  // on both axes - not relying on any ancestor's flex resolution to hand
  // it that height, which is exactly what kept failing before.
  item: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function MainTabs() {
  const { t } = useI18n();
  // The pill used to float a fixed 22px off the raw screen edge, matching
  // the prototype's own CSS bottom:22 - but the prototype runs in a
  // browser mockup with no real OS gesture-navigation bar to clear. On an
  // actual Android device with gesture nav, that fixed 22px sits the pill
  // partly under/behind the system nav area rather than above it (reported
  // by Alena: tab bar "stuck at the very bottom, not fully visible").
  // Adding the real safe-area bottom inset on top of the prototype's own
  // 22px keeps the same visual spacing from the *usable* screen edge on
  // every device, gesture-nav or 3-button. CustomTabBar above reads
  // `insets` from its own BottomTabBarProps (react-navigation passes the
  // same safe-area value in), so nothing here needs it directly anymore.
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
      }}
    >
      {/* Explore/Messages build their own in-content .app-header (brand mark +
          title + avatar), matching the prototype exactly - the native
          header here was a duplicate plain white bar the prototype doesn't
          have (see ExploreScreen/MessagesScreen's own AppHeader). Catalog/
          Likes/Me keep the native header for now - not part of this pass. */}
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ title: t("nav.explore"), headerShown: false }}
      />
      {/* UPDATE (Sept 2026): Catalog builds its own in-content header (logo +
          "Browse profiles" + filter/avatar buttons - see CatalogScreen.tsx),
          same as Explore/Messages above. The native header here was a
          second, duplicate "Browse" bar stacked on top of it, eating
          vertical space and pushing the swipe card's name/actions down
          under the floating tab bar - Alena's "не попадает в экран ничего
          не нажать" screenshot showed exactly this. */}
      <Tab.Screen
        name="Catalog"
        component={CatalogScreen}
        options={{ title: t("nav.browse"), headerShown: false }}
      />
      <Tab.Screen name="Likes" component={LikesScreen} options={{ title: t("nav.likes") }} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ title: t("nav.messages"), headerShown: false }}
      />
      <Tab.Screen name="Me" component={MeProfileScreen} options={{ title: t("nav.profile"), headerShown: false }} />
    </Tab.Navigator>
  );
}
