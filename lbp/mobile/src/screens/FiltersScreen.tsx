import React, { useEffect, useLayoutEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import {
  emptyCatalogFilters,
  fetchCatalogFilterOptions,
  type CatalogFilterOptionRow,
  type CatalogFilters,
} from "../api/catalogFilters";
import { CATALOG_ENUM_OPTIONS } from "../data/catalogLabels";
import { OptionListPicker } from "../components/OptionListPicker";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "Filters">;

// Matches the prototype's #scr-filters. Backend support (main.py's
// member_catalog + member_catalog_filter_options) is real and rich -
// country/city/profileType/donorType/lookingFor/verifiedOnly/ageMin/
// ageMax all work as real query params, and the website already has a
// full working implementation (ui.tsx's CatalogFilters/CatalogFilterPanel)
// this was checked against for field names and behavior.
//
// Scope trim, flagged rather than silently done: the prototype's
// Premium-gated row only shows "Ethnicity" but its note also mentions
// hair color/eye color/education/religion as Premium filters - the
// backend supports all of these (ethnicity/hairColor/eyeColor/education/
// religion/bodyType), but this first pass only builds the always-free
// filters shown as usable in the prototype and renders the whole
// Premium-gated group as a single locked, non-interactive row (matching
// the prototype's own non-premium demo state) rather than building five
// more full option pickers. Worth a follow-up if Alena wants real
// Premium-tier filtering built out.
export default function FiltersScreen({ navigation, route }: Props) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<CatalogFilters>(route.params.initial);
  const [countries, setCountries] = useState<CatalogFilterOptionRow[]>([]);
  const [cities, setCities] = useState<CatalogFilterOptionRow[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [picker, setPicker] = useState<"country" | "city" | "profileTypes" | "donorTypes" | "lookingFor" | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setFilters(emptyCatalogFilters())} hitSlop={8}>
          <Text style={styles.resetText}>{t("filters.reset")}</Text>
        </Pressable>
      ),
    });
  }, [navigation, t]);

  useEffect(() => {
    setLoadingCountries(true);
    fetchCatalogFilterOptions()
      .then((res) => setCountries(res.countries))
      .catch(() => undefined)
      .finally(() => setLoadingCountries(false));
  }, []);

  const selectedCountry = filters.country[0] || null;

  useEffect(() => {
    if (!selectedCountry) {
      setCities([]);
      return;
    }
    setLoadingCities(true);
    fetchCatalogFilterOptions(selectedCountry)
      .then((res) => setCities(res.cities))
      .catch(() => undefined)
      .finally(() => setLoadingCities(false));
  }, [selectedCountry]);

  function toggleMulti(key: "profileTypes" | "donorTypes" | "lookingFor", value: string) {
    setFilters((prev) => {
      const list = prev[key];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...prev, [key]: next };
    });
  }

  function labelsFor(key: "profileTypes" | "donorTypes" | "lookingFor"): string {
    const enumKey = key === "profileTypes" ? "profileTypes" : key === "donorTypes" ? "donorTypes" : "lookingFor";
    const selected = filters[key];
    if (selected.length === 0) return t("filters.any");
    return selected
      .map((value) => CATALOG_ENUM_OPTIONS[enumKey]?.find((o) => o.value === value)?.label || value)
      .join(", ");
  }

  function applyAndClose() {
    navigation.navigate("MainTabs", { screen: "Catalog", params: { appliedFilters: filters, appliedAt: Date.now() } });
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}>
        <Text style={[styles.label, styles.labelFirst]}>{t("filters.country")}</Text>
        <Pressable style={[styles.field, selectedCountry && styles.fieldFilled]} onPress={() => setPicker("country")}>
          <Text style={[styles.fieldText, selectedCountry && styles.fieldTextFilled]} numberOfLines={1}>
            {selectedCountry ? countries.find((c) => c.value === selectedCountry)?.label || selectedCountry : t("filters.any")}
          </Text>
          <Text style={styles.chevron}>{"⌄"}</Text>
        </Pressable>

        <Text style={styles.label}>{t("filters.city")}</Text>
        <Pressable
          style={[styles.field, filters.city && styles.fieldFilled, !selectedCountry && styles.fieldDisabled]}
          onPress={() => selectedCountry && setPicker("city")}
        >
          <Text style={[styles.fieldText, filters.city && styles.fieldTextFilled]} numberOfLines={1}>
            {selectedCountry ? filters.city || t("filters.any") : t("filters.selectCountryFirst")}
          </Text>
          {selectedCountry ? <Text style={styles.chevron}>{"⌄"}</Text> : null}
        </Pressable>

        <Text style={styles.label}>{t("filters.profileType")}</Text>
        <Pressable style={[styles.field, filters.profileTypes.length > 0 && styles.fieldFilled]} onPress={() => setPicker("profileTypes")}>
          <Text style={[styles.fieldText, filters.profileTypes.length > 0 && styles.fieldTextFilled]} numberOfLines={1}>
            {labelsFor("profileTypes")}
          </Text>
          <Text style={styles.chevron}>{"⌄"}</Text>
        </Pressable>

        <Text style={styles.label}>{t("filters.donorType")}</Text>
        <Pressable style={[styles.field, filters.donorTypes.length > 0 && styles.fieldFilled]} onPress={() => setPicker("donorTypes")}>
          <Text style={[styles.fieldText, filters.donorTypes.length > 0 && styles.fieldTextFilled]} numberOfLines={1}>
            {labelsFor("donorTypes")}
          </Text>
          <Text style={styles.chevron}>{"⌄"}</Text>
        </Pressable>

        <Text style={styles.label}>{t("filters.lookingFor")}</Text>
        <Pressable style={[styles.field, filters.lookingFor.length > 0 && styles.fieldFilled]} onPress={() => setPicker("lookingFor")}>
          <Text style={[styles.fieldText, filters.lookingFor.length > 0 && styles.fieldTextFilled]} numberOfLines={1}>
            {labelsFor("lookingFor")}
          </Text>
          <Text style={styles.chevron}>{"⌄"}</Text>
        </Pressable>
        <Text style={styles.note}>{t("filters.lookingForNote")}</Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t("filters.verifiedOnly")}</Text>
          <Switch
            value={filters.verifiedOnly}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, verifiedOnly: value }))}
          />
        </View>

        <View style={styles.ageRow}>
          <View style={styles.ageCol}>
            <Text style={[styles.label, styles.labelFirst]}>{t("filters.minAge")}</Text>
            <TextInput
              style={styles.field}
              value={filters.ageMin}
              onChangeText={(value) => setFilters((prev) => ({ ...prev, ageMin: value.replace(/[^0-9]/g, "") }))}
              keyboardType="number-pad"
              placeholder="18"
              placeholderTextColor={colors.muted}
              maxLength={3}
            />
          </View>
          <View style={styles.ageCol}>
            <Text style={[styles.label, styles.labelFirst]}>{t("filters.maxAge")}</Text>
            <TextInput
              style={styles.field}
              value={filters.ageMax}
              onChangeText={(value) => setFilters((prev) => ({ ...prev, ageMax: value.replace(/[^0-9]/g, "") }))}
              keyboardType="number-pad"
              placeholder="99"
              placeholderTextColor={colors.muted}
              maxLength={3}
            />
          </View>
        </View>

        <Pressable
          style={styles.lockRow}
          onPress={() => Alert.alert(t("filters.premiumLockedTitle"))}
        >
          <Text style={styles.lockLabel}>
            {"🔒 "}
            {t("filters.ethnicity")}
            {"  "}
            <Text style={styles.lockLabelPremium}>{t("filters.premium")}</Text>
          </Text>
          <View style={styles.lockField}>
            <Text style={styles.lockFieldText}>{t("filters.premiumLockedBody")}</Text>
          </View>
          <Text style={styles.note}>{t("filters.premiumMoreNote")}</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.applyBar, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Pressable style={styles.applyButton} onPress={applyAndClose}>
          <Text style={styles.applyButtonText}>{t("filters.apply")}</Text>
        </Pressable>
      </View>

      <Modal visible={picker === "country"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("filters.country")}
          loading={loadingCountries}
          options={[{ value: "", label: t("filters.any") }, ...countries]}
          selected={filters.country}
          multi={false}
          onToggle={(value) => {
            setFilters((prev) => ({ ...prev, country: value ? [value] : [], city: value === prev.country[0] ? prev.city : "" }));
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "city"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("filters.city")}
          loading={loadingCities}
          options={[{ value: "", label: t("filters.any") }, ...cities]}
          selected={filters.city ? [filters.city] : []}
          multi={false}
          onToggle={(value) => {
            setFilters((prev) => ({ ...prev, city: value }));
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "profileTypes"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("filters.profileType")}
          options={CATALOG_ENUM_OPTIONS.profileTypes}
          selected={filters.profileTypes}
          multi
          onToggle={(value) => toggleMulti("profileTypes", value)}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "donorTypes"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("filters.donorType")}
          options={CATALOG_ENUM_OPTIONS.donorTypes}
          selected={filters.donorTypes}
          multi
          onToggle={(value) => toggleMulti("donorTypes", value)}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "lookingFor"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("filters.lookingFor")}
          options={CATALOG_ENUM_OPTIONS.lookingFor}
          selected={filters.lookingFor}
          multi
          onToggle={(value) => toggleMulti("lookingFor", value)}
          onClose={() => setPicker(null)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  resetText: { color: colors.pink, fontSize: 13.5, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 13, marginBottom: 7 },
  labelFirst: { marginTop: 0 },
  field: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    fontSize: 13.5,
    color: colors.muted,
  },
  fieldFilled: {},
  fieldDisabled: { opacity: 0.55 },
  fieldText: { fontSize: 13.5, color: colors.muted, flexShrink: 1 },
  fieldTextFilled: { color: colors.ink, fontWeight: "500" },
  chevron: { fontSize: 16, color: colors.muted },
  note: { fontSize: 11.5, color: colors.muted, marginTop: 8, lineHeight: 16 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 14 },
  toggleLabel: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  ageRow: { flexDirection: "row", gap: 12 },
  ageCol: { flex: 1 },
  lockRow: { marginTop: 18, opacity: 0.55 },
  lockLabel: { fontSize: 14, fontWeight: "700", color: colors.ink, marginBottom: 7, flexDirection: "row", alignItems: "center" },
  lockLabelPremium: { color: colors.pink, fontWeight: "700" },
  lockField: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  lockFieldText: { fontSize: 12, color: "#a3a3a3" },
  applyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  applyButton: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
});
