import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { deletePhoto, fetchPhotos, setPrimaryPhoto, uploadAvatar, uploadPhoto } from "../api/photos";
import { ApiError } from "../api/client";
import type { ProfilePhoto } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GradientBackground from "../components/GradientBackground";
import { Feather } from "@expo/vector-icons";

const MAX_PROFILE_PHOTOS = 6; // matches MAX_PROFILE_PHOTOS in main.py at the time this screen was written - confirm it hasn't changed if uploads start rejecting with 409.

// moderationReason (member_photos()'s pp.moderation_reason - see
// automatic_photo_decision()/moderate_profile_image() in main.py) was
// already returned by the backend but never shown anywhere - a REJECTED
// photo just said "Rejected" with nothing else, Alena's "не понятно
// почему". Google Cloud Vision (the actual moderation provider - see
// moderate_profile_image's VISION_CLIENT) produces a handful of known
// codes; anything else (a raw Vision SafeSearch label, a future code)
// falls back to a generic message rather than showing a raw enum string.
function moderationReasonLabel(reason: string | null | undefined, t: (key: string) => string): string | null {
  if (!reason) return null;
  const known: Record<string, string> = {
    PROHIBITED_CONTENT: t("photos.reasonProhibitedContent"),
    MAIN_PHOTO_FACE_REQUIRED: t("photos.reasonFaceRequired"),
    MAIN_PHOTO_SINGLE_FACE_REQUIRED: t("photos.reasonSingleFaceRequired"),
  };
  return known[reason] || t("photos.reasonGeneric");
}

export default function PhotosScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchPhotos();
      setPhotos(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("photos.loadError"));
    }
  }, [t]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Prototype's #scr-my-photos has separate "Primary photo" and "Avatar"
  // slots (see the mockup Alena sent). Building those for real needed two
  // backend pieces that weren't wired up before:
  //  - "primary" is just whichever photo has position === 0. Until this
  //    round there was no way for the app to CHANGE that after the fact
  //    (only delete-and-reupload-in-order) - see setPrimaryPhoto()/
  //    POST /api/member/photos/{id}/primary, added alongside this screen.
  //  - "avatar" is a separate cropped image tied to the primary photo
  //    (avatarUrl on that photo's own row). POST /api/member/avatar already
  //    existed on the backend but no client called it - see uploadAvatar().
  const primary = useMemo(() => photos.find((p) => p.position === 0) ?? null, [photos]);
  const others = useMemo(
    () => photos.filter((p) => p.position !== 0).sort((a, b) => a.position - b.position),
    [photos]
  );

  function nextFreeAdditionalPosition(): number | null {
    const used = new Set(photos.map((p) => p.position));
    for (let i = 1; i < MAX_PROFILE_PHOTOS; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  }

  async function uploadAt(position: number) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("photos.permissionTitle"), t("photos.permissionBody"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const photo = await uploadPhoto(result.assets[0].uri, position);
      setPhotos((prev) => [...prev.filter((p) => p.position !== position), photo]);
    } catch (err) {
      Alert.alert(t("photos.uploadFailedTitle"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setUploading(false);
    }
  }

  function handleAddOrReplacePrimary() {
    uploadAt(0);
  }

  function handleAddAdditional() {
    const free = nextFreeAdditionalPosition();
    if (free === null) {
      Alert.alert(t("photos.limitTitle"), t("photos.limitBody", { max: MAX_PROFILE_PHOTOS }));
      return;
    }
    uploadAt(free);
  }

  async function handleSetAvatar() {
    if (!primary || primary.moderationStatus !== "APPROVED") return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("photos.permissionTitle"), t("photos.permissionBody"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;

    setUploadingAvatar(true);
    try {
      await uploadAvatar(result.assets[0].uri);
      await load();
    } catch (err) {
      Alert.alert(t("photos.uploadFailedTitle"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleMakePrimary(photo: ProfilePhoto) {
    setSettingPrimaryId(photo.id);
    try {
      await setPrimaryPhoto(photo.id);
      await load();
    } catch (err) {
      Alert.alert(t("photos.setPrimaryFailedTitle"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setSettingPrimaryId(null);
    }
  }

  function handleDelete(photo: ProfilePhoto) {
    Alert.alert(t("photos.deleteTitle"), t("photos.deleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("photos.delete"),
        style: "destructive",
        onPress: async () => {
          setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
          try {
            await deletePhoto(photo.id);
            // Deleting the primary photo makes the backend auto-promote the
            // next one in line (see member_delete_photo) - refetch so that
            // shows up here instead of leaving the Primary card empty.
            if (photo.position === 0) load();
          } catch (err) {
            load(); // out of sync with the server - just refetch
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.pink} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const avatarPreviewUrl = primary?.avatarUrl || primary?.publicUrl || null;
  const canSetAvatar = !!primary && primary.moderationStatus === "APPROVED";

  return (
    <GradientBackground variant="soft">
      <FlatList
        style={{ backgroundColor: "transparent" }}
        data={others}
        keyExtractor={(item) => String(item.id)}
        numColumns={3}
        contentContainerStyle={[styles.grid, { paddingBottom: spacing.md + insets.bottom }]}
        ListHeaderComponent={
          <View style={styles.topSection}>
            <View style={styles.slotsRow}>
              <View style={styles.slotCard}>
                <Text style={styles.slotTitle}>{t("photos.primaryTitle")}</Text>
                <View style={styles.slotImageWrap}>
                  {primary ? (
                    <Image source={{ uri: primary.publicUrl }} style={styles.slotImage} />
                  ) : (
                    <View style={[styles.slotImage, styles.slotImagePlaceholder]}>
                      <Feather name="user" size={28} color={colors.muted} />
                    </View>
                  )}
                  {primary && primary.moderationStatus !== "APPROVED" ? (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>
                        {primary.moderationStatus === "REJECTED" ? t("photos.rejected") : t("photos.pending")}
                      </Text>
                    </View>
                  ) : null}
                  {primary ? (
                    <Pressable style={styles.slotDeleteBadge} onPress={() => handleDelete(primary)} hitSlop={8}>
                      <Text style={styles.deleteBadgeText}>{"✕"}</Text>
                    </Pressable>
                  ) : null}
                </View>
                {primary && primary.moderationStatus === "REJECTED" && moderationReasonLabel(primary.moderationReason, t) ? (
                  <Text style={styles.rejectedReason} numberOfLines={2}>
                    {moderationReasonLabel(primary.moderationReason, t)}
                  </Text>
                ) : null}
                <Pressable style={styles.slotButton} onPress={handleAddOrReplacePrimary} disabled={uploading}>
                  {uploading ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Text style={styles.slotButtonText}>{primary ? t("photos.replacePhoto") : t("photos.addPrimary")}</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.slotCard}>
                <Text style={styles.slotTitle}>{t("photos.avatarTitle")}</Text>
                <View style={styles.slotImageWrap}>
                  {avatarPreviewUrl ? (
                    <Image source={{ uri: avatarPreviewUrl }} style={[styles.slotImage, styles.avatarImage]} />
                  ) : (
                    <View style={[styles.slotImage, styles.avatarImage, styles.slotImagePlaceholder]}>
                      <Feather name="image" size={28} color={colors.muted} />
                    </View>
                  )}
                </View>
                {canSetAvatar ? (
                  <Pressable style={styles.slotButton} onPress={handleSetAvatar} disabled={uploadingAvatar}>
                    {uploadingAvatar ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.slotButtonText}>
                        {primary?.avatarUrl ? t("photos.changeAvatar") : t("photos.setAvatar")}
                      </Text>
                    )}
                  </Pressable>
                ) : (
                  <Text style={styles.slotHint}>{t("photos.avatarNeedsPrimary")}</Text>
                )}
              </View>
            </View>

            <View style={styles.additionalHeader}>
              <Text style={styles.additionalTitle}>{t("photos.additionalTitle")}</Text>
              <Pressable style={styles.addMoreButton} onPress={handleAddAdditional} disabled={uploading}>
                <Text style={styles.addMoreButtonText}>{t("photos.addPhoto")}</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <Image source={{ uri: item.publicUrl }} style={styles.thumb} />
            {item.moderationStatus !== "APPROVED" ? (
              <Pressable
                style={styles.statusBadge}
                disabled={item.moderationStatus !== "REJECTED" || !moderationReasonLabel(item.moderationReason, t)}
                onPress={() => Alert.alert(t("photos.rejected"), moderationReasonLabel(item.moderationReason, t) || undefined)}
              >
                <Text style={styles.statusBadgeText}>{item.moderationStatus === "REJECTED" ? t("photos.rejected") : t("photos.pending")}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.makePrimaryBadge}
                onPress={() => handleMakePrimary(item)}
                disabled={settingPrimaryId === item.id}
                hitSlop={8}
              >
                {settingPrimaryId === item.id ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Feather name="star" size={12} color={colors.white} />
                )}
              </Pressable>
            )}
            {/* Prototype's #scr-my-photos shows an explicit "Delete" control on
                each photo - the previous version only had this bound to an
                undiscoverable long-press with no visible affordance. Added a
                real, visible delete button; kept the long-press too since it
                was already there and some users will have learned it. */}
            <Pressable style={styles.deleteBadge} onPress={() => handleDelete(item)} hitSlop={8}>
              <Text style={styles.deleteBadgeText}>{"✕"}</Text>
            </Pressable>
          </View>
        )}
        // Prototype's #scr-my-photos has a "Tips for better matches" block
        // below the grid - real, static copy, no backend dependency, so
        // added here as a list footer.
        ListFooterComponent={
          photos.length > 0 ? (
            <View style={styles.tips}>
              <Text style={styles.tipsTitle}>{t("photos.tipsTitle")}</Text>
              <Text style={styles.tipsRow}>{"✓"}  {t("photos.tip1")}</Text>
              <Text style={styles.tipsRow}>{"✓"}  {t("photos.tip2")}</Text>
            </View>
          ) : null
        }
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.danger },
  grid: { padding: spacing.sm },
  topSection: { marginBottom: spacing.xs },
  slotsRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xs, marginTop: spacing.xs },
  slotCard: { flex: 1, alignItems: "center" },
  slotTitle: { fontSize: 12.5, fontWeight: "700", color: colors.ink, marginBottom: spacing.xs },
  slotImageWrap: { width: "100%", aspectRatio: 1, position: "relative" },
  slotImage: { width: "100%", height: "100%", borderRadius: radius.md, backgroundColor: colors.line },
  avatarImage: { borderRadius: 999 },
  slotImagePlaceholder: { alignItems: "center", justifyContent: "center" },
  slotDeleteBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotButton: {
    marginTop: spacing.xs,
    backgroundColor: colors.pink,
    borderRadius: radius.md,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  slotButtonText: { color: colors.white, fontWeight: "700", fontSize: 12.5 },
  slotHint: { marginTop: spacing.xs, fontSize: 11, color: colors.muted, textAlign: "center", lineHeight: 15 },
  additionalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  additionalTitle: { fontSize: 13.5, fontWeight: "700", color: colors.ink },
  addMoreButton: { paddingVertical: 4, paddingHorizontal: 8 },
  addMoreButtonText: { color: colors.pink, fontWeight: "700", fontSize: 13 },
  cell: { flex: 1 / 3, aspectRatio: 1, margin: spacing.xs, position: "relative" },
  thumb: { width: "100%", height: "100%", borderRadius: radius.md, backgroundColor: colors.line },
  deleteBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  makePrimaryBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: radius.sm,
    paddingVertical: 3,
    alignItems: "center",
  },
  statusBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  rejectedReason: { fontSize: 11.5, color: colors.danger, textAlign: "center", marginTop: 4, paddingHorizontal: 4 },
  tips: {
    marginTop: spacing.md,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tipsTitle: { fontSize: 13.5, fontWeight: "700", color: colors.ink, marginBottom: spacing.xs },
  tipsRow: { fontSize: 12.5, color: colors.muted, marginTop: 4 },
});
