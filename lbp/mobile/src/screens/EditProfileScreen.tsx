import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { fetchMe, updateProfile, type MemberProfileSummary } from "../api/profile";
import { useAuth } from "../context/AuthContext";
import { fetchCatalogFilterOptions, type CatalogFilterOptionRow } from "../api/catalogFilters";
import { CATALOG_ENUM_OPTIONS, catalogOptionLabel } from "../data/catalogLabels";
import { OptionListPicker, type OptionRow } from "../components/OptionListPicker";
import { ApiError } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

// No Intl/date-picker library depended on here (see the comment on the DOB
// fields below) - a small hardcoded table is the safe, guaranteed-correct
// choice for something as fixed as calendar month names.
const MONTH_NAMES: Record<string, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  es: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
};

function daysInMonth(year: number | null, month: number | null): number {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

// Matches the prototype's #scr-edit-profile. Backend support is real
// (PATCH /api/member/profile - main.py's member_update_profile) but there's
// no GET /api/member/profile to prefill from; GET /api/member/me
// (member_me) is the only endpoint that returns the full editable
// profile.data JSON, via public_profile_summary()'s "data" field - see
// api/profile.ts for the full trail.
//
// Scope trim, flagged rather than silently done: the backend also accepts
// height/weight/eyeColor/hairColor/occupation/education/religion/
// smokingStatus/drinkingStatus/unitPreference/visibleInCatalog, none of
// which appear on the prototype's edit-profile screen - only the fields
// shown there are built here.
//
// UPDATE (Sept 2026): "You are" / "Looking for" / "Donor's contact" were
// shown read-only (matching the prototype's plain key/value rows), but
// Alena asked twice for these to actually be editable - "я ж просила
// сделать... возможно менять кто я и кого ищу". "You are" and "Looking
// for" now open the same OptionListPicker used for country/city/ethnicity
// below (single- and multi-select respectively, against
// CATALOG_ENUM_OPTIONS). "Donor's contact" has no backend enum anywhere in
// the codebase (confirmed against ProfileUpdatePayload/main.py and the
// website's own edit form, both plain free text, max 120 chars) - rather
// than inventing option values nobody defined, it's a real text field
// instead, same as the website. The "only show this section if something's
// already set" gate is gone too - now that it's a real editable form
// section rather than a read-only summary, someone with none of these set
// yet needs to be able to open it and set them for the first time.
//
// dateOfBirth is a hard requirement on every single PATCH (the backend
// 422s "Date of birth is required" otherwise) even though mobile signup
// has never actually collected one - so this screen always shows a
// day/month/year entry (blank if the person has none yet) rather than
// only showing it when already set, and blocks Save until it's filled in.
// No native date-picker library is installed in this project (checked
// package.json) and none can be added from here (a native module needs a
// fresh native build, not just an OTA update) - so instead of the old
// three free-typing digit boxes (Alena: "я ж просила сделать норм ввод
// даты рождения"), day/month/year are now three tap-to-pick fields using
// the same OptionListPicker modal as everything else on this screen. Day's
// option list is clamped to the real number of days in the currently
// selected month/year (leap years included), so an invalid date like Feb
// 30 simply isn't selectable rather than being caught after the fact.
export default function EditProfileScreen({ navigation }: Props) {
  const { t, locale } = useI18n();
  const { refreshUser } = useAuth();
  const monthNames = MONTH_NAMES[locale] || MONTH_NAMES.en;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [about, setAbout] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [addingLanguage, setAddingLanguage] = useState(false);
  const [languageDraft, setLanguageDraft] = useState("");

  const [profileType, setProfileType] = useState<string | null>(null);
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [desiredDonorContact, setDesiredDonorContact] = useState<string | null>(null);

  const [countries, setCountries] = useState<CatalogFilterOptionRow[]>([]);
  const [cities, setCities] = useState<CatalogFilterOptionRow[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [picker, setPicker] = useState<
    "country" | "city" | "ethnicity" | "dobDay" | "dobMonth" | "dobYear" | "profileType" | "lookingFor" | null
  >(null);

  function applyProfile(profile: MemberProfileSummary) {
    setName(profile.displayName || "");
    const dob = profile.data.dateOfBirth || "";
    const [y, m, d] = dob.split("-");
    setDobYear(y || "");
    setDobMonth(m || "");
    setDobDay(d || "");
    setCountry(profile.country || "");
    setCity(profile.city || "");
    setEthnicity(profile.data.ethnicity || "");
    setAbout(profile.data.about || profile.data.bio || "");
    setLanguages(profile.data.languages || []);
    setProfileType(profile.profileType || null);
    setLookingFor(profile.data.lookingFor || []);
    setDesiredDonorContact(profile.data.desiredDonorContact || null);
  }

  useEffect(() => {
    fetchMe()
      .then((res) => {
        if (!res.profile) {
          setLoadError(t("common.somethingWrong"));
          return;
        }
        applyProfile(res.profile);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : t("common.somethingWrong")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (picker !== "country" || countries.length || loadingCountries) return;
    setLoadingCountries(true);
    fetchCatalogFilterOptions()
      .then((res) => setCountries(res.countries))
      .catch(() => undefined)
      .finally(() => setLoadingCountries(false));
  }, [picker, countries.length, loadingCountries]);

  useEffect(() => {
    if (picker !== "city" || !country) return;
    setLoadingCities(true);
    fetchCatalogFilterOptions(country)
      .then((res) => setCities(res.cities))
      .catch(() => undefined)
      .finally(() => setLoadingCities(false));
  }, [picker, country]);

  function addLanguage() {
    const value = languageDraft.trim();
    if (value && !languages.some((l) => l.toLowerCase() === value.toLowerCase())) {
      setLanguages((prev) => [...prev, value]);
    }
    setLanguageDraft("");
    setAddingLanguage(false);
  }

  function removeLanguage(value: string) {
    setLanguages((prev) => prev.filter((l) => l !== value));
  }

  async function handleSave() {
    setSaveError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setSaveError(t("editProfile.nameRequired"));
      return;
    }
    const day = parseInt(dobDay, 10);
    const month = parseInt(dobMonth, 10);
    const year = parseInt(dobYear, 10);
    if (!dobDay || !dobMonth || !dobYear) {
      setSaveError(t("editProfile.dobRequired"));
      return;
    }
    const isValidDate =
      Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year) &&
      month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= new Date().getFullYear();
    if (!isValidDate) {
      setSaveError(t("editProfile.dobInvalid"));
      return;
    }
    const dateOfBirth = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

    setSaving(true);
    try {
      await updateProfile({
        displayName: trimmedName,
        dateOfBirth,
        country,
        city,
        ethnicity,
        about,
        languages,
        ...(profileType ? { profileType } : {}),
        ...(lookingFor.length ? { lookingFor } : {}),
        ...(desiredDonorContact?.trim() ? { desiredDonorContact: desiredDonorContact.trim() } : {}),
      });
      // PATCH /api/member/profile updates the backend fine, but AuthContext's
      // `user` (from GET /api/auth/me) is only ever set at login/signup or
      // by an explicit refreshUser() call - it was never refreshed here, so
      // every screen reading user.displayName (MeProfileScreen's header
      // name/avatar initial, etc.) kept showing the pre-edit name after
      // saving. This is Alena's "ничего не меняется здесь. ни имя ни кто
      // я" - the save itself worked, the cached name just never updated.
      await refreshUser().catch(() => {
        // Best-effort - the save itself already succeeded; don't block
        // navigation on a refresh hiccup.
      });
      navigation.goBack();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : t("common.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  const ethnicityLabel = ethnicity ? catalogOptionLabel("ethnicity", ethnicity) : "";

  return (
    <GradientBackground variant="soft">
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}>
        <Text style={styles.sectionTitle}>{t("editProfile.basicInfo")}</Text>

        <Text style={[styles.label, styles.labelFirst]}>{t("editProfile.name")}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t("editProfile.namePlaceholder")}
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>{t("editProfile.dob")}</Text>
        <View style={styles.dobRow}>
          <Pressable style={[styles.field, styles.dobInput, dobDay && styles.fieldFilled]} onPress={() => setPicker("dobDay")}>
            <Text style={[styles.fieldText, dobDay && styles.fieldTextFilled]}>{dobDay || t("editProfile.dobDay")}</Text>
          </Pressable>
          <Pressable style={[styles.field, styles.dobInput, dobMonth && styles.fieldFilled]} onPress={() => setPicker("dobMonth")}>
            <Text style={[styles.fieldText, dobMonth && styles.fieldTextFilled]} numberOfLines={1}>
              {dobMonth ? monthNames[parseInt(dobMonth, 10) - 1] : t("editProfile.dobMonth")}
            </Text>
          </Pressable>
          <Pressable style={[styles.field, styles.dobInputYear, dobYear && styles.fieldFilled]} onPress={() => setPicker("dobYear")}>
            <Text style={[styles.fieldText, dobYear && styles.fieldTextFilled]}>{dobYear || t("editProfile.dobYear")}</Text>
          </Pressable>
        </View>

        <View style={styles.row}>
          <View style={styles.col2}>
            <Text style={styles.label}>{t("filters.country")}</Text>
            <Pressable style={[styles.field, country && styles.fieldFilled]} onPress={() => setPicker("country")}>
              <Text style={[styles.fieldText, country && styles.fieldTextFilled]} numberOfLines={1}>
                {country ? countries.find((c) => c.value === country)?.label || country : t("editProfile.selectCountry")}
              </Text>
              <Text style={styles.chevron}>{"⌄"}</Text>
            </Pressable>
          </View>
          <View style={styles.col2}>
            <Text style={styles.label}>{t("filters.city")}</Text>
            <Pressable
              style={[styles.field, city && styles.fieldFilled, !country && styles.fieldDisabled]}
              onPress={() => country && setPicker("city")}
            >
              <Text style={[styles.fieldText, city && styles.fieldTextFilled]} numberOfLines={1}>
                {country ? city || t("editProfile.selectCity") : t("filters.selectCountryFirst")}
              </Text>
              {country ? <Text style={styles.chevron}>{"⌄"}</Text> : null}
            </Pressable>
          </View>
        </View>

        <Text style={styles.label}>{t("filters.ethnicity")}</Text>
        <Pressable style={[styles.field, ethnicity && styles.fieldFilled]} onPress={() => setPicker("ethnicity")}>
          <Text style={[styles.fieldText, ethnicity && styles.fieldTextFilled]} numberOfLines={1}>
            {ethnicityLabel || t("editProfile.select")}
          </Text>
          <Text style={styles.chevron}>{"⌄"}</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>{t("editProfile.matchingQuestionnaire")}</Text>
        <View style={styles.quizCard}>
          <Text style={styles.quizHint}>{t("editProfile.matchingHint")}</Text>

          <Text style={styles.label}>{t("editProfile.youAre")}</Text>
          <Pressable style={[styles.field, profileType && styles.fieldFilled]} onPress={() => setPicker("profileType")}>
            <Text style={[styles.fieldText, profileType && styles.fieldTextFilled]} numberOfLines={1}>
              {profileType ? catalogOptionLabel("profileTypes", profileType) : t("editProfile.select")}
            </Text>
            <Text style={styles.chevron}>{"⌄"}</Text>
          </Pressable>

          <Text style={styles.label}>{t("filters.lookingFor")}</Text>
          <Pressable style={[styles.field, lookingFor.length > 0 && styles.fieldFilled]} onPress={() => setPicker("lookingFor")}>
            <Text style={[styles.fieldText, lookingFor.length > 0 && styles.fieldTextFilled]} numberOfLines={1}>
              {lookingFor.length > 0 ? lookingFor.map((value) => catalogOptionLabel("lookingFor", value)).join(", ") : t("editProfile.select")}
            </Text>
            <Text style={styles.chevron}>{"⌄"}</Text>
          </Pressable>

          <Text style={styles.label}>{t("editProfile.donorContact")}</Text>
          <TextInput
            style={styles.input}
            value={desiredDonorContact || ""}
            onChangeText={(v) => setDesiredDonorContact(v.slice(0, 120))}
            placeholder={t("editProfile.donorContactPlaceholder")}
            placeholderTextColor={colors.muted}
          />
        </View>

        <Text style={styles.sectionTitle}>{t("editProfile.aboutYou")}</Text>
        <TextInput
          style={styles.textarea}
          value={about}
          onChangeText={(v) => setAbout(v.slice(0, 2000))}
          placeholder={t("editProfile.bioPlaceholder")}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />
        <Text style={styles.counter}>{about.length} / 2000</Text>

        <Text style={styles.sectionTitle}>{t("editProfile.languagesTitle")}</Text>
        <View style={styles.chipRow}>
          {languages.map((lang) => (
            <Pressable key={lang} style={styles.chip} onPress={() => removeLanguage(lang)}>
              <Text style={styles.chipText}>
                {lang}
                {"  ✕"}
              </Text>
            </Pressable>
          ))}
          {addingLanguage ? (
            <TextInput
              style={styles.chipInput}
              value={languageDraft}
              onChangeText={setLanguageDraft}
              onSubmitEditing={addLanguage}
              onBlur={addLanguage}
              placeholder={t("editProfile.languagePlaceholder")}
              placeholderTextColor={colors.muted}
              autoFocus
            />
          ) : (
            <Pressable style={styles.chipAdd} onPress={() => setAddingLanguage(true)}>
              <Text style={styles.chipAddText}>{t("editProfile.addLanguage")}</Text>
            </Pressable>
          )}
        </View>

        {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      </ScrollView>

      <View style={[styles.saveBar, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>{t("editProfile.save")}</Text>}
        </Pressable>
      </View>

      <Modal visible={picker === "country"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("filters.country")}
          loading={loadingCountries}
          options={countries.map((c): OptionRow => ({ value: c.value, label: c.label }))}
          selected={country ? [country] : []}
          multi={false}
          onToggle={(value) => {
            if (value !== country) setCity("");
            setCountry(value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "city"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("filters.city")}
          loading={loadingCities}
          options={cities.map((c): OptionRow => ({ value: c.value, label: c.label }))}
          selected={city ? [city] : []}
          multi={false}
          onToggle={(value) => {
            setCity(value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "ethnicity"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("filters.ethnicity")}
          options={CATALOG_ENUM_OPTIONS.ethnicity}
          selected={ethnicity ? [ethnicity] : []}
          multi={false}
          onToggle={(value) => {
            setEthnicity(value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "dobDay"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("editProfile.dobDayLabel")}
          options={Array.from(
            { length: daysInMonth(dobYear ? parseInt(dobYear, 10) : null, dobMonth ? parseInt(dobMonth, 10) : null) },
            (_, i) => ({ value: String(i + 1), label: String(i + 1) }),
          )}
          selected={dobDay ? [String(parseInt(dobDay, 10))] : []}
          multi={false}
          onToggle={(value) => {
            setDobDay(value.padStart(2, "0"));
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "dobMonth"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("editProfile.dobMonthLabel")}
          options={monthNames.map((label, i) => ({ value: String(i + 1), label }))}
          selected={dobMonth ? [String(parseInt(dobMonth, 10))] : []}
          multi={false}
          onToggle={(value) => {
            setDobMonth(value.padStart(2, "0"));
            // A day already picked for a longer month (e.g. 31) can become
            // invalid once the month changes (e.g. to April) - clamp it
            // down instead of silently keeping an impossible date selected.
            const maxDay = daysInMonth(dobYear ? parseInt(dobYear, 10) : null, parseInt(value, 10));
            if (dobDay && parseInt(dobDay, 10) > maxDay) setDobDay(String(maxDay).padStart(2, "0"));
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "dobYear"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("editProfile.dobYearLabel")}
          // 18+ only - the backend itself enforces this same floor
          // (latest_adult_birth_date() in main.py), so a year that could
          // never pass isn't offered as a choice in the first place.
          options={Array.from({ length: 83 }, (_, i) => {
            const year = new Date().getFullYear() - 18 - i;
            return { value: String(year), label: String(year) };
          })}
          selected={dobYear ? [String(parseInt(dobYear, 10))] : []}
          multi={false}
          onToggle={(value) => {
            setDobYear(value);
            const maxDay = daysInMonth(parseInt(value, 10), dobMonth ? parseInt(dobMonth, 10) : null);
            if (dobDay && parseInt(dobDay, 10) > maxDay) setDobDay(String(maxDay).padStart(2, "0"));
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "profileType"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("editProfile.youAre")}
          options={CATALOG_ENUM_OPTIONS.profileTypes}
          selected={profileType ? [profileType] : []}
          multi={false}
          onToggle={(value) => {
            setProfileType(value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>

      <Modal visible={picker === "lookingFor"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("editProfile.selectLookingFor")}
          options={CATALOG_ENUM_OPTIONS.lookingFor}
          selected={lookingFor}
          multi
          onToggle={(value) => {
            setLookingFor((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>
    </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing.lg },
  errorText: { fontSize: 14, color: colors.muted, textAlign: "center" },
  content: { padding: spacing.lg },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.ink, marginTop: 22, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.3 },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 13, marginBottom: 7 },
  labelFirst: { marginTop: 0 },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 13.5,
    color: colors.ink,
  },
  dobRow: { flexDirection: "row", gap: 10 },
  dobInput: { flex: 1, textAlign: "center" },
  dobInputYear: { flex: 1.4, textAlign: "center" },
  row: { flexDirection: "row", gap: 12 },
  col2: { flex: 1 },
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
  },
  fieldFilled: {},
  fieldDisabled: { opacity: 0.55 },
  fieldText: { fontSize: 13.5, color: colors.muted, flexShrink: 1 },
  fieldTextFilled: { color: colors.ink, fontWeight: "500" },
  chevron: { fontSize: 16, color: colors.muted },
  quizCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  quizHint: { fontSize: 12, color: colors.muted, marginBottom: 10, lineHeight: 17 },
  quizRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  quizKey: { fontSize: 13.5, color: colors.muted },
  quizValue: { fontSize: 13.5, color: colors.ink, fontWeight: "600" },
  textarea: {
    minHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13.5,
    color: colors.ink,
  },
  counter: { fontSize: 11.5, color: colors.muted, textAlign: "right", marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.tintPink,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: "600" },
  chipAdd: {
    borderWidth: 1,
    borderColor: colors.pink,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipAddText: { fontSize: 13, color: colors.pink, fontWeight: "700" },
  chipInput: {
    height: 36,
    minWidth: 110,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.pink,
    paddingHorizontal: 14,
    fontSize: 13,
    color: colors.ink,
  },
  saveError: { fontSize: 13, color: colors.danger, marginTop: spacing.md, textAlign: "center" },
  saveBar: {
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
  saveButton: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
});
