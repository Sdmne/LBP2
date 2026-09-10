// The full-profile detail sections (bio, Looking for, Contact with the
// child, Languages, Occupation/Religion/Education/Smoking/Drinking/
// Height/Weight/Eye color/Hair color) - shared between ProfileDetailScreen
// (the separate full-screen profile view) and CatalogScreen's inline
// "scroll down to see the full profile without leaving Browse" expansion
// (Alena's prototype screen recording: the swipe card scrolls in place and
// this exact white panel appears underneath it, while the pass/info/
// message/like row and tab bar stay fixed). Extracted so both places
// render identical data instead of drifting apart - see
// utils/profileFields.ts for the field-reading helpers this uses.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { catalogOptionLabel } from "../data/catalogLabels";
import {
  buildDetailRows,
  dataList,
  dataString,
  firstString,
  type ProfileDetailData,
} from "../utils/profileFields";

export default function ProfileDetailSections({ profile }: { profile: ProfileDetailData }) {
  const { t } = useI18n();
  const bio = firstString(profile.data, ["bio", "about", "aboutMe", "description"]);
  const lookingFor = dataList(profile.data, "lookingFor");
  const contactWithChild = dataString(profile.data, "desiredDonorContact");
  const languages = dataList(profile.data, "languages");
  const detailRows = buildDetailRows(t, profile.data);

  return (
    <View style={styles.infoCard}>
      {bio ? <Text style={styles.bio}>{bio}</Text> : null}

      {lookingFor.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profileDetail.lookingFor")}</Text>
          <View style={styles.tagRow}>
            {lookingFor.map((v) => (
              <Text key={v} style={styles.tag}>{catalogOptionLabel("lookingFor", v)}</Text>
            ))}
          </View>
        </View>
      ) : null}

      {contactWithChild ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profileDetail.contactWithChild")}</Text>
          <Text style={styles.tag}>{contactWithChild}</Text>
        </View>
      ) : null}

      {languages.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("profileDetail.languages")}</Text>
          <View style={styles.tagRow}>
            {languages.map((v) => (
              <Text key={v} style={styles.chip}>{v}</Text>
            ))}
          </View>
        </View>
      ) : null}

      {detailRows.length > 0 ? (
        <View style={styles.section}>
          {detailRows.map((row) => (
            <View key={row.label} style={styles.kvRow}>
              <Text style={styles.kvKey}>{row.label}</Text>
              <Text style={styles.kvValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!bio && !lookingFor.length && !contactWithChild && !languages.length && !detailRows.length ? (
        <Text style={styles.empty}>{t("profileDetail.noDetails")}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  bio: { fontSize: 15, color: colors.text, lineHeight: 21 },
  empty: { fontSize: 13.5, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.md },
  section: { marginTop: spacing.md },
  sectionTitle: { fontSize: 12.5, fontWeight: "700", color: colors.muted, marginBottom: spacing.xs },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  tag: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.ink,
    backgroundColor: colors.tintPink,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  chip: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.ink,
    backgroundColor: colors.bgSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  kvKey: { fontSize: 13.5, color: colors.muted },
  kvValue: { fontSize: 13.5, color: colors.ink, fontWeight: "600" },
});
