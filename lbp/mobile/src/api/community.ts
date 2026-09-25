import { api } from "./client";

// Premium roadmap step 11 - Pro-only community/expert Q&A groups (the
// last of the originally-brainstormed roadmap items). Groups are admin-
// curated (created via the generic admin entity endpoints, see
// ADMIN_ENTITY_VIEWS in main.py) - members can only post/reply inside
// them, never create a group themselves.

export type CommunityGroup = {
  id: number;
  name: string | null;
  description: string | null;
  icon: string | null;
  postCount: number;
  isFavourited: boolean;
};

export type CommunityPost = {
  id: number;
  authorName: string | null;
  isExpert: boolean;
  body: string | null;
  createdAt: string | null;
  replyCount: number;
  isMine: boolean;
};

export type CommunityReply = {
  id: number;
  authorName: string | null;
  isExpert: boolean;
  body: string | null;
  createdAt: string | null;
  isMine: boolean;
};

export function fetchCommunityGroups() {
  return api.get<{ ok: true; groups: CommunityGroup[] }>("/api/member/community/groups");
}

export function fetchCommunityPosts(groupId: number) {
  return api.get<{ ok: true; groupId: number; posts: CommunityPost[] }>(`/api/member/community/groups/${groupId}/posts`);
}

export function createCommunityPost(groupId: number, body: string) {
  return api.post<{ ok: true; id: number; post: CommunityPost }>(`/api/member/community/groups/${groupId}/posts`, { body });
}

export function fetchCommunityReplies(postId: number) {
  return api.get<{ ok: true; postId: number; replies: CommunityReply[] }>(`/api/member/community/posts/${postId}/replies`);
}

export function createCommunityReply(postId: number, body: string) {
  return api.post<{ ok: true; id: number; reply: CommunityReply }>(`/api/member/community/posts/${postId}/replies`, { body });
}

export function deleteCommunityPost(postId: number) {
  return api.delete<{ ok: true }>(`/api/member/community/posts/${postId}`);
}

export function deleteCommunityReply(replyId: number) {
  return api.delete<{ ok: true }>(`/api/member/community/replies/${replyId}`);
}
