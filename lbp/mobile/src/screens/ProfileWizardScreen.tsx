import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { updateProfile } from "../api/profile";
import { fetchCatalogFilterOptions, type CatalogFilterOptionRow } from "../api/catalogFilters";
import { CATALOG_ENUM_OPTIONS, catalogOptionLabel } from "../data/catalogLabels";
import { OptionListPicker, type OptionRow } from "../components/OptionListPicker";
import { fetchPhotos, uploadPhoto } from "../api/photos";
import type { ProfilePhoto } from "../api/types";
import { ApiError } from "../api/client";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";

type Props = NativeStackScreenProps<RootStackParamList, "ProfileWizard">;

// Backend's real cap (main.py's MAX_PROFILE_PHOTOS) - the prototype's
// #scr-signup-5 copy says "up to 10 additional photos" (11 total), but the
// backend has only ever allowed 6 total (confirmed same constant PhotosScreen
// already uses). Following the real limit rather than the stale mockup
// number, same as every other prototype/backend mismatch flagged this
// session.
const MAX_PROFILE_PHOTOS = 6;
const MAX_ADDITIONAL_PHOTOS = MAX_PROFILE_PHOTOS - 1;

const SMOKING_DRINKING_VALUES = ["Never", "Occasionally", "Regularly"] as const;

const ROLE_EMOJI: Record<string, string> = {
  SINGLE_WOMAN: "👩",
  SINGLE_MAN: "👨",
  HETERO_COUPLE: "👫",
  LESBIAN_COUPLE: "👩‍❤️‍👩",
  GAY_COUPLE: "👨‍❤️‍👨",
};

type WizStep = "role" | "goal" | "childway" | "basic" | "appearance" | "about" | "photos";

// Real equivalent of the prototype's signup wizard (#scr-signup-1..5, plus
// the branch screens -2b/-4b) - one screen with internal step state rather
// than 7 routed screens, since every step just writes into the same PATCH
// /api/member/profile call at the end (see api/profile.ts) and nothing here
// needs its own back-stack entry. Auto-launched once after a fresh signup
// (or a brand-new social signup) via AuthContext's pendingProfileWizard and
// RootNavigator's one-shot push - guarded off while the person is behind
// the blocking VerifyCode email gate (see RootNavigator), so it only fires
// once verification is done.
//
// Biology-based branching ported faithfully from the prototype's own JS
// (lbp-prototype-source.stripped.html's wizState logic): a Single Man or
// Gay Couple choosing "we want to become parents" needs an egg donor (and
// is shown as a sperm donor if choosing to help others); everyone else
// needs a sperm donor (and is shown as an egg donor if helping others).
// This also decides the exact lookingFor/donorType values sent to the
// backend on completion.
//
// Scope decisions worth flagging:
// - Country/city aren't hard-required to finish (only name+DOB actually are
//   on the backend), so Basic info can be skipped through with location
//   blank - matches PATCH /api/member/profile's real validation, not
//   inventing a stricter client-side rule.
// - Eye/hair color, ethnicity, education and religion are built as pickers
//   from the same enum tables the catalog filters use (CATALOG_ENUM_OPTIONS)
//   rather than the free-text <input>s the website's own edit-profile form
//   uses for eye/hair color - the prototype's wizard screens show these as
//   "Select ..." dropdowns, and storing the same enum tokens the filters
//   already understand means a completed wizard profile is actually
//   filterable by those fields, not just displayed.
// - Smoking/drinking are presented as pickers too, but store the literal
//   English strings "Never"/"Occasionally"/"Regularly" (translated for
//   display only) - that's what the website's own <select> already writes
//   into these fields (confirmed in frontend/src/ui.tsx), so this keeps
//   values consistent across clients rather than inventing new tokens.
// - Height/weight: backend only ever stores centimeters/kilograms
//   (ProfileUpdatePayload's height/weight bounds are metric-only), so an
//   Imperial-mode entry is converted to metric at submit time rather than
//   stored as typed.
// - Not in this build: photo cropping/reordering, and re-opening this
//   wizard later to edit quiz answers (EditProfileScreen shows them
//   read-only with no edit path yet) - out of scope for "get a fresh
//   signup to a complete profile," not silently dropped.
export default function ProfileWizardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);

  // Role -> goal -> (childway, only if goal="parents")
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState<"" | "parents" | "donor">("");
  const [childway, setChildway] = useState<"" | "donor" | "coparent" | "both">("");

  // Basic info
  const [name, setName] = useState(user?.displayName || "");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [countries, setCountries] = useState<CatalogFilterOptionRow[]>([]);
  const [cities, setCities] = useState<CatalogFilterOptionRow[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [basicError, setBasicError] = useState<string | null>(null);

  // Appearance
  const [unit, setUnit] = useState<"METRIC" | "IMPERIAL">("METRIC");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [ethnicity, setEthnicity] = useState("");

  // About you
  const [about, setAbout] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [addingLanguage, setAddingLanguage] = useState(false);
  const [languageDraft, setLanguageDraft] = useState("");
  const [occupation, setOccupation] = useState("");
  const [education, setEducation] = useState("");
  const [religion, setReligion] = useState("");
  const [smoking, setSmoking] = useState("");
  const [drinking, setDrinking] = useState("");

  // Photos
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [uploadingMain, setUploadingMain] = useState(false);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);

  const [picker, setPicker] = useState<
    "country" | "city" | "eyeColor" | "hairColor" | "ethnicity" | "education" | "religion" | "smoking" | "drinking" | null
  >(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const needsEggDonor = role === "SINGLE_MAN" || role === "GAY_COUPLE";

  const flow: WizStep[] =
    goal === "donor"
      ? ["role", "goal", "basic", "appearance", "about", "photos"]
      : ["role", "goal", "childway", "basic", "appearance", "about", "photos"];
  const current = flow[Math.min(step, flow.length - 1)];
  const questionnaireTotal = goal === "parents" ? 3 : 2;
  const questionnaireStepNumber = current === "role" ? 1 : current === "goal" ? 2 : 3;

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

  // Photos step needs to know what's already there in case this screen is
  // ever reached with existing photos (not expected on a truly fresh
  // signup, but cheap to get right).
  useEffect(() => {
    if (current !== "photos" || photos.length) return;
    fetchPhotos()
      .then((res) => setPhotos(res.items))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

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

  function canProceed(): boolean {
    switch (current) {
      case "role":
        return !!role;
      case "goal":
        return !!goal;
      case "childway":
        return !!childway;
      default:
        return true;
    }
  }

  function validateBasic(): string | null {
    if (!name.trim()) return t("editProfile.nameRequired");
    if (!dobDay || !dobMonth || !dobYear) return t("editProfile.dobRequired");
    const day = parseInt(dobDay, 10);
    const month = parseInt(dobMonth, 10);
    const year = parseInt(dobYear, 10);
    const isValidDate =
      Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year) &&
      month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900 && year <= new Date().getFullYear();
    if (!isValidDate) return t("editProfile.dobInvalid");
    return null;
  }

  function goNext() {
    if (current === "basic") {
      const err = validateBasic();
      if (err) {
        setBasicError(err);
        return;
      }
      setBasicError(null);
    } else if (!canProceed()) {
      return;
    }
    if (step >= flow.length - 1) {
      handleComplete();
      return;
    }
    setStep((s) => s + 1);
  }

  function goBack() {
    if (step === 0) {
      navigation.goBack();
      return;
    }
    setStep((s) => s - 1);
  }

  function computeLookingFor(): string[] {
    if (goal !== "parents") return [];
    const donorKey = needsEggDonor ? "EGG_DONOR" : "SPERM_DONOR";
    if (childway === "donor") return [donorKey];
    if (childway === "coparent") return ["CO_PARENTING_PARTNER"];
    if (childway === "both") return [donorKey, "CO_PARENTING_PARTNER"];
    return [];
  }

  function computeDonorType(): string[] {
    if (goal !== "donor") return [];
    // A Single Man/Gay Couple helping others become parents donates sperm;
    // everyone else in that role donates eggs - the inverse of what they'd
    // need themselves.
    return needsEggDonor ? ["SPERM"] : ["EGG"];
  }

  function parseHeightCm(): number | undefined {
    const raw = parseFloat(height);
    if (!raw || Number.isNaN(raw)) return undefined;
    const cm = Math.round(unit === "IMPERIAL" ? raw * 2.54 : raw);
    if (cm < 80 || cm > 250) return undefined;
    return cm;
  }

  function parseWeightKg(): number | undefined {
    const raw = parseFloat(weight);
    if (!raw || Number.isNaN(raw)) return undefined;
    const kg = Math.round(unit === "IMPERIAL" ? raw * 0.453592 : raw);
    if (kg < 25 || kg > 350) return undefined;
    return kg;
  }

  async function handleComplete() {
    setSaveError(null);
    const err = validateBasic();
    if (err) {
      setBasicError(err);
      setStep(flow.indexOf("basic"));
      return;
    }
    const dateOfBirth = `${dobYear.padStart(4, "0")}-${dobMonth.padStart(2, "0")}-${dobDay.padStart(2, "0")}`;
    const heightCm = parseHeightCm();
    const weightKg = parseWeightKg();

    setSaving(true);
    try {
      await updateProfile({
        displayName: name.trim(),
        dateOfBirth,
        country,
        city,
        ethnicity,
        about,
        languages,
        profileType: role,
        lookingFor: computeLookingFor(),
        donorType: computeDonorType(),
        ...(heightCm !== undefined ? { height: heightCm } : {}),
        ...(weightKg !== undefined ? { weight: weightKg } : {}),
        ...(eyeColor ? { eyeColor } : {}),
        ...(hairColor ? { hairColor } : {}),
        ...(occupation.trim() ? { occupation: occupation.trim() } : {}),
        ...(education ? { education } : {}),
        ...(religion ? { religion } : {}),
        ...(smoking ? { smokingStatus: smoking } : {}),
        ...(drinking ? { drinkingStatus: drinking } : {}),
        unitPreference: unit,
      });
      navigation.goBack();
    } catch (err2) {
      setSaveError(err2 instanceof ApiError ? err2.message : t("common.somethingWrong"));
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPhoto(position: number) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPhotosError(t("photos.permissionBody"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setPhotosError(null);
    const setUploading = position === 0 ? setUploadingMain : setUploadingExtra;
    setUploading(true);
    try {
      const photo = await uploadPhoto(result.assets[0].uri, position);
      setPhotos((prev) => [...prev.filter((p) => p.position !== position), photo].sort((a, b) => a.position - b.position));
    } catch (err) {
      setPhotosError(err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setUploading(false);
    }
  }

  const mainPhoto = photos.find((p) => p.position === 0);
  const extraPhotos = photos.filter((p) => p.position > 0);
  const nextExtraPosition = (() => {
    for (let i = 1; i <= MAX_ADDITIONAL_PHOTOS; i++) {
      if (!extraPhotos.some((p) => p.position === i)) return i;
    }
    return null;
  })();

  function renderProgress() {
    if (current === "role" || current === "goal" || current === "childway") {
      return (
        <Text style={styles.stepLabel}>
          {t("wizard.stepLabel", { current: questionnaireStepNumber, total: questionnaireTotal })}
        </Text>
      );
    }
    const dotSteps: WizStep[] = ["basic", "appearance", "about", "photos"];
    const activeIndex = dotSteps.indexOf(current);
    return (
      <View style={styles.stepper}>
        {dotSteps.map((s, i) => (
          <React.Fragment key={s}>
            <View style={[styles.dot, i < activeIndex && styles.dotDone, i === activeIndex && styles.dotActive]}>
              <Text style={[styles.dotText, (i <= activeIndex) && styles.dotTextActive]}>
                {i < activeIndex ? "✓" : i + 1}
              </Text>
            </View>
            {i < dotSteps.length - 1 ? <View style={[styles.dotLine, i < activeIndex && styles.dotLineDone]} /> : null}
          </React.Fragment>
        ))}
      </View>
    );
  }

  function headerTitle(): string {
    switch (current) {
      case "role":
      case "goal":
      case "childway":
        return t("wizard.questionnaireTitle");
      case "basic":
        return t("wizard.basicTitle");
      case "appearance":
        return t("wizard.appearanceTitle");
      case "about":
        return t("wizard.aboutTitle");
      case "photos":
        return t("wizard.photosTitle");
      default:
        return "";
    }
  }

  function renderRoleStep() {
    return (
      <>
        <Text style={styles.question}>{t("wizard.roleQuestion")}</Text>
        {CATALOG_ENUM_OPTIONS.profileTypes.map((option) => {
          const selected = role === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.optionRow, selected && styles.optionRowSelected]}
              onPress={() => setRole(option.value)}
            >
              <Text style={styles.optionEmoji}>{ROLE_EMOJI[option.value] || "👤"}</Text>
              <Text style={styles.optionLabel}>{catalogOptionLabel("profileTypes", option.value)}</Text>
              <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
            </Pressable>
          );
        })}
      </>
    );
  }

  function renderGoalStep() {
    const parentsSub = needsEggDonor ? t("wizard.goalParentsSubEgg") : t("wizard.goalParentsSubSperm");
    const donorSub = needsEggDonor ? t("wizard.goalDonorSubSperm") : t("wizard.goalDonorSubEgg");
    const parentsEmoji = needsEggDonor ? "🥚" : "👶";
    const donorEmoji = needsEggDonor ? "🧬" : "🥚";
    return (
      <>
        <Text style={styles.question}>{t("wizard.goalQuestion")}</Text>
        <Pressable
          style={[styles.optionCardLg, goal === "parents" && styles.optionRowSelected]}
          onPress={() => setGoal("parents")}
        >
          <Text style={styles.optionEmojiLg}>{parentsEmoji}</Text>
          <View style={styles.optionCardText}>
            <Text style={styles.optionLabel}>{t("wizard.goalParentsLabel")}</Text>
            <Text style={styles.optionSub}>{parentsSub}</Text>
          </View>
          <View style={[styles.radio, goal === "parents" && styles.radioSelected]}>
            {goal === "parents" ? <View style={styles.radioDot} /> : null}
          </View>
        </Pressable>
        <Pressable
          style={[styles.optionCardLg, goal === "donor" && styles.optionRowSelected]}
          onPress={() => setGoal("donor")}
        >
          <Text style={styles.optionEmojiLg}>{donorEmoji}</Text>
          <View style={styles.optionCardText}>
            <Text style={styles.optionLabel}>{t("wizard.goalDonorLabel")}</Text>
            <Text style={styles.optionSub}>{donorSub}</Text>
          </View>
          <View style={[styles.radio, goal === "donor" && styles.radioSelected]}>
            {goal === "donor" ? <View style={styles.radioDot} /> : null}
          </View>
        </Pressable>
      </>
    );
  }

  function renderChildwayStep() {
    const donorLabel = needsEggDonor ? t("wizard.childwayDonorLabelEgg") : t("wizard.childwayDonorLabelSperm");
    return (
      <>
        <Text style={styles.question}>{t("wizard.childwayQuestion")}</Text>
        <Pressable
          style={[styles.optionCardLg, childway === "donor" && styles.optionRowSelected]}
          onPress={() => setChildway("donor")}
        >
          <Text style={styles.optionEmojiLg}>{"🧬"}</Text>
          <View style={styles.optionCardText}>
            <Text style={styles.optionLabel}>{donorLabel}</Text>
            <Text style={styles.optionSub}>{t("wizard.childwayDonorSub")}</Text>
          </View>
          <View style={[styles.radio, childway === "donor" && styles.radioSelected]}>
            {childway === "donor" ? <View style={styles.radioDot} /> : null}
          </View>
        </Pressable>
        <Pressable
          style={[styles.optionCardLg, childway === "coparent" && styles.optionRowSelected]}
          onPress={() => setChildway("coparent")}
        >
          <Text style={styles.optionEmojiLg}>{"🤝"}</Text>
          <View style={styles.optionCardText}>
            <Text style={styles.optionLabel}>{t("wizard.childwayCoparentLabel")}</Text>
            <Text style={styles.optionSub}>{t("wizard.childwayCoparentSub")}</Text>
          </View>
          <View style={[styles.radio, childway === "coparent" && styles.radioSelected]}>
            {childway === "coparent" ? <View style={styles.radioDot} /> : null}
          </View>
        </Pressable>
        <Pressable
          style={[styles.optionCardLg, childway === "both" && styles.optionRowSelected]}
          onPress={() => setChildway("both")}
        >
          <Text style={styles.optionEmojiLg}>{"🔀"}</Text>
          <View style={styles.optionCardText}>
            <Text style={styles.optionLabel}>{t("wizard.childwayBothLabel")}</Text>
            <Text style={styles.optionSub}>{t("wizard.childwayBothSub")}</Text>
          </View>
          <View style={[styles.radio, childway === "both" && styles.radioSelected]}>
            {childway === "both" ? <View style={styles.radioDot} /> : null}
          </View>
        </Pressable>
        <View style={styles.infoBox}>
          <Text style={styles.infoBoxText}>
            <Text style={styles.infoBoxBold}>{t("wizard.childwayDonorLabelSperm").replace(/^Looking for a /, "")}. </Text>
            {t("wizard.childwayInfoDonor")}
          </Text>
          <Text style={[styles.infoBoxText, { marginTop: spacing.sm }]}>{t("wizard.childwayInfoCoparent")}</Text>
        </View>
      </>
    );
  }

  function renderRecapCard() {
    if (!role) return null;
    const lookingForLabel =
      goal === "parents" && childway
        ? computeLookingFor().map((v) => catalogOptionLabel("lookingFor", v)).join(", ")
        : goal === "donor"
        ? computeDonorType().map((v) => catalogOptionLabel("donorTypes", v)).join(", ")
        : "—";
    return (
      <View style={styles.recapCard}>
        <Text style={styles.recapHint}>{t("editProfile.matchingHint")}</Text>
        <View style={styles.recapRow}>
          <Text style={styles.recapKey}>{t("editProfile.youAre")}</Text>
          <Text style={styles.recapValue}>{catalogOptionLabel("profileTypes", role)}</Text>
        </View>
        <View style={styles.recapRow}>
          <Text style={styles.recapKey}>{t("filters.lookingFor")}</Text>
          <Text style={styles.recapValue}>{lookingForLabel}</Text>
        </View>
        <Pressable onPress={() => setStep(0)}>
          <Text style={styles.recapEdit}>{"✏️ "}{t("wizard.editAnswers")}</Text>
        </Pressable>
      </View>
    );
  }

  function renderBasicStep() {
    return (
      <>
        {renderRecapCard()}
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
          <TextInput
            style={[styles.input, styles.dobInput]}
            value={dobDay}
            onChangeText={(v) => setDobDay(v.replace(/[^0-9]/g, "").slice(0, 2))}
            keyboardType="number-pad"
            placeholder={t("editProfile.dobDay")}
            placeholderTextColor={colors.muted}
            maxLength={2}
          />
          <TextInput
            style={[styles.input, styles.dobInput]}
            value={dobMonth}
            onChangeText={(v) => setDobMonth(v.replace(/[^0-9]/g, "").slice(0, 2))}
            keyboardType="number-pad"
            placeholder={t("editProfile.dobMonth")}
            placeholderTextColor={colors.muted}
            maxLength={2}
          />
          <TextInput
            style={[styles.input, styles.dobInputYear]}
            value={dobYear}
            onChangeText={(v) => setDobYear(v.replace(/[^0-9]/g, "").slice(0, 4))}
            keyboardType="number-pad"
            placeholder={t("editProfile.dobYear")}
            placeholderTextColor={colors.muted}
            maxLength={4}
          />
        </View>
        <Text style={styles.label}>{t("filters.country")}</Text>
        <Pressable style={[styles.field, country && styles.fieldFilled]} onPress={() => setPicker("country")}>
          <Text style={[styles.fieldText, country && styles.fieldTextFilled]} numberOfLines={1}>
            {country ? countries.find((c) => c.value === country)?.label || country : t("editProfile.selectCountry")}
          </Text>
          <Text style={styles.chevron}>{"⌄"}</Text>
        </Pressable>
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
        {basicError ? <Text style={styles.errorText}>{basicError}</Text> : null}
      </>
    );
  }

  function renderPickerField(label: string, placeholder: string, value: string, onPress: () => void, labelField?: string) {
    const display = value ? (labelField ? catalogOptionLabel(labelField, value) : value) : "";
    return (
      <>
        <Text style={styles.label}>
          {label} <Text style={styles.optionalTag}>{t("wizard.optional")}</Text>
        </Text>
        <Pressable style={[styles.field, value && styles.fieldFilled]} onPress={onPress}>
          <Text style={[styles.fieldText, value && styles.fieldTextFilled]} numberOfLines={1}>
            {display || placeholder}
          </Text>
          <Text style={styles.chevron}>{"⌄"}</Text>
        </Pressable>
      </>
    );
  }

  function renderAppearanceStep() {
    return (
      <>
        <View style={styles.unitToggle}>
          <Pressable style={[styles.unitBtn, unit === "METRIC" && styles.unitBtnActive]} onPress={() => setUnit("METRIC")}>
            <Text style={[styles.unitBtnText, unit === "METRIC" && styles.unitBtnTextActive]}>{t("wizard.unitMetric")}</Text>
          </Pressable>
          <Pressable style={[styles.unitBtn, unit === "IMPERIAL" && styles.unitBtnActive]} onPress={() => setUnit("IMPERIAL")}>
            <Text style={[styles.unitBtnText, unit === "IMPERIAL" && styles.unitBtnTextActive]}>{t("wizard.unitImperial")}</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          <View style={styles.col2}>
            <Text style={styles.label}>
              {t("wizard.height")} <Text style={styles.optionalTag}>{t("wizard.optional")}</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={height}
              onChangeText={(v) => setHeight(v.replace(/[^0-9.]/g, ""))}
              keyboardType="numeric"
              placeholder={unit === "METRIC" ? "170" : "67"}
              placeholderTextColor={colors.muted}
            />
          </View>
          <View style={styles.col2}>
            <Text style={styles.label}>
              {t("wizard.weight")} <Text style={styles.optionalTag}>{t("wizard.optional")}</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, ""))}
              keyboardType="numeric"
              placeholder={unit === "METRIC" ? "65" : "143"}
              placeholderTextColor={colors.muted}
            />
          </View>
        </View>
        {renderPickerField(t("wizard.eyeColor"), t("wizard.selectEyeColor"), eyeColor, () => setPicker("eyeColor"), "eyeColor")}
        {renderPickerField(t("wizard.hairColor"), t("wizard.selectHairColor"), hairColor, () => setPicker("hairColor"), "hairColor")}
        {renderPickerField(t("filters.ethnicity"), t("editProfile.select"), ethnicity, () => setPicker("ethnicity"), "ethnicity")}
      </>
    );
  }

  function renderAboutStep() {
    return (
      <>
        <Text style={[styles.label, styles.labelFirst]}>
          {t("editProfile.aboutYou")} <Text style={styles.optionalTag}>{t("wizard.optional")}</Text>
        </Text>
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

        <Text style={styles.label}>{t("editProfile.languagesTitle")}</Text>
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

        <Text style={styles.label}>
          {t("wizard.occupation")} <Text style={styles.optionalTag}>{t("wizard.optional")}</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={occupation}
          onChangeText={setOccupation}
          placeholder={t("wizard.occupationPlaceholder")}
          placeholderTextColor={colors.muted}
        />
        {renderPickerField(t("wizard.education"), t("wizard.selectEducation"), education, () => setPicker("education"), "education")}
        {renderPickerField(t("wizard.religion"), t("wizard.selectReligion"), religion, () => setPicker("religion"), "religion")}
        {renderPickerField(t("wizard.smoking"), t("wizard.selectSmoking"), smoking, () => setPicker("smoking"))}
        {renderPickerField(t("wizard.drinking"), t("wizard.selectDrinking"), drinking, () => setPicker("drinking"))}
      </>
    );
  }

  function renderPhotosStep() {
    return (
      <>
        <View style={styles.photosTopRow}>
          <View style={styles.photoSlotWrap}>
            <Text style={styles.photoSlotLabel}>{t("wizard.mainPhoto")}</Text>
            <Pressable
              style={[styles.mainPhotoBox, !mainPhoto && styles.mainPhotoEmpty]}
              onPress={() => handleUploadPhoto(0)}
              disabled={uploadingMain}
            >
              {uploadingMain ? (
                <ActivityIndicator color={colors.pink} />
              ) : mainPhoto ? (
                <Image source={{ uri: mainPhoto.publicUrl }} style={styles.mainPhotoImage} />
              ) : (
                <>
                  <Text style={styles.mainPhotoPlus}>{"+"}</Text>
                  <Text style={styles.mainPhotoText}>{t("wizard.tapToUpload")}</Text>
                </>
              )}
            </Pressable>
          </View>
          <View style={styles.photoSlotWrap}>
            <Text style={styles.photoSlotLabel}>{t("wizard.avatar")}</Text>
            <View style={styles.avatarCircle}>
              {mainPhoto ? <Image source={{ uri: mainPhoto.publicUrl }} style={styles.avatarImage} /> : null}
            </View>
            {!mainPhoto ? <Text style={styles.avatarStatus}>{t("wizard.uploadPhotoFirst")}</Text> : null}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>{t("wizard.additionalPhotos")}</Text>
        <Text style={styles.mutedNote}>
          {t("wizard.additionalPhotosCount", { count: extraPhotos.length, max: MAX_ADDITIONAL_PHOTOS })}
        </Text>
        <View style={styles.photoGrid}>
          {extraPhotos.map((photo) => (
            <View key={photo.id} style={styles.photoCell}>
              <Image source={{ uri: photo.publicUrl }} style={styles.photoCellImage} />
            </View>
          ))}
          {nextExtraPosition !== null && mainPhoto ? (
            <Pressable
              style={styles.photoAddTile}
              onPress={() => nextExtraPosition !== null && handleUploadPhoto(nextExtraPosition)}
              disabled={uploadingExtra}
            >
              {uploadingExtra ? <ActivityIndicator color={colors.pink} /> : <Text style={styles.mainPhotoPlus}>{"+"}</Text>}
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.mutedNote}>{t("wizard.fileTypes")}</Text>
        {photosError ? <Text style={styles.errorText}>{photosError}</Text> : null}
        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
      </>
    );
  }

  function renderStep() {
    switch (current) {
      case "role":
        return renderRoleStep();
      case "goal":
        return renderGoalStep();
      case "childway":
        return renderChildwayStep();
      case "basic":
        return renderBasicStep();
      case "appearance":
        return renderAppearanceStep();
      case "about":
        return renderAboutStep();
      case "photos":
        return renderPhotosStep();
      default:
        return null;
    }
  }

  const nextLabel =
    step >= flow.length - 1
      ? t("wizard.completeProfile")
      : current === "childway"
      ? t("wizard.done")
      : t("wizard.next");
  const nextDisabled = current === "photos" ? false : !canProceed() && current !== "basic";

  return (
    <GradientBackground variant="soft">
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>{"‹"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{headerTitle()}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {renderProgress()}
        {renderStep()}
      </ScrollView>
      <View style={[styles.bottomBar, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Pressable style={[styles.nextButton, nextDisabled && styles.nextButtonDisabled]} onPress={goNext} disabled={nextDisabled || saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextButtonText}>{nextLabel}</Text>}
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
      <Modal visible={picker === "eyeColor"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("wizard.eyeColor")}
          options={CATALOG_ENUM_OPTIONS.eyeColor}
          selected={eyeColor ? [eyeColor] : []}
          multi={false}
          onToggle={(value) => {
            setEyeColor(value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>
      <Modal visible={picker === "hairColor"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("wizard.hairColor")}
          options={CATALOG_ENUM_OPTIONS.hairColor}
          selected={hairColor ? [hairColor] : []}
          multi={false}
          onToggle={(value) => {
            setHairColor(value);
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
      <Modal visible={picker === "education"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("wizard.education")}
          options={CATALOG_ENUM_OPTIONS.education}
          selected={education ? [education] : []}
          multi={false}
          onToggle={(value) => {
            setEducation(value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>
      <Modal visible={picker === "religion"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("wizard.religion")}
          options={CATALOG_ENUM_OPTIONS.religion}
          selected={religion ? [religion] : []}
          multi={false}
          onToggle={(value) => {
            setReligion(value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>
      <Modal visible={picker === "smoking"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("wizard.smoking")}
          options={SMOKING_DRINKING_VALUES.map((v): OptionRow => ({ value: v, label: t(`wizard.freq${v}` as const) }))}
          selected={smoking ? [smoking] : []}
          multi={false}
          onToggle={(value) => {
            setSmoking(value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>
      <Modal visible={picker === "drinking"} animationType="slide" onRequestClose={() => setPicker(null)}>
        <OptionListPicker
          title={t("wizard.drinking")}
          options={SMOKING_DRINKING_VALUES.map((v): OptionRow => ({ value: v, label: t(`wizard.freq${v}` as const) }))}
          selected={drinking ? [drinking] : []}
          multi={false}
          onToggle={(value) => {
            setDrinking(value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      </Modal>
    </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "transparent" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 26, color: colors.ink, marginTop: -2 },
  headerTitle: { fontSize: 15.5, fontWeight: "800", color: colors.ink, flexShrink: 1, textAlign: "center" },
  container: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  stepLabel: { fontSize: 11.5, fontWeight: "800", color: colors.muted, letterSpacing: 0.6, marginBottom: spacing.sm, textTransform: "uppercase" },
  stepper: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  dotActive: { borderColor: colors.pink, backgroundColor: colors.pink },
  dotDone: { borderColor: colors.pink, backgroundColor: colors.pink },
  dotText: { fontSize: 11.5, fontWeight: "800", color: colors.muted },
  dotTextActive: { color: "#fff" },
  dotLine: { flex: 1, height: 2, backgroundColor: colors.line, marginHorizontal: 4 },
  dotLineDone: { backgroundColor: colors.pink },
  question: { fontSize: 19, fontWeight: "800", color: colors.ink, marginBottom: spacing.md },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    marginBottom: 10,
    gap: spacing.sm,
  },
  optionRowSelected: { borderColor: colors.pink, backgroundColor: colors.tintPink },
  optionEmoji: { fontSize: 22, width: 30, textAlign: "center" },
  optionEmojiLg: { fontSize: 26, width: 38, textAlign: "center" },
  optionLabel: { fontSize: 14.5, fontWeight: "700", color: colors.ink, flex: 1 },
  optionCardLg: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
    gap: spacing.sm,
  },
  optionCardText: { flex: 1 },
  optionSub: { fontSize: 12.5, color: colors.muted, marginTop: 3, lineHeight: 17 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.pink },
  radioDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: colors.pink },
  infoBox: {
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  infoBoxText: { fontSize: 12.5, color: colors.muted, lineHeight: 18 },
  infoBoxBold: { fontWeight: "800", color: colors.ink },
  recapCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  recapHint: { fontSize: 12, color: colors.muted, marginBottom: 10, lineHeight: 17 },
  recapRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  recapKey: { fontSize: 13.5, color: colors.muted },
  recapValue: { fontSize: 13.5, color: colors.ink, fontWeight: "600" },
  recapEdit: { fontSize: 12.5, fontWeight: "700", color: colors.pink, marginTop: 6 },
  label: { fontSize: 14, fontWeight: "700", color: colors.ink, marginTop: 13, marginBottom: 7 },
  labelFirst: { marginTop: 0 },
  optionalTag: { fontSize: 12, fontWeight: "500", color: colors.muted },
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
  errorText: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  unitToggle: {
    flexDirection: "row",
    backgroundColor: colors.bgSoft,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
    alignSelf: "flex-start",
  },
  unitBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.pill },
  unitBtnActive: { backgroundColor: colors.pink },
  unitBtnText: { fontSize: 12.5, fontWeight: "700", color: colors.muted },
  unitBtnTextActive: { color: "#fff" },
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
  chip: { backgroundColor: colors.tintPink, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: "600" },
  chipAdd: { borderWidth: 1, borderColor: colors.pink, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
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
  sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.ink, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.3 },
  mutedNote: { fontSize: 12, color: colors.muted, marginBottom: spacing.sm },
  photosTopRow: { flexDirection: "row", gap: spacing.lg },
  photoSlotWrap: { alignItems: "center" },
  photoSlotLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 8 },
  mainPhotoBox: {
    width: 110,
    height: 110,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    overflow: "hidden",
  },
  mainPhotoEmpty: { borderWidth: 1.5, borderColor: colors.line, borderStyle: "dashed" },
  mainPhotoImage: { width: "100%", height: "100%" },
  mainPhotoPlus: { fontSize: 22, color: colors.pink, fontWeight: "300" },
  mainPhotoText: { fontSize: 11, color: colors.muted, marginTop: 4 },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarStatus: { fontSize: 10.5, color: colors.muted, fontWeight: "600", marginTop: 8, textAlign: "center", width: 90 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoCell: { width: 84, height: 84, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.line },
  photoCellImage: { width: "100%", height: "100%" },
  photoAddTile: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  nextButton: { height: 52, borderRadius: radius.pill, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center" },
  nextButtonDisabled: { opacity: 0.5 },
  nextButtonText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
});
