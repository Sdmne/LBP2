import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchLikes } from "../api/likes";
import { ApiError } from "../api/client";
import type { ProfileSummary } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";

type Props = NativeStackScreenProps<RootStackParamList, "FamilyPlanPicker">;

// Alena asked why tapping "Family Plan" on Explore just opens Messages -
// real reason (see the comment that used to sit on that tile in
// ExploreScreen.tsx): FamilyRoom needs a specific matched profile's id, and
// there's no single "the" match to jump to, so the tile fell back to the
// plain inbox as a workaround. That's confusing on its own (the tile says
// "Family Plan", the screen it opens says "Messages" with zero connection
// between them) - this screen replaces that workaround with the real
// thing: fetch the person's actual matches (same GET /api/member/likes
// call LikesScreen's "Matches" tab already uses) and let them pick who to
// plan with, landing directly in that person's Family Room. Zero matches
// still needs a real fallback (nobody to plan with yet) - Explore's tile
// onPress skips this screen entirely and goes straight to that case
// (Alert + Browse CTA) or straight to FamilyRoom when there's exactly one
// match, so this screen only ever renders for the 2+ case.
export default function FamilyPlanPickerScreen({ navigation }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLikes()
      .then((res) => setMatches(res.matches))
      .catch((err) => setError(err instanceof ApiError ? err.message : t("common.somethingWrong")))
      .finally(() => setLoading(false));
  }, [t]);

  return (
    <GradientBackground variant="soft">
      <View style={styles.screen}>
        <Text style={styles.title}>{t("familyPlanPicker.title")}</Text>
        <Text style={styles.subtitle}>{t("familyPlanPicker.subtitle")}</Text>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.pink} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={matches}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[styles.list, { paddingBottom: spacing.xl + insets.bottom }]}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => navigation.replace("FamilyRoom", { profileId: item.id, displayName: item.displayName })}
              >
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarPlaceholderText}>{item.displayName?.[0] ?? "?"}</Text>
                  </View>
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.subtitleRow} numberOfLines={1}>
                    {[item.city, item.country].filter(Boolean).join(", ") || t("common.locationNotSet")}
                  </Text>
                </View>
                <Text style={styles.chevron}>{"›"}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  subtitle: { fontSize: 13.5, color: colors.muted, paddingHorizontal: spacing.lg, marginTop: 4, marginBottom: spacing.md, lineHeight: 19 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger, textAlign: "center" },
  list: { paddingHorizontal: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  avatar: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.line },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarPlaceholderText: { fontSize: 20, fontWeight: "700", color: colors.muted },
  rowBody: { flex: 1 },
  name: { fontSize: 16, fontWeight: "700", color: colors.ink },
  subtitleRow: { fontSize: 13, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.muted },
});
