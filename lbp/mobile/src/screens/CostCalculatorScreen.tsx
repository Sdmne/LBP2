import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable, Linking } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import type { RootStackParamList } from "../navigation/RootNavigator";
import GradientBackground from "../components/GradientBackground";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import {
  PARENTHOOD_COST_PATHS,
  pathTotalRange,
  type ParenthoodCostPath,
} from "../data/parenthoodCostData";

// Premium roadmap, step 6: a cost-of-parenthood-path calculator. Deliberately
// built as a purely static/informational tool - no backend endpoint, no
// account data, nothing to deploy - the same reason "Rewind" (step 1) was
// picked as an easy first step. Unlike the rest of the "premium roadmap"
// items, this one is NOT gated behind a paywall: it's positioned as an
// INFORM-pillar trust-building tool (see the master brief's three pillars,
// INFORM/SUPPORT/PROTECT), the same spirit as the free Resources worksheets
// this screen links out to - gating basic cost information behind a
// paywall would cut against that positioning. The soft upsell instead is a
// single CTA at the bottom pointing at the AI Family Advisor (Premium) for
// a personalized conversation, plus a link to the Co-Parenting Agreement
// tool for anyone already matched.
function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export default function CostCalculatorScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useI18n();
  const [selectedKey, setSelectedKey] = useState(PARENTHOOD_COST_PATHS[0].key);
  const [units, setUnits] = useState<Record<string, number>>(() =>
    Object.fromEntries(PARENTHOOD_COST_PATHS.map((path) => [path.key, path.defaultUnits])),
  );

  const selected = useMemo<ParenthoodCostPath>(
    () => PARENTHOOD_COST_PATHS.find((path) => path.key === selectedKey) || PARENTHOOD_COST_PATHS[0],
    [selectedKey],
  );
  const selectedUnits = units[selected.key] ?? selected.defaultUnits;
  const total = pathTotalRange(selected, selectedUnits);

  const adjustUnits = (delta: number) => {
    setUnits((prev) => {
      const current = prev[selected.key] ?? selected.defaultUnits;
      const next = Math.min(selected.maxUnits, Math.max(selected.minUnits, current + delta));
      return { ...prev, [selected.key]: next };
    });
  };

  return (
    <GradientBackground variant="soft">
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t("costCalc.title")}</Text>
        <Text style={styles.subtitle}>{t("costCalc.subtitle")}</Text>

        <View style={styles.disclaimerBox}>
          <Feather name="info" size={14} color={colors.muted} />
          <Text style={styles.disclaimerText}>{t("costCalc.disclaimer")}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t("costCalc.choosePath")}</Text>
        <View style={styles.pathList}>
          {PARENTHOOD_COST_PATHS.map((path) => {
            const isActive = path.key === selectedKey;
            return (
              <Pressable
                key={path.key}
                style={[styles.pathRow, isActive && styles.pathRowActive]}
                onPress={() => setSelectedKey(path.key)}
              >
                <View style={[styles.pathIconWrap, isActive && styles.pathIconWrapActive]}>
                  <Feather name={path.icon as any} size={16} color={isActive ? colors.white : colors.pink} />
                </View>
                <Text style={[styles.pathRowLabel, isActive && styles.pathRowLabelActive]}>
                  {t(`costCalc.path.${path.key}.title`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t(`costCalc.path.${selected.key}.title`)}</Text>
          <Text style={styles.cardDesc}>{t(`costCalc.path.${selected.key}.desc`)}</Text>

          {selected.perCycle ? (
            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>{t("costCalc.cyclesLabel")}</Text>
              <View style={styles.stepperControls}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => adjustUnits(-1)}
                  disabled={selectedUnits <= selected.minUnits}
                >
                  <Feather name="minus" size={16} color={selectedUnits <= selected.minUnits ? colors.line : colors.ink} />
                </Pressable>
                <Text style={styles.stepperValue}>{selectedUnits}</Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => adjustUnits(1)}
                  disabled={selectedUnits >= selected.maxUnits}
                >
                  <Feather name="plus" size={16} color={selectedUnits >= selected.maxUnits ? colors.line : colors.ink} />
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={styles.totalBlock}>
            <Text style={styles.totalLabel}>{t("costCalc.estimatedTotal")}</Text>
            <Text style={styles.totalValue}>
              {formatUsd(total.low)} – {formatUsd(total.high)}
            </Text>
            <Text style={styles.totalUnitNote}>
              {selected.perCycle ? t("costCalc.totalForCycles", { count: selectedUnits }) : t("costCalc.totalOneTime")}
            </Text>
          </View>

          <Text style={styles.breakdownLabel}>{t("costCalc.breakdown")}</Text>
          <View style={styles.itemList}>
            {selected.items.map((item) => (
              <View key={item.key} style={styles.itemRow}>
                <Text style={styles.itemLabel}>{t(`costCalc.item.${item.key}`)}</Text>
                <Text style={styles.itemValue}>
                  {formatUsd(item.low)} – {formatUsd(item.high)}
                  {selected.perCycle ? t("costCalc.perCycleSuffix") : ""}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.tipBox}>
            <Feather name="star" size={13} color={colors.premium} />
            <Text style={styles.tipText}>{t(`costCalc.path.${selected.key}.tip`)}</Text>
          </View>
        </View>

        <Pressable
          style={styles.linkRow}
          onPress={() => navigation.navigate("ResourceTool", { categorySlug: "parenthood-planning", toolSlug: "financial-planning" })}
        >
          <Feather name="file-text" size={16} color={colors.blue} />
          <Text style={styles.linkText}>{t("costCalc.linkWorksheet")}</Text>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </Pressable>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate("AiAdvisor")}>
          <Feather name="message-circle" size={16} color={colors.blue} />
          <Text style={styles.linkText}>{t("costCalc.linkAdvisor")}</Text>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </Pressable>

        <Text style={styles.footerNote}>{t("costCalc.footerNote")}</Text>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink },
  subtitle: { fontSize: 13.5, color: colors.muted, lineHeight: 19, marginTop: -4 },
  disclaimerBox: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "flex-start",
  },
  disclaimerText: { flex: 1, fontSize: 12, color: colors.muted, lineHeight: 16 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: colors.muted, marginTop: spacing.xs },
  pathList: { gap: 6 },
  pathRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  pathRowActive: { borderColor: colors.pink, backgroundColor: colors.tintPink },
  pathIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.tintPink,
    alignItems: "center",
    justifyContent: "center",
  },
  pathIconWrapActive: { backgroundColor: colors.pink },
  pathRowLabel: { fontSize: 13.5, fontWeight: "600", color: colors.ink, flex: 1 },
  pathRowLabelActive: { color: colors.pink, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  cardDesc: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: -4 },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  stepperLabel: { fontSize: 13, fontWeight: "600", color: colors.ink, flex: 1 },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: { fontSize: 15, fontWeight: "700", color: colors.ink, minWidth: 20, textAlign: "center" },
  totalBlock: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  totalLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  totalValue: { fontSize: 22, fontWeight: "800", color: colors.pink, marginTop: 2 },
  totalUnitNote: { fontSize: 11.5, color: colors.muted, marginTop: 2 },
  breakdownLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, marginTop: spacing.xs },
  itemList: { gap: 4 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  itemLabel: { fontSize: 13, color: colors.text, flex: 1 },
  itemValue: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  tipBox: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.tint,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "flex-start",
    marginTop: spacing.xs,
  },
  tipText: { flex: 1, fontSize: 12.5, color: colors.ink, lineHeight: 17 },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  linkText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.ink },
  footerNote: { fontSize: 11, color: colors.muted, lineHeight: 15, textAlign: "center", marginTop: spacing.xs },
});
