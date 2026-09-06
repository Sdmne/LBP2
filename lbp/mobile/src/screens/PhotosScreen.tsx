import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { deletePhoto, fetchPhotos, uploadPhoto } from "../api/photos";
import { ApiError } from "../api/client";
import type { ProfilePhoto } from "../api/types";
import { useI18n } from "../i18n/I18nContext";
import { colors, radius, spacing } from "../theme";

const MAX_PROFILE_PHOTOS = 6; // matches MAX_PROFILE_PHOTOS in main.py at the time this screen was written - confirm it hasn't changed if uploads start rejecting with 409.

export default function PhotosScreen() {
  const { t } = useI18n();
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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

  async function handleAdd() {
    if (photos.length >= MAX_PROFILE_PHOTOS) {
      Alert.alert(t("photos.limitTitle"), t("photos.limitBody", { max: MAX_PROFILE_PHOTOS }));
      return;
    }
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
      // Position is "next free slot" - the backend's own count decides
      // whether that's actually allowed (MAX_PROFILE_PHOTOS, one photo per
      // position).
      const photo = await uploadPhoto(result.assets[0].uri, photos.length);
      setPhotos((prev) => [...prev, photo]);
    } catch (err) {
      Alert.alert(t("photos.uploadFailedTitle"), err instanceof ApiError ? err.message : t("common.pleaseTryAgain"));
    } finally {
      setUploading(false);
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

  return (
    <FlatList
      data={photos}
      keyExtractor={(item) => String(item.id)}
      numColumns={3}
      contentContainerStyle={styles.grid}
      ListHeaderComponent={
        <Pressable style={styles.addButton} onPress={handleAdd} disabled={uploading}>
          {uploading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.addButtonText}>{t("photos.addPhoto")}</Text>}
        </Pressable>
      }
      renderItem={({ item }) => (
        <Pressable style={styles.cell} onLongPress={() => handleDelete(item)}>
          <Image source={{ uri: item.publicUrl }} style={styles.thumb} />
          {item.moderationStatus !== "APPROVED" ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{item.moderationStatus === "REJECTED" ? t("photos.rejected") : t("photos.pending")}</Text>
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.danger },
  grid: { padding: spacing.sm },
  addButton: {
    backgroundColor: colors.pink,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    margin: spacing.xs,
  },
  addButtonText: { color: colors.white, fontWeight: "700" },
  cell: { flex: 1 / 3, aspectRatio: 1, margin: spacing.xs, position: "relative" },
  thumb: { width: "100%", height: "100%", borderRadius: radius.md, backgroundColor: colors.line },
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
});
