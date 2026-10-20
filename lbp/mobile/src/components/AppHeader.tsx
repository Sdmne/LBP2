import React, { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { useMyAvatarUrl } from "../hooks/useMyAvatar";
import { profilePhotoSource } from "../api/profilePhotoSource";

export const APP_HEADER_ITEM_SIZE = 60;

type Props = {
  title?: string;
  actions?: React.ReactNode;
  badgeCount?: number;
  onBackPress?: () => void;
  onAvatarPress?: () => void;
};

export default function AppHeader({ title, actions, badgeCount, onBackPress, onAvatarPress }: Props) {
  const { user } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const initial = (user?.displayName?.[0] ?? "?").toUpperCase();
  const avatarUrl = useMyAvatarUrl();
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    setFailedAvatarUrl(null);
  }, []));
  const AvatarWrapper = onAvatarPress ? Pressable : View;

  return (
    <View style={[styles.row, { paddingTop: Math.max(0, insets.top - headerHeight) }]}>
      <View style={styles.brand}>
        {onBackPress ? (
          <Pressable hitSlop={10} onPress={onBackPress} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color="#020817" />
          </Pressable>
        ) : null}
        <Image source={require("../../assets/logo-mark.png")} style={styles.brandIcon} resizeMode="contain" />
        {title ? <Text style={styles.brandName} numberOfLines={2}>{title}</Text> : null}
      </View>
      <View style={styles.actions}>
        {actions}
        <AvatarWrapper
          style={styles.avatarWrap}
          onPress={onAvatarPress}
          accessibilityRole={onAvatarPress ? "button" : undefined}
          accessibilityLabel={onAvatarPress ? t("nav.profile") : undefined}
        >
          {avatarUrl && avatarUrl !== failedAvatarUrl ? (
            <Image source={profilePhotoSource(avatarUrl)} style={styles.avatar} onError={() => setFailedAvatarUrl(avatarUrl)} />
          ) : (
            <LinearGradient
              colors={["#4e9bff", "#f070a9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
          )}
          {badgeCount ? (
            <View style={styles.badge} pointerEvents="none">
              <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : String(badgeCount)}</Text>
            </View>
          ) : null}
        </AvatarWrapper>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 8,
  },
  brand: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  backButton: { minWidth: 44, height: APP_HEADER_ITEM_SIZE, alignItems: "center", justifyContent: "center" },
  brandIcon: { width: APP_HEADER_ITEM_SIZE, height: APP_HEADER_ITEM_SIZE, flexShrink: 0 },
  brandName: { flexShrink: 1, fontWeight: "500", fontSize: 16, lineHeight: 20, color: "#020817", letterSpacing: -0.2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  avatarWrap: { position: "relative", width: APP_HEADER_ITEM_SIZE, height: APP_HEADER_ITEM_SIZE },
  avatar: {
    width: APP_HEADER_ITEM_SIZE,
    height: APP_HEADER_ITEM_SIZE,
    borderRadius: APP_HEADER_ITEM_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 22 },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 3,
    backgroundColor: "#f31260",
    borderWidth: 1.5,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9.5, fontWeight: "700" },
});
