import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";

export type OptionRow = { value: string; label: string; count?: number };

// Shared full-screen modal list picker - single or multi-select, with an
// optional loading spinner for async option lists (country/city). Extracted
// from FiltersScreen.tsx (its original, only caller) once EditProfileScreen
// needed the same country/city/ethnicity picker UI, per the "worth
// promoting to src/components/ if a second screen wants one" note left
// there when it was first built.
export function OptionListPicker({
  title,
  options,
  selected,
  multi,
  loading,
  onToggle,
  onClose,
}: {
  title: string;
  options: OptionRow[];
  selected: string[];
  multi: boolean;
  loading?: boolean;
  onToggle: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.done}>{t("filters.done")}</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.pink} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}>
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <Pressable key={option.value || "any"} style={styles.row} onPress={() => onToggle(option.value)}>
                <Text style={styles.rowLabel}>
                  {option.label}
                  {typeof option.count === "number" ? ` (${option.count})` : ""}
                </Text>
                {isSelected ? <Text style={styles.check}>{"✓"}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {multi ? (
        <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
          <Pressable style={styles.footerButton} onPress={onClose}>
            <Text style={styles.footerButtonText}>{t("filters.done")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { fontSize: 16, fontWeight: "800", color: colors.ink },
  done: { fontSize: 14, fontWeight: "700", color: colors.pink },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: { fontSize: 14.5, color: colors.ink, flexShrink: 1 },
  check: { fontSize: 16, fontWeight: "800", color: colors.pink },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  footerButton: { height: 48, borderRadius: radius.pill, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center" },
  footerButtonText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
});
