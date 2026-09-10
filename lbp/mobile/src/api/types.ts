// Types below are transcribed directly from what lbp/backend/main.py actually
// returns (not guessed) for the endpoints this app currently calls - see the
// comment above each one pointing at the exact function. Anything marked
// "shape not fully verified" means I read enough of main.py to know the
// endpoint exists and roughly what it returns, but didn't trace every column
// alias - double check against the backend before depending on a new field.

// public_user() in main.py
export type PublicUser = {
  id: number;
  profileId: number | null;
  email: string;
  displayName: string | null;
  role: string | null;
  status: string | null;
  emailVerified: boolean;
  passwordLoginEnabled: boolean;
  createdAt: string | null;
};

// POST /api/auth/login, /api/auth/signup, /api/auth/firebase all return this
// shape (plus a couple of endpoint-specific extra fields) after the
// sessionToken field was added for native clients - see the comments in
// main.py's auth_login/auth_signup/auth_firebase.
export type AuthResponse = {
  expiresAt: string;
  user: PublicUser;
  sessionToken: string;
  emailVerificationRequired?: boolean;
  emailSent?: boolean;
  provider?: string;
  isNewUser?: boolean;
};

// GET /api/member/catalog - member_catalog() in main.py. Field names are
// exactly the SQL column aliases it selects, plus attach_profile_photos()
// which adds `photos` (an array of URLs, the profile's approved gallery
// photos, falling back to avatarUrl if none).
export type CatalogProfile = {
  id: number;
  displayName: string;
  role: string;
  status: string;
  sourceId: string | null;
  country: string | null;
  city: string | null;
  avatarUrl: string | null;
  photos?: string[];
  profileType: string | null;
  age: string | null;
  dateOfBirth: string | null;
  donorType: string[] | null;
  lookingFor: string[] | null;
  isVerified: boolean | null;
  isPremium: boolean | null;
  likedByViewer: boolean;
  createdAt: string;
};

export type CatalogResponse = {
  items: CatalogProfile[];
  total: number;
  limit: number;
  offset: number;
};

// public_profile_summary() in main.py - a narrower shape than CatalogProfile
// (no sourceId/photos/age/dateOfBirth/donorType/lookingFor/createdAt), used
// by /api/member/likes, /api/member/profile-views and /api/member/blocks.
export type ProfileSummary = {
  id: number;
  displayName: string | null;
  role: string | null;
  status: string | null;
  country: string | null;
  city: string | null;
  avatarUrl: string | null;
  profileType: string | null;
  isVerified: boolean | null;
  isPremium: boolean | null;
  likedByViewer?: boolean;
  likeReadOnly?: boolean;
  likedAt?: string | null;
  matchedAt?: string | null;
};

// GET /api/member/likes - member_likes() in main.py, exact response shape
// (previously this app incorrectly assumed a flat `{ items: [...] }` shape -
// the real endpoint returns these 4 named lists, not one array).
// `likesYou` is only populated (non-empty) server-side when the viewer is
// Premium; otherwise it's `[]` and `likesYouLocked` is true - same paywall
// shown on the website's Likes page.
export type LikesResponse = {
  likesYou: ProfileSummary[];
  likesYouCount: number;
  likesYouLocked: boolean;
  myLikes: ProfileSummary[];
  matches: ProfileSummary[];
  readThroughId: number;
};

// GET /api/member/profile-views - member_profile_views() in main.py. Also
// Premium-gated (`locked: true` + empty `items` otherwise), mirrors the
// website's "Visitors" tab on the Likes page.
export type ProfileVisitor = ProfileSummary & {
  viewId: number;
  viewCount: number;
  lastViewedAt: string | null;
};
export type ProfileVisitsResponse = {
  items: ProfileVisitor[];
  total: number;
  locked: boolean;
};

// GET /api/member/conversations - member_conversations() in main.py, via
// conversation_scope_sql(). These column aliases are exact, straight from
// the SELECT; there may be a couple more (unread count, etc.) further down
// that function this type doesn't list yet.
export type ConversationSummary = {
  id: number;
  match_id: number | null;
  profile_a_id: number;
  profile_b_id: number;
  status: string;
  created_at: string;
  updated_at: string;
  other_profile_id: number;
  otherDisplayName: string | null;
  otherRole: string | null;
  otherAvatarUrl: string | null;
  otherCity: string | null;
  otherCountry: string | null;
  otherLastSeenAt: string | null;
  lastMessage: string | null;
  lastMessageMediaUrl: string | null;
  // Real, already computed server-side (conversation_scope_sql() in
  // main.py counts messages from the other person with read_at IS NULL) -
  // just wasn't exposed on this type before.
  unreadCount: number;
  [key: string]: unknown;
};

// GET /api/member/conversations/{id}/messages -
// member_conversation_messages() in main.py - these column aliases are
// exact, straight from the SELECT.
export type ConversationMessage = {
  id: number;
  conversationId: number;
  senderProfileId: number;
  body: string | null;
  mediaUrl: string | null;
  created_at: string;
  deliveredAt: string | null;
  readAt: string | null;
  status: string;
};

// GET/PATCH /api/member/settings - member_settings()/member_update_settings()
// in main.py. NotificationSetting.type is one of the 5 keys in
// DEFAULT_NOTIFICATION_SETTINGS (NEW_MATCH, NEW_LIKE, NEW_MESSAGE,
// PROFILE_VIEW, MARKETING).
export type NotificationSetting = { type: string; emailEnabled: boolean };
export type MemberSettings = {
  interfaceLanguage: string;
  notificationSettings: NotificationSetting[];
  visibleInCatalog: boolean;
  betaFlags: Record<string, unknown>;
};

// GET /api/member/photos - member_photos() in main.py, exact column aliases.
export type ProfilePhoto = {
  id: number;
  publicUrl: string;
  avatarUrl: string | null;
  position: number;
  status: string;
  uploadStatus: string;
  moderationStatus: string;
  moderationReason: string | null;
  created_at: string;
  updated_at: string;
};

// GET /api/member/verification - member_verification_status() in main.py.
// `url` (the Didit-hosted verification page) is only present while status is
// PENDING/IN_REVIEW and a session was actually started.
export type VerificationStatus = {
  id?: number;
  status: "NOT_STARTED" | "PENDING" | "IN_REVIEW" | "APPROVED" | "DECLINED" | "EXPIRED" | "ABANDONED" | string;
  provider?: string;
  sessionId?: string | null;
  verifiedAt?: string | null;
  providerConfigured: boolean;
  photoModerationConfigured: boolean;
  primaryPhoto: boolean;
  primaryPhotoReady: boolean;
  primaryPhotoModerationStatus: string | null;
  url?: string;
};

// GET /api/member/subscription - member_subscription_status() in main.py.
// UPDATE (Sept 2026): real Family-Builder-vs-Pro tiers - `tier` is the
// profile's actual feature tier (EXPLORE/BUILDER/PRO, from profile_tier()),
// independent of `isPremium` (kept as-is: true for BUILDER or PRO).
export type SubscriptionTier = "EXPLORE" | "BUILDER" | "PRO";

export type SubscriptionStatus = {
  isVerified: boolean;
  isPremium: boolean;
  tier: SubscriptionTier;
  status: "VERIFICATION_REQUIRED" | "NOT_STARTED" | "PENDING" | "ACTIVE" | string;
  limits: { freeLikesPerDay: number; premiumLikesPerDay: number };
  request: { id: number; plan: string; tier: string | null; createdAt: string; updatedAt: string } | null;
};

// GET /api/member/blocks - member_blocks() in main.py, via
// public_profile_summary() plus blockId/reason/blockedAt.
export type BlockedProfile = {
  id: number;
  displayName: string | null;
  city: string | null;
  country: string | null;
  avatarUrl: string | null;
  blockId: number;
  reason: string | null;
  blockedAt: string;
  [key: string]: unknown;
};

// GET /api/public/clinics, /api/public/lawyers - directory_public_record() in
// main.py. Same shape for both ("kind" tells them apart); the site calls the
// same public endpoints (no auth needed to browse), only favouriting needs a
// session. `data` is whatever public_safe_data() left of the raw JSON blob -
// read defensively, same spirit as ProfileDetail.
export type DirectoryItem = {
  id: number;
  name: string;
  country: string | null;
  city: string | null;
  status: string;
  slug?: string | null;
  logoUrl?: string | null;
  photoUrl?: string | null;
  location?: string | null;
  languages?: unknown;
  services?: unknown;
  practiceAreas?: unknown;
  servicesCount?: number | null;
  practiceAreasCount?: number | null;
  kind: "clinics" | "lawyers";
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

// GET /api/public/clinics/{slug}, /api/public/lawyers/{slug} - same as
// DirectoryItem plus a `contact` object (only present with include_contact,
// which the detail endpoints always pass).
export type DirectoryDetail = DirectoryItem & {
  contact?: {
    website?: string;
    phone?: string;
    fax?: string;
    email?: string;
    location?: string;
    state?: string;
    zip?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
    hours?: unknown;
  };
};

export type DirectoryListResponse = {
  items: DirectoryItem[];
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

// GET /api/member/favourites (also aliased /api/member/favorites) -
// member_favourites() in main.py. Each entry is a clinic/lawyer row plus
// favouriteId/favouritedAt.
export type FavouriteItem = DirectoryItem & { favouriteId: number; favouritedAt: string };
export type FavouritesResponse = { clinics: FavouriteItem[]; lawyers: FavouriteItem[]; total: number };

// The real backend's Pydantic model only accepts "VOICE" | "VIDEO"
// (CallCreatePayload in main.py) - note the *web* frontend actually sends
// "AUDIO" for its audio-call button, which the backend's own pattern
// rejects (a real bug there, separate from anything in this app). The
// mobile app uses the value the backend actually accepts.
export type CallKind = "VOICE" | "VIDEO";

// member_call_response() in main.py - shape returned by every /api/member/calls*
// endpoint. serverUrl/token are only included when include_token=True
// (starting or accepting a call).
export type CallInfo = {
  id: number;
  conversationId: number;
  callType: CallKind;
  status: "RINGING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "ENDED" | "MISSED" | string;
  incoming: boolean;
  peerName: string;
  peerAvatarUrl: string | null;
  createdAt: string;
  acceptedAt: string | null;
  serverUrl?: string;
  token?: string;
};
