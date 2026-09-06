import React, { useState } from "react";
import { ActivityIndicator, ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabNavigationProp, BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { MainTabsParamList } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = BottomTabScreenProps<MainTabsParamList, "Me">;

// Deliberately minimal for now: shows what we already have from login
// (GET /api/auth/me / the login response) rather than guessing the exact
// shape of GET /api/member/me (a large, not-yet-traced endpoint - see the
// comment above it in main.py).
export default function MeProfileScreen(_props: Props) {
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Same underlying navigation object as rootNav above, typed separately so
  // TypeScript knows "Resources" is a sibling tab (see MainTabs.tsx) rather
  // than a root-stack screen - switches tabs instead of pushing a duplicate
  // screen on top of the stack.
  const tabNav = useNavigation<BottomTabNavigationProp<MainTabsParamList>>();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  const rows: { icon: string; label: string; onPress: () => void }[] = [
    { icon: "❤️", label: t("me.saved"), onPress: () => rootNav.navigate("Favourites") },
    { icon: "🧰", label: t("me.resources"), onPress: () => tabNav.navigate("Resources") },
    { icon: "⚙️", label: t("me.settings"), onPress: () => rootNav.navigate("Settings") },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.displayName?.[0] ?? "?"}</Text>
        </View>
        <Text style={styles.name}>{user?.displayName}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        {user?.emailVerified === false ? (
          <Text style={styles.notice}>{t("me.emailNotVerified")}</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        {rows.map((row, i) => (
          <Pressable
            key={row.label}
            style={[styles.row, i === rows.length - 1 && styles.rowLast]}
            onPress={row.onPress}
          >
            <View style={styles.rowIconWrap}>
              <Text style={styles.rowIcon}>{row.icon}</Text>
            </View>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowChevron}>{"›"}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logout} onPress={handleLogout} disabled={loggingOut}>
        {loggingOut ? <ActivityIndicator color={colors.pink} /> : <Text style={styles.logoutText}>{t("me.logout")}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  hero: { alignItems: "center", marginBottom: spacing.lg },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 34, fontWeight: "800", color: colors.blue },
  name: { fontSize: 19, fontWeight: "600", color: colors.ink },
  email: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  notice: { fontSize: 13, color: colors.premium, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIcon: { fontSize: 16 },
  rowLabel: { flex: 1, fontSize: 14.5, fontWeight: "500", color: colors.ink },
  rowChevron: { fontSize: 18, color: "#a3a3a3" },
  logout: { alignItems: "center", paddingVertical: spacing.lg },
  logoutText: { color: colors.pink, fontSize: 13.5, fontWeight: "600" },
});
