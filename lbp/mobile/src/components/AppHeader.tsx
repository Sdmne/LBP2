import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

// Prototype's .app-header (see lbp-prototype-source.html): a small brand
// mark + optional title on the left, a gradient initial-letter avatar on
// the right. Every main-tab screen (#scr-explore, #scr-messages, and by
// the same pattern #scr-browse/#scr-likes/#scr-profile-settings) builds
// this itself in-content - there's no native navigation header anywhere
// in the design. Was previously only half-built (Explore had a bare
// avatar circle with no brand mark; Messages had no header of its own at
// all and relied entirely on MainTabs' native `headerShown:true` title
// bar, which is a plain white bar that doesn't exist in the prototype -
// see the "Explore"/"Messages" extraneous-header reports). Centralizing it
// here since the same three pieces (logo, title, avatar) repeat per-screen.
type Props = {
  title?: string;
  onAvatarPress?: () => void;
  // Alena's Messages-header mockup wants a badge showing how many new
  // messages there are, next to the avatar. Optional and only ever passed
  // by MessagesScreen today (the one screen with a real per-item count to
  // sum) - every other AppHeader caller is unaffected.
  badgeCount?: number;
  // All 4 callers used to be true tab roots (Explore/Catalog/Messages/Me),
  // where "back" makes no sense - you switch tabs instead. KnowledgeHub is
  // the first caller that's actually a PUSHED screen (opened from
  // Explore's "Guides & professionals" list) with its native header
  // hidden (headerShown:false, since it builds this same in-content
  // header) - which left it with no way back at all, not even the
  // system back gesture reliably closing it (Alena: "как отсюда выйти?
  // нет кнопки назад"). Optional so the 3 real tab-root callers are
  // unaffected - only a screen that was actually pushed passes this.
  onBackPress?: () => void;
};

export default function AppHeader({ title, onAvatarPress, badgeCount, onBackPress }: Props) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const initial = (user?.displayName?.[0] ?? "?").toUpperCase();
  return (
    // None of this component's 4 callers (Explore, Catalog, Messages,
    // Knowledge Hub) ever accounted for the status bar - there's no native
    // navigation header on any main-tab screen (see the comment above), so
    // nothing was pushing this row below it. Alena's Messages screenshot
    // showed the title and avatar rendering right under the clock/battery
    // icons, unpressable under there on some phones. Fixed once here
    // instead of in every caller.
    <View style={[styles.row, { paddingTop: 6 + insets.top }]}>
      <View style={styles.brand}>
        {onBackPress ? (
          <Pressable hitSlop={10} onPress={onBackPress} style={styles.backButton}>
            <Feather name="chevron-left" size={24} color="#020817" />
          </Pressable>
        ) : null}
        <Image source={require("../../assets/logo-mark.png")} style={styles.brandIcon} />
        {title ? <Text style={styles.brandName}>{title}</Text> : null}
      </View>
      <View style={styles.avatarWrap}>
        {/* Was a bare LinearGradient with onTouchEnd - a raw touch handler
            on a non-Pressable never properly claims the touch responder,
            so on Android it's easy for the tap to get swallowed (a tiny
            finger movement, or another view nearby claiming the gesture
            first) with nothing happening - Alena: "переход в профиль не
            работает". Pressable's onPress is the reliable, documented way
            to make an arbitrary view tappable in RN. */}
        <Pressable hitSlop={8} onPress={onAvatarPress}>
          <LinearGradient
            colors={["#4e9bff", "#f070a9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </LinearGradient>
        </Pressable>
        {badgeCount ? (
          <View style={styles.badge} pointerEvents="none">
            <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : String(badgeCount)}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  backButton: { marginRight: -2 },
  brandIcon: { width: 26, height: 26 },
  brandName: { fontWeight: "500", fontSize: 16, color: "#020817", letterSpacing: -0.2 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
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
