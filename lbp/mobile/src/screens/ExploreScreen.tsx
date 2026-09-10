import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainTabsParamList } from "../navigation/MainTabs";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { openFamilyPlan } from "../utils/familyPlan";
import AppHeader from "../components/AppHeader";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing, tabBarClearance } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import { emptyCatalogFilters } from "../api/catalogFilters";
import type { CatalogFilters } from "../api/catalogFilters";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabsParamList, "Explore">,
  NativeStackNavigationProp<RootStackParamList>
>;

// New home dashboard, per the Sept 2026 prototype's #scr-explore (43-screen
// version, not the older single-file prototype the rest of the app was
// aligned to earlier) and Alena's explicit choice to replace the tab
// structure with it rather than add it alongside (see MainTabs.tsx). Ported
// 1:1 for copy/layout; a few taps had no exact real-screen equivalent to
// point to, called out below.
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { t } = useI18n();

  // All five path cards used to land on the exact same unfiltered Catalog
  // deck, which read to Alena as "these buttons lead nowhere" - there was
  // nothing differentiating one card's outcome from another's. Catalog
  // already supports arriving with appliedFilters/appliedAt (the same
  // params FiltersScreen passes back), so each card that has a clean
  // matching enum now pre-applies a real filter. "partner" and "exploring"
  // (the prototype's own copy for "Still exploring" points at the
  // compatibility quiz, not browse) have no clean 1:1 filter, so they stay
  // a plain unfiltered browse rather than guessing at one.
  const goBrowse = (filters?: Partial<CatalogFilters>) =>
    navigation.navigate("Catalog", filters ? { appliedFilters: { ...emptyCatalogFilters(), ...filters }, appliedAt: Date.now() } : undefined);

  const PATH_FILTERS: Record<string, Partial<CatalogFilters> | undefined> = {
    coparenting: { lookingFor: ["CO_PARENTING_PARTNER"] },
    donor: { donorTypes: ["SPERM", "EGG"] },
    partner: undefined,
    coupleDonor: { profileTypes: ["HETERO_COUPLE", "LESBIAN_COUPLE", "GAY_COUPLE"], donorTypes: ["SPERM", "EGG"] },
    exploring: undefined,
  };

  // Prototype's .path-card.blue/.pink alternate two tint backgrounds
  // behind the icon (.path-card .icon).
  //
  // UPDATE (Sept 2026): these were raw emoji (🤝/🧬/💞/👩‍❤️‍👩/🧭) - Alena
  // flagged that they visibly clash with each other (a plain handshake next
  // to a full-color illustrated couple emoji next to a compass, each a
  // different style/weight) and with the rest of the app, which already
  // uses one consistent Feather line-icon set (tab bar, Profile rows,
  // Messages/Explore's own guide-list icons below). Switched to Feather for
  // the same reason - one icon language across the whole app, not five
  // different ones on this one screen.
  const paths: { key: string; icon: keyof typeof Feather.glyphMap; tone: "blue" | "pink"; wide?: boolean }[] = [
    { key: "coparenting", icon: "users", tone: "blue" },
    { key: "donor", icon: "droplet", tone: "pink" },
    { key: "partner", icon: "heart", tone: "blue" },
    { key: "coupleDonor", icon: "user-plus", tone: "pink" },
    { key: "exploring", icon: "compass", tone: "blue", wide: true },
  ];

  return (
    <GradientBackground variant="soft">
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + tabBarClearance + insets.bottom }]}>
      <AppHeader onAvatarPress={() => navigation.navigate("Me")} />
      <Text style={styles.greeting}>{t("explore.greeting", { name: user?.displayName || "" })}</Text>
      <Text style={styles.subtitle}>{t("explore.subtitle")}</Text>

      <Text style={styles.sectionTitle}>{t("explore.findYourPath")}</Text>
      <View style={styles.pathGrid}>
        {paths.map((path) => (
          <Pressable
            key={path.key}
            style={[styles.pathCard, path.wide && styles.pathCardWide]}
            onPress={() => goBrowse(PATH_FILTERS[path.key])}
          >
            <View style={[styles.pathIconWrap, path.tone === "pink" ? styles.pathIconWrapPink : styles.pathIconWrapBlue]}>
              <Feather name={path.icon} size={17} color={path.tone === "pink" ? colors.pink : colors.blue} />
            </View>
            <View style={path.wide ? styles.pathTextWide : undefined}>
              <Text style={styles.pathTitle}>{t(`explore.path.${path.key}.title`)}</Text>
              <Text style={styles.pathDesc}>{t(`explore.path.${path.key}.desc`)}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t("explore.continueJourney")}</Text>
      <View style={styles.toolRow}>
        <Pressable style={styles.toolChip} onPress={() => navigation.navigate("CompatibilityQuiz")}>
          <Text style={styles.toolTitle}>{t("explore.tool.quiz.title")}</Text>
          <Text style={styles.toolDesc}>{t("explore.tool.quiz.desc")}</Text>
          <Text style={styles.toolTag}>{t("explore.tool.quiz.tag")}</Text>
        </Pressable>
        <Pressable
          style={styles.toolChip}
          onPress={() => navigation.navigate("ResourceTool", { categorySlug: "co-parenting", toolSlug: "planning-template" })}
        >
          <Text style={styles.toolTitle}>{t("explore.tool.planning.title")}</Text>
          <Text style={styles.toolDesc}>{t("explore.tool.planning.desc")}</Text>
          <Text style={styles.toolTag}>{t("explore.tool.planning.tag")}</Text>
        </Pressable>
        <Pressable style={styles.toolChip} onPress={() => openFamilyPlan(navigation, t)}>
          <Text style={styles.toolTitle}>{t("explore.tool.familyPlan.title")}</Text>
          <Text style={styles.toolDesc}>{t("explore.tool.familyPlan.desc")}</Text>
          <Text style={styles.toolTag}>{t("explore.tool.familyPlan.tag")}</Text>
        </Pressable>
      </View>

      {/* Prototype's .trust-strip: linear-gradient(135deg,var(--tint),var(--tint-pink)), not a flat tint. */}
      <Pressable onPress={() => navigation.navigate("Verification")}>
        <LinearGradient
          colors={[colors.tint, colors.tintPink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.trustStrip}
        >
          <Feather name="shield" size={20} color={colors.blue} style={styles.trustIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.trustTitle}>{t("explore.trustTitle")}</Text>
            <Text style={styles.trustBody}>{t("explore.trustBody")}</Text>
          </View>
        </LinearGradient>
      </Pressable>

      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>{t("explore.guidesTitle")}</Text>
      <View style={styles.guidesCard}>
        <Pressable style={styles.guideRow} onPress={() => navigation.navigate("KnowledgeHub")}>
          <View style={[styles.guideIconWrap, { backgroundColor: colors.tint }]}>
            <Feather name="book" size={17} color={colors.blue} />
          </View>
          <Text style={styles.guideLabel}>{t("nav.knowledgeHubTitle")}</Text>
          <Text style={styles.guideChevron}>{"›"}</Text>
        </Pressable>
        <Pressable style={styles.guideRow} onPress={() => navigation.navigate("Resources")}>
          <View style={[styles.guideIconWrap, { backgroundColor: colors.tintPink }]}>
            <Feather name="clipboard" size={17} color={colors.pink} />
          </View>
          <Text style={styles.guideLabel}>{t("explore.linkResources")}</Text>
          <Text style={styles.guideChevron}>{"›"}</Text>
        </Pressable>
        <Pressable style={styles.guideRow} onPress={() => navigation.navigate("Directory", { initialKind: "clinics" })}>
          <View style={[styles.guideIconWrap, { backgroundColor: colors.tintPink }]}>
            <Feather name="plus-circle" size={17} color={colors.pink} />
          </View>
          <Text style={styles.guideLabel}>{t("directory.clinics")}</Text>
          <Text style={styles.guideChevron}>{"›"}</Text>
        </Pressable>
        <Pressable
          style={[styles.guideRow, styles.guideRowLast]}
          onPress={() => navigation.navigate("Directory", { initialKind: "lawyers" })}
        >
          <View style={[styles.guideIconWrap, { backgroundColor: colors.tintPink }]}>
            <Feather name="briefcase" size={17} color={colors.pink} />
          </View>
          <Text style={styles.guideLabel}>{t("directory.lawyers")}</Text>
          <Text style={styles.guideChevron}>{"›"}</Text>
        </Pressable>
      </View>
    </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  content: { padding: spacing.lg, paddingBottom: spacing.xl + tabBarClearance },
  hero: { alignItems: "flex-end" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.tintPink,
    color: colors.pink,
    textAlign: "center",
    textAlignVertical: "center",
    lineHeight: 36,
    fontWeight: "800",
    overflow: "hidden",
  },
  greeting: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: spacing.sm },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: spacing.xs, lineHeight: 20 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: colors.ink, marginTop: spacing.xl, marginBottom: spacing.sm },
  pathGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pathCard: {
    width: "47%",
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  pathCardWide: { width: "100%", flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pathTextWide: { flex: 1 },
  pathIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
    flexShrink: 0,
  },
  pathIconWrapBlue: { backgroundColor: colors.tint },
  pathIconWrapPink: { backgroundColor: colors.tintPink },
  pathIcon: { fontSize: 16 },
  pathTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  pathDesc: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },
  toolRow: { gap: spacing.sm },
  toolChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  toolTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  toolDesc: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  toolTag: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.pink,
    backgroundColor: colors.tintPink,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  trustStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  trustIcon: { width: 22 },
  trustTitle: { fontSize: 13.5, fontWeight: "700", color: colors.ink },
  trustBody: { fontSize: 12, color: colors.muted, marginTop: 2 },
  guidesCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  guideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  guideRowLast: { borderBottomWidth: 0 },
  guideIconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  guideIcon: { fontSize: 16 },
  guideLabel: { flex: 1, fontSize: 14.5, fontWeight: "500", color: colors.ink },
  guideChevron: { fontSize: 18, color: "#a3a3a3" },
});
