import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
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
  // Set from fetchCatalogFilterOptions' isPremium field (already fetched
  // below for countries/cities - same response, no extra request). Gates
  // whether the 5 rows below are real pickers or locked upsell rows.
  const [isPremium, setIsPremium] = useState(false);
  const [picker, setPicker] = useState<
    "country" | "city" | "profileTypes" | "donorTypes" | "lookingFor" | "ethnicity" | "hairColor" | "eyeColor" | "education" | "religion" | null
  >(null);

  useEffect(() => {
    setLoadingCountries(true);
    fetchCatalogFilterOptions()
      .then((res) => {
        setCountries(res.countries);
        setIsPremium(res.isPremium);
      })
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

  // Premium filters (ethnicity/hairColor/eyeColor/education/religion) are
  // all single-select strings, unlike the multi-select fields above.
  const PREMIUM_FIELDS = ["ethnicity", "hairColor", "eyeColor", "education", "religion"] as const;
  type PremiumField = (typeof PREMIUM_FIELDS)[number];

  function premiumFieldLabel(field: PremiumField): string {
    const value = filters[field];
    if (!value) return t("filters.any");
    return CATALOG_ENUM_OPTIONS[field]?.find((o) => o.value === value)?.label || value;
  }

  function openPremiumField(field: PremiumField) {
    if (isPremium) {
      setPicker(field);
      return;
    }
    Alert.alert(t("filters.premiumLockedTitle"), t("filters.premiumLockedBody"), [
      { text: t("filters.premiumLockedCancel"), style: "cancel" },
      { text: t("filters.premiumLockedUpgrade"), onPress: () => navigation.navigate("Subscription") },
    ]);
  }

  function applyAndClose() {
    navigation.navigate("MainTabs", { screen: "Catalog", params: { appliedFilters: filters, appliedAt: Date.now() } });
  }

  return (
    <View style={styles.container}>
      {/* Alena: "кнопки назад и сбросить лучше сделать без кругов и тени,
          а просто стрелка назад (можно добавить back) и слово reset" plus
          "я бы ещё убрала границы и фон в хедере ... прозрачный фон с
          размытием" - this used to be the native-stack header (a bare
          Feather arrow for back, a bare "Reset" Text for headerRight - see
          the removed useLayoutEffect above), which on this build renders
          those as circular glass buttons that aren't controllable from
          here. Replaced with an in-screen header we fully control: no
          circles/shadows, just an arrow + "Back" label and a plain "Reset"
          word, on a blurred/translucent bar instead of a solid one. */}
      <View style={[styles.customHeader, { paddingTop: insets.top + spacing.xs }]}>
        <BlurView intensity={60} tint="light" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(250,250,250,0.55)" }]} />
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.headerBackBtn}>
          <Feather name="arrow-left" size={19} color={colors.ink} />
          <Text style={styles.headerBackText}>{t("common.back")}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{t("nav.filtersTitle")}</Text>
        <Pressable onPress={() => setFilters(emptyCatalogFilters())} hitSlop={8} style={styles.headerResetBtn}>
          <Text style={styles.resetText}>{t("filters.reset")}</Text>
        </Pressable>
      </View>
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

        {/* Alena: "огромные переключатели" - RN's Switch is the plain OS
            control (iOS's default is 51x31), which next to this screen's
            14px labels read as oversized. Scaling it down is the standard
            way to shrink a native Switch (it has no size prop of its own). */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t("filters.verifiedOnly")}</Text>
          <Switch
            style={styles.toggleSwitch}
            value={filters.verifiedOnly}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, verifiedOnly: value }))}
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t("filters.videoVerifiedOnly")}</Text>
          <Switch
            style={styles.toggleSwitch}
            value={filters.videoVerifiedOnly}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, videoVerifiedOnly: value }))}
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

        {/* Premium appearance/background filters - real pickers for a
            Premium viewer (matches the website's CatalogFilterPanel:
            ethnicity/hairColor/eyeColor/education/religion), a single
            locked-look row per field for everyone else that offers to open
            Subscription rather than just silently doing nothing. Alena
            flagged these as missing on mobile (screenshot of the website's
            panel) - they previously rendered as one static, non-interactive
            "Ethnicity — Unlock with Premium" row and nothing else. */}
        {PREMIUM_FIELDS.map((field) => (
          <View key={field}>
            <Text style={styles.label}>
              {t(`filters.${field}`)}
              {!isPremium ? <Text style={styles.lockLabelPremium}>{"  " + t("filters.premium")}</Text> : null}
            </Text>
            <Pressable
              style={[styles.field, isPremium && filters[field] && styles.fieldFilled, !isPremium && styles.fieldDisabled]}
              onPress={() => openPremiumField(field)}
            >
              <Text style={[styles.fieldText, isPremium && filters[field] && styles.fieldTextFilled]} numberOfLines={1}>
                {isPremium ? premiumFieldLabel(field) : t("filters.premiumLockedBody")}
              </Text>
              <Text style={styles.chevron}>{isPremium ? "⌄" : "🔒"}</Text>
            </Pressable>
          </View>
        ))}
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

      {PREMIUM_FIELDS.map((field) => (
        <Modal key={field} visible={picker === field} animationType="slide" onRequestClose={() => setPicker(null)}>
          <OptionListPicker
            title={t(`filters.${field}`)}
            options={[{ value: "", label: t("filters.any") }, ...CATALOG_ENUM_OPTIONS[field]]}
            selected={filters[field] ? [filters[field]] : []}
            multi={false}
            onToggle={(value) => {
              setFilters((prev) => ({ ...prev, [field]: value }));
              setPicker(null);
            }}
            onClose={() => setPicker(null)}
          />
        </Modal>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  customHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerBackBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerBackText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  headerTitle: { position: "absolute", left: 60, right: 60, textAlign: "center", fontSize: 15, fontWeight: "700", color: colors.ink },
  headerResetBtn: { paddingVertical: 4, paddingLeft: 8 },
  content: { padding: spacing.lg },
  resetText: { color: colors.pink, fontSize: 13.5, fontWeight: "600" },
  toggleSwitch: { transform: [{ scale: 0.82 }] },
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
  lockLabelPremium: { color: colors.pink, fontWeight: "700" },
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
