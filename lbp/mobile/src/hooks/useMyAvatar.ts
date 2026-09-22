import { useEffect, useState } from "react";
import { fetchPhotos } from "../api/photos";

// AppHeader.tsx is mounted on 4 different screens (Explore/Messages/
// KnowledgeHub/Me), and until now every one of them just showed a
// gradient-initial circle - never the person's real photo, even when they
// have one (Alena: "аватарки по сути нет, хотя фото есть"). This is the
// shared source of truth for that photo: a tiny in-memory cache plus
// request de-duplication, so mounting AppHeader on 4 screens doesn't fire 4
// parallel GET /api/member/photos calls, and switching tabs doesn't
// re-fetch every time.
let cached: string | null | undefined; // undefined = not loaded yet
let inFlight: Promise<string | null> | null = null;

function load(): Promise<string | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = fetchPhotos()
      // The primary (position 0) photo carries its own dedicated cropped
      // `avatarUrl` (see PhotosScreen.tsx's comment on "primary" vs.
      // "avatar" - POST /api/member/avatar) - that's the right image for
      // this small circular header avatar, not the full publicUrl. Falls
      // back to publicUrl only if no avatar crop has been set yet.
      .then((res) => {
        const p = res.items.find((item) => item.position === 0);
        return p?.avatarUrl || p?.publicUrl || null;
      })
      .catch(() => null)
      .then((url) => {
        cached = url;
        inFlight = null;
        return url;
      });
  }
  return inFlight;
}

// PhotosScreen calls this after any change to the primary (position 0)
// photo - upload, replace, "make primary", or deleting it - so AppHeader
// picks up the new photo next time it mounts instead of showing a stale
// one (or none) until the app restarts.
export function invalidateMyAvatarCache() {
  cached = undefined;
}

export function useMyAvatarUrl(): string | null {
  const [url, setUrl] = useState<string | null>(cached ?? null);
  useEffect(() => {
    let alive = true;
    load().then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, []);
  return url;
}
