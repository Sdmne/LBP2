import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { fetchClinicDetail, fetchLawyerDetail } from "../api/directory";
import { favouriteClinic, favouriteLawyer, unfavouriteClinic, unfavouriteLawyer } from "../api/favourites";
import { ApiError } from "../api/client";
import type { DirectoryDetail } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "DirectoryDetail">;

// Restyled (Sep 2026) to match the prototype's #scr-provider-detail: a
// centered "hero" (icon circle, name, location, a green verified-partner
// badge), a row of service/practice-area tag pills, then contact actions.
// The prototype's own contact section is just a demo "Contact" button that
// shows a toast - this app has real phone/email/website/address data from
// the backend (DirectoryDetail.contact, see api/types.ts), so those stay as
// real tappable rows instead of being replaced by a fake button. There's
// also no "about" text field on clinics/lawyers in the real API, so no
// .prov-about section is rendered (the prototype's was empty/decorative
// there too, per its own markup).
export default function DirectoryDetailScreen({ route }: Props) {
  const { kind, slugOrId, isFavourite: initialIsFavourite } = route.params;
  const { t } = useI18n();
  const [item, setItem] = useState<DirectoryDetail | null>(null);
  const [isFavourite, setIsFavourite] = useState(!!initialIsFavourite);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fetchDetail = kind === "clinics" ? fetchClinicDetail : fetchLawyerDetail;
    fetchDetail(slugOrId)
      .then(setItem)
      .catch((err) => setError(err instanceof ApiError ? err.message : t("directoryDetail.loadError")));
  }, [kind, slugOrId, t]);

  async function toggleFavourite() {
    if (!item) return;
    setBusy(true);
    const next = !isFavourite;
    setIsFavourite(next);
    try {
      if (kind === "clinics") {
        await (next ? favouriteClinic(item.id) : unfavouriteClinic(item.id));
      } else {
        await (next ? favouriteLawyer(item.id) : unfavouriteLawyer(item.id));
      }
    } catch {
      setIsFavourite(!next);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  const image = item.logoUrl || item.photoUrl;
  const contact = item.contact || {};
  const tags = firstStringList(kind === "clinics" ? item.services : item.practiceAreas);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        {image ? (
          <Image source={{ uri: image }} style={styles.heroIcon} />
        ) : (
          <View style={[styles.heroIcon, styles.heroIconPlaceholder]}>
            <Text style={{ fontSize: 30 }}>{kind === "clinics" ? "🏥" : "⚖️"}</Text>
          </View>
        )}
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.subtitle}>📍 {[item.city, item.country].filter(Boolean).join(", ") || t("common.locationNotSet")}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t("directoryDetail.verifiedPartner")}</Text>
        </View>
      </View>

      {tags.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("directoryDetail.services")}</Text>
          <View style={styles.tagsRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Pressable style={[styles.favouriteButton, isFavourite && styles.favouriteButtonActive]} onPress={toggleFavourite} disabled={busy}>
          <Text style={[styles.favouriteText, isFavourite && styles.favouriteTextActive]}>
            {isFavourite ? t("directoryDetail.saved") : t("directoryDetail.save")}
          </Text>
        </Pressable>

        {contact.phone ? (
          <ContactRow icon="📞" label={t("directoryDetail.phone")} value={contact.phone} onPress={() => Linking.openURL(`tel:${contact.phone}`)} />
        ) : null}
        {contact.email ? (
          <ContactRow icon="✉️" label={t("directoryDetail.email")} value={contact.email} onPress={() => Linking.openURL(`mailto:${contact.email}`)} />
        ) : null}
        {contact.website ? (
          <ContactRow icon="🌐" label={t("directoryDetail.website")} value={contact.website} onPress={() => Linking.openURL(String(contact.website))} />
        ) : null}
        {contact.location ? <ContactRow icon="📍" label={t("directoryDetail.address")} value={contact.location} /> : null}
      </View>
    </ScrollView>
  );
}

function firstStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function ContactRow({ icon, label, value, onPress }: { icon: string; label: string; value: string; onPress?: () => void }) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper style={styles.contactRow} onPress={onPress}>
      <View style={styles.contactIconWrap}>
        <Text style={styles.contactIcon}>{icon}</Text>
      </View>
      <View style={styles.contactBody}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={[styles.contactValue, onPress && styles.contactValueLink]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  errorText: { color: colors.danger },
  container: { paddingBottom: spacing.xl, backgroundColor: colors.card },
  hero: { alignItems: "center", paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
  heroIcon: { width: 74, height: 74, borderRadius: 37, backgroundColor: colors.tint, marginBottom: 12 },
  heroIconPlaceholder: { alignItems: "center", justifyContent: "center" },
  name: { fontSize: 19, fontWeight: "800", color: colors.ink, textAlign: "center" },
  subtitle: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: "center" },
  badge: { marginTop: 10, backgroundColor: "#e4f7ec", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: 11.5, fontWeight: "700", color: "#1e9e5a" },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 6 },
  tagText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  favouriteButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  favouriteButtonActive: { borderColor: colors.danger, backgroundColor: "#fdeef0" },
  favouriteText: { fontWeight: "700", color: colors.ink },
  favouriteTextActive: { color: colors.danger },
  contactRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  contactIconWrap: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.tintPink, alignItems: "center", justifyContent: "center" },
  contactIcon: { fontSize: 15 },
  contactBody: { flex: 1, minWidth: 0 },
  contactLabel: { fontSize: 11, color: colors.muted, fontWeight: "700", textTransform: "uppercase" },
  contactValue: { fontSize: 14, color: colors.ink, marginTop: 1 },
  contactValueLink: { color: colors.blueDark },
});
