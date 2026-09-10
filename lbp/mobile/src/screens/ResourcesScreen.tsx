import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { RESOURCES_CATEGORIES, CATEGORY_ICON } from "../data/resources";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";

// UPDATE (Sept 2026): restyled from a heavy card-per-item layout (which
// mirrored the website's /resources index instead of the mobile
// prototype) to the prototype's actual #scr-resources look - a subtitle,
// then plain icon-wrap/title/meta list rows (.doc-row) grouped under
// "Start here" and "Browse by category", the same row pattern already
// used on ExploreScreen/SettingsScreen/MeProfileScreen. Real data and
// navigation are unchanged - RESOURCES_CATEGORIES already carries an
// icon key ("coparenting"/"fertility"/"planning") that maps directly to
// the prototype's blue/pink/green icon-wrap colors, so nothing here is
// invented. Moved to data/resources.ts (CATEGORY_ICON) so
// ResourceCategoryScreen.tsx can share the exact same mapping.

export default function ResourcesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  return (
    <GradientBackground variant="soft">
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <Text style={styles.sub}>
        Guides, templates and tools to help you plan your path to parenthood.
      </Text>

      <Text style={styles.groupTitle}>Start here</Text>
      <View style={styles.card}>
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate("CompatibilityQuiz")}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.tintPink }]}>
            <Text style={styles.icon}>🧭</Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Compatibility Quiz</Text>
            <Text style={styles.rowMeta}>26 questions, ~5 min — reflect, not score</Text>
          </View>
          <Text style={styles.chevron}>{"\u203a"}</Text>
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowDivider]}
          onPress={() => navigation.navigate("ResourceTool", { categorySlug: "co-parenting", toolSlug: "planning-template" })}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.tint }]}>
            <Text style={styles.icon}>📄</Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Co-Parenting Planning Template</Text>
            <Text style={styles.rowMeta}>10 sections to align with a co-parent</Text>
          </View>
          <Text style={styles.chevron}>{"\u203a"}</Text>
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowDivider]}
          onPress={() => navigation.navigate("ResourceTool", { categorySlug: "co-parenting", toolSlug: "questions-to-ask" })}
        >
          <View style={[styles.iconWrap, { backgroundColor: "#e6f7ef" }]}>
            <Text style={styles.icon}>❓</Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Questions to Ask a Potential Co-Parent</Text>
            <Text style={styles.rowMeta}>A conversation starter list</Text>
          </View>
          <Text style={styles.chevron}>{"\u203a"}</Text>
        </Pressable>
      </View>

      <Text style={styles.groupTitle}>Browse by category</Text>
      <View style={styles.card}>
        {RESOURCES_CATEGORIES.map((cat, i) => {
          const iconInfo = CATEGORY_ICON[cat.icon] || { emoji: "\ud83d\udcc4", bg: colors.bgSoft };
          return (
            <Pressable
              key={cat.slug}
              style={[styles.row, i > 0 && styles.rowDivider]}
              onPress={() => navigation.navigate("ResourceCategory", { slug: cat.slug })}
            >
              <View style={[styles.iconWrap, { backgroundColor: iconInfo.bg }]}>
                <Text style={styles.icon}>{iconInfo.emoji}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{cat.eyebrow}</Text>
                <Text style={styles.rowMeta}>{cat.description}</Text>
              </View>
              <Text style={styles.chevron}>{"\u203a"}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.proCard}>
        <Text style={styles.proIcon}>{"\ud83d\udcac"}</Text>
        <Text style={styles.proTitle}>Looking for professional guidance?</Text>
        <Text style={styles.proBody}>
          Some questions are better discussed with a qualified professional. LetsBeParents is building a trusted
          space to connect people with psychological, medical and other professional support when they need it.
        </Text>
      </View>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  groupTitle: { fontSize: 12.5, fontWeight: "700", color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  iconWrap: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 18 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  rowMeta: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  chevron: { fontSize: 18, color: "#a3a3a3" },
  proCard: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    alignItems: "flex-start",
  },
  proIcon: { fontSize: 22, marginBottom: spacing.xs },
  proTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  proBody: { fontSize: 13, color: colors.muted, marginTop: spacing.xs, lineHeight: 18 },
});
