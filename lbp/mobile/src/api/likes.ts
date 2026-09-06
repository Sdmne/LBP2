import { api } from "./client";
import type { LikesResponse, ProfileVisitsResponse } from "./types";

// GET /api/member/likes - member_likes() in main.py.
export function fetchLikes() {
  return api.get<LikesResponse>("/api/member/likes");
}

// POST /api/member/notifications/likes/read - member_mark_likes_read() in
// main.py. Mirrors the website's Likes page: called whenever the "Likes you"
// tab is the active one and there's a readThroughId to report, so the
// unread count clears the same way it does on the site.
export function markLikesRead(readThroughId: number) {
  return api.post<{ ok: true; readThroughId: number; counts: { likesYou: number } }>(
    "/api/member/notifications/likes/read",
    { readThroughId }
  );
}

// GET /api/member/profile-views - member_profile_views() in main.py.
export function fetchProfileViews() {
  return api.get<ProfileVisitsResponse>("/api/member/profile-views");
}
