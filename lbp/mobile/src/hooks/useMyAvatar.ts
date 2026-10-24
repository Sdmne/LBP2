import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { AppState } from "react-native";
import { fetchPhotos } from "../api/photos";

// All headers share the primary photo and one in-flight request. Successful
// results remain visible during background revalidation on screen focus and
// foreground resume. Local photo changes and account changes invalidate them.
let cached: string | null | undefined; // undefined = not loaded yet
let inFlight: Promise<string | null> | null = null;
let generation = 0;
const listeners = new Set<(url: string | null) => void>();

function publish(url: string | null) {
  listeners.forEach((listener) => listener(url));
}

function load(refresh = false): Promise<string | null> {
  if (!refresh && cached !== undefined) return Promise.resolve(cached);
  if (!inFlight) {
    const requestGeneration = generation;
    inFlight = fetchPhotos()
      // The primary (position 0) photo carries its own dedicated cropped
      // `avatarUrl` (see PhotosScreen.tsx's comment on "primary" vs.
      // "avatar" - POST /api/member/avatar) - that's the right image for
      // this small circular header avatar, not the full publicUrl. Falls
      // back to publicUrl only if no avatar crop has been set yet.
      .then((res) => {
        const p = res.items.find((item) => item.position === 0);
        const url = p?.avatarUrl || p?.publicUrl || null;
        if (requestGeneration !== generation) return null;
        cached = url;
        publish(url);
        return url;
      })
      // A network error is not a confirmed absence of photos. Leave the cache
      // unloaded so another header mount or screen focus can retry.
      .catch(() => null)
      .finally(() => {
        if (requestGeneration === generation) inFlight = null;
      });
  }
  return inFlight;
}

// PhotosScreen calls this after any change to the primary (position 0)
// photo - upload, replace, "make primary", or deleting it - so AppHeader
// updates already-mounted headers immediately. A generation guard prevents
// an older in-flight request from restoring a replaced photo or account.
export function invalidateMyAvatarCache(refresh = true) {
  generation += 1;
  cached = undefined;
  inFlight = null;
  publish(null);
  if (refresh && listeners.size > 0) void load();
}

export function useMyAvatarUrl(): string | null {
  const [url, setUrl] = useState<string | null>(cached ?? null);
  useEffect(() => {
    listeners.add(setUrl);
    if (cached !== undefined) setUrl(cached);
    else void load();
    return () => {
      listeners.delete(setUrl);
    };
  }, []);
  useFocusEffect(useCallback(() => {
    void load(true);
  }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load(true);
    });
    return () => subscription.remove();
  }, []);
  return url;
}
