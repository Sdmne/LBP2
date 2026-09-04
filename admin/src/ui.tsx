import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { createApiClient } from "./api";
import { MarketingCampaignPage, MarketingFeature } from "./marketing";

const api = createApiClient("/admin/api");
type Session = { email: string; role?: string; permissions?: string[] };
type RecordValue = Record<string, unknown>;
type ListResponse = {
  items: RecordValue[];
  total: number;
  limit: number;
  offset: number;
};
type SettingField = {
  key: string;
  title: string;
  description?: string;
  type: "toggle" | "number" | "text" | "email" | "textarea";
  fallback: unknown;
};
type FilterOption = { value?: unknown; label?: unknown; count?: unknown };
type AdminIconName =
  | "dashboard"
  | "users"
  | "crown"
  | "shield"
  | "building"
  | "scale"
  | "file"
  | "headphones"
  | "image"
  | "flag"
  | "phone"
  | "activity"
  | "drive"
  | "code"
  | "megaphone"
  | "settings"
  | "logout"
  | "userCheck"
  | "userPlus"
  | "alert"
  | "creditCard"
  | "trendingUp"
  | "percent"
  | "eye"
  | "heart"
  | "clock"
  | "circleCheck"
  | "circleX"
  | "check"
  | "x"
  | "barChart"
  | "refresh"
  | "plus"
  | "sliders"
  | "messageSquare"
  | "pencil"
  | "trash"
  | "ellipsis"
  | "externalLink"
  | "gripVertical"
  | "arrowLeft"
  | "eyeOff"
  | "circleUser"
  | "monitor"
  | "messageCircle"
  | "thumbsUp"
  | "ban"
  | "mail"
  | "globe"
  | "server"
  | "cpu"
  | "memory"
  | "container"
  | "database"
  | "wifi"
  | "gauge";
type EditorIconName =
  | "bold"
  | "italic"
  | "underline"
  | "strike"
  | "heading2"
  | "heading3"
  | "heading4"
  | "list"
  | "listOrdered"
  | "quote"
  | "minus"
  | "alignLeft"
  | "alignCenter"
  | "alignRight"
  | "link"
  | "youtube"
  | "undo"
  | "redo"
  | "code2"
  | "table"
  | "arrowLeft"
  | "save";
const nav: ReadonlyArray<{
  path: string;
  title: string;
  view?: string;
  icon: AdminIconName;
  badge?: string;
}> = [
  { path: "/dashboard", title: "Dashboard", icon: "dashboard" },
  { path: "/users", title: "Users", view: "users", icon: "users" },
  {
    path: "/subscriptions",
    title: "Subscriptions",
    view: "subscriptions",
    icon: "crown",
  },
  {
    path: "/verifications",
    title: "Verifications",
    view: "verifications",
    icon: "shield",
    badge: "pending_verifications",
  },
  { path: "/clinics", title: "Clinics", view: "clinics", icon: "building" },
  { path: "/lawyers", title: "Lawyers", view: "lawyers", icon: "scale" },
  { path: "/articles", title: "Articles", view: "articles", icon: "file" },
  {
    path: "/support",
    title: "Support Chat",
    view: "support",
    icon: "headphones",
    badge: "unanswered_support",
  },
  {
    path: "/moderation/photos",
    title: "Photo Moderation",
    view: "moderation-photos",
    icon: "image",
  },
  {
    path: "/moderation/reports",
    title: "Reports",
    view: "moderation-reports",
    icon: "flag",
    badge: "pending_reports",
  },
  { path: "/livekit", title: "LiveKit Calls", view: "livekit", icon: "phone" },
  { path: "/monitoring", title: "Monitoring", icon: "activity" },
  { path: "/storage", title: "Storage", icon: "drive" },
  {
    path: "/static-pages",
    title: "Static Pages",
    view: "static-pages",
    icon: "code",
  },
  {
    path: "/marketing",
    title: "Marketing",
    view: "marketing",
    icon: "megaphone",
  },
  { path: "/settings", title: "Settings", view: "settings", icon: "settings" },
];
const columnsByView: Record<string, string[]> = {
  articles: ["title", "category", "status", "views", "updated_at"],
  users: [
    "displayName",
    "status",
    "profileType",
    "location",
    "createdAt",
    "source",
    "blocksCount",
    "reportsCount",
  ],
  subscriptions: ["profileName", "plan", "status", "source", "period"],
  verifications: [
    "profileName",
    "verificationStatus",
    "liveness",
    "faceMatch",
    "createdAt",
    "completed_at",
  ],
  clinics: ["name", "location", "partner", "services", "status"],
  lawyers: ["name", "location", "practiceAreas", "status"],
};
const detailTabs: Array<[string, string, string, AdminIconName, boolean]> = [
  ["profile", "Profile", "profile", "circleUser", false],
  ["devices", "Devices", "devices", "monitor", false],
  ["verification", "Verification", "verifications", "shield", false],
  ["support", "Support Chat", "supportMessages", "headphones", false],
  ["messages", "Messages", "messages", "messageCircle", false],
  ["photos", "Photos", "photos", "image", false],
  ["sent-likes", "He Liked", "sentLikes", "thumbsUp", true],
  ["received-likes", "Liked Him", "receivedLikes", "heart", true],
  ["matches", "Matches", "matches", "users", true],
  ["subscriptions", "Subscriptions", "subscriptions", "creditCard", false],
  ["clinics", "Liked Clinics", "likedClinics", "building", true],
  ["visitors", "Visitors", "visitors", "eye", true],
  ["blocked", "Blocked", "blocked", "ban", true],
  ["blocked-by", "Blocked By", "blockedBy", "ban", true],
];

function label(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
function settingBoolean(value: unknown) {
  if (typeof value === "string")
    return !["", "0", "false", "off", "no", "null"].includes(
      value.trim().toLowerCase(),
    );
  return Boolean(value);
}
function countryName(value: unknown) {
  const code = String(value ?? "").trim();
  if (!code) return "";
  if (code.length !== 2) return code;
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(
        code === "UK" ? "GB" : code.toUpperCase(),
      ) ?? code
    );
  } catch {
    return code;
  }
}
function userCountryName(value: unknown) {
  const country = countryName(value);
  const compactNames: Record<string, string> = {
    "United States": "USA",
    "United Kingdom": "UK",
    "United Arab Emirates": "UAE",
  };
  return compactNames[country] ?? country;
}
function columnLabel(view: string, column: string) {
  if (view === "users") {
    return (
      (
        {
          displayName: "User",
          profileType: "Type",
          createdAt: "Created",
          blocksCount: "Blocked",
          reportsCount: "Reports",
        } as Record<string, string>
      )[column] ?? label(column)
    );
  }
  if (view === "subscriptions" && column === "profileName") return "User";
  if (view === "verifications") {
    return (
      (
        {
          profileName: "User",
          verificationStatus: "Status",
          createdAt: "Created",
          completed_at: "Completed",
        } as Record<string, string>
      )[column] ?? label(column)
    );
  }
  if (view === "articles" && column === "updated_at") return "Updated";
  return label(column);
}
function valueOf(value: unknown) {
  return value === null || value === undefined || value === ""
    ? "—"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
function compactDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.valueOf())
    ? date.toLocaleDateString("en-GB")
    : valueOf(value);
}
function verificationDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.valueOf())
    ? date.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : valueOf(value);
}
function auditActionLabel(value: unknown, source: unknown) {
  const action = String(value ?? "Unknown");
  const referenceLabels: Record<string, string> = {
    "verification.approved": "Verification approved",
    "verification.declined": "Verification declined",
    VERIFICATION_MANUAL_APPROVED: "Manually approved verification",
    SEND_SUPPORT_MESSAGE: "Sent support message",
  };
  if (referenceLabels[action]) return referenceLabels[action];
  return source === "native" ? label(action) : action;
}
function rowName(row: RecordValue) {
  return valueOf(
    row.displayName ??
      row.profileName ??
      row.name ??
      row.title ??
      row.email ??
      row.id,
  );
}
function articleCategory(row: RecordValue) {
  const meta = (row.data ?? {}) as RecordValue;
  const category = meta.category;
  if (!category || typeof category !== "object")
    return valueOf(meta.categoryName ?? category);
  const value = category as RecordValue;
  const translations = Array.isArray(value.translations)
    ? (value.translations as RecordValue[])
    : [];
  const english =
    translations.find(
      (item) => String(item.locale ?? "").toLowerCase() === "en",
    ) ?? translations[0];
  return valueOf(english?.name ?? value.name ?? value.slug);
}
function articleDate(value: unknown) {
  return compactDate(value).replaceAll("/", ".");
}

function profileTypeLabel(value: unknown) {
  const key = String(value ?? "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();
  const labels: Record<string, string> = {
    GAY_COUPLE: "Gay Couple",
    HETERO_COUPLE: "Hetero Couple",
    HETERO_COUPLE_DONOR: "Hetero Couple (Donor)",
    LESBIAN_COUPLE: "Lesbian Couple",
    CO_PARENT: "Co-Parent",
    CO_PARENTING_PARTNER: "Co-Parenting Partner",
    SINGLE_MAN: "Single Man",
    SINGLE_MAN_D: "Single Man (Donor)",
    SINGLE_MAN_DONOR: "Single Man (Donor)",
    SINGLE_WOMAN: "Single Woman",
    SINGLE_WOMAN_D: "Single Woman (Donor)",
    SINGLE_WOMAN_DONOR: "Single Woman (Donor)",
    USER: "User",
  };
  return labels[key] ?? (key ? label(key) : "—");
}

function registrationSourceLabel(value: unknown) {
  const source = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    !source ||
    source === "local_signup" ||
    source === "firebase_auth" ||
    source === "web"
  )
    return "Web App";
  if (source.includes("android") || source === "play_store")
    return "Mobile App (Android)";
  if (
    source.includes("ios") ||
    source.includes("apple") ||
    source === "app_store"
  )
    return "Mobile App (iOS)";
  if (source.startsWith("handover_")) return "Web App";
  return valueOf(value);
}

function registrationSourceClass(value: unknown) {
  const source = registrationSourceLabel(value);
  if (source.includes("iOS")) return "source-ios";
  if (source.includes("Android")) return "source-android";
  return "source-web";
}

function isDonorProfile(row: RecordValue) {
  const data = (
    row.data && typeof row.data === "object" ? row.data : {}
  ) as RecordValue;
  const donorType = data.donorType;
  return (
    (Array.isArray(donorType) && donorType.length > 0) ||
    (typeof donorType === "string" && donorType.trim().length > 0) ||
    String(row.profileType ?? "")
      .toUpperCase()
      .includes("DONOR")
  );
}

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const command = (name: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };
  const insertHtml = (html: string) => command("insertHTML", html);
  const insertImage = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      insertHtml(`<img src="${String(reader.result ?? "")}" alt="" />`);
    reader.readAsDataURL(file);
  };
  return (
    <div className="rich-editor">
      <div className="editor-toolbar">
        <button
          type="button"
          title="Bold"
          aria-label="Bold"
          onClick={() => command("bold")}
        >
          <EditorIcon name="bold" />
        </button>
        <button
          type="button"
          title="Italic"
          aria-label="Italic"
          onClick={() => command("italic")}
        >
          <EditorIcon name="italic" />
        </button>
        <button
          type="button"
          title="Underline"
          aria-label="Underline"
          onClick={() => command("underline")}
        >
          <EditorIcon name="underline" />
        </button>
        <button
          type="button"
          title="Strikethrough"
          aria-label="Strikethrough"
          onClick={() => command("strikeThrough")}
        >
          <EditorIcon name="strike" />
        </button>
        {[2, 3, 4].map((level) => (
          <button
            type="button"
            key={level}
            title={`Heading ${level}`}
            aria-label={`Heading ${level}`}
            onClick={() => command("formatBlock", `h${level}`)}
          >
            <EditorIcon name={`heading${level}` as EditorIconName} />
          </button>
        ))}
        <button
          type="button"
          title="Bullet list"
          aria-label="Bullet list"
          onClick={() => command("insertUnorderedList")}
        >
          <EditorIcon name="list" />
        </button>
        <button
          type="button"
          title="Ordered list"
          aria-label="Ordered list"
          onClick={() => command("insertOrderedList")}
        >
          <EditorIcon name="listOrdered" />
        </button>
        <button
          type="button"
          title="Blockquote"
          aria-label="Blockquote"
          onClick={() => command("formatBlock", "blockquote")}
        >
          <EditorIcon name="quote" />
        </button>
        <button
          type="button"
          title="Horizontal rule"
          aria-label="Horizontal rule"
          onClick={() => command("insertHorizontalRule")}
        >
          <EditorIcon name="minus" />
        </button>
        <button
          type="button"
          title="Align left"
          aria-label="Align left"
          onClick={() => command("justifyLeft")}
        >
          <EditorIcon name="alignLeft" />
        </button>
        <button
          type="button"
          title="Align center"
          aria-label="Align center"
          onClick={() => command("justifyCenter")}
        >
          <EditorIcon name="alignCenter" />
        </button>
        <button
          type="button"
          title="Align right"
          aria-label="Align right"
          onClick={() => command("justifyRight")}
        >
          <EditorIcon name="alignRight" />
        </button>
        <button
          type="button"
          title="Add link"
          aria-label="Add link"
          onClick={() => {
            const url = window.prompt("URL");
            if (url) command("createLink", url);
          }}
        >
          <EditorIcon name="link" />
        </button>
        <button
          type="button"
          title="Upload image"
          aria-label="Upload image"
          onClick={() => fileRef.current?.click()}
        >
          <AdminIcon name="image" />
        </button>
        <button
          type="button"
          title="YouTube video"
          aria-label="YouTube video"
          onClick={() => {
            const url = window.prompt("YouTube URL");
            if (url)
              insertHtml(
                `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></p>`,
              );
          }}
        >
          <EditorIcon name="youtube" />
        </button>
        <button
          type="button"
          title="Undo"
          aria-label="Undo"
          onClick={() => command("undo")}
        >
          <EditorIcon name="undo" />
        </button>
        <button
          type="button"
          title="Redo"
          aria-label="Redo"
          onClick={() => command("redo")}
        >
          <EditorIcon name="redo" />
        </button>
        <button
          type="button"
          title="HTML source"
          aria-label="HTML source"
          className={sourceMode ? "active" : ""}
          onClick={() => setSourceMode((current) => !current)}
        >
          <EditorIcon name="code2" />
        </button>
        <button
          type="button"
          title="Insert table"
          aria-label="Insert table"
          onClick={() =>
            insertHtml(
              "<table><tbody><tr><td>Cell</td><td>Cell</td></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table>",
            )
          }
        >
          <EditorIcon name="table" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            insertImage(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {sourceMode ? (
        <textarea
          className="article-source-editor"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="HTML source editor"
        />
      ) : (
        <div
          ref={editorRef}
          className="article-content-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          dangerouslySetInnerHTML={{ __html: value }}
          data-placeholder={placeholder}
        />
      )}
    </div>
  );
}

function EditorIcon({ name }: { name: EditorIconName }) {
  const paths: Record<EditorIconName, JSX.Element> = {
    bold: (
      <path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" />
    ),
    italic: (
      <>
        <line x1="19" x2="10" y1="4" y2="4" />
        <line x1="14" x2="5" y1="20" y2="20" />
        <line x1="15" x2="9" y1="4" y2="20" />
      </>
    ),
    underline: (
      <>
        <path d="M6 4v6a6 6 0 0 0 12 0V4" />
        <line x1="4" x2="20" y1="20" y2="20" />
      </>
    ),
    strike: (
      <>
        <path d="M16 4H9a3 3 0 0 0-2.83 4" />
        <path d="M14 12a4 4 0 0 1 0 8H6" />
        <line x1="4" x2="20" y1="12" y2="12" />
      </>
    ),
    heading2: (
      <>
        <path d="M4 12h8" />
        <path d="M4 18V6" />
        <path d="M12 18V6" />
        <path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
      </>
    ),
    heading3: (
      <>
        <path d="M4 12h8" />
        <path d="M4 18V6" />
        <path d="M12 18V6" />
        <path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2" />
        <path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" />
      </>
    ),
    heading4: (
      <>
        <path d="M12 18V6" />
        <path d="M17 10v3a1 1 0 0 0 1 1h3" />
        <path d="M21 10v8" />
        <path d="M4 12h8" />
        <path d="M4 18V6" />
      </>
    ),
    list: (
      <>
        <path d="M3 5h.01" />
        <path d="M3 12h.01" />
        <path d="M3 19h.01" />
        <path d="M8 5h13" />
        <path d="M8 12h13" />
        <path d="M8 19h13" />
      </>
    ),
    listOrdered: (
      <>
        <path d="M11 5h10" />
        <path d="M11 12h10" />
        <path d="M11 19h10" />
        <path d="M4 4h1v5" />
        <path d="M4 9h2" />
        <path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" />
      </>
    ),
    quote: (
      <>
        <path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
        <path d="M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z" />
      </>
    ),
    minus: <path d="M5 12h14" />,
    alignLeft: (
      <>
        <path d="M21 5H3" />
        <path d="M15 12H3" />
        <path d="M17 19H3" />
      </>
    ),
    alignCenter: (
      <>
        <path d="M21 5H3" />
        <path d="M17 12H7" />
        <path d="M19 19H5" />
      </>
    ),
    alignRight: (
      <>
        <path d="M21 5H3" />
        <path d="M21 12H9" />
        <path d="M21 19H7" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </>
    ),
    youtube: (
      <>
        <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
        <path d="m10 15 5-3-5-3z" />
      </>
    ),
    undo: (
      <>
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
      </>
    ),
    redo: (
      <>
        <path d="M21 7v6h-6" />
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
      </>
    ),
    code2: (
      <>
        <path d="m16 18 6-6-6-6" />
        <path d="m8 6-6 6 6 6" />
      </>
    ),
    table: (
      <>
        <path d="M12 3v18" />
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M3 15h18" />
      </>
    ),
    arrowLeft: (
      <>
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </>
    ),
    save: (
      <>
        <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
        <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
        <path d="M7 3v4a1 1 0 0 0 1 1h7" />
      </>
    ),
  };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function AdminIcon({ name }: { name: AdminIconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<AdminIconName, JSX.Element> = {
    dashboard: (
      <>
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <path d="M16 3.128a4 4 0 0 1 0 7.744" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <circle cx="9" cy="7" r="4" />
      </>
    ),
    crown: (
      <>
        <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
        <path d="M5 21h14" />
      </>
    ),
    shield: (
      <>
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    building: (
      <>
        <path d="M10 12h4" />
        <path d="M10 8h4" />
        <path d="M14 21v-3a2 2 0 0 0-4 0v3" />
        <path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" />
        <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
      </>
    ),
    scale: (
      <>
        <path d="M12 3v18" />
        <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" />
        <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" />
        <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" />
        <path d="M7 21h10" />
      </>
    ),
    file: (
      <>
        <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
        <path d="M14 2v5a1 1 0 0 0 1 1h5" />
        <path d="M10 9H8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
      </>
    ),
    headphones: (
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    ),
    image: (
      <>
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      </>
    ),
    flag: (
      <path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" />
    ),
    phone: (
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
    ),
    activity: (
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    ),
    drive: (
      <>
        <path d="M10 16h.01" />
        <path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        <path d="M21.946 12.013H2.054" />
        <path d="M6 16h.01" />
      </>
    ),
    code: (
      <>
        <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
        <path d="M14 2v5a1 1 0 0 0 1 1h5" />
        <path d="M10 12.5 8 15l2 2.5" />
        <path d="m14 12.5 2 2.5-2 2.5" />
      </>
    ),
    megaphone: (
      <>
        <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" />
        <path d="M8 6v8" />
      </>
    ),
    settings: (
      <>
        <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    logout: (
      <>
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      </>
    ),
    userCheck: (
      <>
        <path d="m16 11 2 2 4-4" />
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
      </>
    ),
    userPlus: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" x2="19" y1="8" y2="14" />
        <line x1="22" x2="16" y1="11" y2="11" />
      </>
    ),
    alert: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    creditCard: (
      <>
        <rect width="20" height="14" x="2" y="5" rx="2" />
        <line x1="2" x2="22" y1="10" y2="10" />
      </>
    ),
    trendingUp: (
      <>
        <path d="M16 7h6v6" />
        <path d="m22 7-8.5 8.5-5-5L2 17" />
      </>
    ),
    percent: (
      <>
        <line x1="19" x2="5" y1="5" y2="19" />
        <circle cx="6.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </>
    ),
    eye: (
      <>
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    heart: (
      <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    circleCheck: (
      <>
        <path d="M21.801 10A10 10 0 1 1 17 3.335" />
        <path d="m9 11 3 3L22 4" />
      </>
    ),
    circleX: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6" />
        <path d="m9 9 6 6" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    x: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    barChart: (
      <>
        <path d="M3 3v16a2 2 0 0 0 2 2h16" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
      </>
    ),
    refresh: (
      <>
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M8 16H3v5" />
      </>
    ),
    plus: (
      <>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </>
    ),
    sliders: (
      <>
        <path d="M14 17H5" />
        <path d="M19 7h-9" />
        <circle cx="17" cy="17" r="3" />
        <circle cx="7" cy="7" r="3" />
      </>
    ),
    messageSquare: (
      <>
        <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
        <path d="M7 11h10" />
        <path d="M7 15h6" />
        <path d="M7 7h8" />
      </>
    ),
    pencil: (
      <>
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
        <path d="m15 5 4 4" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" x2="10" y1="11" y2="17" />
        <line x1="14" x2="14" y1="11" y2="17" />
      </>
    ),
    ellipsis: (
      <>
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </>
    ),
    externalLink: (
      <>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    gripVertical: (
      <>
        <circle cx="9" cy="12" r="1" />
        <circle cx="9" cy="5" r="1" />
        <circle cx="9" cy="19" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="15" cy="5" r="1" />
        <circle cx="15" cy="19" r="1" />
      </>
    ),
    arrowLeft: (
      <>
        <path d="m12 19-7-7 7-7" />
        <path d="M19 12H5" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
        <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
        <path d="m2 2 20 20" />
      </>
    ),
    circleUser: (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="10" r="3" />
        <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
      </>
    ),
    monitor: (
      <>
        <rect width="20" height="14" x="2" y="3" rx="2" />
        <line x1="8" x2="16" y1="21" y2="21" />
        <line x1="12" x2="12" y1="17" y2="21" />
      </>
    ),
    messageCircle: (
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
    ),
    thumbsUp: (
      <>
        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        <path d="M7 10v12" />
      </>
    ),
    ban: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M4.929 4.929 19.07 19.071" />
      </>
    ),
    mail: (
      <>
        <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
        <rect x="2" y="4" width="20" height="16" rx="2" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </>
    ),
    server: (
      <>
        <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
        <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
        <line x1="6" x2="6.01" y1="6" y2="6" />
        <line x1="6" x2="6.01" y1="18" y2="18" />
      </>
    ),
    cpu: (
      <>
        <path d="M12 20v2" />
        <path d="M12 2v2" />
        <path d="M17 20v2" />
        <path d="M17 2v2" />
        <path d="M2 12h2" />
        <path d="M2 17h2" />
        <path d="M2 7h2" />
        <path d="M20 12h2" />
        <path d="M20 17h2" />
        <path d="M20 7h2" />
        <path d="M7 20v2" />
        <path d="M7 2v2" />
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="8" y="8" width="8" height="8" rx="1" />
      </>
    ),
    memory: (
      <>
        <path d="M12 12v-2" />
        <path d="M12 18v-2" />
        <path d="M16 12v-2" />
        <path d="M16 18v-2" />
        <path d="M2 11h1.5" />
        <path d="M20 18v-2" />
        <path d="M20.5 11H22" />
        <path d="M4 18v-2" />
        <path d="M8 12v-2" />
        <path d="M8 18v-2" />
        <rect x="2" y="6" width="20" height="10" rx="2" />
      </>
    ),
    container: (
      <>
        <path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z" />
        <path d="M10 21.9V14L2.1 9.1" />
        <path d="m10 14 11.9-6.9" />
        <path d="M14 19.8v-8.1" />
        <path d="M18 17.5V9.4" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5V19A9 3 0 0 0 21 19V5" />
        <path d="M3 12A9 3 0 0 0 21 12" />
      </>
    ),
    wifi: (
      <>
        <path d="M12 20h.01" />
        <path d="M2 8.82a15 15 0 0 1 20 0" />
        <path d="M5 12.859a10 10 0 0 1 14 0" />
        <path d="M8.5 16.429a5 5 0 0 1 7 0" />
      </>
    ),
    gauge: (
      <>
        <path d="m12 14 4-4" />
        <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      </>
    ),
  };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      aria-hidden="true"
      viewBox="0 0 24 24"
      {...common}
    >
      {paths[name]}
    </svg>
  );
}

function Login({
  onAuthenticated,
}: {
  onAuthenticated: (session: Session) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onAuthenticated(
        await api.post<Session>("/admin/login", { email, password }),
      );
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="login">
      <section className="login-card">
        <header className="login-card-header">
          <h3>LetsBeParents Admin</h3>
          <p>Sign in to access the admin panel</p>
        </header>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              type="email"
              required
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              type="password"
              required
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button disabled={loading}>
            {loading ? "Signing In…" : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: unknown;
  hint?: string;
  icon?: AdminIconName;
}) {
  return (
    <article
      className={`metric-card${title === "Banned" ? " metric-card-danger" : title === "Pending Photos" || title === "Pending Reports" ? " metric-card-warning" : ""}`}
    >
      <div className="metric-title">
        <h3>{title}</h3>
        {icon && (
          <i aria-hidden="true">
            <AdminIcon name={icon} />
          </i>
        )}
      </div>
      <strong>{valueOf(value)}</strong>
      {hint && <p>{hint}</p>}
    </article>
  );
}
function BarGroup({
  title,
  rows,
  emptyLabel = "No data available",
}: {
  title: string;
  rows: RecordValue[];
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((row) => Number(row.count ?? 0)));
  return (
    <article className="dashboard-panel">
      <h2>{title}</h2>
      <div className="bar-list">
        {rows.map((row, index) => (
          <div key={`${valueOf(row.label)}-${index}`}>
            <p>
              <span>{valueOf(row.label)}</span>
              <b>{valueOf(row.count)}</b>
            </p>
            <i>
              <em
                style={{
                  width: `${Math.max(1, (Number(row.count ?? 0) / max) * 100)}%`,
                }}
              />
            </i>
          </div>
        ))}
        {!rows.length && <p className="bar-empty">{emptyLabel}</p>}
      </div>
    </article>
  );
}

const profileChartColors = [
  "#f31260",
  "#21c45d",
  "#ffc800",
  "#af57db",
  "#1fb1f9",
];
const lookingForChartColors = ["#af57db", "#1fb1f9", "#21c45d"];

function dashboardCount(value: unknown) {
  const count = Number(value ?? 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

function dashboardNumber(value: unknown) {
  return dashboardCount(value).toLocaleString("ru-RU");
}

function dashboardPercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}

function donutPoint(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: 125 + radius * Math.cos(radians),
    y: 125 - radius * Math.sin(radians),
  };
}

function donutSector(startAngle: number, endAngle: number) {
  const startOuter = donutPoint(100, startAngle);
  const endOuter = donutPoint(100, endAngle);
  const startInner = donutPoint(50, startAngle);
  const endInner = donutPoint(50, endAngle);
  if (endAngle - startAngle >= 359.999) {
    const outerMid = donutPoint(100, startAngle + 180);
    const innerMid = donutPoint(50, startAngle + 180);
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A 100 100 0 1 0 ${outerMid.x} ${outerMid.y}`,
      `A 100 100 0 1 0 ${startOuter.x} ${startOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A 50 50 0 1 1 ${innerMid.x} ${innerMid.y}`,
      `A 50 50 0 1 1 ${startInner.x} ${startInner.y}`,
      "Z",
    ].join(" ");
  }
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A 100 100 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A 50 50 0 ${largeArc} 1 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
}

function ProfileDonutPanel({
  title,
  rows,
  colors,
  percentTotal,
  footer,
}: {
  title: string;
  rows: RecordValue[];
  colors: string[];
  percentTotal?: number;
  footer?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const items = rows.map((row, index) => ({
    label: valueOf(row.label),
    count: dashboardCount(row.count),
    color: colors[index % colors.length],
    suppliedPercent: Number(row.percent),
  }));
  const chartTotal = items.reduce((sum, item) => sum + item.count, 0);
  const legendTotal =
    percentTotal && percentTotal > 0 ? percentTotal : chartTotal;
  let angle = 0;
  const sectors = items.map((item) => {
    const start = angle;
    angle += chartTotal ? (item.count / chartTotal) * 360 : 0;
    return { ...item, start, end: angle };
  });
  return (
    <article className="dashboard-panel profile-donut-panel">
      <h2>{title}</h2>
      <div className="profile-donut-body">
        <div className="profile-donut-main">
          <div className="profile-donut-chart">
            <svg viewBox="0 0 250 250" role="img" aria-label={title}>
              <title>{title}</title>
              {chartTotal ? (
                <g className="profile-donut-sectors">
                  {sectors.map(
                    (item, index) =>
                      item.count > 0 && (
                        <path
                          className="profile-donut-sector"
                          d={donutSector(item.start, item.end)}
                          fill={item.color}
                          stroke="#fff"
                          key={`${item.label}-${index}`}
                          onPointerEnter={(event) => {
                            const bounds =
                              event.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
                            setHovered({
                              index,
                              x: event.clientX - (bounds?.left ?? 0) + 12,
                              y: event.clientY - (bounds?.top ?? 0) + 12,
                            });
                          }}
                          onPointerMove={(event) => {
                            const bounds =
                              event.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
                            setHovered({
                              index,
                              x: event.clientX - (bounds?.left ?? 0) + 12,
                              y: event.clientY - (bounds?.top ?? 0) + 12,
                            });
                          }}
                          onPointerLeave={() => setHovered(null)}
                        />
                      ),
                  )}
                </g>
              ) : (
                <circle
                  className="profile-donut-empty"
                  cx="125"
                  cy="125"
                  r="75"
                />
              )}
            </svg>
            {hovered && sectors[hovered.index] && (
              <div
                className="profile-donut-tooltip"
                role="status"
                style={{ left: hovered.x, top: hovered.y }}
              >
                <span style={{ color: sectors[hovered.index].color }}>
                  {sectors[hovered.index].label} :{" "}
                  {sectors[hovered.index].count}
                </span>
              </div>
            )}
          </div>
          <div className="profile-donut-legend">
            {items.map((item, index) => {
              const percent = Number.isFinite(item.suppliedPercent)
                ? item.suppliedPercent
                : legendTotal
                  ? (item.count / legendTotal) * 100
                  : 0;
              return (
                <div
                  className="profile-donut-legend-row"
                  key={`${item.label}-${index}`}
                >
                  <i style={{ backgroundColor: item.color }} />
                  <span>{item.label}:</span>
                  <b>{dashboardPercent(percent)}</b>
                  <em>({dashboardNumber(item.count)})</em>
                </div>
              );
            })}
          </div>
        </div>
        {footer}
      </div>
    </article>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<RecordValue | null>(null);
  const [tab, setTab] = useState("users");
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get<RecordValue>("/admin/stats")
      .then(setStats)
      .catch(() => setError("Could not load dashboard metrics."));
  }, []);
  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="loading-inline">Loading dashboard…</p>;
  const counts = (stats.counts ?? {}) as RecordValue;
  const dashboard = (stats.dashboard ?? {}) as RecordValue;
  const profiles = (dashboard.profiles ?? {}) as RecordValue;
  const engagement = (dashboard.engagement ?? {}) as RecordValue;
  const subscriptions = (dashboard.subscriptions ?? {}) as RecordValue;
  const subscriptionPlans = Array.isArray(subscriptions.plans)
    ? (subscriptions.plans as RecordValue[])
    : [];
  const partners = (dashboard.partners ?? {}) as RecordValue;
  const devices = (dashboard.devices ?? {}) as RecordValue;
  const funnel = (dashboard.funnel ?? {}) as RecordValue;
  const quickQuit = (dashboard.quickQuit ?? {}) as RecordValue;
  const deletionReasons = Array.isArray(dashboard.deletionReasons)
    ? (dashboard.deletionReasons as RecordValue[])
    : [];
  const tabs = [
    ["users", "Users & Growth"],
    ["profiles", "Profiles"],
    ["engagement", "Engagement & Matching"],
    ["subscriptions", "Subscriptions"],
    ["partners", "Partners"],
    ["devices", "Devices & Tech"],
    ["funnel", "Funnel"],
  ] as const;
  const profileTypes = Array.isArray(profiles.profileTypes)
    ? (profiles.profileTypes as RecordValue[])
    : [];
  const lookingFor = Array.isArray(profiles.lookingFor)
    ? (profiles.lookingFor as RecordValue[])
    : [];
  const totalDonors = dashboardCount(profiles.totalDonors);
  const spermDonors = dashboardCount(profiles.spermDonors);
  const eggDonors = dashboardCount(profiles.eggDonors);
  const spermDonorPercent = Number.isFinite(Number(profiles.spermDonorPercent))
    ? Number(profiles.spermDonorPercent)
    : totalDonors
      ? (spermDonors / totalDonors) * 100
      : 0;
  const eggDonorPercent = Number.isFinite(Number(profiles.eggDonorPercent))
    ? Number(profiles.eggDonorPercent)
    : totalDonors
      ? (eggDonors / totalDonors) * 100
      : 0;
  const lookingForTotal = dashboardCount(profiles.lookingForTotal);
  const deviceCountries = Array.isArray(devices.countries)
    ? (devices.countries as RecordValue[]).map((row) => ({
        ...row,
        label: countryName(row.label),
      }))
    : [];
  const deviceTypes = Array.isArray(devices.devices)
    ? (devices.devices as RecordValue[]).filter(
        (row) =>
          String(row.label ?? "")
            .trim()
            .toLowerCase() !== "unknown",
      )
    : [];
  const deviceBrowsers = Array.isArray(devices.browsers)
    ? (devices.browsers as RecordValue[]).filter(
        (row) =>
          String(row.label ?? "")
            .trim()
            .toLowerCase() !== "unknown",
      )
    : [];
  const devicePlatforms = (devices.platforms ?? {}) as RecordValue;
  const deviceComparison = Array.isArray(devices.comparison)
    ? (devices.comparison as RecordValue[])
    : [];
  return (
    <>
      <header className="page-heading">
        <h1>Dashboard</h1>
      </header>
      <div className="dashboard-tabs-rule">
        <nav className="dashboard-tabs">
          {tabs.map(([key, title]) => (
            <button
              className={tab === key ? "active" : ""}
              key={key}
              onClick={() => setTab(key)}
            >
              {title}
            </button>
          ))}
        </nav>
      </div>
      {tab === "users" && (
        <>
          <section className="metric-grid">
            <MetricCard
              title="Total Users"
              value={counts.profiles}
              icon="users"
            />
            <MetricCard
              title="Active"
              value={counts.active_users}
              hint="status active"
              icon="userCheck"
            />
            <MetricCard
              title="Banned"
              value={counts.banned_users}
              icon="alert"
            />
            <MetricCard
              title="DAU"
              value={counts.dau}
              hint="active today (rolling)"
              icon="userCheck"
            />
            <MetricCard
              title="WAU"
              value={counts.wau}
              hint="active last 7 days"
              icon="userCheck"
            />
            <MetricCard
              title="MAU"
              value={counts.mau}
              hint="active last 30 days"
              icon="userCheck"
            />
          </section>
          <DashboardSeries
            series={stats.series as RecordValue | undefined}
            counts={counts}
          />
          <section className="dashboard-deletion-grid">
            <article className="dashboard-panel dashboard-quick-quit">
              <h3>Quick-quit (30d)</h3>
              <strong>{valueOf(quickQuit.pct)}%</strong>
              <p>
                {valueOf(quickQuit.quick)} of {valueOf(quickQuit.total)}{" "}
                deleters lasted &lt; 24h
              </p>
            </article>
            <article className="dashboard-panel dashboard-deletion-reasons">
              <h3>Top deletion reasons (30d)</h3>
              <div>
                {deletionReasons.map((row) => (
                  <p key={String(row.reason)}>
                    <span>
                      {label(String(row.reason ?? "other").toLowerCase())}
                    </span>
                    <b>{valueOf(row.count)}</b>
                  </p>
                ))}
              </div>
              <Link to="/users/deletion-feedback">
                View full deletion feedback →
              </Link>
            </article>
          </section>
        </>
      )}
      {tab === "profiles" && (
        <>
          <section className="metric-grid metric-grid-four">
            <MetricCard
              title="Total Profiles"
              value={profiles.totalProfiles}
              hint={`${valueOf(profiles.withoutProfile)} without profile`}
              icon="users"
            />
            <MetricCard
              title="Avg Completeness"
              value={
                profiles.avgCompleteness ? `${profiles.avgCompleteness}%` : "—"
              }
              hint="profile score"
              icon="percent"
            />
            <MetricCard
              title="Verified"
              value={profiles.verified}
              hint={`${valueOf(profiles.unverified)} unverified`}
              icon="userCheck"
            />
            <MetricCard
              title="Visible"
              value={profiles.visible}
              hint={`${valueOf(profiles.hidden)} hidden`}
              icon="eye"
            />
          </section>
          <h2 className="dashboard-section-title">Identity Verifications</h2>
          <section className="verification-grid">
            {(
              [
                "approved",
                "pending",
                "declined",
                "abandoned",
                "expired",
              ] as const
            ).map((status) => {
              const values = (profiles.verifications ?? {}) as RecordValue;
              return (
                <article
                  className={`verification-card verification-${status}`}
                  key={status}
                >
                  <div>
                    <span>{label(status)}</span>
                    <AdminIcon name="shield" />
                  </div>
                  <strong>{valueOf(values[status])}</strong>
                </article>
              );
            })}
          </section>
          <h2 className="dashboard-section-title comparison-title">
            Предложение (профили по типу) vs Спрос (кого ищут)
          </h2>
          <section className="dashboard-split profile-comparison-grid">
            <ProfileDonutPanel
              title="Profile Types"
              rows={profileTypes}
              colors={profileChartColors}
              footer={
                <div className="profile-donor-footer">
                  <p>Donors ({dashboardNumber(totalDonors)} of profiles)</p>
                  <div>
                    <span>
                      Sperm: <b>{dashboardNumber(spermDonors)}</b>{" "}
                      <em>({dashboardPercent(spermDonorPercent)})</em>
                    </span>
                    <span>
                      Egg: <b>{dashboardNumber(eggDonors)}</b>{" "}
                      <em>({dashboardPercent(eggDonorPercent)})</em>
                    </span>
                  </div>
                </div>
              }
            />
            <ProfileDonutPanel
              title="Looking For"
              rows={lookingFor}
              colors={lookingForChartColors}
              percentTotal={lookingForTotal}
              footer={
                <p className="profile-looking-note">
                  Users can select multiple preferences.
                </p>
              }
            />
          </section>
        </>
      )}
      {tab === "engagement" && (
        <>
          <section className="metric-grid metric-grid-four">
            <MetricCard
              title="Total Likes"
              value={engagement.totalLikes}
              hint={`${valueOf(engagement.likesToday)} today`}
              icon="heart"
            />
            <MetricCard
              title="Total Matches"
              value={engagement.totalMatches}
              hint={`${valueOf(engagement.matchesToday)} today`}
              icon="heart"
            />
            <MetricCard
              title="Active Matches"
              value={engagement.activeMatches}
              hint="currently active"
              icon="users"
            />
            <MetricCard
              title="Match Rate"
              value={engagement.matchRate ? `${engagement.matchRate}%` : "0%"}
              hint="users with matches"
              icon="trendingUp"
            />
          </section>
          <DashboardSeries
            series={{ engagement: engagement.daily }}
            mode="engagement"
          />
          <LikeFlow
            ranges={engagement.likeFlowByRange as RecordValue | undefined}
          />
          <h2 className="dashboard-section-title">Moderation Queue</h2>
          <section className="metric-grid metric-grid-two">
            <MetricCard
              title="Pending Photos"
              value={engagement.pendingPhotos}
              hint="awaiting review"
              icon="image"
            />
            <MetricCard
              title="Pending Reports"
              value={engagement.pendingReports}
              hint="awaiting review"
              icon="flag"
            />
          </section>
        </>
      )}
      {tab === "subscriptions" && (
        <>
          <section className="metric-grid metric-grid-four">
            <MetricCard
              title="Active Subscriptions"
              value={subscriptions.active}
              hint="total active"
              icon="creditCard"
            />
            <MetricCard
              title="Premium Users"
              value={subscriptions.premiumUsers}
              hint="isPremium = true"
              icon="creditCard"
            />
            <MetricCard
              title="Conversion Rate"
              value={`${valueOf(subscriptions.conversionRate)}%`}
              hint="paid / total users"
              icon="trendingUp"
            />
            <article className="metric-card plan-card">
              <div className="metric-title">
                <h3>By Plan</h3>
                <i>
                  <AdminIcon name="creditCard" />
                </i>
              </div>
              <div className="plan-list">
                {subscriptionPlans.map((row, index) => (
                  <p key={`${valueOf(row.label)}-${index}`}>
                    <span>{valueOf(row.label)}</span>
                    <b>{valueOf(row.count)}</b>
                  </p>
                ))}
                {!subscriptionPlans.length && (
                  <p className="plan-empty">No subscriptions</p>
                )}
              </div>
            </article>
          </section>
        </>
      )}
      {tab === "partners" && (
        <section className="metric-grid partners-grid">
          <MetricCard
            title="Total Partners"
            value={partners.totalPartners}
            hint={`${valueOf(partners.verifiedPartners)} verified`}
            icon="users"
          />
          <MetricCard
            title="Total Clinics"
            value={partners.clinics}
            hint={`${valueOf(partners.activeClinics)} active`}
            icon="building"
          />
          <MetricCard
            title="Total Lawyers"
            value={partners.lawyers}
            hint={`${valueOf(partners.activeLawyers)} active`}
            icon="scale"
          />
          <MetricCard
            title="New Partners (7d)"
            value={partners.newPartners7d}
            hint="signups this week"
            icon="trendingUp"
          />
          <MetricCard
            title="New Partners (30d)"
            value={partners.newPartners30d}
            hint="signups this month"
            icon="trendingUp"
          />
        </section>
      )}
      {tab === "devices" && (
        <>
          <section className="dashboard-split device-overview-grid">
            <BarGroup title="Top Countries" rows={deviceCountries} />
            <BarGroup title="Device Types" rows={deviceTypes} />
            <BarGroup title="Top Browsers" rows={deviceBrowsers} />
          </section>
          <section className="metric-grid metric-grid-four device-platform-grid">
            <MetricCard
              title="iOS"
              value={devicePlatforms.iOS}
              hint="registered on iOS"
              icon="users"
            />
            <MetricCard
              title="Android"
              value={devicePlatforms.Android}
              hint="registered on Android"
              icon="users"
            />
            <MetricCard
              title="Web"
              value={devicePlatforms.Web}
              hint="registered on web"
              icon="users"
            />
            <MetricCard
              title="Unknown"
              value={devicePlatforms.Unknown}
              hint="до начала фиксации / устаревшие"
              icon="users"
            />
          </section>
          <Comparison rows={deviceComparison} />
        </>
      )}
      {tab === "funnel" && (
        <Funnel
          rows={
            Array.isArray(funnel.rows) ? (funnel.rows as RecordValue[]) : []
          }
        />
      )}
    </>
  );
}

type ChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};
function LineChart({
  rows,
  series,
  title,
}: {
  rows: RecordValue[];
  series: ChartSeries[];
  title: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(980);
  const height = 280;
  const pad = { left: 48, right: 18, top: 16, bottom: 36 };
  useEffect(() => {
    const element = chartRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const updateWidth = () =>
      setWidth(
        Math.max(620, Math.round(element.getBoundingClientRect().width)),
      );
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const max = Math.max(1, ...series.flatMap((entry) => entry.values));
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const x = (index: number) =>
    pad.left +
    (rows.length <= 1
      ? innerWidth / 2
      : (index / (rows.length - 1)) * innerWidth);
  const y = (value: number) =>
    pad.top + innerHeight - (value / max) * innerHeight;
  const path = (values: number[]) => {
    const points = values.map((value, index) => ({ x: x(index), y: y(value) }));
    if (points.length < 2)
      return points.length
        ? `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
        : "";
    const slopes = points
      .slice(1)
      .map(
        (point, index) =>
          (point.y - points[index].y) / (point.x - points[index].x),
      );
    const tangents = points.map((_, index) => {
      if (index === 0) return slopes[0];
      if (index === points.length - 1) return slopes[slopes.length - 1];
      return slopes[index - 1] * slopes[index] <= 0
        ? 0
        : (slopes[index - 1] + slopes[index]) / 2;
    });
    slopes.forEach((slope, index) => {
      if (slope === 0) {
        tangents[index] = 0;
        tangents[index + 1] = 0;
        return;
      }
      const first = tangents[index] / slope;
      const second = tangents[index + 1] / slope;
      const length = Math.hypot(first, second);
      if (length > 3) {
        const scale = 3 / length;
        tangents[index] = scale * first * slope;
        tangents[index + 1] = scale * second * slope;
      }
    });
    return points.slice(1).reduce(
      (result, point, index) => {
        const previous = points[index];
        const third = (point.x - previous.x) / 3;
        return `${result} C${(previous.x + third).toFixed(1)},${(previous.y + tangents[index] * third).toFixed(1)} ${(point.x - third).toFixed(1)},${(point.y - tangents[index + 1] * third).toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
      },
      `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`,
    );
  };
  const active = hovered === null ? null : rows[hovered];
  const tooltipY =
    hovered === null
      ? 0
      : Math.min(...series.map((entry) => y(entry.values[hovered] ?? 0)));
  const formatDate = (value: unknown) => {
    const text = String(value ?? "");
    const match = text.match(/\d{4}-(\d{2})-(\d{2})/);
    return match ? `${match[1]}/${match[2]}` : text.replaceAll("-", "/");
  };
  return (
    <section className="dashboard-panel chart-panel">
      {!rows.length ? (
        <p className="empty">No event data.</p>
      ) : (
        <>
          <div className="line-chart-wrap" ref={chartRef}>
            <svg
              className="line-chart"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={title}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    x2={width - pad.right}
                    y1={pad.top + innerHeight * (1 - tick)}
                    y2={pad.top + innerHeight * (1 - tick)}
                  />
                  <text
                    x={pad.left - 9}
                    y={pad.top + innerHeight * (1 - tick) + 4}
                    textAnchor="end"
                  >
                    {Math.round(max * tick)}
                  </text>
                </g>
              ))}
              {rows.map(
                (row, index) =>
                  (index %
                    Math.max(
                      1,
                      width >= 1200 ? 1 : Math.ceil(rows.length / 12),
                    ) ===
                    0 ||
                    index === rows.length - 1) && (
                    <text
                      className="x-label"
                      key={String(row.date ?? index)}
                      x={x(index)}
                      y={height - 12}
                      textAnchor="middle"
                    >
                      {formatDate(row.date ?? row.day)}
                    </text>
                  ),
              )}
              {series.map((entry) => (
                <path
                  className="chart-path"
                  key={entry.key}
                  d={path(entry.values)}
                  stroke={entry.color}
                />
              ))}
              {series.map((entry) =>
                entry.values.map((value, index) => (
                  <circle
                    key={`${entry.key}-${index}`}
                    className="chart-dot"
                    cx={x(index)}
                    cy={y(value)}
                    r={hovered === index ? 4.5 : 2.5}
                    fill={entry.color}
                  />
                )),
              )}
              <rect
                className="chart-hit-area"
                x={pad.left}
                y={pad.top}
                width={innerWidth}
                height={innerHeight}
                onMouseMove={(event) => {
                  const svg = event.currentTarget.ownerSVGElement;
                  if (!svg || rows.length < 1) return;
                  const bounds = svg.getBoundingClientRect();
                  const pointerX =
                    ((event.clientX - bounds.left) / bounds.width) * width;
                  const index =
                    rows.length === 1
                      ? 0
                      : Math.round(
                          ((pointerX - pad.left) / innerWidth) *
                            (rows.length - 1),
                        );
                  setHovered(Math.max(0, Math.min(rows.length - 1, index)));
                }}
                onMouseLeave={() => setHovered(null)}
              />
              {hovered !== null && (
                <line
                  className="chart-cursor"
                  x1={x(hovered)}
                  x2={x(hovered)}
                  y1={pad.top}
                  y2={pad.top + innerHeight}
                />
              )}
            </svg>
            {active && hovered !== null && (
              <div
                className="chart-tooltip"
                role="status"
                style={{
                  left: `${(x(hovered) / width) * 100}%`,
                  top: `${(tooltipY / height) * 100}%`,
                  transform:
                    hovered > rows.length * 0.7
                      ? "translate(calc(-100% - 12px), 12px)"
                      : "translate(12px, 12px)",
                }}
              >
                <b>{formatDate(active.date ?? active.day)}</b>
                {series.map((entry) => (
                  <span key={entry.key} style={{ color: entry.color }}>
                    {series.length === 1 ? "count" : entry.label} :{" "}
                    {entry.values[hovered]}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="chart-legend">
            {series.map((entry) => (
              <span key={entry.key} style={{ color: entry.color }}>
                <i style={{ background: entry.color }} />
                {entry.label}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
function DashboardSeries({
  series,
  counts,
  mode,
}: {
  series?: RecordValue;
  counts?: RecordValue;
  mode?: "engagement";
}) {
  const [period, setPeriod] = useState(30);
  const engagement = Array.isArray(series?.engagement)
    ? (series.engagement as RecordValue[])
    : [];
  const registrations = Array.isArray(series?.registrationsDaily)
    ? (series.registrationsDaily as RecordValue[])
    : [];
  const deletions = Array.isArray(series?.deletionsDaily)
    ? (series.deletionsDaily as RecordValue[])
    : [];
  const isEngagement = mode === "engagement";
  const source = (isEngagement ? engagement : registrations).slice(-period);
  const deletionByDay = new Map(
    deletions.map((row) => [
      String(row.date ?? row.day),
      Number(row.count ?? 0),
    ]),
  );
  const chartSeries: ChartSeries[] = isEngagement
    ? [
        {
          key: "likes",
          label: "Likes",
          color: "#f51161",
          values: source.map((row) => Number(row.likes ?? 0)),
        },
        {
          key: "matches",
          label: "Matches",
          color: "#08b77b",
          values: source.map((row) => Number(row.matches ?? 0)),
        },
        {
          key: "messages",
          label: "Messages",
          color: "#397cf0",
          values: source.map((row) => Number(row.messages ?? 0)),
        },
      ]
    : [
        {
          key: "deletions",
          label: "Deletions",
          color: "#ff5a5a",
          values: source.map(
            (row) => deletionByDay.get(String(row.date ?? row.day)) ?? 0,
          ),
        },
        {
          key: "net",
          label: "Net growth",
          color: "#397cf0",
          values: source.map(
            (row) =>
              Number(row.count ?? 0) -
              (deletionByDay.get(String(row.date ?? row.day)) ?? 0),
          ),
        },
        {
          key: "registrations",
          label: "Registrations",
          color: "#08b77b",
          values: source.map((row) => Number(row.count ?? 0)),
        },
      ];
  const registrationSeries: ChartSeries[] = [
    {
      key: "registrations",
      label: "Registrations",
      color: "#f31260",
      values: registrations.slice(-30).map((row) => Number(row.count ?? 0)),
    },
  ];
  return (
    <>
      {!isEngagement && (
        <>
          <div className="registration-heading">
            <h2>Registrations</h2>
            <div className="registration-badges">
              <span className="active">
                Last 24h: {valueOf(counts?.registrations_1d)}
              </span>
              <span>Last 7 days: {valueOf(counts?.registrations_7d)}</span>
              <span>Last 30 days: {valueOf(counts?.registrations_30d)}</span>
            </div>
          </div>
          <LineChart
            title="Registrations"
            rows={registrations.slice(-30)}
            series={registrationSeries}
          />
          <p className="chart-method-note">
            Значения переключателей — скользящие окна; график сгруппирован по
            календарю (по дням / ISO-неделям / месяцам).
          </p>
        </>
      )}
      <div className="panel-title chart-heading">
        <h2>
          {isEngagement
            ? "Engagement (likes / messages / matches per day)"
            : "Growth (registrations vs deletions)"}
        </h2>
        <div className="range-tabs">
          {[7, 30, 90].map((value) => (
            <button
              className={period === value ? "active" : ""}
              onClick={() => setPeriod(value)}
              key={value}
            >
              {value}д
            </button>
          ))}
        </div>
      </div>
      <LineChart
        title={isEngagement ? "Engagement" : "Growth"}
        rows={source}
        series={chartSeries}
      />
    </>
  );
}
function LikeFlow({ ranges }: { ranges?: RecordValue }) {
  const [period, setPeriod] = useState("30");
  const source = (ranges?.[period] ?? {}) as RecordValue;
  const headers = Array.isArray(source.headers)
    ? (source.headers as string[])
    : [];
  const rows = Array.isArray(source.rows) ? (source.rows as RecordValue[]) : [];
  const max = Math.max(
    1,
    ...rows.flatMap((row) =>
      Array.isArray(row.values) ? (row.values as number[]) : [],
    ),
  );
  return (
    <section className="dashboard-panel">
      <div className="panel-title">
        <h2>Like Flow</h2>
        <div className="range-tabs">
          {["7", "30", "90"].map((value) => (
            <button
              className={period === value ? "active" : ""}
              onClick={() => setPeriod(value)}
              key={value}
            >
              {value}д
            </button>
          ))}
        </div>
      </div>
      <h3 className="like-flow-caption">
        Like Flow (строка = отправитель → столбец = получатель)
      </h3>
      <div className="table compact-table">
        <table>
          <thead>
            <tr>
              <th>Sender / receiver</th>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.label ?? index)}>
                <th>{valueOf(row.label)}</th>
                {(Array.isArray(row.values)
                  ? (row.values as number[])
                  : []
                ).map((count, cell) => (
                  <td
                    className="flow-cell"
                    style={{
                      backgroundColor: count
                        ? `rgba(245, 17, 104, ${0.08 + (count / max) * 0.55})`
                        : undefined,
                    }}
                    key={cell}
                  >
                    {count ? count : "—"}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={Math.max(1, headers.length + 1)} className="empty">
                  No likes for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="muted">Total likes for period: {valueOf(source.total)}</p>
    </section>
  );
}
function Comparison({ rows }: { rows: RecordValue[] }) {
  return (
    <section className="dashboard-panel platform-comparison">
      <h2>Platform behavior comparison</h2>
      <div className="table compact-table">
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Users</th>
              <th>% deleted (30d)</th>
              <th>% premium</th>
              <th>% verified</th>
              <th>Likes avg/med</th>
              <th>Msgs avg/med</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.platform ?? index)}>
                <td>{valueOf(row.platform)}</td>
                <td>{valueOf(row.users)}</td>
                <td>{valueOf(row.deleted30d)}%</td>
                <td>{valueOf(row.premium)}%</td>
                <td>{valueOf(row.verified)}%</td>
                <td>
                  {valueOf(row.likesAvg)} / {valueOf(row.likesMedian)}
                </td>
                <td>
                  {valueOf(row.messagesAvg)} / {valueOf(row.messagesMedian)}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="empty">
                  No platform data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="platform-comparison-note">
        Платформа = устройство <em>регистрации</em> (приблизительно;
        пользователь, зарегистрировавшийся в вебе, может позже перейти в
        приложение). Платформа фиксируется практически полностью только с ~мая
        2026 — более ранние пользователи попадают в «unknown».
      </p>
    </section>
  );
}
function Funnel({ rows }: { rows: RecordValue[] }) {
  const pct = (value: unknown, total: unknown) =>
    `${valueOf(value)} (${Math.round((Number(value ?? 0) / Math.max(1, Number(total ?? 0))) * 100)}%)`;
  return (
    <section className="dashboard-panel">
      <h2>Activation milestones by registration week</h2>
      <div className="table compact-table">
        <table>
          <thead>
            <tr>
              <th>Week</th>
              <th>Registered</th>
              <th>Wizard done</th>
              <th>Verified</th>
              <th>≥1 like</th>
              <th>≥1 match</th>
              <th>≥1 message</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={String(row.week ?? index)}>
                <td>{valueOf(row.week)}</td>
                <td>{valueOf(row.registered)}</td>
                <td>{pct(row.wizard, row.registered)}</td>
                <td>{pct(row.verified, row.registered)}</td>
                <td>{pct(row.likes, row.registered)}</td>
                <td>{pct(row.matches, row.registered)}</td>
                <td>{pct(row.messages, row.registered)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="empty">
                  No cohort data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="funnel-note">
        Каждый % — это доля зарегистрированной когорты той недели, достигшая
        данной вехи (сами вехи — флаги, выставляемые в мастере регистрации), и
        считается независимо — это НЕ последовательная воронка, поэтому поздние
        столбцы могут быть выше ранних (например, «≥1 матч» может оказаться выше
        «верифицирован»). У когорт старше ~30 дней теряются последующие события
        удалённых пользователей (% считается среди оставшихся); число
        регистраций за старые недели может быть занижено.
      </p>
    </section>
  );
}

function arrayOf(value: unknown): RecordValue[] {
  return Array.isArray(value) ? (value as RecordValue[]) : [];
}

function formatBytes(value: unknown) {
  const bytes = Math.max(0, Number(value ?? 0));
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = bytes / 1024;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${units[unit]}`;
}

function formatDuration(value: unknown) {
  let seconds = Math.max(0, Math.floor(Number(value ?? 0)));
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  return (
    [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`]
      .filter(Boolean)
      .join(" ") || `${seconds}s`
  );
}

function ProgressStat({
  label: title,
  value,
  total,
}: {
  label: string;
  value: unknown;
  total: unknown;
}) {
  const amount = Number(value ?? 0);
  const maximum = Math.max(1, Number(total ?? 0));
  const percent = Math.min(100, Math.max(0, (amount / maximum) * 100));
  return (
    <div className="monitor-progress">
      <p>
        <span>{title}</span>
        <b>
          {formatBytes(amount)} / {formatBytes(maximum)}
        </b>
      </p>
      <i>
        <em style={{ width: `${percent}%` }} />
      </i>
      <small>{percent.toFixed(1)}% used</small>
    </div>
  );
}

function monitorBytes(value: unknown) {
  const bytes = Math.max(0, Number(value ?? 0));
  if (!Number.isFinite(bytes) || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[unit]}`;
}

function MonitorSectionTitle({
  icon,
  children,
}: {
  icon: AdminIconName;
  children: React.ReactNode;
}) {
  return (
    <h2 className="monitor-section-title">
      <AdminIcon name={icon} /> {children}
    </h2>
  );
}

function MonitorMetric({
  title,
  value,
  hint,
  icon,
  compact = false,
}: {
  title: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon: AdminIconName;
  compact?: boolean;
}) {
  return (
    <article className={`monitor-metric-card${compact ? " compact" : ""}`}>
      <header>
        <h3>{title}</h3>
        <AdminIcon name={icon} />
      </header>
      <strong>{value}</strong>
      {hint ? <p>{hint}</p> : null}
    </article>
  );
}

function MonitorUsage({
  title,
  value,
  total,
  free,
  icon,
}: {
  title: string;
  value: unknown;
  total: unknown;
  free: unknown;
  icon: AdminIconName;
}) {
  const amount = Math.max(0, Number(value ?? 0));
  const maximum = Math.max(1, Number(total ?? 0));
  const percent = Math.min(100, Math.max(0, (amount / maximum) * 100));
  return (
    <article className="monitor-usage-card">
      <header>
        <h3>
          <AdminIcon name={icon} /> {title}
        </h3>
        <i aria-label="Healthy" />
      </header>
      <p>
        {monitorBytes(amount)} / {monitorBytes(maximum)} ({monitorBytes(free)}
        &nbsp;free)
      </p>
      <div>
        <span style={{ width: `${percent}%` }} />
      </div>
      <b>{Math.round(percent)}%</b>
    </article>
  );
}

function MonitoringPage() {
  const [tab, setTab] = useState("System");
  const [data, setData] = useState<RecordValue | null>(null);
  const [error, setError] = useState("");
  const [minimum, setMinimum] = useState("100");
  const [appliedMinimum, setAppliedMinimum] = useState("100");
  const load = () => {
    setError("");
    api
      .get<RecordValue>(
        `/admin/monitoring?minMeanMs=${encodeURIComponent(appliedMinimum)}`,
      )
      .then(setData)
      .catch(() => setError("Could not load monitoring data."));
  };
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, [appliedMinimum]);
  const system = (data?.system ?? {}) as RecordValue;
  const memory = (system.memory ?? {}) as RecordValue;
  const disk = (system.disk ?? {}) as RecordValue;
  const database = (data?.postgres ?? {}) as RecordValue;
  const databaseTables = arrayOf(database.tableSizes);
  const largestDatabaseTable = Math.max(
    1,
    ...databaseTables.map((row) => Number(row.bytes ?? 0)),
  );
  const docker = (data?.docker ?? {}) as RecordValue;
  const redis = (data?.redis ?? {}) as RecordValue;
  const resetSlowQueries = async () => {
    if (!window.confirm("Reset collected slow-query statistics?")) return;
    try {
      await api.post("/admin/monitoring/slow-queries/reset", {});
      load();
    } catch {
      setError("Slow-query statistics could not be reset.");
    }
  };
  return (
    <>
      <header className="page-heading monitoring-heading">
        <h1>System Monitoring</h1>
        <span>
          <AdminIcon name="refresh" /> Auto-refresh: 60s
        </span>
      </header>
      <nav className="monitor-tabs">
        {["System", "External APIs", "Cron Jobs", "Slow Queries"].map(
          (title) => (
            <button
              key={title}
              className={tab === title ? "active" : ""}
              onClick={() => setTab(title)}
            >
              {title}
            </button>
          ),
        )}
      </nav>
      {error && <p className="error">{error}</p>}
      {!data ? (
        <p className="loading-inline">Loading…</p>
      ) : tab === "System" ? (
        <div className="monitor-system">
          <section className="monitor-system-section">
            <MonitorSectionTitle icon="server">Server</MonitorSectionTitle>
            <div className="monitor-metric-grid">
              <MonitorMetric
                title="Uptime"
                value={formatDuration(system.uptimeSeconds)}
                hint={valueOf(system.hostname)}
                icon="clock"
              />
              <MonitorMetric
                title="CPU Cores"
                value={valueOf(system.cpuCores)}
                hint={valueOf(system.cpuModel)}
                icon="cpu"
              />
              <MonitorMetric
                title="Load Average"
                value={valueOf(
                  Array.isArray(system.loadAverage)
                    ? system.loadAverage[0]
                    : "—",
                )}
                hint={
                  Array.isArray(system.loadAverage)
                    ? `5m: ${valueOf(system.loadAverage[1])} / 15m: ${valueOf(system.loadAverage[2])}`
                    : undefined
                }
                icon="activity"
              />
              <MonitorMetric
                title="Platform"
                value={String(system.platform ?? "—")
                  .split(/\s+/)[0]
                  .toLowerCase()}
                icon="server"
              />
            </div>
            <div className="monitor-usage-grid">
              <MonitorUsage
                title="Disk Usage"
                value={disk.used}
                total={disk.total}
                free={disk.free}
                icon="drive"
              />
              <MonitorUsage
                title="Memory Usage"
                value={memory.used}
                total={memory.total}
                free={memory.available}
                icon="memory"
              />
            </div>
          </section>

          <section className="monitor-system-section">
            <MonitorSectionTitle icon="container">Docker</MonitorSectionTitle>
            <article className="monitor-docker-card">
              <header>
                <h3>
                  <AdminIcon name="container" /> Docker Disk Usage
                </h3>
                <button disabled={!docker.available}>
                  <AdminIcon name="trash" /> Clean Up
                </button>
              </header>
              <p>
                {docker.available
                  ? `${valueOf(docker.images)} images, ${valueOf(docker.containers)} containers, ${valueOf(docker.volumes)} volumes`
                  : valueOf(docker.message)}
              </p>
              <dl>
                <div>
                  <dt>Images</dt>
                  <dd>
                    {docker.available ? monitorBytes(docker.imageBytes) : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Build Cache</dt>
                  <dd>
                    {docker.available ? monitorBytes(docker.cacheBytes) : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Reclaimable</dt>
                  <dd className="positive">
                    {docker.available
                      ? monitorBytes(docker.reclaimableBytes)
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="monitor-docker-progress">
                <span
                  style={{
                    width: `${Math.min(100, Math.max(0, Number(docker.reclaimablePercent ?? 0)))}%`,
                  }}
                />
              </div>
              <b>{Math.round(Number(docker.reclaimablePercent ?? 0))}%</b>
            </article>
          </section>

          <section className="monitor-system-section">
            <MonitorSectionTitle icon="database">
              PostgreSQL
            </MonitorSectionTitle>
            <div className="monitor-metric-grid">
              <MonitorMetric
                compact
                title="Database Size"
                value={monitorBytes(database.size)}
                icon="database"
              />
              <MonitorMetric
                compact
                title="Active Connections"
                value={valueOf(database.connections)}
                icon="wifi"
              />
              <MonitorMetric
                compact
                title="Tables"
                value={valueOf(database.tables)}
                icon="database"
              />
              <MonitorMetric
                compact
                title="DB Uptime"
                value={formatDuration(database.uptimeSeconds)}
                icon="clock"
              />
            </div>
            <article className="monitor-table-card">
              <header>
                <h3>Table Sizes</h3>
                <p>Top tables by total size (data + indexes)</p>
              </header>
              <div className="monitor-table-size-rows">
                {databaseTables.map((row) => (
                  <div
                    className="monitor-table-size-row"
                    key={String(row.name)}
                  >
                    <p>
                      <code>{valueOf(row.name)}</code>
                      <span>
                        <span>
                          ~{Number(row.rows ?? 0).toLocaleString()} rows
                        </span>
                        <b>{monitorBytes(row.bytes)}</b>
                      </span>
                    </p>
                    <i>
                      <span
                        style={{
                          width: `${Math.max(1, (Number(row.bytes ?? 0) / largestDatabaseTable) * 100)}%`,
                        }}
                      />
                    </i>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="monitor-system-section">
            <MonitorSectionTitle icon="database">Redis</MonitorSectionTitle>
            <div className="monitor-metric-grid">
              <MonitorMetric
                title="Status"
                value={valueOf(redis.status)}
                hint={valueOf(redis.version)}
                icon="circleCheck"
              />
              <MonitorMetric
                title="Memory Used"
                value={valueOf(redis.memoryUsed)}
                hint={
                  redis.memoryPeak ? `Peak: ${valueOf(redis.memoryPeak)}` : "—"
                }
                icon="memory"
              />
              <MonitorMetric
                title="Total Keys"
                value={valueOf(redis.totalKeys)}
                hint={redis.clients ? `${valueOf(redis.clients)} clients` : "—"}
                icon="database"
              />
              <MonitorMetric
                title="Uptime"
                value={
                  redis.uptimeSeconds
                    ? formatDuration(redis.uptimeSeconds)
                    : "—"
                }
                hint={
                  redis.totalCommands
                    ? `${Number(redis.totalCommands).toLocaleString()} total cmds`
                    : "Redis is not part of the current application stack."
                }
                icon="clock"
              />
            </div>
          </section>
        </div>
      ) : tab === "External APIs" ? (
        <section className="external-api-grid">
          {arrayOf(data.externalApis).map((service) => {
            const metrics = (service.metrics ?? {}) as RecordValue;
            return (
              <article
                className="monitor-card external-api-card"
                key={String(service.key)}
              >
                <header>
                  <div>
                    <h3>
                      <AdminIcon
                        name={
                          String(service.key) === "email" ? "mail" : "globe"
                        }
                      />{" "}
                      {valueOf(service.name)}
                    </h3>
                    <p>{valueOf(service.description)}</p>
                  </div>
                </header>
                <div className="api-periods">
                  {[
                    ["Today", "today"],
                    ["This Month", "month"],
                    ["All Time", "all"],
                  ].map(([title, key]) => (
                    <section key={key}>
                      <p className="api-period-title">{title}</p>
                      {Object.entries(metrics).map(([metric, periods]) => (
                        <p key={metric}>
                          <span>{metric}</span>
                          <b>
                            {Number(
                              ((periods ?? {}) as RecordValue)[key] ?? 0,
                            ).toLocaleString()}
                          </b>
                        </p>
                      ))}
                      {Object.keys(metrics).length > 1 && (
                        <p className="api-total">
                          <span>Total</span>
                          <b>
                            {Object.values(metrics)
                              .reduce<number>(
                                (sum, periods) =>
                                  sum +
                                  Number(
                                    ((periods ?? {}) as RecordValue)[key] ?? 0,
                                  ),
                                0,
                              )
                              .toLocaleString()}
                          </b>
                        </p>
                      )}
                    </section>
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      ) : tab === "Cron Jobs" ? (
        <div className="monitor-stack">
          <section className="monitor-card">
            <h2>App Cleanup Jobs</h2>
            <p className="monitor-muted">
              Runs via POST /api/cron/cleanup (authorized with CRON_SECRET)
            </p>
            <div className="table monitor-table">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Task</th>
                    <th>Description</th>
                    <th>Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {arrayOf(data.appCleanupJobs).map((row, index) => (
                    <tr key={String(row.task)}>
                      <td>{index + 1}</td>
                      <td>
                        <code>{valueOf(row.task)}</code>
                      </td>
                      <td>{valueOf(row.description)}</td>
                      <td>{valueOf(row.schedule)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="monitor-card">
            <h2>System Cron Jobs</h2>
            <p className="monitor-muted">Server-level crontab (root)</p>
            <div className="table monitor-table">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Description</th>
                    <th>Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {arrayOf(data.systemCronJobs).map((row, index) => (
                    <tr key={index}>
                      <td>
                        <code>{valueOf(row.task)}</code>
                      </td>
                      <td>{valueOf(row.description)}</td>
                      <td>{valueOf(row.schedule)}</td>
                    </tr>
                  ))}
                  {!arrayOf(data.systemCronJobs).length && (
                    <tr>
                      <td colSpan={3} className="empty">
                        No system cron jobs are exposed to the application
                        container.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section className="monitor-card">
            <h2>Run History</h2>
            <div className="table monitor-table">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Job</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Results</th>
                  </tr>
                </thead>
                <tbody>
                  {arrayOf(data.cronHistory).map((row, index) => {
                    const payload = (row.payload ?? {}) as RecordValue;
                    return (
                      <tr key={String(row.id ?? index)}>
                        <td>{verificationDate(row.created_at)}</td>
                        <td>{valueOf(payload.job ?? row.event_type)}</td>
                        <td>
                          <span
                            className={`table-badge status-${String(payload.status ?? "ok").toLowerCase()}`}
                          >
                            {valueOf(payload.status ?? "OK")}
                          </span>
                        </td>
                        <td>
                          {valueOf(
                            payload.duration ??
                              (payload.durationSeconds
                                ? `${payload.durationSeconds}s`
                                : ""),
                          )}
                        </td>
                        <td>
                          {valueOf(payload.results ?? payload.details ?? "")}
                        </td>
                      </tr>
                    );
                  })}
                  {!arrayOf(data.cronHistory).length && (
                    <tr>
                      <td colSpan={5} className="empty">
                        No recorded runs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <section className="monitor-card slow-query-card">
          <header className="slow-query-toolbar">
            <div>
              <h3>
                <AdminIcon name="gauge" /> Slow Queries
              </h3>
              <p>
                Top queries by mean execution time from{" "}
                <code>pg_stat_statements</code>. Counters are cumulative since
                the last reset / postgres restart.
              </p>
            </div>
            <label>
              Min mean (ms):
              <input
                type="number"
                min="0"
                value={minimum}
                onChange={(event) => setMinimum(event.target.value)}
              />
            </label>
            <button
              className="secondary-button"
              onClick={() => setAppliedMinimum(minimum || "0")}
            >
              <AdminIcon name="refresh" /> Refresh
            </button>
            <button
              className="secondary-button slow-query-reset"
              disabled={!data.slowQueriesAvailable}
              onClick={() => void resetSlowQueries()}
            >
              <AdminIcon name="trash" /> Reset Stats
            </button>
          </header>
          <div className="table monitor-table slow-query-table">
            <table>
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Calls</th>
                  <th>Mean (ms)</th>
                  <th>Max (ms)</th>
                  <th>Total (ms)</th>
                  <th>Rows / call</th>
                </tr>
              </thead>
              <tbody>
                {arrayOf(data.slowQueries).map((row, index) => (
                  <tr key={String(row.id ?? index)}>
                    <td>
                      <code>{valueOf(row.query)}</code>
                    </td>
                    <td>{Number(row.calls ?? 0).toLocaleString()}</td>
                    <td>{Number(row.mean_ms ?? 0).toFixed(2)}</td>
                    <td>{Number(row.max_ms ?? 0).toFixed(2)}</td>
                    <td>
                      {Math.round(Number(row.total_ms ?? 0)).toLocaleString()}
                    </td>
                    <td>
                      {Math.round(
                        Number(row.rows_per_call ?? 0),
                      ).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!arrayOf(data.slowQueries).length && (
                  <tr>
                    <td colSpan={6} className="empty">
                      {data.slowQueriesAvailable
                        ? "No queries match this threshold."
                        : "pg_stat_statements is not enabled."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

const storageCategories: Array<[string, string]> = [
  ["all", "All Files"],
  ["profile_photos", "Profile Photos"],
  ["chat_images", "Chat Images"],
  ["chat_files", "Chat Files"],
  ["clinic_logos", "Clinic Logos"],
  ["lawyer_photos", "Lawyer Photos"],
  ["article_images", "Article Images"],
];

function StoragePage() {
  const [category, setCategory] = useState("all");
  const [userId, setUserId] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<RecordValue | null>(null);
  const [error, setError] = useState("");
  const limit = 24;
  const load = () => {
    const params = new URLSearchParams({
      category,
      limit: String(limit),
      offset: String(offset),
    });
    if (userId.trim()) params.set("userId", userId.trim());
    setData(null);
    setError("");
    api
      .get<RecordValue>(`/admin/storage?${params}`)
      .then(setData)
      .catch(() => setError("Could not load storage data."));
  };
  useEffect(load, [category, userId, offset]);
  const total = Number(data?.total ?? 0);
  const summary = (data?.summary ?? {}) as RecordValue;
  return (
    <>
      <header className="page-heading storage-heading">
        <div>
          <h1>Storage</h1>
          <p>
            {formatBytes(data?.totalBytes)} /{" "}
            {Number(data?.totalFiles ?? 0).toLocaleString()} files
          </p>
        </div>
        <button onClick={load}>
          <AdminIcon name="refresh" /> Refresh Stats
        </button>
      </header>
      {error && <p className="error">{error}</p>}
      <section className="storage-summary">
        {storageCategories.slice(1).map(([key, title]) => {
          const item = (summary[key] ?? {}) as RecordValue;
          return (
            <article key={key}>
              <span>{title}</span>
              <strong>{Number(item.files ?? 0).toLocaleString()}</strong>
              <small>{formatBytes(item.bytes)}</small>
            </article>
          );
        })}
      </section>
      <div className="storage-filter">
        <label className="sr-only" htmlFor="storage-user-filter">
          Filter by User ID
        </label>
        <input
          id="storage-user-filter"
          value={userId}
          onChange={(event) => {
            setUserId(event.target.value);
            setOffset(0);
          }}
          placeholder="Filter by User ID (UUID)"
        />
      </div>
      <nav className="storage-tabs">
        {storageCategories.map(([key, title]) => (
          <button
            key={key}
            className={category === key ? "active" : ""}
            onClick={() => {
              setCategory(key);
              setOffset(0);
            }}
          >
            {title}
          </button>
        ))}
      </nav>
      {total > limit && (
        <div className="storage-pager">
          <span>
            Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
          </span>
          <div>
            <button
              className="secondary-button"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </button>
            <button
              className="secondary-button"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {!data ? (
        <p className="loading-inline">Loading…</p>
      ) : (
        <section className="storage-file-grid">
          {arrayOf(data.items).map((row) => {
            const preview =
              String(row.mimeType ?? "").startsWith("image/") &&
              row.contentUrl ? (
                <img src={String(row.contentUrl)} alt="" loading="lazy" />
              ) : (
                <div className="storage-file-placeholder">
                  <AdminIcon
                    name={
                      String(row.mimeType ?? "").startsWith("image/")
                        ? "image"
                        : "file"
                    }
                  />
                </div>
              );
            return (
              <article key={String(row.id)}>
                {row.contentUrl ? (
                  <a
                    className="storage-file-preview"
                    href={String(row.contentUrl)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${String(row.name ?? "file")}`}
                  >
                    {preview}
                  </a>
                ) : (
                  preview
                )}
                <div className="storage-file-info">
                  <span className="table-badge">
                    {label(String(row.category ?? "other"))}
                  </span>
                  <b title={String(row.name ?? "")}>{valueOf(row.name)}</b>
                  <small>
                    {formatBytes(row.bytes)} · {compactDate(row.createdAt)}
                  </small>
                  {Boolean(row.profileId) && (
                    <Link
                      to={`/users/${encodeURIComponent(String(row.profileId))}`}
                    >
                      User {valueOf(row.profileId)}
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
          {!arrayOf(data.items).length && (
            <p className="storage-empty">No files found.</p>
          )}
        </section>
      )}
    </>
  );
}

function Operations({ kind }: { kind: "monitoring" | "storage" }) {
  return kind === "monitoring" ? <MonitoringPage /> : <StoragePage />;
}

function Support() {
  const { id: requestedThreadId } = useParams();
  const [result, setResult] = useState<ListResponse | null>(null);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState<RecordValue | null>(null);
  const [detail, setDetail] = useState<RecordValue | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [unanswered, setUnanswered] = useState(true);
  const limit = 25;
  const load = () => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (query.trim()) params.set("q", query.trim());
    if (unanswered) params.set("unanswered", "true");
    api
      .get<ListResponse>(`/admin/support?${params}`)
      .then(setResult)
      .catch(() => setError("Could not load support conversations."));
  };
  useEffect(load, [query, offset, unanswered]);
  useEffect(() => {
    if (!requestedThreadId || active?.id) return;
    const match = result?.items.find(
      (row) => String(row.id) === requestedThreadId,
    );
    if (match) setActive(match);
    else
      api
        .get<RecordValue>(
          `/admin/support/${encodeURIComponent(requestedThreadId)}`,
        )
        .then((loaded) =>
          setActive((loaded.conversation ?? loaded) as RecordValue),
        )
        .catch(() => setError("Could not load the conversation."));
  }, [requestedThreadId, result, active]);
  useEffect(() => {
    if (active?.id)
      api
        .get<RecordValue>(
          `/admin/support/${encodeURIComponent(String(active.id))}`,
        )
        .then(setDetail)
        .catch(() => setError("Could not load the conversation."));
    else setDetail(null);
  }, [active]);
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!active?.id || !body.trim()) return;
    try {
      await api.post(
        `/admin/support/${encodeURIComponent(String(active.id))}/messages`,
        { body },
      );
      setBody("");
      const updated = await api.get<RecordValue>(
        `/admin/support/${encodeURIComponent(String(active.id))}`,
      );
      setDetail(updated);
      load();
    } catch {
      setError("Could not send the support response.");
    }
  };
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  return (
    <div className="support-workspace">
      <section className="support-list-pane">
        <nav className="support-tabs">
          <button
            className={unanswered ? "active" : ""}
            onClick={() => {
              setOffset(0);
              setUnanswered(true);
            }}
          >
            Unanswered {unanswered && result ? `(${total})` : ""}
          </button>
          <button
            className={!unanswered ? "active" : ""}
            onClick={() => {
              setOffset(0);
              setUnanswered(false);
            }}
          >
            All {!unanswered && result ? `(${total})` : ""}
          </button>
        </nav>
        <div className="support-search">
          <input
            value={query}
            onChange={(event) => {
              setOffset(0);
              setQuery(event.target.value);
            }}
            placeholder="Search by name or email..."
          />
        </div>
        {error && <p className="error">{error}</p>}
        <div className="support-conversation-list">
          {!result ? (
            <p className="loading-inline">Loading…</p>
          ) : (
            items.map((row) => (
              <button
                className={active?.id === row.id ? "selected" : ""}
                key={String(row.id)}
                onClick={() => setActive(row)}
              >
                <i>{rowName(row).slice(0, 1).toUpperCase()}</i>
                <span>
                  <b>{rowName(row)}</b>
                  <small>
                    {valueOf(row.profileType ?? row.type ?? row.email)}
                  </small>
                  <p>{valueOf(row.lastMessage)}</p>
                </span>
                <time>{compactDate(row.lastMessageAt ?? row.updated_at)}</time>
                {Number(row.unreadCount ?? 0) > 0 && (
                  <em>{valueOf(row.unreadCount)}</em>
                )}
              </button>
            ))
          )}
          {result && !items.length && (
            <div className="support-list-empty">No support conversations.</div>
          )}
        </div>
        {total > limit && (
          <div className="support-pager">
            <button
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              ‹
            </button>
            <span>
              {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)}
            </span>
            <button
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              ›
            </button>
          </div>
        )}
      </section>
      <section className="support-thread">
        {detail ? (
          <>
            <h2>
              {valueOf(
                (detail.conversation as RecordValue | undefined)?.userName ??
                  active?.userName,
              )}
            </h2>
            <p className="muted">
              {valueOf(
                (detail.conversation as RecordValue | undefined)?.email ??
                  active?.email,
              )}
            </p>
            <div className="message-list">
              {((detail.messages ?? []) as RecordValue[]).map(
                (message, index) => (
                  <article key={String(message.id ?? index)}>
                    <b>{valueOf(message.senderName)}</b>
                    <p>{valueOf(message.body)}</p>
                    <small>{compactDate(message.created_at)}</small>
                  </article>
                ),
              )}
            </div>
            <form onSubmit={send}>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={3}
                placeholder="Write a response…"
              />
              <button className="primary">Send reply</button>
            </form>
          </>
        ) : (
          <div className="support-empty">
            <AdminIcon name="headphones" />
            <h2>Select a conversation</h2>
            <p>Choose a support chat from the list to start responding</p>
          </div>
        )}
      </section>
    </div>
  );
}

function ModerationPhotos() {
  const [status, setStatus] = useState("PENDING");
  const [result, setResult] = useState<ListResponse | null>(null);
  const [notice, setNotice] = useState("");
  const limit = 100;
  const load = () => {
    setResult(null);
    api
      .get<ListResponse>(
        `/admin/list/moderation-photos?limit=${limit}&offset=0&status=${encodeURIComponent(status)}`,
      )
      .then(setResult)
      .catch(() => setNotice("Could not load photo moderation."));
  };
  useEffect(load, [status]);
  const review = async (row: RecordValue, next: "APPROVED" | "REJECTED") => {
    const reason =
      next === "REJECTED" ? window.prompt("Rejection reason")?.trim() : "";
    if (next === "REJECTED" && !reason) return;
    try {
      await api.patch(
        `/admin/item/moderation-photos/${encodeURIComponent(String(row.id))}`,
        { values: { status: next, reason } },
      );
      setNotice(next === "APPROVED" ? "Photo approved." : "Photo rejected.");
      load();
    } catch {
      setNotice("Could not update this photo.");
    }
  };
  const items = result?.items ?? [];
  return (
    <>
      <header className="page-heading">
        <h1>Photo Moderation</h1>
      </header>
      <nav className="moderation-tabs">
        {[
          ["PENDING", "Pending"],
          ["APPROVED", "Approved"],
          ["REJECTED", "Rejected"],
        ].map(([key, title]) => (
          <button
            key={key}
            className={status === key ? "active" : ""}
            onClick={() => setStatus(key)}
          >
            <AdminIcon
              name={
                key === "PENDING"
                  ? "clock"
                  : key === "APPROVED"
                    ? "circleCheck"
                    : "circleX"
              }
            />{" "}
            {title}
          </button>
        ))}
      </nav>
      {notice && (
        <p className={notice.includes("Could not") ? "error" : "notice"}>
          {notice}
        </p>
      )}
      {!result ? (
        <p className="loading-inline">Loading photos…</p>
      ) : (
        <section className="moderation-photo-grid">
          {items.map((row, index) => {
            const imageUrl = String(
              row.publicUrl ??
                row.url ??
                (row.data as RecordValue | undefined)?.publicUrl ??
                "",
            );
            return (
              <article key={String(row.id ?? index)}>
                <div className="moderation-photo-media">
                  <span>Photo unavailable</span>
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt=""
                      onError={(event) => event.currentTarget.remove()}
                    />
                  )}
                </div>
                <div>
                  <b>{rowName(row)}</b>
                  <p>{valueOf(row.status)}</p>
                  {status === "PENDING" && (
                    <p className="row-actions">
                      <button
                        className="primary"
                        onClick={() => void review(row, "APPROVED")}
                      >
                        Approve
                      </button>
                      <button
                        className="danger"
                        onClick={() => void review(row, "REJECTED")}
                      >
                        Reject
                      </button>
                    </p>
                  )}
                </div>
              </article>
            );
          })}
          {!items.length && (
            <div className="moderation-empty">
              <b>
                No photos{" "}
                {status === "PENDING"
                  ? "pending moderation"
                  : `in ${status.toLowerCase()} queue`}
              </b>
              <p>
                {status === "PENDING"
                  ? "All photos have been reviewed"
                  : "There are no photos in this section"}
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ModerationReports() {
  const [status, setStatus] = useState("PENDING");
  const [result, setResult] = useState<ListResponse | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({
    PENDING: 0,
    RESOLVED: 0,
    DISMISSED: 0,
  });
  const [notice, setNotice] = useState("");
  const loadCounts = () =>
    Promise.all(
      ["PENDING", "RESOLVED", "DISMISSED"].map(
        async (key) =>
          [
            key,
            (
              await api.get<ListResponse>(
                `/admin/list/moderation-reports?limit=1&offset=0&status=${key}`,
              )
            ).total,
          ] as const,
      ),
    ).then((items) => setCounts(Object.fromEntries(items)));
  const load = () => {
    setResult(null);
    api
      .get<ListResponse>(
        `/admin/list/moderation-reports?limit=100&offset=0&status=${encodeURIComponent(status)}`,
      )
      .then(setResult)
      .catch(() => setNotice("Could not load reports."));
  };
  useEffect(load, [status]);
  useEffect(() => {
    void loadCounts();
  }, []);
  const review = async (row: RecordValue, next: "RESOLVED" | "DISMISSED") => {
    if (!window.confirm(`Mark this report as ${next.toLowerCase()}?`)) return;
    try {
      await api.patch(
        `/admin/item/moderation-reports/${encodeURIComponent(String(row.id))}`,
        { values: { status: next } },
      );
      setNotice(next === "RESOLVED" ? "Report resolved." : "Report dismissed.");
      load();
      void loadCounts();
    } catch {
      setNotice("Could not update this report.");
    }
  };
  const items = result?.items ?? [];
  return (
    <>
      <header className="page-heading">
        <h1>Reports</h1>
      </header>
      <nav className="moderation-tabs">
        {[
          ["PENDING", "New"],
          ["RESOLVED", "Resolved"],
          ["DISMISSED", "Dismissed"],
        ].map(([key, title]) => (
          <button
            key={key}
            className={status === key ? "active" : ""}
            onClick={() => setStatus(key)}
          >
            <AdminIcon
              name={
                key === "PENDING"
                  ? "clock"
                  : key === "RESOLVED"
                    ? "circleCheck"
                    : "circleX"
              }
            />{" "}
            {title}
            {counts[key] ? (
              <span className="moderation-tab-count">
                {key === "PENDING" ? counts[key] : `(${counts[key]})`}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      {notice && (
        <p className={notice.includes("Could not") ? "error" : "notice"}>
          {notice}
        </p>
      )}
      <section
        className={`table moderation-report-table${result && !items.length ? " is-empty" : ""}`}
      >
        {!result ? (
          <p className="loading-inline">Loading reports…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reporter</th>
                <th>Reported user</th>
                <th>Reason</th>
                <th>Description</th>
                <th>Date</th>
                {status === "PENDING" && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  <td>{valueOf(row.reporterName ?? row.reporterEmail)}</td>
                  <td>{valueOf(row.reportedName ?? row.reportedEmail)}</td>
                  <td>{valueOf(row.reason)}</td>
                  <td>{valueOf(row.details ?? row.description)}</td>
                  <td>{verificationDate(row.createdAt ?? row.created_at)}</td>
                  {status === "PENDING" && (
                    <td className="row-actions">
                      <button
                        className="primary"
                        onClick={() => void review(row, "RESOLVED")}
                      >
                        <AdminIcon name="check" /> Resolve
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => void review(row, "DISMISSED")}
                      >
                        <AdminIcon name="x" /> Dismiss
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!items.length && null}
            </tbody>
          </table>
        )}
      </section>
      {result && !items.length && (
        <section className="moderation-report-empty">
          <AdminIcon name="flag" />
          <h2>
            {status === "PENDING"
              ? "No pending reports"
              : `No ${status.toLowerCase()} reports`}
          </h2>
          <p>
            {status === "PENDING"
              ? "All reports have been reviewed"
              : "There are no reports in this section"}
          </p>
        </section>
      )}
    </>
  );
}

function LiveKitCalls() {
  const [tab, setTab] = useState<"live" | "history" | "statistics">("live");
  const [result, setResult] = useState<ListResponse | null>(null);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const load = () => {
    setResult(null);
    api
      .get<ListResponse>("/admin/list/livekit?limit=100&offset=0")
      .then((data) => {
        setResult(data);
        setUpdatedAt(new Date());
      })
      .catch(() => setResult({ items: [], total: 0, limit: 100, offset: 0 }));
  };
  useEffect(() => {
    void load();
  }, []);
  const rows = result?.items ?? [];
  const activeRows = rows.filter((row) =>
    ["ACTIVE", "CONNECTED", "RINGING"].includes(
      String(
        row.status ?? (row.data as RecordValue | undefined)?.status ?? "",
      ).toUpperCase(),
    ),
  );
  const endedRows = rows.filter((row) => !activeRows.includes(row));
  return (
    <>
      <header className="livekit-heading">
        <h1>LiveKit Calls</h1>
        <p>Monitor video and voice calls in real-time</p>
      </header>
      <nav className="livekit-tabs">
        <button
          className={tab === "live" ? "active" : ""}
          onClick={() => setTab("live")}
        >
          <AdminIcon name="phone" /> Live Calls
        </button>
        <button
          className={tab === "history" ? "active" : ""}
          onClick={() => setTab("history")}
        >
          <AdminIcon name="clock" /> Call History
        </button>
        <button
          className={tab === "statistics" ? "active" : ""}
          onClick={() => setTab("statistics")}
        >
          <AdminIcon name="barChart" /> Statistics
        </button>
      </nav>
      {tab === "live" && (
        <>
          <div className="livekit-toolbar">
            <span>
              <i />
              {activeRows.length} active calls&nbsp; · Updated{" "}
              {Math.max(
                0,
                Math.floor((Date.now() - updatedAt.valueOf()) / 1000),
              )}
              s ago
            </span>
            <button className="secondary-button" onClick={load}>
              <AdminIcon name="refresh" /> Refresh
            </button>
          </div>
          <section className="livekit-empty">
            <b>
              <AdminIcon name="circleCheck" />
            </b>
            <p className="livekit-empty-title">
              {result ? "No active calls" : "Loading..."}
            </p>
            <p>{result ? "All quiet right now" : ""}</p>
          </section>
        </>
      )}
      {tab === "history" && (
        <section className="livekit-history">
          <select aria-label="Call status">
            <option>All statuses</option>
            <option>Ended</option>
            <option>Declined</option>
            <option>Missed</option>
          </select>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Caller</th>
                  <th>Callee</th>
                  <th>Type</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {endedRows.map((row, index) => {
                  const data = (row.data ?? row) as RecordValue;
                  return (
                    <tr key={String(row.id ?? index)}>
                      <td>
                        {verificationDate(data.createdAt ?? row.created_at)}
                      </td>
                      <td>{valueOf(data.callerName ?? data.caller)}</td>
                      <td>{valueOf(data.calleeName ?? data.callee)}</td>
                      <td>{valueOf(data.type)}</td>
                      <td>{valueOf(data.duration)}</td>
                      <td>
                        <span
                          className={`table-badge status-${String(data.status ?? row.status ?? "").toLowerCase()}`}
                        >
                          {valueOf(data.status ?? row.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {result && !endedRows.length && (
                  <tr>
                    <td className="empty" colSpan={6}>
                      No call history
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "statistics" && (
        <section className="livekit-statistics">
          <select aria-label="Statistics period">
            <option>Last 7 days</option>
            <option>Last 30 days</option>
          </select>
          <div className="metric-grid metric-grid-four">
            <MetricCard
              title="Total Calls"
              value={rows.length}
              hint="in last 7 days"
              icon="phone"
            />
            <MetricCard
              title="Avg Duration"
              value="0s"
              hint="per call"
              icon="activity"
            />
            <MetricCard title="Missed Rate" value="0%" icon="alert" />
            <MetricCard
              title="Video / Audio"
              value="0 / 0"
              hint="calls by type"
              icon="phone"
            />
          </div>
          <article className="dashboard-panel livekit-chart">
            <h3>Calls per day</h3>
            <p>Last 7 days</p>
            <div>
              {Array.from({ length: 7 }, (_, index) => (
                <span key={index}>
                  {new Date(
                    Date.now() - (6 - index) * 86400000,
                  ).toLocaleDateString("en-CA", {
                    month: "2-digit",
                    day: "2-digit",
                  })}
                </span>
              ))}
            </div>
          </article>
        </section>
      )}
    </>
  );
}

function StaticPages() {
  const [result, setResult] = useState<ListResponse | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragSlug, setDragSlug] = useState("");
  const navigate = useNavigate();
  const load = () =>
    api
      .get<ListResponse>("/admin/list/static-pages?limit=100&offset=0")
      .then(setResult);
  useEffect(() => {
    void load();
  }, []);
  const groups = useMemo(() => {
    const map = new Map<string, RecordValue[]>();
    for (const row of result?.items ?? []) {
      const key = String(row.slug ?? row.id);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()]
      .map(([slug, rows]) => {
        const primary = rows.find((row) => row.locale === "en") ?? rows[0];
        const meta = (
          primary.data && typeof primary.data === "object" ? primary.data : {}
        ) as RecordValue;
        const inFooter = Boolean(
          meta.inFooter ??
            meta.in_footer ??
            ["terms-of-use", "privacy-policy"].includes(slug),
        );
        return {
          slug,
          rows,
          primary,
          inFooter,
          sortOrder: Number(
            meta.sortOrder ?? meta.sort_order ?? primary.id ?? 0,
          ),
        };
      })
      .filter(
        (group) =>
          !query.trim() ||
          `${group.primary.title} ${group.slug}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      )
      .sort(
        (a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug),
      );
  }, [result, query]);
  const toggleFooter = async (group: (typeof groups)[number]) => {
    setBusy(true);
    try {
      await Promise.all(
        group.rows.map((row) =>
          api.patch(
            `/admin/item/static-pages/${encodeURIComponent(String(row.id))}`,
            {
              values: {
                meta: {
                  ...((row.data ?? {}) as RecordValue),
                  inFooter: !group.inFooter,
                },
              },
            },
          ),
        ),
      );
      await load();
    } finally {
      setBusy(false);
    }
  };
  const archive = async (group: (typeof groups)[number]) => {
    if (!window.confirm(`Delete ${valueOf(group.primary.title)}?`)) return;
    setBusy(true);
    try {
      await Promise.all(
        group.rows.map((row) =>
          api.delete(
            `/admin/item/static-pages/${encodeURIComponent(String(row.id))}`,
          ),
        ),
      );
      await load();
    } finally {
      setBusy(false);
    }
  };
  const reorderFooter = async (targetSlug: string) => {
    if (!dragSlug || dragSlug === targetSlug) return;
    const footer = groups.filter((group) => group.inFooter);
    const sourceIndex = footer.findIndex((group) => group.slug === dragSlug);
    const targetIndex = footer.findIndex((group) => group.slug === targetSlug);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const ordered = [...footer];
    const [moved] = ordered.splice(sourceIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    setBusy(true);
    try {
      await Promise.all(
        ordered.flatMap((group, index) =>
          group.rows.map((row) =>
            api.patch(
              `/admin/item/static-pages/${encodeURIComponent(String(row.id))}`,
              {
                values: {
                  meta: {
                    ...((row.data ?? {}) as RecordValue),
                    inFooter: true,
                    sortOrder: index,
                  },
                },
              },
            ),
          ),
        ),
      );
      await load();
    } finally {
      setBusy(false);
      setDragSlug("");
    }
  };
  const renderGroup = (group: (typeof groups)[number], draggable = false) => (
    <div
      className="static-page-row"
      key={group.slug}
      draggable={draggable && !busy}
      onDragStart={() => setDragSlug(group.slug)}
      onDragOver={(event) => {
        if (draggable) event.preventDefault();
      }}
      onDrop={() => void reorderFooter(group.slug)}
    >
      {draggable ? (
        <button
          type="button"
          className="drag-handle"
          aria-label="Drag to reorder"
        >
          <AdminIcon name="gripVertical" />
        </button>
      ) : (
        <span className="drag-handle-placeholder" aria-hidden="true" />
      )}
      <button
        type="button"
        className="static-page-name"
        onClick={() =>
          navigate(`/static-pages/${encodeURIComponent(group.slug)}`)
        }
      >
        <b>{valueOf(group.primary.title)}</b>
        <small>/{group.slug}</small>
      </button>
      <span
        className={`table-badge status-${String(group.primary.status ?? "").toLowerCase()}`}
      >
        {valueOf(group.primary.status)}
      </span>
      <label className="static-footer-toggle">
        <input
          type="checkbox"
          role="switch"
          aria-label="In footer"
          checked={group.inFooter}
          disabled={busy}
          onChange={() => void toggleFooter(group)}
        />
        <span /> In footer
      </label>
      <button
        type="button"
        className="static-icon-button"
        aria-label="Edit page"
        onClick={() =>
          navigate(`/static-pages/${encodeURIComponent(group.slug)}`)
        }
      >
        <AdminIcon name="pencil" />
      </button>
      <button
        type="button"
        className="static-icon-button delete"
        aria-label="Delete page"
        onClick={() => void archive(group)}
      >
        <AdminIcon name="trash" />
      </button>
    </div>
  );
  const footerPages = groups.filter((group) => group.inFooter);
  const otherPages = groups.filter((group) => !group.inFooter);
  return (
    <>
      <header className="page-heading static-heading">
        <div>
          <h1>Static Pages</h1>
          <p>
            Manage legal, policy, and informational pages. Toggle In footer to
            show a page in the website footer, and drag to reorder footer links.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => navigate("/static-pages/create")}
        >
          <AdminIcon name="plus" /> New Page
        </button>
      </header>
      <div className="static-search">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages..."
        />
      </div>
      <section className="static-page-section">
        <header>
          <h2>Shown in footer</h2>
          <span>
            {footerPages.length} {footerPages.length === 1 ? "page" : "pages"}·
            drag to reorder
          </span>
        </header>
        <div>{footerPages.map((group) => renderGroup(group, true))}</div>
      </section>
      <section className="static-page-section">
        <header>
          <h2>Other pages</h2>
          <span>
            {otherPages.length} {otherPages.length === 1 ? "page" : "pages"}
          </span>
        </header>
        <div>{otherPages.map((group) => renderGroup(group))}</div>
      </section>
    </>
  );
}

function StaticPageEditor({
  rows,
  busy,
  onClose,
  onSaved,
}: {
  rows: RecordValue[];
  busy: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [locale, setLocale] = useState(String(rows[0]?.locale ?? "en"));
  const current = rows.find((row) => row.locale === locale) ?? rows[0];
  const [title, setTitle] = useState(String(current?.title ?? ""));
  const [slug, setSlug] = useState(String(current?.slug ?? ""));
  const [body, setBody] = useState(String(current?.body_html ?? ""));
  const [status, setStatus] = useState(
    String(current?.status ?? "DRAFT").toUpperCase(),
  );
  const pageMeta = (row: RecordValue | undefined) => {
    const next = { ...((row?.data ?? {}) as RecordValue) };
    if (next.inFooter === undefined)
      next.inFooter = ["terms-of-use", "privacy-policy"].includes(
        String(row?.slug ?? ""),
      );
    return next;
  };
  const [meta, setMeta] = useState<RecordValue>(() => pageMeta(current));
  const [saving, setSaving] = useState(false);
  const switchLocale = (next: string) => {
    const row = rows.find((item) => item.locale === next);
    setLocale(next);
    setTitle(String(row?.title ?? ""));
    setSlug(String(row?.slug ?? rows[0]?.slug ?? ""));
    setBody(String(row?.body_html ?? ""));
    setStatus(String(row?.status ?? "DRAFT").toUpperCase());
    setMeta(pageMeta(row));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const values = { locale, title, slug, body_html: body, status, meta };
    setSaving(true);
    try {
      if (current?.__new || !current?.id)
        await api.post("/admin/create/static-pages", { values });
      else
        await api.patch(
          `/admin/item/static-pages/${encodeURIComponent(String(current.id))}`,
          { values },
        );
      await onSaved();
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="article-editor-page" onSubmit={submit}>
      <header className="article-editor-heading">
        <button
          type="button"
          className="article-back"
          aria-label="Back"
          onClick={onClose}
        >
          <EditorIcon name="arrowLeft" />
        </button>
        <h1>{current?.__new ? "New Page" : "Edit Page"}</h1>
      </header>
      <div className="article-editor-grid">
        <section className="article-editor-main">
          <nav className="article-language-tabs">
            {[
              ["en", "English"],
              ["ru", "Russian"],
              ["es", "Spanish"],
            ].map(([code, name]) => (
              <button
                type="button"
                key={code}
                className={locale === code ? "active" : ""}
                onClick={() => switchLocale(code)}
              >
                {name}
              </button>
            ))}
          </nav>
          <label>
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Page title"
              required
            />
          </label>
          <label>
            Content
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Write page content..."
            />
          </label>
        </section>
        <aside className="article-editor-side">
          <section className="article-settings-card">
            <h3>Settings</h3>
            <label>
              Slug
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="page-slug"
                required
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <label>
              Sort Order
              <input
                type="number"
                value={String(meta.sortOrder ?? meta.sort_order ?? 0)}
                onChange={(event) =>
                  setMeta({
                    ...meta,
                    sortOrder: Number(event.target.value) || 0,
                  })
                }
              />
            </label>
            <label className="static-footer-check">
              <input
                type="checkbox"
                checked={Boolean(meta.inFooter)}
                onChange={(event) =>
                  setMeta({ ...meta, inFooter: event.target.checked })
                }
              />{" "}
              Show in Footer
            </label>
          </section>
          <section className="article-settings-card">
            <h3>SEO ({locale.toUpperCase()})</h3>
            <label>
              Meta Title
              <input
                maxLength={70}
                value={String(meta.metaTitle ?? meta.seoTitle ?? "")}
                onChange={(event) =>
                  setMeta({ ...meta, metaTitle: event.target.value })
                }
                placeholder="SEO title (max 70 chars)"
              />
              <small>
                {String(meta.metaTitle ?? meta.seoTitle ?? "").length}/70
              </small>
            </label>
            <label>
              Meta Description
              <textarea
                maxLength={160}
                rows={4}
                value={String(
                  meta.metaDescription ?? meta.seoDescription ?? "",
                )}
                onChange={(event) =>
                  setMeta({ ...meta, metaDescription: event.target.value })
                }
                placeholder="SEO description (max 160 chars)"
              />
              <small>
                {
                  String(meta.metaDescription ?? meta.seoDescription ?? "")
                    .length
                }
                /160
              </small>
            </label>
          </section>
          <div className="article-editor-actions static-editor-actions">
            <button
              className="primary"
              disabled={busy || saving || !title.trim() || !slug.trim()}
            >
              {saving ? "Saving…" : "Save Page"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}

function StaticPageRoute({ create = false }: { create?: boolean }) {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RecordValue[] | null>(
    create
      ? [
          {
            __new: true,
            locale: "en",
            slug: "",
            title: "",
            status: "DRAFT",
            data: {},
          },
        ]
      : null,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    if (create) return;
    api
      .get<ListResponse>("/admin/list/static-pages?limit=200&offset=0")
      .then((result) => {
        const matches = result.items.filter(
          (item) => String(item.slug ?? "") === decodeURIComponent(slug),
        );
        if (!matches.length) setError("Page not found.");
        else setRows(matches);
      })
      .catch(() => setError("Could not load this page."));
  }, [create, slug]);
  if (error) return <p className="error">{error}</p>;
  if (!rows) return <p className="loading-inline">Loading page…</p>;
  return (
    <StaticPageEditor
      rows={rows}
      busy={false}
      onClose={() => navigate("/static-pages")}
      onSaved={async () => navigate("/static-pages")}
    />
  );
}

function DeletionFeedback() {
  const [result, setResult] = useState<ListResponse | null>(null);
  const [days, setDays] = useState("30");
  useEffect(() => {
    api
      .get<ListResponse>("/admin/list/deletion-feedback?limit=200&offset=0")
      .then(setResult)
      .catch(() => setResult({ items: [], total: 0, limit: 200, offset: 0 }));
  }, []);
  const profileTypes: Array<[string, string]> = [
    ["GayCouple", "Gay Couple"],
    ["HeteroCouple", "Hetero Couple"],
    ["HeteroCoupleDonor", "Hetero Couple (Donor)"],
    ["LesbianCouple", "Lesbian Couple"],
    ["SingleMan", "Single Man"],
    ["SingleManDonor", "Single Man (Donor)"],
    ["SingleWoman", "Single Woman"],
    ["SingleWomanDonor", "Single Woman (Donor)"],
    ["Unknown", "Unknown"],
  ];
  const records = (result?.items ?? [])
    .map((row) => {
      const data = (
        row.data && typeof row.data === "object" ? row.data : {}
      ) as RecordValue;
      const values = (
        data.profileTypes && typeof data.profileTypes === "object"
          ? data.profileTypes
          : {}
      ) as RecordValue;
      return {
        row,
        data,
        reason: valueOf(data.reasonLabel ?? row.title ?? data.reason),
        count: Number(data.count ?? 1) || 0,
        values,
      };
    })
    .sort((a, b) => b.count - a.count);
  const total = records.reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(1, ...records.map((item) => item.count));
  const other = records.flatMap((item) => {
    const feedback =
      item.data.feedback ?? item.data.comment ?? item.data.details;
    return feedback
      ? [
          {
            text: valueOf(feedback),
            type: valueOf(item.data.profileType),
            locale: valueOf(item.row.locale ?? item.data.locale),
            date: compactDate(item.row.created_at),
          },
        ]
      : [];
  });
  return (
    <>
      <Link className="back" to="/users">
        <AdminIcon name="arrowLeft" /> Back to Users
      </Link>
      <header className="deletion-heading">
        <div>
          <h1>
            Deletion Feedback <span>({total})</span>
          </h1>
          <p>Why users delete their accounts.</p>
        </div>
        <select
          value={days}
          onChange={(event) => setDays(event.target.value)}
          aria-label="Feedback period"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </header>
      {!result ? (
        <p className="loading-inline">Loading…</p>
      ) : (
        <>
          <section className="deletion-card">
            <h3>Reasons</h3>
            <div className="deletion-bars" role="application">
              {records.map((item) => (
                <div key={String(item.row.id)}>
                  <span>{item.reason}</span>
                  <i>
                    <b
                      style={{
                        width: `${Math.max(2, (item.count / max) * 100)}%`,
                      }}
                    />
                  </i>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="deletion-card">
            <h3>Reason by profile type</h3>
            <div className="table deletion-matrix">
              <table>
                <thead>
                  <tr>
                    <th>Reason</th>
                    {profileTypes.map(([, title]) => (
                      <th key={title}>{title}</th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item) => (
                    <tr key={String(item.row.id)}>
                      <td>{item.reason}</td>
                      {profileTypes.map(([key]) => (
                        <td key={key}>
                          {Number(
                            item.values[key] ??
                              item.values[
                                key.replace(/([A-Z])/g, "_$1").toUpperCase()
                              ] ??
                              0,
                          )}
                        </td>
                      ))}
                      <td>{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="deletion-card">
            <h3>"Other" feedback</h3>
            {other.length ? (
              <div className="feedback-list">
                {other.map((item, index) => (
                  <article key={index}>
                    <p>{item.text}</p>
                    <div>
                      <span>{profileTypeLabel(item.type)}</span>
                      <span>{item.locale}</span>
                      <span>{item.date}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">No written feedback for this period.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}

function GenericList({ view }: { view: string }) {
  const location = useLocation();
  const isPartnerUsers =
    view === "users" && location.pathname.endsWith("/partners");
  const [result, setResult] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<Record<string, string>>(() =>
    isPartnerUsers
      ? ({ role: "PARTNER" } as Record<string, string>)
      : view === "users"
        ? ({ role: "USER" } as Record<string, string>)
        : ({} as Record<string, string>),
  );
  const [filterOptions, setFilterOptions] = useState<RecordValue>({});
  const [summaryCounts, setSummaryCounts] = useState<RecordValue>({});
  const [grantOpen, setGrantOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [grantUser, setGrantUser] = useState("");
  const [grantPlan, setGrantPlan] = useState("MONTHLY");
  const [grantDays, setGrantDays] = useState(30);
  const [editing, setEditing] = useState<RecordValue | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [subscriptionToRevoke, setSubscriptionToRevoke] =
    useState<RecordValue | null>(null);
  const [subscriptionReview, setSubscriptionReview] = useState<{
    row: RecordValue;
    status: "APPROVED" | "DECLINED";
  } | null>(null);
  const [userAction, setUserAction] = useState<{
    row: RecordValue;
    kind: "ban" | "delete";
  } | null>(null);
  const [openUserMenu, setOpenUserMenu] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const navigate = useNavigate();
  const limit =
    view === "articles"
      ? 100
      : ["users", "verifications", "clinics", "lawyers"].includes(view)
        ? 50
        : 25;
  useEffect(() => {
    const nextFilters: Record<string, string> = isPartnerUsers
      ? { role: "PARTNER" }
      : view === "users"
        ? { role: "USER" }
        : {};
    setFilters((current) => {
      const currentEntries = Object.entries(current);
      const nextEntries = Object.entries(nextFilters);
      return currentEntries.length === nextEntries.length &&
        nextEntries.every(([key, value]) => current[key] === value)
        ? current
        : nextFilters;
    });
    setQuery("");
    setOffset(0);
  }, [view, isPartnerUsers]);
  useEffect(() => {
    let live = true;
    api
      .get<RecordValue>("/admin/filter-options")
      .then((data) => live && setFilterOptions(data))
      .catch(() => live && setFilterOptions({}));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (view !== "subscriptions") return;
    api
      .get<RecordValue>("/admin/stats")
      .then((data) => setSummaryCounts((data.counts ?? {}) as RecordValue))
      .catch(() => setSummaryCounts({}));
  }, [view, refresh]);
  useEffect(() => {
    let live = true;
    setResult(null);
    setError("");
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (query.trim()) params.set("q", query.trim());
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    api
      .get<ListResponse>(`/admin/list/${view}?${params}`)
      .then((data) => live && setResult(data))
      .catch(() => live && setError("Could not load this section."));
    return () => {
      live = false;
    };
  }, [view, query, offset, filters, refresh]);
  const columns = useMemo(() => columnsByView[view] ?? [], [view]);
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(pageCount, Math.floor(offset / limit) + 1);
  const maxOffset = Math.max(0, (pageCount - 1) * limit);
  const usersPager =
    total > limit ? (
      <div className="users-pager">
        <span>
          Page {currentPage} of {pageCount}
        </span>
        <div>
          <button
            disabled={currentPage <= 1}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            <span aria-hidden="true">‹</span> Previous
          </button>
          <button
            disabled={currentPage >= pageCount}
            onClick={() => setOffset(Math.min(maxOffset, offset + limit))}
          >
            Next <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    ) : null;
  const optionsFor = (key: string): FilterOption[] => {
    const value = filterOptions[key];
    return Array.isArray(value)
      ? value.filter(
          (option): option is FilterOption =>
            Boolean(option) && typeof option === "object",
        )
      : [];
  };
  const statusOptions = optionsFor(
    view === "clinics"
      ? "clinicStatuses"
      : view === "lawyers"
        ? "lawyerStatuses"
        : view === "users" || view === "verifications"
          ? "profileStatuses"
          : "entityStatuses",
  );
  const countryOptions = optionsFor(
    view === "clinics"
      ? "clinicCountries"
      : view === "lawyers"
        ? "lawyerCountries"
        : "userCountries",
  );
  const profileTypeOptions = optionsFor("profileTypes");
  const choose = (row: RecordValue) => {
    const data = row.data as RecordValue | undefined;
    const userId = row.sourceId ?? row.profileId ?? row.profile_id ?? row.id;
    const linkedProfileId =
      row.profileSourceId ?? row.profileId ?? data?.profileId;
    const clinicId = data?.id ?? row.id;
    if (view === "users" && userId) navigate(`/users/${userId}`);
    if (
      (view === "subscriptions" || view === "verifications") &&
      linkedProfileId
    )
      navigate(`/users/${linkedProfileId}`);
    if (view === "clinics" && clinicId) navigate(`/clinics/${clinicId}`);
    if (view === "lawyers" && clinicId) navigate(`/lawyers/${clinicId}`);
    if (view === "articles" && row.id) navigate(`/articles/${row.id}`);
  };
  const visibleColumns = columns.length
    ? columns
    : Object.keys(items[0] ?? {}).slice(0, 6);
  const editable = ![
    "users",
    "clinics",
    "lawyers",
    "articles",
    "subscriptions",
    "verifications",
  ].includes(view);
  const creatable = [
    "articles",
    "static-pages",
    "marketing",
    "settings",
  ].includes(view);
  const hasRowAction = editable || view === "subscriptions" || view === "users";
  const itemId = (row: RecordValue) => row.id ?? row.entityId;
  const refreshList = () => {
    setOffset(0);
    setRefresh((value) => value + 1);
  };
  const saveRow = async (values: RecordValue) => {
    if (!editing) return;
    setSaving(true);
    try {
      if (editing.__new) await api.post(`/admin/create/${view}`, { values });
      else if (itemId(editing) !== undefined)
        await api.patch(
          `/admin/item/${view}/${encodeURIComponent(String(itemId(editing)))}`,
          { values },
        );
      else return;
      setEditing(null);
      refreshList();
    } catch {
      setError("Could not save this record.");
    } finally {
      setSaving(false);
    }
  };
  const removeRow = async () => {
    if (!editing || itemId(editing) === undefined) return;
    setSaving(true);
    try {
      await api.delete(
        `/admin/item/${view}/${encodeURIComponent(String(itemId(editing)))}`,
      );
      setConfirmArchive(false);
      setEditing(null);
      refreshList();
    } catch {
      setError("Could not archive this record.");
    } finally {
      setSaving(false);
    }
  };
  const revokeSubscription = async () => {
    const subscriptionId = subscriptionToRevoke && itemId(subscriptionToRevoke);
    if (subscriptionId === undefined || subscriptionId === null) return;
    setSaving(true);
    try {
      await api.post(
        `/admin/subscriptions/${encodeURIComponent(String(subscriptionId))}/revoke`,
        {},
      );
      setSubscriptionToRevoke(null);
      refreshList();
    } catch {
      setError("Could not revoke Premium.");
    } finally {
      setSaving(false);
    }
  };
  const grantSubscription = async (event: FormEvent) => {
    event.preventDefault();
    if (!grantUser.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.post("/admin/subscriptions/grant", {
        profileRef: grantUser.trim(),
        plan: grantPlan,
        days: grantDays,
      });
      setGrantOpen(false);
      setGrantUser("");
      refreshList();
    } catch {
      setError("Could not grant Premium. Verify the user and try again.");
    } finally {
      setSaving(false);
    }
  };
  const reviewSubscription = async () => {
    if (!subscriptionReview) return;
    const subscriptionId = itemId(subscriptionReview.row);
    if (subscriptionId === undefined || subscriptionId === null) return;
    setSaving(true);
    try {
      await api.post(
        `/admin/subscriptions/${encodeURIComponent(String(subscriptionId))}/review`,
        { status: subscriptionReview.status },
      );
      setSubscriptionReview(null);
      refreshList();
    } catch {
      setError(
        subscriptionReview.status === "APPROVED"
          ? "Could not approve Premium. Verify the profile first."
          : "Could not decline this request.",
      );
    } finally {
      setSaving(false);
    }
  };
  const runUserAction = async (values: RecordValue) => {
    if (!userAction) return;
    const profileRef =
      userAction.row.profileId ??
      userAction.row.profile_id ??
      userAction.row.id;
    if (profileRef === undefined || profileRef === null) return;
    setSaving(true);
    try {
      if (userAction.kind === "delete")
        await api.delete(
          `/admin/item/users/${encodeURIComponent(String(profileRef))}`,
        );
      else {
        const data = (
          userAction.row.data && typeof userAction.row.data === "object"
            ? userAction.row.data
            : {}
        ) as RecordValue;
        await api.patch(
          `/admin/item/users/${encodeURIComponent(String(profileRef))}`,
          {
            values: {
              status: "BANNED",
              data: {
                ...data,
                banReason: values.reason,
                banDetails: values.details,
                bannedAt: new Date().toISOString(),
              },
            },
          },
        );
      }
      setUserAction(null);
      setOpenUserMenu(null);
      refreshList();
    } catch {
      setError(
        userAction.kind === "delete"
          ? "Could not permanently delete this user."
          : "Could not ban this user.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (view === "articles" && editing) {
    return (
      <ArticleEditor
        row={editing}
        busy={saving}
        onClose={() => setEditing(null)}
        onSave={saveRow}
      />
    );
  }
  return (
    <>
      <header className="page-heading">
        <h1>
          {label(view)}{" "}
          {!["subscriptions", "articles"].includes(view) && result ? (
            <span>({total})</span>
          ) : (
            ""
          )}
        </h1>
        <div className="page-actions">
          {view === "subscriptions" && (
            <button
              className="primary grant-premium-button"
              onClick={() => setGrantOpen(true)}
            >
              <AdminIcon name="crown" /> Grant Premium
            </button>
          )}
          {view === "articles" && (
            <button
              className="secondary-button categories-button"
              type="button"
              onClick={() => setCategoriesOpen(true)}
            >
              <AdminIcon name="file" /> Categories
            </button>
          )}
          {view === "users" && (
            <Link className="secondary-button" to="/users/deletion-feedback">
              <AdminIcon name="file" /> Deletion feedback
            </Link>
          )}
          {creatable && (
            <button
              className="primary"
              onClick={() => {
                if (view === "articles") {
                  navigate("/articles/new");
                  return;
                }
                setEditing({
                  __new: true,
                  title: "",
                  status:
                    view === "articles" || view === "static-pages"
                      ? "DRAFT"
                      : "ACTIVE",
                  locale: "en",
                  slug: "",
                  data: {},
                });
              }}
            >
              New {label(view).replace(/s$/, "")}
            </button>
          )}
        </div>
      </header>
      {view === "subscriptions" && (
        <section className="metric-grid metric-grid-four subscription-summary">
          <MetricCard
            title="Total Premium"
            value={summaryCounts.active_subscriptions}
            hint={`${valueOf(summaryCounts.active_subscriptions && total ? Math.round((Number(summaryCounts.active_subscriptions) / Math.max(1, Number(summaryCounts.profiles ?? total))) * 1000) / 10 : 0)}% conversion rate`}
            icon="crown"
          />
          <MetricCard
            title="Manual Grants"
            value={summaryCounts.manual_subscriptions}
            hint={`${valueOf(summaryCounts.manual_subscriptions_30d)} in last 30 days`}
            icon="userCheck"
          />
          <MetricCard
            title="App Store"
            value={summaryCounts.app_store_subscriptions}
            icon="phone"
          />
          <MetricCard
            title="Play Store"
            value={summaryCounts.play_store_subscriptions}
            icon="drive"
          />
        </section>
      )}
      {view === "users" && (
        <nav className="member-tabs">
          <NavLink to="/users" end>
            Users
          </NavLink>
          <NavLink to="/users/partners">Partners</NavLink>
        </nav>
      )}
      <section
        className={`list-controls ${view === "users" ? "user-list-controls" : view === "subscriptions" ? "subscription-list-controls" : view === "verifications" ? "verification-list-controls" : ["clinics", "lawyers"].includes(view) ? "directory-list-controls" : view === "articles" ? "article-list-controls" : ""}`}
      >
        <input
          value={query}
          onChange={(event) => {
            setOffset(0);
            setQuery(event.target.value);
          }}
          placeholder={
            view === "users"
              ? "Search by email, name or ID..."
              : view === "subscriptions"
                ? "Search by email or name..."
                : view === "verifications"
                  ? "Search by name or email..."
                  : `Search ${label(view).toLowerCase()}...`
          }
        />
        {view === "articles" && (
          <div className="status-segments">
            {["", "DRAFT", "PUBLISHED", "ARCHIVED"].map((status) => (
              <button
                type="button"
                className={(filters.status ?? "") === status ? "active" : ""}
                key={status || "all"}
                onClick={() => {
                  setOffset(0);
                  setFilters((current) => ({ ...current, status }));
                }}
              >
                {status ? statusLabel(status) : "All"}
              </button>
            ))}
          </div>
        )}
        {[
          "users",
          "clinics",
          "lawyers",
          "subscriptions",
          "verifications",
        ].includes(view) && (
          <div className="filter-row">
            {["clinics", "lawyers", "verifications"].includes(view) && (
              <select
                value={filters.status ?? ""}
                onChange={(event) => {
                  setOffset(0);
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }));
                }}
              >
                <option value="">All statuses</option>
                {(view === "verifications"
                  ? [
                      "PENDING",
                      "APPROVED",
                      "DECLINED",
                      "ABANDONED",
                      "EXPIRED",
                    ].map((value) => ({ value }))
                  : statusOptions
                ).map((option) => {
                  const value = String(option.value ?? "");
                  return value ? (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ) : null;
                })}
              </select>
            )}
            {["clinics", "lawyers"].includes(view) && (
              <>
                <select
                  value={filters.country ?? ""}
                  onChange={(event) => {
                    setOffset(0);
                    setFilters((current) => ({
                      ...current,
                      country: event.target.value,
                    }));
                  }}
                >
                  <option value="">All countries</option>
                  {countryOptions.map((option) => {
                    const value = String(option.value ?? "");
                    return value ? (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ) : null;
                  })}
                </select>
                {view === "clinics" && (
                  <>
                    <select
                      value={filters.hasWebsite ?? ""}
                      onChange={(event) => {
                        setOffset(0);
                        setFilters((current) => ({
                          ...current,
                          hasWebsite: event.target.value,
                        }));
                      }}
                    >
                      <option value="">Website: Any</option>
                      <option value="true">Website: Yes</option>
                      <option value="false">Website: No</option>
                    </select>
                    <select
                      value={filters.hasLogo ?? ""}
                      onChange={(event) => {
                        setOffset(0);
                        setFilters((current) => ({
                          ...current,
                          hasLogo: event.target.value,
                        }));
                      }}
                    >
                      <option value="">Logo: Any</option>
                      <option value="true">Logo: Yes</option>
                      <option value="false">Logo: No</option>
                    </select>
                  </>
                )}
              </>
            )}
            {view === "users" && (
              <>
                <select
                  value={filters.profileType ?? ""}
                  onChange={(event) => {
                    setOffset(0);
                    setFilters((current) => ({
                      ...current,
                      profileType: event.target.value,
                    }));
                  }}
                >
                  <option value="">All Types</option>
                  {profileTypeOptions.map((option) => {
                    const value = String(option.value ?? "");
                    return value ? (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ) : null;
                  })}
                </select>
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={filters.isDonor === "true"}
                    onChange={(event) => {
                      setOffset(0);
                      setFilters((current) => ({
                        ...current,
                        isDonor: event.target.checked ? "true" : "",
                      }));
                    }}
                  />
                  Donors
                </label>
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={filters.seeksCoParent === "true"}
                    onChange={(event) => {
                      setOffset(0);
                      setFilters((current) => ({
                        ...current,
                        seeksCoParent: event.target.checked ? "true" : "",
                      }));
                    }}
                  />
                  Co-parenting
                </label>
                <select
                  value={filters.country ?? ""}
                  onChange={(event) => {
                    setOffset(0);
                    setFilters((current) => ({
                      ...current,
                      country: event.target.value,
                    }));
                  }}
                >
                  <option value="">All countries</option>
                  {countryOptions.map((option) => {
                    const value = String(option.value ?? "");
                    return value ? (
                      <option key={value} value={value}>
                        {valueOf(option.label ?? value)}
                      </option>
                    ) : null;
                  })}
                </select>
                <input
                  value={filters.city ?? ""}
                  onChange={(event) => {
                    setOffset(0);
                    setFilters((current) => ({
                      ...current,
                      city: event.target.value,
                    }));
                  }}
                  placeholder="Filter by city…"
                />
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={filters.isOnline === "true"}
                    onChange={(event) => {
                      setOffset(0);
                      setFilters((current) => ({
                        ...current,
                        isOnline: event.target.checked ? "true" : "",
                      }));
                    }}
                  />
                  Online
                </label>
                <select
                  value={filters.mismatch ?? "off"}
                  onChange={(event) => {
                    setOffset(0);
                    setFilters((current) => ({
                      ...current,
                      mismatch: event.target.value,
                    }));
                  }}
                >
                  <option value="off">Mismatch: Off</option>
                  <option value="on">Mismatch: On</option>
                </select>
                <select
                  value={filters.orderBy ?? "newest"}
                  onChange={(event) => {
                    setOffset(0);
                    setFilters((current) => ({
                      ...current,
                      orderBy: event.target.value,
                    }));
                  }}
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="oldest">Sort: Oldest</option>
                </select>
              </>
            )}
            {view === "subscriptions" && (
              <>
                <select
                  value={filters.plan ?? ""}
                  onChange={(event) => {
                    setOffset(0);
                    setFilters((current) => ({
                      ...current,
                      plan: event.target.value,
                    }));
                  }}
                >
                  <option value="">All Premium</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
                <select
                  value={filters.status ?? ""}
                  onChange={(event) => {
                    setOffset(0);
                    setFilters((current) => ({
                      ...current,
                      status: event.target.value,
                    }));
                  }}
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PENDING">Pending</option>
                  <option value="EXPIRED">Expired</option>
                </select>
                <select
                  value={filters.source ?? ""}
                  onChange={(event) => {
                    setOffset(0);
                    setFilters((current) => ({
                      ...current,
                      source: event.target.value,
                    }));
                  }}
                >
                  <option value="">All Sources</option>
                  <option value="APP_STORE">App Store</option>
                  <option value="PLAY_STORE">Play Store</option>
                  <option value="MANUAL_REVIEW">Manual</option>
                </select>
              </>
            )}
          </div>
        )}
      </section>
      {["static-pages", "marketing"].includes(view) && (
        <section className="list-controls">
          <select
            value={filters.status ?? ""}
            onChange={(event) => {
              setOffset(0);
              setFilters((current) => ({
                ...current,
                status: event.target.value,
              }));
            }}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="SENDING">Sending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </section>
      )}
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <>
          {total > limit &&
            (view === "users" ? (
              usersPager
            ) : (
              <div className="pager">
                <button
                  disabled={!offset}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  disabled={offset >= maxOffset}
                  onClick={() => setOffset(Math.min(maxOffset, offset + limit))}
                >
                  Next
                </button>
              </div>
            ))}
          <div className={`table ${view === "users" ? "users-table" : ""}`}>
            {result === null ? (
              <p className="loading-inline">Loading…</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    {visibleColumns.map((column) => (
                      <th key={column}>{columnLabel(view, column)}</th>
                    ))}
                    {hasRowAction && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, index) => {
                    const rowKey = String(
                      row.profileId ?? row.profile_id ?? row.id ?? index,
                    );
                    return (
                      <tr
                        key={rowKey}
                        onClick={() => choose(row)}
                        className={
                          view === "users" ||
                          view === "subscriptions" ||
                          view === "verifications" ||
                          view === "clinics" ||
                          view === "lawyers" ||
                          view === "articles"
                            ? "clickable"
                            : ""
                        }
                      >
                        {visibleColumns.map((column) => (
                          <td key={column}>
                            {view === "articles" && column === "title" ? (
                              <div className="article-title-cell">
                                <b>{valueOf(row.title)}</b>
                                <small>{valueOf(row.slug)}</small>
                              </div>
                            ) : view === "articles" && column === "category" ? (
                              <span className="category-badge">
                                {articleCategory(row)}
                              </span>
                            ) : view === "articles" && column === "views" ? (
                              valueOf(
                                (row.data as RecordValue | undefined)?.views ??
                                  0,
                              )
                            ) : column === "location" ? (
                              (view === "users"
                                ? [userCountryName(row.country), row.city]
                                : [row.city, countryName(row.country)]
                              )
                                .filter(Boolean)
                                .map(valueOf)
                                .join(", ") || "—"
                            ) : column === "partner" ? (
                              valueOf(row.partnerName ?? row.partner)
                            ) : column === "services" ? (
                              valueOf(row.servicesCount ?? row.services)
                            ) : column === "practiceAreas" ? (
                              Array.isArray(row[column]) ? (
                                (row[column] as unknown[]).length
                              ) : (
                                valueOf(row.practiceAreasCount ?? row[column])
                              )
                            ) : view === "users" && column === "profileType" ? (
                              <span className="user-type-cell">
                                {profileTypeLabel(row[column])}
                                {isDonorProfile(row) && (
                                  <em className="donor-badge" title="Donor">
                                    D
                                  </em>
                                )}
                              </span>
                            ) : view === "users" && column === "source" ? (
                              <span
                                className={`source-badge ${registrationSourceClass(row[column])}`}
                              >
                                {registrationSourceLabel(row[column])}
                              </span>
                            ) : column === "status" ||
                              column === "verificationStatus" ? (
                              <span
                                className={`table-badge status-${String(row[column] ?? "").toLowerCase()}`}
                              >
                                {valueOf(row[column])}
                              </span>
                            ) : column.toLowerCase().includes("created") ||
                              column.toLowerCase().includes("completed") ? (
                              view === "verifications" ? (
                                verificationDate(row[column] ?? row.created_at)
                              ) : view === "users" ? (
                                compactDate(
                                  row[column] ?? row.created_at,
                                ).replaceAll("/", ".")
                              ) : (
                                compactDate(row[column] ?? row.created_at)
                              )
                            ) : view === "articles" &&
                              column === "updated_at" ? (
                              articleDate(row[column])
                            ) : ["displayName", "profileName", "name"].includes(
                                column,
                              ) ? (
                              <div className="person-cell">
                                <span className="person-avatar">
                                  <i>
                                    {rowName(row).slice(0, 1).toUpperCase()}
                                  </i>
                                  {Boolean(
                                    row.avatarUrl ||
                                      row.logoUrl ||
                                      row.photoUrl,
                                  ) && (
                                    <img
                                      src={String(
                                        row.avatarUrl ??
                                          row.logoUrl ??
                                          row.photoUrl,
                                      )}
                                      alt=""
                                      onError={(event) =>
                                        event.currentTarget.remove()
                                      }
                                    />
                                  )}
                                </span>
                                <span>
                                  <span className="person-name-line">
                                    <b>{rowName(row)}</b>
                                    {view === "users" &&
                                      isDonorProfile(row) && (
                                        <em
                                          className="donor-badge"
                                          title="Donor"
                                        >
                                          D
                                        </em>
                                      )}
                                  </span>
                                  <small>
                                    {valueOf(
                                      row.email ?? row.profileEmail ?? row.slug,
                                    )}
                                  </small>
                                </span>
                              </div>
                            ) : (
                              valueOf(row[column])
                            )}
                          </td>
                        ))}
                        {hasRowAction && (
                          <td>
                            {view === "users" ? (
                              <span className="row-menu-wrap">
                                <button
                                  className="row-action row-menu-button"
                                  aria-label="User actions"
                                  aria-expanded={openUserMenu === rowKey}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenUserMenu((current) =>
                                      current === rowKey ? null : rowKey,
                                    );
                                  }}
                                >
                                  •••
                                </button>
                                {openUserMenu === rowKey && (
                                  <span
                                    className="row-menu"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <button
                                      className="danger-text"
                                      onClick={() =>
                                        setUserAction({ row, kind: "ban" })
                                      }
                                    >
                                      Ban
                                    </button>
                                    <button
                                      className="danger-text"
                                      onClick={() =>
                                        setUserAction({ row, kind: "delete" })
                                      }
                                    >
                                      Permanent Delete
                                    </button>
                                  </span>
                                )}
                              </span>
                            ) : view === "subscriptions" ? (
                              <span className="row-menu-wrap">
                                <button
                                  className="row-action row-menu-button"
                                  aria-label="Subscription actions"
                                  aria-expanded={openUserMenu === rowKey}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenUserMenu((current) =>
                                      current === rowKey ? null : rowKey,
                                    );
                                  }}
                                >
                                  •••
                                </button>
                                {openUserMenu === rowKey && (
                                  <span
                                    className="row-menu"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {String(row.status ?? "").toUpperCase() ===
                                      "PENDING" && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setOpenUserMenu(null);
                                            setSubscriptionReview({
                                              row,
                                              status: "APPROVED",
                                            });
                                          }}
                                        >
                                          Approve
                                        </button>
                                        <button
                                          onClick={() => {
                                            setOpenUserMenu(null);
                                            setSubscriptionReview({
                                              row,
                                              status: "DECLINED",
                                            });
                                          }}
                                        >
                                          Decline
                                        </button>
                                      </>
                                    )}
                                    <button
                                      className="danger-text"
                                      onClick={() => {
                                        setOpenUserMenu(null);
                                        setSubscriptionToRevoke(row);
                                      }}
                                    >
                                      Revoke Premium
                                    </button>
                                  </span>
                                )}
                              </span>
                            ) : (
                              <button
                                className="row-action"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditing(row);
                                }}
                              >
                                Manage
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {!items.length && (
                    <tr>
                      <td
                        colSpan={Math.max(
                          1,
                          visibleColumns.length + (hasRowAction ? 1 : 0),
                        )}
                        className="empty"
                      >
                        No records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
          {view === "users" && usersPager}
        </>
      )}
      {grantOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal grant-modal" onSubmit={grantSubscription}>
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setGrantOpen(false)}
            >
              <AdminIcon name="x" />
            </button>
            <h2>
              <AdminIcon name="crown" /> Grant Premium
            </h2>
            <label>
              User
              <input
                value={grantUser}
                onChange={(event) => setGrantUser(event.target.value)}
                placeholder="Search by email or name..."
                required
              />
            </label>
            <label>
              Plan
              <select
                value={grantPlan}
                onChange={(event) => setGrantPlan(event.target.value)}
              >
                <option value="MONTHLY">Premium Monthly</option>
                <option value="QUARTERLY">Premium Quarterly</option>
                <option value="ANNUAL">Premium Annual</option>
              </select>
            </label>
            <label>
              Duration (days)
              <input
                type="number"
                min={1}
                max={3650}
                value={grantDays}
                onChange={(event) =>
                  setGrantDays(Number(event.target.value) || 30)
                }
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setGrantOpen(false)}>
                Cancel
              </button>
              <button className="primary" disabled={saving}>
                {saving ? "Working…" : "Grant Premium"}
              </button>
            </div>
          </form>
        </div>
      )}
      <EntityModal
        row={editing}
        title={label(view)}
        busy={saving}
        onClose={() => setEditing(null)}
        onSave={saveRow}
        onDelete={() => setConfirmArchive(true)}
      />
      {view === "articles" && (
        <CategoryManager
          open={categoriesOpen}
          onClose={() => setCategoriesOpen(false)}
        />
      )}
      <ConfirmModal
        open={confirmArchive}
        title={`Archive ${label(view)}`}
        message="This record will be archived and no longer shown in active lists."
        confirmLabel="Archive"
        busy={saving}
        onClose={() => setConfirmArchive(false)}
        onConfirm={removeRow}
      />
      <ConfirmModal
        open={Boolean(subscriptionReview)}
        title={
          subscriptionReview?.status === "APPROVED"
            ? "Approve Premium"
            : "Decline Premium"
        }
        message={
          subscriptionReview?.status === "APPROVED"
            ? `Approve Premium for ${rowName(subscriptionReview?.row ?? {})}? The profile must already be verified.`
            : `Decline the Premium request from ${rowName(subscriptionReview?.row ?? {})}?`
        }
        confirmLabel={
          subscriptionReview?.status === "APPROVED"
            ? "Approve Premium"
            : "Decline Premium"
        }
        busy={saving}
        onClose={() => setSubscriptionReview(null)}
        onConfirm={reviewSubscription}
      />
      <ConfirmModal
        open={Boolean(subscriptionToRevoke)}
        title="Revoke Premium"
        message={`Premium access for ${rowName(subscriptionToRevoke ?? {})} will be cancelled. The user will lose Premium access immediately.`}
        confirmLabel="Revoke Premium"
        busy={saving}
        onClose={() => setSubscriptionToRevoke(null)}
        onConfirm={revokeSubscription}
      />
      <ActionModal
        state={
          userAction
            ? {
                kind: userAction.kind,
                title:
                  userAction.kind === "ban"
                    ? "Ban user"
                    : "Permanently Delete User",
              }
            : null
        }
        onClose={() => {
          setUserAction(null);
          setOpenUserMenu(null);
        }}
        onConfirm={runUserAction}
      />
    </>
  );
}

function ArticlesList({ view }: { view: "articles" | "categories" }) {
  return view === "categories" ? (
    <Navigate to="/articles" replace />
  ) : (
    <GenericList view={view} />
  );
}

function ArticleRoute({ create = false }: { create?: boolean }) {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState<RecordValue | null>(
    create
      ? {
          __new: true,
          locale: "en",
          slug: "",
          title: "",
          excerpt: "",
          body_html: "",
          status: "DRAFT",
          data: {},
        }
      : null,
  );
  const [translations, setTranslations] = useState<RecordValue[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (create) return;
    api
      .get<ListResponse>("/admin/list/articles?limit=200&offset=0")
      .then((result) => {
        const match = result.items.find((item) => String(item.id ?? "") === id);
        if (match) {
          setRow(match);
          setTranslations(
            result.items.filter(
              (item) => String(item.slug ?? "") === String(match.slug ?? ""),
            ),
          );
        } else setError("Article not found.");
      })
      .catch(() => setError("Could not load this article."));
  }, [create, id]);
  const save = async (values: RecordValue) => {
    setBusy(true);
    try {
      const existing = translations.find(
        (item) => String(item.locale ?? "en") === String(values.locale ?? "en"),
      );
      if (create || !existing?.id)
        await api.post("/admin/create/articles", { values });
      else
        await api.patch(
          `/admin/item/articles/${encodeURIComponent(String(existing.id))}`,
          { values },
        );
      navigate("/articles");
    } finally {
      setBusy(false);
    }
  };
  if (error) return <p className="error">{error}</p>;
  if (!row) return <p className="loading-inline">Loading article…</p>;
  return (
    <ArticleEditor
      row={row}
      translations={translations}
      busy={busy}
      onClose={() => navigate("/articles")}
      onSave={save}
    />
  );
}

function CategoryManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<RecordValue[]>([]);
  const [nameEn, setNameEn] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [slug, setSlug] = useState("");
  const [editing, setEditing] = useState<RecordValue | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api
      .get<ListResponse>("/admin/list/categories?limit=100&offset=0")
      .then((data) => setItems(data.items));
  useEffect(() => {
    if (open) void load();
  }, [open]);
  if (!open) return null;
  const fields = (row: RecordValue) => {
    const data = (
      row.data && typeof row.data === "object" ? row.data : row
    ) as RecordValue;
    const translations = Array.isArray(data.translations)
      ? (data.translations as RecordValue[])
      : [];
    return {
      data,
      en: valueOf(
        translations.find((item) => item.locale === "en")?.name ??
          data.name ??
          row.title,
      ),
      ru: valueOf(
        translations.find((item) => item.locale === "ru")?.name ?? "",
      ),
      slug: valueOf(data.slug ?? row.slug ?? row.title),
    };
  };
  const reset = () => {
    setEditing(null);
    setNameEn("");
    setNameRu("");
    setSlug("");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!nameEn.trim() || !slug.trim()) return;
    setBusy(true);
    const original = editing ? fields(editing).data : {};
    const values = {
      title: nameEn.trim(),
      slug: slug.trim(),
      status: "active",
      locale: "en",
      data: {
        ...original,
        name: nameEn.trim(),
        slug: slug.trim(),
        isActive: true,
        translations: [
          { locale: "en", name: nameEn.trim() },
          ...(nameRu.trim() ? [{ locale: "ru", name: nameRu.trim() }] : []),
        ],
      },
    };
    try {
      if (editing)
        await api.patch(
          `/admin/item/categories/${encodeURIComponent(String(editing.id))}`,
          { values },
        );
      else await api.post("/admin/create/categories", { values });
      reset();
      await load();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop category-backdrop" role="presentation">
      <section
        className="modal category-manager"
        role="dialog"
        aria-modal="true"
        aria-label="Manage Categories"
      >
        <h2>Manage Categories</h2>
        <form className="category-add-row" onSubmit={save}>
          <label>
            Name (EN)
            <input
              value={nameEn}
              onChange={(event) => setNameEn(event.target.value)}
              placeholder="Category name"
            />
          </label>
          <label>
            Name (RU)
            <input
              value={nameRu}
              onChange={(event) => setNameRu(event.target.value)}
              placeholder="Название категории"
            />
          </label>
          <label>
            Slug
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="category-slug"
            />
          </label>
          <button
            className="primary"
            disabled={busy || !nameEn.trim() || !slug.trim()}
          >
            {editing ? "Save" : "Add"}
          </button>
        </form>
        <div className="category-list">
          {items.map((item) => {
            const data = fields(item);
            return (
              <div className="category-row" key={String(item.id)}>
                <span>
                  <b>{data.en}</b>
                  <small>{data.slug}</small>
                </span>
                <div>
                  <button
                    type="button"
                    aria-label={`Edit ${data.en}`}
                    onClick={() => {
                      setEditing(item);
                      setNameEn(data.en === "—" ? "" : data.en);
                      setNameRu(data.ru === "—" ? "" : data.ru);
                      setSlug(data.slug === "—" ? "" : data.slug);
                    }}
                  >
                    <AdminIcon name="pencil" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${data.en}`}
                    onClick={async () => {
                      if (!window.confirm(`Archive ${data.en}?`)) return;
                      await api.delete(
                        `/admin/item/categories/${encodeURIComponent(String(item.id))}`,
                      );
                      await load();
                    }}
                  >
                    <AdminIcon name="trash" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="category-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

function ArticleEditor({
  row,
  translations = [],
  busy,
  onClose,
  onSave,
}: {
  row: RecordValue;
  translations?: RecordValue[];
  busy: boolean;
  onClose: () => void;
  onSave: (values: RecordValue) => Promise<void>;
}) {
  const initialMeta = (
    row.data && typeof row.data === "object" ? row.data : {}
  ) as RecordValue;
  const [locale, setLocale] = useState(String(row.locale ?? "en"));
  const [title, setTitle] = useState(String(row.title ?? ""));
  const [excerpt, setExcerpt] = useState(String(row.excerpt ?? ""));
  const [body, setBody] = useState(String(row.body_html ?? ""));
  const [slug, setSlug] = useState(String(row.slug ?? ""));
  const [status, setStatus] = useState(
    String(row.status ?? "DRAFT").toUpperCase(),
  );
  const [coverUrl, setCoverUrl] = useState(String(row.cover_url ?? ""));
  const [tags, setTags] = useState(
    Array.isArray(initialMeta.tags)
      ? (initialMeta.tags as unknown[]).join(", ")
      : String(initialMeta.tags ?? ""),
  );
  const [metaTitle, setMetaTitle] = useState(
    String(initialMeta.metaTitle ?? initialMeta.seoTitle ?? ""),
  );
  const [metaDescription, setMetaDescription] = useState(
    String(initialMeta.metaDescription ?? initialMeta.seoDescription ?? ""),
  );
  const [ogImage, setOgImage] = useState(String(initialMeta.ogImage ?? ""));
  const [category, setCategory] = useState<RecordValue | null>(
    initialMeta.category && typeof initialMeta.category === "object"
      ? (initialMeta.category as RecordValue)
      : null,
  );
  const [categories, setCategories] = useState<RecordValue[]>([]);
  useEffect(() => {
    api
      .get<ListResponse>("/admin/list/categories?limit=100&offset=0")
      .then((data) => setCategories(data.items))
      .catch(() => setCategories([]));
  }, []);
  const switchLocale = (next: string) => {
    const translated = translations.find(
      (item) => String(item.locale ?? "en") === next,
    );
    const translatedMeta = (
      translated?.data && typeof translated.data === "object"
        ? translated.data
        : {}
    ) as RecordValue;
    setLocale(next);
    setTitle(String(translated?.title ?? ""));
    setExcerpt(String(translated?.excerpt ?? ""));
    setBody(String(translated?.body_html ?? ""));
    setSlug(String(translated?.slug ?? row.slug ?? ""));
    setStatus(
      String(translated?.status ?? row.status ?? "DRAFT").toUpperCase(),
    );
    setCoverUrl(String(translated?.cover_url ?? row.cover_url ?? ""));
    setTags(
      Array.isArray(translatedMeta.tags)
        ? (translatedMeta.tags as unknown[]).join(", ")
        : String(translatedMeta.tags ?? ""),
    );
    setMetaTitle(
      String(translatedMeta.metaTitle ?? translatedMeta.seoTitle ?? ""),
    );
    setMetaDescription(
      String(
        translatedMeta.metaDescription ?? translatedMeta.seoDescription ?? "",
      ),
    );
    setOgImage(String(translatedMeta.ogImage ?? ""));
    setCategory(
      translatedMeta.category && typeof translatedMeta.category === "object"
        ? (translatedMeta.category as RecordValue)
        : null,
    );
  };
  const categoryId = String(
    category?.id ?? category?.sourceId ?? category?.slug ?? "",
  );
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const meta: RecordValue = {
      ...initialMeta,
      category,
      tags: tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      metaTitle,
      metaDescription,
      ogImage,
    };
    await onSave({
      locale,
      title,
      excerpt,
      body_html: body,
      slug,
      cover_url: coverUrl,
      status,
      meta,
    });
  };
  return (
    <form className="article-editor-page" onSubmit={submit}>
      <header className="article-editor-heading">
        <button
          type="button"
          className="article-back"
          aria-label="Back"
          onClick={onClose}
        >
          <EditorIcon name="arrowLeft" />
        </button>
        <h1>{row.__new ? "New Article" : "Edit Article"}</h1>
      </header>
      <div className="article-editor-grid">
        <section className="article-editor-main">
          <nav className="article-language-tabs">
            {[
              ["en", "English"],
              ["ru", "Russian"],
              ["es", "Spanish"],
            ].map(([code, name]) => (
              <button
                type="button"
                key={code}
                className={locale === code ? "active" : ""}
                onClick={() => switchLocale(code)}
              >
                {name}
              </button>
            ))}
          </nav>
          <label>
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Article title"
              required
            />
          </label>
          <label>
            Excerpt
            <textarea
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              placeholder="Short description..."
              rows={3}
            />
          </label>
          <label>
            Content
            <RichTextEditor
              value={body}
              onChange={setBody}
              placeholder="Write your article..."
            />
          </label>
          <label>
            Cover Image
            <div className="cover-picker">
              <input
                value={coverUrl}
                onChange={(event) => setCoverUrl(event.target.value)}
                placeholder="Image URL"
              />
              <input
                type="file"
                accept="image/*"
                aria-label="Choose File"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () =>
                    setCoverUrl(String(reader.result ?? ""));
                  reader.readAsDataURL(file);
                }}
              />
            </div>
          </label>
        </section>
        <aside className="article-editor-side">
          <section className="article-settings-card">
            <h3>Settings</h3>
            <label>
              Slug
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="article-slug"
                required
              />
            </label>
            <label>
              Category
              <select
                value={categoryId}
                onChange={(event) => {
                  const next =
                    categories.find(
                      (item) =>
                        String(item.id ?? item.sourceId ?? item.slug ?? "") ===
                        event.target.value,
                    ) ?? null;
                  setCategory(
                    next
                      ? ((next.data && typeof next.data === "object"
                          ? next.data
                          : next) as RecordValue)
                      : null,
                  );
                }}
              >
                <option value="">Select category</option>
                {categories.map((item, index) => {
                  const data = (
                    item.data && typeof item.data === "object"
                      ? item.data
                      : item
                  ) as RecordValue;
                  const id = String(data.id ?? item.id ?? data.slug ?? index);
                  return (
                    <option value={id} key={id}>
                      {valueOf(data.name ?? item.title ?? data.slug)}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Tags
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="Type tag and press Enter..."
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
          </section>
          <section className="article-settings-card">
            <h3>SEO ({locale.toUpperCase()})</h3>
            <label>
              Meta Title
              <input
                maxLength={70}
                value={metaTitle}
                onChange={(event) => setMetaTitle(event.target.value)}
                placeholder="SEO title (max 70 chars)"
              />
              <small>{metaTitle.length}/70</small>
            </label>
            <label>
              Meta Description
              <textarea
                maxLength={160}
                rows={4}
                value={metaDescription}
                onChange={(event) => setMetaDescription(event.target.value)}
                placeholder="SEO description (max 160 chars)"
              />
              <small>{metaDescription.length}/160</small>
            </label>
            <label>
              OG Image URL
              <input
                value={ogImage}
                onChange={(event) => setOgImage(event.target.value)}
                placeholder="OpenGraph image URL"
              />
            </label>
          </section>
          <div className="article-editor-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={!slug}
              onClick={() =>
                window.open(
                  `https://test.letsbeparents.com/${locale}/knowledge-hub/${slug}`,
                  "_blank",
                )
              }
            >
              <AdminIcon name="eye" /> Preview
            </button>
            <button
              className="primary"
              disabled={busy || !title.trim() || !slug.trim()}
            >
              <EditorIcon name="save" /> {busy ? "Saving…" : "Save Article"}
            </button>
          </div>
        </aside>
      </div>
    </form>
  );
}

function SettingsList({ view }: { view: string }) {
  const initial =
    (
      {
        "settings-api-keys": "API Keys",
        "settings-moderation": "Moderation",
        "settings-modules": "Modules",
        "settings-ranking": "Ranking",
        "settings-app-stores": "App Stores",
        "settings-audit-log": "Audit Log",
      } as Record<string, string>
    )[view] ?? "Admins";
  const [tab, setTab] = useState(initial);
  const [settings, setSettings] = useState<RecordValue[]>([]);
  const [auditRows, setAuditRows] = useState<RecordValue[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [operations, setOperations] = useState<RecordValue>({});
  const [session, setSession] = useState<Session | null>(null);
  const [adminAccounts, setAdminAccounts] = useState<RecordValue[]>([]);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<RecordValue | null>(null);
  const [savingKey, setSavingKey] = useState("");
  const [saveMessage, setSaveMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);
  const tabs = [
    "Admins",
    "API Keys",
    "Moderation",
    "Platform",
    "Modules",
    "Ranking",
    "App Stores",
    "Audit Log",
  ];
  const reload = () =>
    Promise.all([
      api.get<ListResponse>("/admin/list/settings?limit=200&offset=0"),
      api.get<RecordValue>("/admin/operations"),
      api.get<Session>("/admin/session"),
      api.get<ListResponse>("/admin/accounts"),
    ]).then(
      ([settingsResult, operationResult, sessionResult, accountsResult]) => {
        setSettings(settingsResult.items);
        setOperations(operationResult);
        setSession(sessionResult);
        setAdminAccounts(accountsResult.items);
      },
    );
  const loadAudit = (page: number) =>
    api
      .get<ListResponse>(`/admin/audit-log?limit=100&offset=${page * 100}`)
      .then((result) => {
        setAuditRows(result.items);
        setAuditTotal(result.total);
      })
      .catch(() => {
        setAuditRows([]);
        setAuditTotal(0);
      });
  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);
  useEffect(() => {
    void loadAudit(auditPage);
  }, [auditPage]);
  const findSetting = (key: string) =>
    settings.find(
      (row) =>
        String(row.source_key ?? row.sourceKey ?? row.slug ?? row.title) ===
          key || String(((row.data ?? {}) as RecordValue).key ?? "") === key,
    );
  const getValue = (key: string, fallback: unknown) => {
    const row = findSetting(key);
    const data = (row?.data ?? {}) as RecordValue;
    return data.value ?? data.enabled ?? fallback;
  };
  const saveValue = async (key: string, value: unknown, group: string) => {
    setSavingKey(key);
    setSaveMessage(null);
    const row = findSetting(key);
    const data = (row?.data ?? {}) as RecordValue;
    const values = {
      title: key,
      status: "active",
      slug: key,
      data: { ...data, key, group, value },
    };
    try {
      if (row?.id)
        await api.patch(
          `/admin/item/settings/${encodeURIComponent(String(row.id))}`,
          { values },
        );
      else
        await api.post("/admin/create/settings", {
          values: { ...values, source_key: key },
        });
      const settingsResult = await api.get<ListResponse>(
        "/admin/list/settings?limit=200&offset=0",
      );
      const persisted = settingsResult.items.find(
        (item) =>
          String(
            item.source_key ?? item.sourceKey ?? item.slug ?? item.title,
          ) === key ||
          String(((item.data ?? {}) as RecordValue).key ?? "") === key,
      );
      const persistedData = (persisted?.data ?? {}) as RecordValue;
      if (
        !persisted ||
        String(persistedData.value ?? persistedData.enabled ?? "") !==
          String(value)
      )
        throw new Error(`Setting ${key} was not persisted`);
      setSettings(settingsResult.items);
      setSaveMessage({ kind: "success", text: `${key} saved` });
    } catch (reason) {
      setSaveMessage({
        kind: "error",
        text:
          reason instanceof Error ? reason.message : `Could not save ${key}`,
      });
    } finally {
      setSavingKey("");
    }
  };
  const renderCard = (
    group: string,
    groupDescription: string,
    fields: SettingField[],
  ) => (
    <article className="settings-card">
      <header>
        <h3>{group}</h3>
        {groupDescription && <p>{groupDescription}</p>}
      </header>
      <div className="settings-card-content">
        {fields.map((field) => (
          <SettingControl
            key={field.key}
            field={field}
            value={getValue(field.key, field.fallback)}
            busy={savingKey === field.key}
            onSave={(value) => saveValue(field.key, value, group)}
          />
        ))}
      </div>
    </article>
  );
  const renderConfig = (
    title: string,
    description: string,
    group: string,
    groupDescription: string,
    fields: SettingField[],
  ) => (
    <section className="settings-section">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {renderCard(group, groupDescription, fields)}
    </section>
  );
  return (
    <>
      <header className="page-heading settings-page-heading">
        <h1>Settings</h1>
      </header>
      <nav className="settings-tabs">
        {tabs.map((title) => (
          <button
            key={title}
            className={tab === title ? "active" : ""}
            onClick={() => setTab(title)}
          >
            {title}
          </button>
        ))}
      </nav>
      {saveMessage && (
        <p
          className={`settings-save-message ${saveMessage.kind}`}
          role={saveMessage.kind === "error" ? "alert" : "status"}
        >
          {saveMessage.text}
        </p>
      )}
      {tab === "Admins" && (
        <section className="settings-section">
          <header className="settings-title-action">
            <div>
              <h2>Admin Users</h2>
              <p>Manage who has access to the admin panel</p>
            </div>
            <button
              className="primary"
              aria-expanded={addingAdmin}
              onClick={() => setAddingAdmin(true)}
            >
              <AdminIcon name="plus" /> Add Admin
            </button>
          </header>
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {adminAccounts.map((account, index) => {
                  const permissions = Array.isArray(account.permissions)
                    ? (account.permissions as string[])
                    : [];
                  return (
                    <tr key={String(account.id ?? account.email ?? index)}>
                      <td>
                        {valueOf(account.email)}{" "}
                        {String(account.email) === session?.email && (
                          <small className="you-badge">You</small>
                        )}
                      </td>
                      <td>
                        <span className="table-badge">
                          {valueOf(account.role)}
                        </span>
                      </td>
                      <td>
                        {permissions.includes("*") ? (
                          "All (super)"
                        ) : (
                          <div className="permission-badges">
                            {permissions.map((permission) => (
                              <small key={permission}>
                                {label(permission)}
                              </small>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="table-badge status-active">
                          {valueOf(account.status)}
                        </span>
                      </td>
                      <td>
                        {String(account.email) === session?.email
                          ? "Current session"
                          : account.lastLoginAt
                            ? verificationDate(account.lastLoginAt)
                            : "—"}
                      </td>
                      <td>
                        {account.createdAt
                          ? verificationDate(account.createdAt)
                          : "—"}
                      </td>
                      <td>
                        <button
                          className="row-action"
                          aria-label={`Actions for ${String(account.email)}`}
                          onClick={() =>
                            account.configured
                              ? window.alert(
                                  "This protected account is managed through server configuration.",
                                )
                              : setEditingAdmin(account)
                          }
                        >
                          <AdminIcon name="ellipsis" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!adminAccounts.length && (
                  <tr>
                    <td colSpan={7} className="empty">
                      Loading admin users…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "API Keys" && (
        <section className="settings-section">
          <header>
            <h2>API Keys</h2>
            <p>Status of external API integrations</p>
          </header>
          <div className="settings-api-grid">
            <article>
              <div>
                <h3>Google Places API</h3>
                <p>
                  City autocomplete in profile editing and clinic management
                </p>
              </div>
              <span
                className={`integration-status ${((operations.integrations ?? {}) as RecordValue).googlePlacesConfigured ? "configured" : ""}`}
              >
                {((operations.integrations ?? {}) as RecordValue)
                  .googlePlacesConfigured
                  ? "Configured"
                  : "Not Configured"}
              </span>
            </article>
            <article>
              <div>
                <h3>Google Vision API</h3>
                <p>Automatic photo moderation (SafeSearch detection)</p>
                <small>Shares the same API key as Google Places</small>
              </div>
              <span
                className={`integration-status ${((operations.integrations ?? {}) as RecordValue).visionConfigured ? "configured" : ""}`}
              >
                {((operations.integrations ?? {}) as RecordValue)
                  .visionConfigured
                  ? "Configured"
                  : "Not Configured"}
              </span>
            </article>
          </div>
          <div className="settings-note">
            <p>API keys are managed via server environment variables</p>
            <small>
              To update: SSH to server, edit /opt/parents/.env, then restart
              containers.
            </small>
          </div>
        </section>
      )}
      {tab === "Moderation" &&
        renderConfig(
          "Moderation Settings",
          "Configure automatic moderation and content review",
          "Moderation",
          "Automated review of user-generated content.",
          [
            {
              key: "moderation.auto_enabled",
              title: "Auto-moderate photos via Vision API",
              description:
                "When ON, new profile photos are screened by our automated safe-search service immediately after upload. Failing photos are rejected or marked for manual review. When OFF, every new photo stays in PENDING and must be moderated by hand.",
              type: "toggle",
              fallback: true,
            },
          ],
        )}
      {tab === "Platform" && (
        <section className="settings-section">
          <header>
            <h2>Platform Settings</h2>
            <p>Configure platform-wide settings and limits</p>
          </header>
          <div className="settings-card-stack">
            {renderCard(
              "Platform",
              "Global switches that affect whether new users can sign up and whether the site is accessible.",
              [
                {
                  key: "platform.livekit_enabled",
                  title: "Enable LiveKit (audio/video calls)",
                  description:
                    "Audio + video calls in chat (LiveKit). Emergency kill-switch — disable to drop call icons from chat UI globally and reject all NEW calls (start + join). Existing in-flight calls finish naturally.",
                  type: "toggle",
                  fallback: true,
                },
                {
                  key: "platform.maintenance_full",
                  title: "Maintenance: hard mode (kick users, end calls)",
                  description:
                    "HARD maintenance. ONLY effective when Maintenance mode is also ON. Logs out all non-staff users, ends active video calls, disconnects WebSocket sessions. Use only for emergency takedowns.",
                  type: "toggle",
                  fallback: false,
                },
                {
                  key: "platform.maintenance_mode",
                  title: "Maintenance mode",
                  description:
                    "Turns the whole public website into a maintenance page. Do NOT enable unless the site is down for planned work — logged-in users are kicked out.",
                  type: "toggle",
                  fallback: false,
                },
                {
                  key: "platform.registration_enabled",
                  title: "Allow new user registrations",
                  description:
                    "When OFF, new account creation is blocked on web and mobile (register endpoints return FORBIDDEN). Existing users can still sign in normally.",
                  type: "toggle",
                  fallback: true,
                },
                {
                  key: "platform.system_email",
                  title: "System Email (contact form recipient)",
                  description:
                    "Destination address for contact form messages. Must be a working inbox you read regularly.",
                  type: "email",
                  fallback: "",
                },
              ],
            )}
            {renderCard(
              "Limits",
              "Hard limits applied across the app. Changes take effect immediately for the next request.",
              [
                {
                  key: "limits.free_cold_chats_per_day",
                  title:
                    "Free plan daily cold-chat limit (0 = must match first)",
                  type: "number",
                  fallback: 0,
                },
                {
                  key: "limits.free_likes_per_day",
                  title: "Free plan daily likes limit",
                  description:
                    "Number of likes a free user can send per day. Counter resets at midnight UTC.",
                  type: "number",
                  fallback: 3,
                },
                {
                  key: "limits.max_message_length",
                  title: "Maximum message length",
                  description:
                    "Maximum number of characters a single chat message can contain. The tRPC schema has its own upper bound (5000) as a hard ceiling — this setting lets you lower it further.",
                  type: "number",
                  fallback: 5000,
                },
                {
                  key: "limits.max_photos",
                  title: "Maximum profile photos",
                  description:
                    "Maximum number of photos a user can upload. The avatar takes one additional slot on top of this.",
                  type: "number",
                  fallback: 10,
                },
                {
                  key: "limits.min_photos",
                  title: "Minimum profile photos",
                  description:
                    "Minimum number of photos required to finish onboarding. If a user deletes photos and drops below this threshold, they are not blocked — the check runs only at wizard completion.",
                  type: "number",
                  fallback: 1,
                },
                {
                  key: "limits.premium_cold_chats_per_day",
                  title: "Premium plan daily cold-chat limit",
                  type: "number",
                  fallback: 5,
                },
                {
                  key: "limits.premium_likes_per_day",
                  title: "Premium plan daily likes limit",
                  description:
                    "Number of likes a premium subscriber can send per day. Counter resets at midnight UTC.",
                  type: "number",
                  fallback: 15,
                },
              ],
            )}
          </div>
        </section>
      )}
      {tab === "Modules" &&
        renderConfig(
          "Modules",
          "Enable or disable user-facing features. Disabled modules are hidden from the website navigation.",
          "User-Facing Modules",
          "Toggle visibility of features on the website",
          [
            {
              key: "modules.articles",
              title: "Articles",
              description: "Knowledge Hub section with articles and guides",
              type: "toggle",
              fallback: true,
            },
            {
              key: "modules.clinics",
              title: "Clinics",
              description: "Fertility clinic directory with search and filters",
              type: "toggle",
              fallback: true,
            },
            {
              key: "modules.lawyers",
              title: "Lawyer Catalog",
              description: "Legal services directory (coming soon)",
              type: "toggle",
              fallback: true,
            },
            {
              key: "modules.matchmaking",
              title: "Matchmaking (Find a Match)",
              description: "Profile catalog, likes, matches, and chat",
              type: "toggle",
              fallback: true,
            },
          ],
        )}
      {tab === "Ranking" &&
        renderConfig(
          "Ranking Settings",
          "Weights and tuning for the catalog ranking formula",
          "Ranking",
          "Weights and parameters used by the catalog ranking formula. Changes take effect within 60 seconds across all servers.",
          [
            {
              key: "ranking.honeymoon.durationDays",
              title: "Honeymoon duration (days)",
              description:
                "How long the newly-registered-user boost lasts (days since signup).",
              type: "number",
              fallback: 5,
            },
            {
              key: "ranking.recency.halfLifeHours",
              title: "Recency half-life (hours)",
              description:
                "How long the recency boost takes to decay by half (e.g. 48 means a login 2 days ago is worth half of a login today).",
              type: "number",
              fallback: 48,
            },
            {
              key: "ranking.v2.enabled",
              title: "Ranking v2 enabled",
              description:
                "Feature flag for the new ranking formula. Keep OFF on production until the new formula has been A/B tested.",
              type: "toggle",
              fallback: true,
            },
            {
              key: "ranking.weights.completeness",
              title: "Completeness weight",
              description:
                "How much a fully-filled profile boosts the catalog position. 0 = ignored. Higher value = more visible complete profiles.",
              type: "number",
              fallback: 25,
            },
            {
              key: "ranking.weights.honeymoon",
              title: "Honeymoon weight",
              description:
                "Temporary boost applied to newly registered users so they get their first matches faster.",
              type: "number",
              fallback: 5,
            },
            {
              key: "ranking.weights.premium",
              title: "Premium weight",
              description:
                "Boost applied to premium subscribers. Kept separate from completeness so you can tune monetization vs fairness.",
              type: "number",
              fallback: 30,
            },
            {
              key: "ranking.weights.recency",
              title: "Recency weight",
              description:
                "How much recent login activity boosts the position. Decays over time via half-life below.",
              type: "number",
              fallback: 25,
            },
            {
              key: "ranking.weights.verified",
              title: "Verified weight",
              description:
                "Boost applied to verified profiles (passed identity check via Didit).",
              type: "number",
              fallback: 100,
            },
          ],
        )}
      {tab === "App Stores" &&
        renderConfig(
          "App Store Settings",
          "Configure mobile app version requirements and store URLs",
          "App Stores",
          "Mobile-app version gating. The mobile app pings our server on launch, compares the running version to the values below, and shows an update dialog (soft or forced) accordingly. The binary itself is still downloaded from the App Store / Play Store — we only signal that an update is needed.",
          [
            {
              key: "app_stores.android_store_url",
              title: "Android store URL",
              description:
                "Deep link opened by the 'Update Now' button on Android. Usually https://play.google.com/store/apps/details?id=com.ovufy.app (valid even before first publish — returns 404 until the app is live).",
              type: "textarea",
              fallback:
                "https://play.google.com/store/apps/details?id=com.letsBeParents.letsBeParents",
            },
            {
              key: "app_stores.force_update_below_android",
              title: "Force update below Android version",
              description:
                "Minimum Android app version allowed. Users on a version below this see a blocking 'Update Required' dialog and cannot use the app until they update via the store. Leave at 0.0.0 to require no minimum. Raise it to the new version after a store release when you need to force everyone off older builds (e.g. security fix or breaking API change). Note: this compares the app's marketing version (app.json `version`), NOT the build number — bump `version` on each release you want to gate.",
              type: "textarea",
              fallback: "0.0.0",
            },
            {
              key: "app_stores.force_update_below_ios",
              title: "Force update below iOS version",
              description:
                "Same as above, for iOS. Leave at 0.0.0 when no minimum is required.",
              type: "textarea",
              fallback: "0.0.0",
            },
            {
              key: "app_stores.ios_store_url",
              title: "iOS store URL",
              description:
                "Deep link opened by the 'Update Now' button on iOS. Format: https://apps.apple.com/app/id<APP_ID> — you get the APP_ID from App Store Connect after your first build is processed.",
              type: "textarea",
              fallback: "https://apps.apple.com/app/id1636495669",
            },
          ],
        )}
      {tab === "Audit Log" && (
        <section className="settings-section">
          <header className="settings-audit-heading">
            <h2>Audit Log</h2>
            <p>
              {auditTotal
                ? `Showing ${auditPage * 100 + 1}–${Math.min((auditPage + 1) * 100, auditTotal)} of ${auditTotal} entries`
                : "Administrative and system activity"}
            </p>
          </header>
          <div className="table settings-audit-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((row, index) => {
                  const data = (row.data ?? {}) as RecordValue;
                  const details =
                    data.details ??
                    data.entityName ??
                    data.entityId ??
                    data.entityType ??
                    row.source_key;
                  return (
                    <tr key={String(row.id ?? index)}>
                      <td>
                        {verificationDate(data.createdAt ?? row.created_at)}
                      </td>
                      <td>
                        {valueOf(
                          data.adminEmail ??
                            row.actor ??
                            row.email ??
                            "Unknown",
                        )}
                      </td>
                      <td>
                        <span className="settings-audit-action">
                          {auditActionLabel(
                            data.action ?? row.action ?? row.title,
                            data.source,
                          )}
                        </span>
                      </td>
                      <td>{details ? valueOf(details) : ""}</td>
                    </tr>
                  );
                })}
                {!auditRows.length && (
                  <tr>
                    <td colSpan={4} className="empty">
                      No audit entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {auditTotal > 100 && (
            <div className="pager settings-audit-pager">
              <button
                disabled={auditPage === 0}
                onClick={() => setAuditPage((page) => Math.max(0, page - 1))}
              >
                ← Previous
              </button>
              <span>
                Page {auditPage + 1} of {Math.ceil(auditTotal / 100)}
              </span>
              <button
                disabled={(auditPage + 1) * 100 >= auditTotal}
                onClick={() => setAuditPage((page) => page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </section>
      )}
      {addingAdmin && (
        <AdminAccountModal
          onClose={() => setAddingAdmin(false)}
          onSaved={async () => {
            setAddingAdmin(false);
            await reload();
          }}
        />
      )}
      {editingAdmin && (
        <AdminAccountModal
          account={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          onSaved={async () => {
            setEditingAdmin(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

function AdminAccountModal({
  account,
  onClose,
  onSaved,
}: {
  account?: RecordValue;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const editing = Boolean(account?.id);
  const [email, setEmail] = useState(String(account?.email ?? ""));
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(String(account?.role ?? "STAFF"));
  const [permissions, setPermissions] = useState<string[]>(
    Array.isArray(account?.permissions)
      ? (account.permissions as string[])
      : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options: Array<[string, string]> = [
    ["dashboard", "Dashboard"],
    ["users", "Users"],
    ["subscriptions", "Subscriptions"],
    ["verifications", "Verifications"],
    ["clinics", "Clinics"],
    ["lawyers", "Lawyers"],
    ["articles", "Articles"],
    ["support", "Support Chat"],
    ["moderation-photos", "Photo Moderation"],
    ["moderation-reports", "Reports"],
    ["livekit", "LiveKit Calls"],
    ["monitoring", "Monitoring"],
    ["storage", "Storage"],
    ["static-pages", "Static Pages"],
    ["marketing", "Marketing"],
    ["settings", "Settings"],
  ];
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (editing)
        await api.patch(
          `/admin/accounts/${encodeURIComponent(String(account?.id))}`,
          { password: password || null, role, permissions },
        );
      else
        await api.post("/admin/accounts", {
          email,
          password,
          role,
          permissions,
        });
      await onSaved();
    } catch (reason) {
      let message =
        reason instanceof Error
          ? reason.message
          : "Could not save the admin account.";
      try {
        message = String(
          (JSON.parse(message) as RecordValue).detail ?? message,
        );
      } catch {}
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <form
        className="modal admin-account-modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit Admin User" : "Add Admin User"}
        onSubmit={submit}
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          <AdminIcon name="x" />
        </button>
        <div className="admin-account-header">
          <h2>{editing ? "Edit Admin User" : "Add Admin User"}</h2>
          <p className="admin-account-subtitle">
            {editing
              ? "Update this account's role, permissions, or password"
              : "Create a new admin account or upgrade an existing user"}
          </p>
        </div>
        <div className="admin-account-body">
          {error && <p className="error admin-account-error">{error}</p>}
          <div className="admin-account-field">
            <label htmlFor="admin-account-email">Email</label>
            <input
              id="admin-account-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              disabled={editing}
              required
            />
          </div>
          <div className="admin-account-field">
            <label htmlFor="admin-account-password">Password</label>
            <input
              id="admin-account-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={
                editing
                  ? "Leave blank to keep current password"
                  : "Min 8 chars, uppercase + number"
              }
              minLength={editing ? undefined : 8}
              required={!editing}
            />
          </div>
          <div className="admin-account-field admin-account-role">
            <label htmlFor="admin-account-role">Role</label>
            <select
              id="admin-account-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </select>
            {role === "STAFF" && (
              <p className="admin-role-note">
                Staff can only access the sections explicitly granted below.
              </p>
            )}
          </div>
          {role === "STAFF" && (
            <div className="admin-permissions-group">
              <span className="admin-permissions-label">
                Initial permissions
              </span>
              <div className="admin-permissions">
                {options.map(([key, title]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={permissions.includes(key)}
                      onChange={() =>
                        setPermissions((current) =>
                          current.includes(key)
                            ? current.filter((item) => item !== key)
                            : [...current, key],
                        )
                      }
                    />
                    <span>{title}</span>
                  </label>
                ))}
              </div>
              <p className="admin-role-note admin-permissions-note">
                You can adjust permissions after creation from the row actions
                menu.
              </p>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy || !email || (!editing && password.length < 8)}
          >
            {!editing && <AdminIcon name="userPlus" />}
            {busy ? "Saving…" : editing ? "Save Changes" : "Add Admin"}
          </button>
        </div>
      </form>
    </div>
  );
}

function SettingControl({
  field,
  value,
  busy,
  onSave,
}: {
  field: SettingField;
  value: unknown;
  busy: boolean;
  onSave: (value: unknown) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(value ?? ""));
  useEffect(() => setDraft(String(value ?? "")), [value]);
  const saveDraft = () => {
    if (field.type === "number" && !draft.trim()) {
      setDraft(String(value ?? ""));
      return;
    }
    const next = field.type === "number" ? Number(draft) : draft;
    if (field.type === "number" && !Number.isFinite(next)) {
      setDraft(String(value ?? ""));
      return;
    }
    if (String(next) !== String(value)) void onSave(next);
  };
  return (
    <div className={`setting-control setting-control-${field.type}`}>
      <div>
        <b>{field.title}</b>
        {field.description && <p>{field.description}</p>}
        <small>{field.key}</small>
      </div>
      {field.type === "toggle" ? (
        <label className="static-footer-toggle">
          <input
            aria-label={field.title}
            type="checkbox"
            role="switch"
            checked={settingBoolean(value)}
            disabled={busy}
            onChange={(event) => void onSave(event.target.checked)}
          />
          <span />
        </label>
      ) : field.type === "textarea" ? (
        <textarea
          aria-label={field.title}
          rows={3}
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={saveDraft}
        />
      ) : (
        <input
          aria-label={field.title}
          type={field.type}
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={saveDraft}
        />
      )}
    </div>
  );
}

function EntityModal({
  row,
  title,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  row: RecordValue | null;
  title: string;
  busy: boolean;
  onClose: () => void;
  onSave: (values: RecordValue) => Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState("");
  const [entityTitle, setEntityTitle] = useState("");
  const [locale, setLocale] = useState("");
  const [slug, setSlug] = useState("");
  const [payload, setPayload] = useState("");
  useEffect(() => {
    setStatus(String(row?.status ?? ""));
    setEntityTitle(String(row?.title ?? row?.name ?? ""));
    setLocale(String(row?.locale ?? ""));
    setSlug(String(row?.slug ?? ""));
    const data = row?.data;
    setPayload(
      typeof data === "string" ? data : JSON.stringify(data ?? {}, null, 2),
    );
  }, [row]);
  if (!row) return null;
  const isNew = Boolean(row.__new);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    let data: unknown = {};
    try {
      data = payload.trim() ? JSON.parse(payload) : {};
    } catch {
      return;
    }
    await onSave({ title: entityTitle, status, locale, slug, data });
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal entity-modal" onSubmit={submit}>
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          <AdminIcon name="x" />
        </button>
        <h2>
          {isNew ? "New" : "Manage"} {title}
        </h2>
        <label>
          Title
          <input
            value={entityTitle}
            onChange={(event) => setEntityTitle(event.target.value)}
            required
          />
        </label>
        <label>
          Status
          <input
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          />
        </label>
        <label>
          Locale
          <input
            value={locale}
            onChange={(event) => setLocale(event.target.value)}
          />
        </label>
        <label>
          Slug
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </label>
        <label>
          Data (JSON)
          <textarea
            rows={8}
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          {!isNew && (
            <button
              type="button"
              className="danger"
              onClick={onDelete}
              disabled={busy}
            >
              Archive
            </button>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Working…" : isNew ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

type ModalState = {
  kind: "ban" | "grant" | "shadow" | "delete";
  title: string;
} | null;
function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal confirm-modal" aria-modal="true" role="dialog">
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          <AdminIcon name="x" />
        </button>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="danger"
            type="button"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
function ActionModal({
  state,
  onClose,
  onConfirm,
}: {
  state: ModalState;
  onClose: () => void;
  onConfirm: (values: RecordValue) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("HARASSMENT_THREATS");
  const [details, setDetails] = useState("");
  const [days, setDays] = useState("30");
  const [plan, setPlan] = useState("MONTHLY");
  if (!state) return null;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await onConfirm({ reason, details, days: Number(days), plan });
      onClose();
    } finally {
      setBusy(false);
    }
  };
  const destructive =
    state.kind === "ban" || state.kind === "delete" || state.kind === "shadow";
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={submit} aria-modal="true" role="dialog">
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          <AdminIcon name="x" />
        </button>
        <h2>{state.title}</h2>
        {state.kind === "ban" && (
          <>
            <p>
              This is permanent. The user will be logged out of all devices,
              lose Premium, and their active subscription will be cancelled.
              Store subscriptions must be cancelled separately.
            </p>
            <label>
              Reason
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                <option value="HARASSMENT_THREATS">Harassment / threats</option>
                <option value="SEXUAL_SOLICITATION_OFF_PLATFORM">
                  Sexual solicitation / off-platform conduct
                </option>
                <option value="FRAUD_SCAM">Fraud / scam</option>
                <option value="IMPERSONATION_FAKE_IDENTITY">
                  Impersonation / fake identity
                </option>
                <option value="ILLEGAL_CONTENT">Illegal content</option>
                <option value="SPAM_COMMERCIAL_ABUSE">
                  Spam / commercial abuse
                </option>
                <option value="OTHER_SEE_NOTES">Other (see notes)</option>
              </select>
            </label>
            <label>
              Details (optional)
              <textarea
                rows={4}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder="Context, references, links to reports…"
              />
            </label>
          </>
        )}
        {state.kind === "grant" && (
          <>
            <p>Grant a verified profile a manual Premium subscription.</p>
            <label>
              Plan
              <select
                value={plan}
                onChange={(event) => setPlan(event.target.value)}
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </label>
            <label>
              Duration (days)
              <input
                min="1"
                max="730"
                type="number"
                value={days}
                onChange={(event) => setDays(event.target.value)}
              />
            </label>
          </>
        )}
        {state.kind === "shadow" && (
          <p>
            This changes the user visibility in matching and discovery without
            notifying them.
          </p>
        )}
        {state.kind === "delete" && (
          <p>
            This action cannot be undone. It permanently deletes the user
            account, all data, photos, messages, matches and likes.
          </p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={destructive ? "danger" : "primary"}
            disabled={busy}
          >
            {busy
              ? "Working…"
              : state.kind === "delete"
                ? "Delete Permanently"
                : state.kind === "ban"
                  ? "Ban user"
                  : state.kind === "grant"
                    ? "Grant Premium"
                    : "Confirm"}
          </button>
        </div>
      </form>
    </div>
  );
}

function UserTabContent({
  profileId,
  tab,
  rows,
  overview,
  error,
  onReload,
}: {
  profileId: string;
  tab: string;
  rows: RecordValue[];
  overview: RecordValue;
  error: string;
  onReload: () => void;
}) {
  const [supportDraft, setSupportDraft] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [messageMode, setMessageMode] = useState<"visible" | "hidden">(
    "visible",
  );
  const [selectedConversation, setSelectedConversation] = useState<string>("");
  const [busy, setBusy] = useState(false);
  if (error) return <p className="error">{error}</p>;
  const nested = (row: RecordValue, key = "data") =>
    row[key] && typeof row[key] === "object" ? (row[key] as RecordValue) : {};
  const detailDeviceDate = (value: unknown) => {
    const date = value ? new Date(String(value)) : null;
    return date && !Number.isNaN(date.valueOf())
      ? date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
  };
  const person = (row: RecordValue) =>
    row.profile && typeof row.profile === "object"
      ? (row.profile as RecordValue)
      : row;
  const personLink = (row: RecordValue) => {
    const item = person(row);
    const id = item.id ?? row.profile_id ?? row.profileId;
    const name = valueOf(
      item.displayName ??
        item.display_name ??
        item.profileName ??
        row.display_name ??
        row.title ??
        row.id,
    );
    return id ? (
      <Link className="user-mini-link" to={`/users/${id}`}>
        <span className="mini-avatar">{name.slice(0, 1).toUpperCase()}</span>
        <span>
          <b>{name}</b>
          <small>{valueOf(item.email ?? row.email)}</small>
        </span>
      </Link>
    ) : (
      <b>{name}</b>
    );
  };
  const empty = (message: string) => (
    <p className="empty user-tab-empty">{message}</p>
  );
  const emptyState = (title: string, description?: string) => (
    <div className="user-empty-state">
      <AdminIcon name="users" />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
    </div>
  );
  if (tab === "devices") {
    const registration = rows.find((row) =>
      String(row.kind ?? "")
        .toLowerCase()
        .includes("registration"),
    );
    const last = rows.find(
      (row) =>
        String(row.kind ?? "")
          .toLowerCase()
          .includes("session") ||
        String(row.kind ?? "")
          .toLowerCase()
          .includes("last"),
    );
    const profile = (overview.profile ?? {}) as RecordValue;
    const profileData = nested(profile);
    const deviceCard = (title: string, row?: RecordValue) => {
      const data = row ? nested(row) : {};
      const source = registrationSourceLabel(
        data.source ?? data.platform ?? data.deviceType,
      );
      return (
        <article className="user-info-card">
          <h4>{title}</h4>
          <p>
            <span>Source</span>
            <b>{source}</b>
          </p>
          <p>
            <span>IP Address</span>
            <b>{valueOf(data.ipAddress ?? data.ip ?? row?.ip_address)}</b>
          </p>
          <p>
            <span>Location</span>
            <b>
              {valueOf(
                data.location ??
                  [data.city, countryName(data.country)]
                    .filter(Boolean)
                    .join(", "),
              )}
            </b>
          </p>
          <p>
            <span>Timezone</span>
            <b>{valueOf(data.timezone)}</b>
          </p>
          <p>
            <span>Screen</span>
            <b>
              {valueOf(
                data.screen ??
                  (data.screenWidth && data.screenHeight
                    ? `${data.screenWidth}x${data.screenHeight}`
                    : null),
              )}
            </b>
          </p>
          <p>
            <span>Date</span>
            <b>{detailDeviceDate(row?.created_at ?? data.createdAt)}</b>
          </p>
          <h5>Mobile Device</h5>
          <p>
            <span>OS</span>
            <b>{valueOf(data.os ?? data.osVersion)}</b>
          </p>
          <p>
            <span>Device</span>
            <b>{valueOf(data.device ?? data.model)}</b>
          </p>
          <p>
            <span>App Version</span>
            <b>{valueOf(data.appVersion)}</b>
          </p>
          <p>
            <span>Pixel Ratio</span>
            <b>{data.pixelRatio ? `${data.pixelRatio}x` : "—"}</b>
          </p>
          <p>
            <span>Emulator</span>
            <b>
              {data.isEmulator === undefined
                ? "—"
                : data.isEmulator
                  ? "Yes"
                  : "No"}
            </b>
          </p>
        </article>
      );
    };
    const lastData = nested(last ?? {});
    return (
      <section className="user-info-grid">
        {deviceCard("Registration Device", registration)}
        {deviceCard("Last Session Device", last)}
        <article className="user-info-card">
          <h4>Location</h4>
          <p>
            <span>Stated</span>
            <b>{valueOf(profileData.country)}</b>
          </p>
          <p>
            <span>IP country</span>
            <b>
              {valueOf(
                lastData.ipCountry ??
                  [lastData.country, lastData.city].filter(Boolean).join(" ("),
              )}
              {lastData.country && lastData.city ? ")" : ""}
            </b>
          </p>
          <p>
            <span>Device TZ</span>
            <b>{valueOf(lastData.timezone)}</b>
          </p>
          <p>
            <span>Last session</span>
            <b>{detailDeviceDate(last?.created_at ?? lastData.createdAt)}</b>
          </p>
        </article>
      </section>
    );
  }
  if (tab === "verification")
    return rows.length ? (
      <section className="user-tab-section">
        <p>
          {rows.length} {rows.length === 1 ? "session" : "sessions"}
        </p>
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Liveness</th>
                <th>Face Match</th>
                <th>Created</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const data = nested(row);
                return (
                  <tr key={String(row.id ?? index)}>
                    <td>
                      <span
                        className={`table-badge status-${String(row.status ?? data.status ?? "").toLowerCase()}`}
                      >
                        {valueOf(row.status ?? data.status)}
                      </span>
                    </td>
                    <td>
                      {valueOf(
                        data.liveness ?? data.livenessScore ?? row.liveness,
                      )}
                    </td>
                    <td>
                      {valueOf(
                        data.faceMatch ?? data.faceMatchScore ?? row.faceMatch,
                      )}
                    </td>
                    <td>
                      {verificationDate(data.createdAt ?? row.created_at)}
                    </td>
                    <td>
                      {verificationDate(
                        data.completedAt ?? row.completed_at ?? row.updated_at,
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    ) : (
      emptyState("No verification sessions")
    );
  if (tab === "support") {
    const conversationId =
      rows.find((row) => row.conversation_id ?? row.conversationId)
        ?.conversation_id ??
      rows.find((row) => row.conversationId)?.conversationId;
    const send = async (event: FormEvent) => {
      event.preventDefault();
      if (!supportDraft.trim() || !conversationId) return;
      setBusy(true);
      try {
        await api.post(`/admin/support/${conversationId}/messages`, {
          body: supportDraft.trim(),
        });
        setSupportDraft("");
        onReload();
      } finally {
        setBusy(false);
      }
    };
    return (
      <section className="profile-support">
        <h3>
          Support Chat <span>({rows.length} messages)</span>
        </h3>
        <div className="profile-support-messages">
          {[...rows].reverse().map((row, index) => (
            <article
              key={String(row.id ?? index)}
              className={
                String(row.sender_role ?? "").toUpperCase() === "SUPPORT"
                  ? "support"
                  : "member"
              }
            >
              <p>{valueOf(row.body)}</p>
              <small>{verificationDate(row.created_at)}</small>
            </article>
          ))}
          {!rows.length && empty("No support messages.")}
        </div>
        <form onSubmit={send}>
          <input
            value={supportDraft}
            onChange={(event) => setSupportDraft(event.target.value)}
            placeholder="Type a message as support..."
          />
          <button
            className="primary"
            disabled={busy || !conversationId || !supportDraft.trim()}
            aria-label="Send support message"
          >
            Send
          </button>
        </form>
      </section>
    );
  }
  if (tab === "messages") {
    const conversations = (
      (overview.conversations ?? []) as RecordValue[]
    ).filter((row) =>
      rowName(person(row)).toLowerCase().includes(messageSearch.toLowerCase()),
    );
    const currentId =
      selectedConversation || String(conversations[0]?.id ?? "");
    const messages = rows
      .filter(
        (row) =>
          String(row.conversation_id ?? row.conversationId ?? "") === currentId,
      )
      .sort((a, b) =>
        String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
      );
    if (!conversations.length)
      return emptyState("No Conversations", "This user has no chat history.");
    return (
      <section className="profile-messages">
        <aside>
          <input
            value={messageSearch}
            onChange={(event) => setMessageSearch(event.target.value)}
            placeholder="Search by name…"
          />
          <nav>
            <button
              className={messageMode === "visible" ? "active" : ""}
              onClick={() => setMessageMode("visible")}
            >
              Visible ({conversations.length})
            </button>
            <button
              className={messageMode === "hidden" ? "active" : ""}
              onClick={() => setMessageMode("hidden")}
            >
              Hidden (0)
            </button>
          </nav>
          {messageMode === "visible" &&
            conversations.map((row) => (
              <button
                className={
                  String(row.id) === currentId
                    ? "conversation active"
                    : "conversation"
                }
                key={String(row.id)}
                onClick={() => setSelectedConversation(String(row.id))}
              >
                {personLink(row)}
                <small>{Number(row.message_count ?? 0)} messages</small>
              </button>
            ))}
        </aside>
        <div className="message-thread">
          {currentId ? (
            messages.map((row, index) => (
              <article key={String(row.id ?? index)}>
                <b>{valueOf(row.sender_name ?? "Member")}</b>
                <p>{valueOf(row.body)}</p>
                <small>{verificationDate(row.created_at)}</small>
              </article>
            ))
          ) : (
            <p>Select a conversation</p>
          )}
        </div>
      </section>
    );
  }
  if (tab === "photos") {
    const action = async (path: string, method: "post" | "delete") => {
      setBusy(true);
      try {
        if (method === "post") await api.post(path, {});
        else await api.delete(path);
        onReload();
      } finally {
        setBusy(false);
      }
    };
    return (
      <section className="profile-photos">
        <p>{rows.length} photos</p>
        <div>
          {rows.map((row, index) => {
            const photoId = String(row.id);
            const url = String(row.public_url ?? row.publicUrl ?? "");
            const primary = Number(row.position ?? index) === 0;
            return (
              <article key={photoId}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={url}
                      alt=""
                      onError={(event) => event.currentTarget.remove()}
                    />
                  </a>
                ) : (
                  <div className="profile-photo-unavailable">
                    Photo unavailable
                  </div>
                )}
                <span
                  className={`table-badge status-${String(row.moderation_status ?? row.status ?? "").toLowerCase()}`}
                >
                  {valueOf(row.moderation_status ?? row.status)}
                </span>
                <div>
                  {!primary && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        action(
                          `/admin/users/${profileId}/photos/${photoId}/primary`,
                          "post",
                        )
                      }
                    >
                      Make this the primary photo
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() =>
                      action(
                        `/admin/users/${profileId}/photos/${photoId}/avatar`,
                        "post",
                      )
                    }
                  >
                    Crop as avatar
                  </button>
                  <button
                    className="danger-text"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Permanently delete this photo?"))
                        void action(
                          `/admin/users/${profileId}/photos/${photoId}`,
                          "delete",
                        );
                    }}
                  >
                    Permanently delete this photo
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {!rows.length && empty("No photos.")}
      </section>
    );
  }
  if (
    [
      "sent-likes",
      "received-likes",
      "matches",
      "blocked",
      "blocked-by",
    ].includes(tab)
  ) {
    const labels: Record<string, [string, string, string]> = {
      "sent-likes": ["likes sent", "No Sent Likes", "No data"],
      "received-likes": ["likes received", "No Received Likes", "No data"],
      matches: ["matches", "No Matches", "No data"],
      blocked: ["blocked users", "", "This user hasn't blocked anyone."],
      "blocked-by": ["users", "", "No one has blocked this user."],
    };
    const [noun, emptyTitle, emptyText] = labels[tab];
    return (
      <section className="user-tab-section">
        {rows.length ? (
          <>
            <p>
              {rows.length} {noun}
            </p>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Date</th>
                    {tab.startsWith("blocked") && <th>Reason</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={String(row.id ?? index)}>
                      <td>{personLink(row)}</td>
                      <td>{compactDate(row.created_at ?? row.updated_at)}</td>
                      {tab.startsWith("blocked") && (
                        <td>{valueOf(row.reason)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : emptyTitle ? (
          emptyState(emptyTitle, emptyText)
        ) : (
          empty(emptyText)
        )}
      </section>
    );
  }
  if (tab === "subscriptions") {
    const current =
      rows.find((row) => String(row.status ?? "").toUpperCase() === "ACTIVE") ??
      rows[0];
    if (!rows.length) return emptyState("Free — no subscription history");
    return (
      <section className="profile-subscriptions">
        {current && (
          <article>
            <h3>Current Subscription</h3>
            <div>
              <h3>
                {valueOf(
                  nested(current).planLabel ??
                    nested(current).plan ??
                    current.title,
                )}
              </h3>
              <span
                className={`table-badge status-${String(current.status ?? "").toLowerCase()}`}
              >
                {valueOf(current.status)}
              </span>
              <p>
                {valueOf(nested(current).source)} ·{" "}
                {compactDate(nested(current).startedAt ?? current.created_at)} —{" "}
                {compactDate(nested(current).expiresAt)}
              </p>
              <button type="button">Reveal</button>
              <button type="button" disabled>
                Copy
              </button>
            </div>
          </article>
        )}
        <article>
          <h3>Lifecycle Timeline</h3>
          {rows.map((row, index) => {
            const data = nested(row);
            return (
              <details key={String(row.id ?? index)} open={index === 0}>
                <summary>
                  {valueOf(data.planLabel ?? data.plan ?? row.title)}{" "}
                  <span>{statusLabel(String(row.status ?? ""))}</span> ·{" "}
                  {valueOf(data.source)}
                </summary>
                <p>
                  Started {verificationDate(data.startedAt ?? row.created_at)}
                </p>
                <p>
                  Period: {compactDate(data.startedAt ?? row.created_at)} —{" "}
                  {compactDate(data.expiresAt ?? row.updated_at)}
                </p>
              </details>
            );
          })}
        </article>
      </section>
    );
  }
  if (tab === "clinics")
    return (
      <section className="user-tab-section">
        {rows.length ? (
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Clinic</th>
                  <th>Location</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={String(row.id ?? index)}>
                    <td>
                      {row.clinic_id ? (
                        <Link to={`/clinics/${row.clinic_id}`}>
                          {valueOf(row.clinic_name ?? row.title)}
                        </Link>
                      ) : (
                        valueOf(row.clinic_name ?? row.title)
                      )}
                    </td>
                    <td>
                      {[row.clinic_city, countryName(row.clinic_country)]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </td>
                    <td>{compactDate(row.updated_at ?? row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          emptyState(
            "No Liked Clinics",
            "This user hasn't liked any clinics yet.",
          )
        )}
      </section>
    );
  if (tab === "visitors")
    return rows.length ? (
      <section className="profile-visitors">
        {rows.map((row, index) => {
          const data = nested(row);
          return (
            <article key={String(row.id ?? index)}>
              {personLink(row)}
              <p>
                {Number(data.viewCount ?? data.views ?? 1)}{" "}
                {Number(data.viewCount ?? data.views ?? 1) === 1
                  ? "view"
                  : "views"}
              </p>
              <small>
                Last:{" "}
                {compactDate(
                  data.lastViewedAt ?? row.updated_at ?? row.created_at,
                )}
              </small>
            </article>
          );
        })}
      </section>
    ) : (
      emptyState("No Visitors", "No one has viewed this user's profile yet.")
    );
  return empty("No records.");
}

function UserDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<RecordValue | null>(null);
  const [tab, setTab] = useState("profile");
  const [tabRows, setTabRows] = useState<RecordValue[]>([]);
  const [error, setError] = useState("");
  const [tabError, setTabError] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [notice, setNotice] = useState("");
  const [bioEditing, setBioEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    setDetail(null);
    setError("");
    api
      .get<RecordValue>(`/admin/users/${encodeURIComponent(id)}/overview`)
      .then(setDetail)
      .catch(() => setError("Could not load the user profile."));
  }, [id, reload]);
  useEffect(() => {
    setTabError("");
    if (tab === "profile") {
      setTabRows([]);
      return;
    }
    setTabRows([]);
    api
      .get<{ items: RecordValue[] }>(
        `/admin/users/${encodeURIComponent(id)}/tabs/${encodeURIComponent(tab)}`,
      )
      .then((payload) =>
        setTabRows(Array.isArray(payload.items) ? payload.items : []),
      )
      .catch(() => setTabError("Could not load the selected user tab."));
  }, [id, tab, reload]);
  if (error) return <p className="error">{error}</p>;
  if (!detail) return <p className="loading-inline">Loading user…</p>;
  const profile = (detail.profile ?? {}) as RecordValue;
  const counts = (detail.counts ?? {}) as RecordValue;
  const profileId = String(profile.id ?? id);
  const list = tab === "profile" ? [] : tabRows;
  const profileData = (profile.data ?? {}) as RecordValue;
  const dataValue = (...keys: string[]) => {
    for (const key of keys) {
      const value = profileData[key] ?? profile[key];
      if (value !== null && value !== undefined && value !== "") return value;
    }
    return null;
  };
  const humanValue = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value))
      return (
        value.map((item) => label(String(item).toLowerCase())).join(", ") || "-"
      );
    const text = String(value);
    if (["true", "false"].includes(text.toLowerCase()))
      return text.toLowerCase() === "true" ? "Yes" : "No";
    return /^[A-Z0-9_ -]+$/.test(text) ? label(text.toLowerCase()) : text;
  };
  const detailDate = (value: unknown) => {
    const date = value ? new Date(String(value)) : null;
    return date && !Number.isNaN(date.valueOf())
      ? date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
  };
  const tabCount = (key: string) => {
    const fallback =
      key === "sentLikes"
        ? dataValue("likesCount")
        : key === "receivedLikes"
          ? dataValue("likedByCount")
          : key === "reports"
            ? dataValue("reportCount")
            : null;
    return Number(counts[key] ?? 0) || Number(fallback ?? 0);
  };
  const section = (title: string, fields: Array<[string, unknown]>) => (
    <section className="profile-section" key={title}>
      <h4>{title}</h4>
      {fields.map(([name, value]) => (
        <p key={name}>
          <span>{name}</span>
          <b>{humanValue(value)}</b>
        </p>
      ))}
    </section>
  );
  const handleAction = async (values: RecordValue) => {
    if (!modal) return;
    if (modal.kind === "ban") {
      await api.patch(`/admin/item/users/${encodeURIComponent(profileId)}`, {
        values: {
          status: "BANNED",
          data: {
            ...profileData,
            banReason: values.reason,
            banDetails: values.details,
            bannedAt: new Date().toISOString(),
          },
        },
      });
      setNotice("User banned.");
    }
    if (modal.kind === "grant") {
      await api.post("/admin/subscriptions/grant", {
        profileRef: profileId,
        plan: values.plan,
        days: values.days,
      });
      setNotice("Premium granted.");
    }
    if (modal.kind === "shadow") {
      const enabled = !Boolean(profileData.shadowBanned);
      await api.patch(`/admin/item/users/${encodeURIComponent(profileId)}`, {
        values: {
          data: {
            ...profileData,
            shadowBanned: enabled,
            shadowBannedAt: enabled ? new Date().toISOString() : null,
          },
        },
      });
      setNotice(enabled ? "User shadow banned." : "Shadow ban removed.");
    }
    if (modal.kind === "delete") {
      await api.delete(`/admin/item/users/${encodeURIComponent(profileId)}`);
      navigate("/users");
      return;
    }
    setReload((value) => value + 1);
  };
  const openAmplitude = async () => {
    const target = window.open("about:blank", "_blank", "noopener");
    try {
      const result = await api.post<{ url?: string }>(
        `/admin/users/${encodeURIComponent(profileId)}/amplitude`,
      );
      if (!result.url) throw new Error();
      if (target) target.location.replace(result.url);
      else window.open(result.url, "_blank", "noopener");
    } catch {
      target?.close();
      setNotice("Amplitude is not configured or unavailable.");
    }
  };
  const toggleVerification = async () => {
    const enabled = !settingBoolean(dataValue("isVerified"));
    await api.patch(`/admin/item/users/${encodeURIComponent(profileId)}`, {
      values: {
        data: {
          ...profileData,
          isVerified: enabled,
          verifiedAt: enabled ? new Date().toISOString() : null,
        },
      },
    });
    setNotice(enabled ? "User verified." : "Verification removed.");
    setReload((value) => value + 1);
  };
  const avatarUrl = String(dataValue("avatarUrl", "avatar_url") ?? "");
  const verified = settingBoolean(dataValue("isVerified", "verified"));
  const online = settingBoolean(dataValue("isOnlineNow", "online"));
  const saveBio = async () => {
    setBioSaving(true);
    try {
      await api.patch(`/admin/item/users/${encodeURIComponent(profileId)}`, {
        values: { data: { ...profileData, bio: bioDraft.trim() } },
      });
      setBioEditing(false);
      setNotice("Bio saved.");
      setReload((value) => value + 1);
    } finally {
      setBioSaving(false);
    }
  };
  return (
    <>
      <Link className="back" to="/users">
        <AdminIcon name="arrowLeft" /> Back to Users
      </Link>
      {notice && <p className="notice">{notice}</p>}
      <header className="detail-heading user-detail-heading">
        <div className="user-detail-identity">
          <div className="user-detail-avatar">
            <i>
              {String(profile.display_name ?? profile.displayName ?? "U")
                .slice(0, 1)
                .toUpperCase()}
            </i>
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=""
                onError={(event) => event.currentTarget.remove()}
              />
            )}
          </div>
          <div>
            <h1>
              {valueOf(
                profile.display_name ?? profile.displayName ?? "No profile",
              )}{" "}
              {verified && (
                <span className="verified-mark" title="Verified">
                  <AdminIcon name="circleCheck" />
                </span>
              )}{" "}
              <em>{online ? "Online" : "Offline"}</em>
            </h1>
            <p>{valueOf(profile.email)}</p>
            <p>
              Blocked by <b>{tabCount("blockedBy")}</b> users　{" "}
              <b>{tabCount("reports")}</b> reports
            </p>
          </div>
        </div>
        <div className="detail-actions user-detail-actions">
          <span className="status">{valueOf(profile.status)}</span>
          <button onClick={openAmplitude}>
            <AdminIcon name="externalLink" /> Open in Amplitude
          </button>
          <button
            onClick={() => setModal({ kind: "grant", title: "Grant Premium" })}
          >
            <AdminIcon name="crown" /> Grant Premium
          </button>
          <button onClick={() => void toggleVerification()}>
            {verified ? "Unverify" : "Verify"}
          </button>
          <button
            className="danger"
            onClick={() => setModal({ kind: "ban", title: "Ban user" })}
          >
            Ban
          </button>
          <button
            onClick={() =>
              setModal({
                kind: "shadow",
                title: profileData.shadowBanned
                  ? "Remove shadow ban"
                  : "Shadow ban user",
              })
            }
          >
            <AdminIcon name="eyeOff" /> Shadow ban
          </button>
          <button
            className="danger"
            onClick={() =>
              setModal({ kind: "delete", title: "Permanently Delete User" })
            }
          >
            <AdminIcon name="trash" /> Delete
          </button>
        </div>
      </header>
      <nav className="detail-tabs">
        {detailTabs.map(([key, title, countKey, icon, showCount]) => (
          <button
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
            key={key}
          >
            <AdminIcon name={icon} />
            {title}
            {showCount ? ` (${tabCount(countKey)})` : ""}
          </button>
        ))}
      </nav>
      {tab === "profile" ? (
        <section className="detail-grid user-profile-grid">
          <article>
            {section("IDs", [
              ["User ID", dataValue("id", "userId") ?? id],
              [
                "Profile ID",
                dataValue("profileId", "profile_id") ?? profile.id,
              ],
            ])}
            {section("Basic Info", [
              ["Display Name", dataValue("displayName", "display_name")],
              ["User Type (legacy)", dataValue("donorType", "userType")],
              ["Date of Birth", dataValue("dateOfBirth", "birthDate")],
              ["Country", dataValue("country")],
              ["City", dataValue("city")],
            ])}
            {section("Reproductive Model", [
              ["Profile Type", dataValue("profileType")],
              ["Willing to Donate", dataValue("donorType", "willingToDonate")],
              ["Looking For", dataValue("lookingFor")],
              [
                "Contact with the Child",
                dataValue("contactWillingness", "contactWithChild"),
              ],
              ["Desired Donor Contact", dataValue("desiredDonorContact")],
            ])}
            {section("Appearance", [
              ["Height", dataValue("height")],
              ["Weight", dataValue("weight")],
              ["Eye Color", dataValue("eyeColor")],
              ["Hair Color", dataValue("hairColor")],
              ["Ethnicity", dataValue("ethnicity")],
            ])}
            {section("About Me", [
              ["Education", dataValue("education")],
              ["Occupation", dataValue("occupation")],
              ["Smoking", dataValue("smoking")],
              ["Drinking", dataValue("drinking")],
              ["Religion", dataValue("religion")],
              ["Languages", dataValue("languages")],
            ])}
            <section className="profile-section profile-bio">
              <p>
                <span>
                  Bio{" "}
                  <button
                    type="button"
                    aria-label="Edit bio"
                    title="Edit bio"
                    onClick={() => {
                      setBioDraft(String(dataValue("bio", "aboutMe") ?? ""));
                      setBioEditing(true);
                    }}
                  >
                    <AdminIcon name="pencil" />
                  </button>
                </span>
              </p>
              {bioEditing ? (
                <div className="profile-bio-editor">
                  <textarea
                    aria-label="No bio"
                    maxLength={2000}
                    value={bioDraft}
                    onChange={(event) => setBioDraft(event.target.value)}
                    autoFocus
                  />
                  <small>{bioDraft.length} / 2000</small>
                  <p>
                    <button type="button" onClick={() => setBioEditing(false)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="primary"
                      disabled={bioSaving}
                      onClick={() => void saveBio()}
                    >
                      {bioSaving ? "Saving…" : "Save"}
                    </button>
                  </p>
                </div>
              ) : (
                <div
                  className={
                    dataValue("bio", "aboutMe") ? "" : "profile-bio-empty"
                  }
                >
                  {dataValue("bio", "aboutMe")
                    ? humanValue(dataValue("bio", "aboutMe"))
                    : "No bio set"}
                </div>
              )}
            </section>
          </article>
          <article>
            <section className="profile-section acquisition-card">
              <h3>Acquisition</h3>
              <p>
                {dataValue("acquisition", "attribution")
                  ? humanValue(dataValue("acquisition", "attribution"))
                  : "No attribution captured."}
              </p>
            </section>
            {section("Account", [
              ["Email", dataValue("email")],
              ["Email Verified", dataValue("emailVerified", "isEmailVerified")],
              ["Auth Type", dataValue("authType")],
              ["Premium", dataValue("isPremium")],
              ["Status", profile.status],
              ["Locale", dataValue("locale")],
            ])}
            {section("Activity", [
              [
                "Registered",
                detailDate(
                  dataValue("createdAt", "created_at") ?? profile.created_at,
                ),
              ],
              ["Last Login", detailDate(dataValue("lastLoginAt"))],
              ["Registration Source", dataValue("registrationSource")],
              ["Last Login Source", dataValue("lastLoginSource")],
            ])}
            {section("Profile Status", [
              [
                "Visible in Catalog",
                dataValue("visibleInCatalog", "isVisible"),
              ],
              ["Verified", verified],
              ["Verified At", detailDate(dataValue("verifiedAt"))],
              ["Wizard Completed", dataValue("wizardCompleted")],
              ["Completeness Score", dataValue("completenessScore")],
            ])}
            {section("Donor Details", [
              ["Contact Willingness", dataValue("contactWillingness")],
              ["Previous Donations", dataValue("previousDonations")],
              ["Willing to Donate To", dataValue("willingToDonateTo")],
            ])}
          </article>
        </section>
      ) : (
        <UserTabContent
          profileId={profileId}
          tab={tab}
          rows={list}
          overview={detail}
          error={tabError}
          onReload={() => setReload((value) => value + 1)}
        />
      )}
      <ActionModal
        state={modal}
        onClose={() => setModal(null)}
        onConfirm={handleAction}
      />
    </>
  );
}

function ClinicDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<RecordValue | null>(null);
  const [tab, setTab] = useState("info");
  const [draft, setDraft] = useState<RecordValue>({});
  const [languageEntry, setLanguageEntry] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const load = () => {
    setData(null);
    api
      .get<RecordValue>(`/admin/clinics/${encodeURIComponent(id)}/overview`)
      .then((result) => {
        setData(result);
        setDraft((result.clinic ?? {}) as RecordValue);
      })
      .catch(() => setError("Could not load clinic details."));
  };
  useEffect(load, [id]);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="loading-inline">Loading clinic…</p>;
  const clinic = (data.clinic ?? {}) as RecordValue;
  const serviceGroups = (data.serviceGroups ?? {}) as Record<
    string,
    Array<RecordValue>
  >;
  const languages = Array.isArray(draft.languages)
    ? (draft.languages as string[])
    : [];
  const services = Array.isArray(draft.services)
    ? (draft.services as unknown[])
        .map((item) =>
          typeof item === "object" && item !== null
            ? String(
                (item as RecordValue).slug ?? (item as RecordValue).id ?? "",
              )
            : String(item),
        )
        .filter(Boolean)
    : [];
  const serviceCount = services.length || Number(draft.servicesCount ?? 0);
  const clinicDirty = JSON.stringify(draft) !== JSON.stringify(clinic);
  const setValue = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async (values = draft) => {
    await api.patch(`/admin/clinics/${encodeURIComponent(id)}`, { values });
    setNotice("Changes saved.");
    load();
  };
  const toggleService = async (slug: string) => {
    const next = services.includes(slug)
      ? services.filter((item) => item !== slug)
      : [...services, slug];
    setValue("services", next);
    await save({ services: next });
  };
  const updateClinicSetting = async (
    key: "chatEnabled" | "isActive",
    value: boolean,
  ) => {
    try {
      await api.patch(`/admin/clinics/${encodeURIComponent(id)}`, {
        values: { [key]: value },
      });
      setNotice(
        key === "chatEnabled"
          ? `Chat ${value ? "enabled" : "disabled"}.`
          : `Clinic ${value ? "activated" : "deactivated"}.`,
      );
      load();
    } catch {
      setNotice("Could not update this clinic setting.");
    }
  };
  const permanentDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/clinics/${encodeURIComponent(id)}`);
      navigate("/clinics");
    } finally {
      setDeleting(false);
    }
  };
  const onLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const result = await api.upload<{ publicUrl: string }>(
      `/admin/clinics/${encodeURIComponent(id)}/logo`,
      form,
    );
    setDraft((current) => ({ ...current, logoUrl: result.publicUrl }));
    setNotice("Logo uploaded.");
    load();
  };
  return (
    <>
      <Link className="back" to="/clinics">
        <AdminIcon name="arrowLeft" /> Back to Clinics
      </Link>
      {notice && <p className="notice">{notice}</p>}
      <header className="clinic-heading">
        <div className="clinic-logo">
          {draft.logoUrl ? (
            <img src={String(draft.logoUrl)} alt="" />
          ) : (
            <AdminIcon name="building" />
          )}
        </div>
        <div>
          <h1>{valueOf(clinic.name)}</h1>
          <p>
            {[clinic.city, clinic.region, countryName(clinic.country)]
              .filter(Boolean)
              .join(", ") || "—"}
          </p>
        </div>
        <p className="clinic-partner">Partner: {valueOf(clinic.partnerName)}</p>
        <span className="status">{valueOf(clinic.status)}</span>
      </header>
      <nav className="detail-tabs clinic-tabs">
        {[
          ["info", "Info"],
          ["services", `Services (${serviceCount})`],
          ["languages", `Languages (${languages.length})`],
          ["about", "About"],
          ["visitors", `Visitors (${valueOf(data.visitorCount ?? 0)})`],
        ].map(([key, title]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {title}
          </button>
        ))}
      </nav>
      {tab === "info" && (
        <section className="clinic-form">
          <article>
            <h2>Logo</h2>
            <div className="logo-editor">
              <div className="clinic-logo">
                {draft.logoUrl ? (
                  <img src={String(draft.logoUrl)} alt="" />
                ) : (
                  <AdminIcon name="building" />
                )}
              </div>
              <label className="secondary-button">
                Upload Logo
                <input
                  onChange={onLogo}
                  accept="image/jpeg,image/png,image/webp"
                  type="file"
                  hidden
                />
              </label>
            </div>
          </article>
          <article>
            <h2>General Info</h2>
            <div className="form-grid">
              {[
                ["name", "Name"],
                ["website", "Website"],
                ["phone", "Phone"],
                ["email", "Email"],
                ["slug", "Slug"],
              ].map(([key, title]) => (
                <label key={key}>
                  {title}
                  <input
                    placeholder={
                      key === "website"
                        ? "https://"
                        : key === "phone"
                          ? "+1-555-123-4567"
                          : key === "email"
                            ? "clinic@example.com"
                            : undefined
                    }
                    value={valueOf(draft[key] === "—" ? "" : draft[key])}
                    onChange={(event) => setValue(key, event.target.value)}
                  />
                </label>
              ))}
              <label>
                Partner
                <input
                  value={valueOf(
                    draft.partnerName === "—" ? "" : draft.partnerName,
                  )}
                  disabled
                  readOnly
                />
              </label>
            </div>
          </article>
          <article>
            <h2>Location</h2>
            <div className="form-grid">
              {[
                ["location", "Address"],
                ["country", "Country"],
                ["region", "Region"],
                ["city", "City"],
                ["latitude", "Latitude"],
                ["longitude", "Longitude"],
              ].map(([key, title]) => (
                <label key={key}>
                  {title}
                  <input
                    value={valueOf(draft[key] === "—" ? "" : draft[key])}
                    onChange={(event) => setValue(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </article>
          <article>
            <h2>Hours & Credentials</h2>
            <div className="form-grid">
              {[
                ["establishedYear", "Established Year"],
                ["hours", "Working Hours"],
                ["credentials", "Credentials"],
                ["honorsAwards", "Honors & Awards"],
                ["hospitalAffiliations", "Hospital Affiliations"],
              ].map(([key, title]) => (
                <label key={key}>
                  {title}
                  {[
                    "credentials",
                    "honorsAwards",
                    "hospitalAffiliations",
                  ].includes(key) ? (
                    <textarea
                      rows={4}
                      value={valueOf(draft[key] === "—" ? "" : draft[key])}
                      onChange={(event) => setValue(key, event.target.value)}
                    />
                  ) : (
                    <input
                      type={key === "establishedYear" ? "number" : "text"}
                      value={valueOf(draft[key] === "—" ? "" : draft[key])}
                      onChange={(event) => setValue(key, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
          </article>
          <article className="settings-row">
            <div>
              <h2>Chat with Clinic</h2>
              <p>Allow users to start a chat with this clinic</p>
            </div>
            <button
              className="secondary-button"
              onClick={() =>
                void updateClinicSetting(
                  "chatEnabled",
                  !settingBoolean(draft.chatEnabled),
                )
              }
            >
              {settingBoolean(draft.chatEnabled)
                ? "Disable Chat"
                : "Enable Chat"}
            </button>
          </article>
          <article className="settings-row">
            <div>
              <h2>Clinic Status</h2>
              <p>Toggle whether this clinic is visible in the public catalog</p>
            </div>
            <button
              className="danger"
              onClick={() =>
                void updateClinicSetting(
                  "isActive",
                  !settingBoolean(draft.isActive),
                )
              }
            >
              {settingBoolean(draft.isActive) ? "Deactivate" : "Activate"}
            </button>
          </article>
          <div className="form-actions">
            <button
              className="primary"
              disabled={!clinicDirty}
              onClick={() => void save()}
            >
              Save Changes
            </button>
          </div>
        </section>
      )}
      {tab === "services" && (
        <section className="clinic-form">
          <article>
            <h2>Services</h2>
            {Object.entries(serviceGroups).map(([group, entries]) => (
              <fieldset key={group}>
                <legend>{group}</legend>
                <div className="service-grid">
                  {entries.map((entry) => {
                    const slug = String(entry.slug);
                    return (
                      <label key={slug} className="check">
                        <input
                          type="checkbox"
                          checked={services.includes(slug)}
                          onChange={() => void toggleService(slug)}
                        />
                        {valueOf(entry.label)}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </article>
        </section>
      )}
      {tab === "languages" && (
        <section className="clinic-form">
          <article>
            <h2>Languages</h2>
            <div className="language-editor">
              <div className="language-chips">
                {languages.map((language) => (
                  <button
                    type="button"
                    className="language-chip"
                    key={language}
                    onClick={() =>
                      setValue(
                        "languages",
                        languages.filter((item) => item !== language),
                      )
                    }
                  >
                    {new Intl.DisplayNames(["en"], { type: "language" }).of(
                      language,
                    ) ?? language}{" "}
                    <span aria-label={`Remove ${language}`}>
                      <AdminIcon name="x" />
                    </span>
                  </button>
                ))}
              </div>
              <div className="language-add">
                <input
                  value={languageEntry}
                  placeholder="Add language"
                  onChange={(event) => setLanguageEntry(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const value = languageEntry.trim();
                      if (
                        value &&
                        !languages.some(
                          (item) => item.toLowerCase() === value.toLowerCase(),
                        )
                      )
                        setValue("languages", [...languages, value]);
                      setLanguageEntry("");
                    }
                  }}
                />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    const value = languageEntry.trim();
                    if (
                      value &&
                      !languages.some(
                        (item) => item.toLowerCase() === value.toLowerCase(),
                      )
                    )
                      setValue("languages", [...languages, value]);
                    setLanguageEntry("");
                  }}
                >
                  Add
                </button>
              </div>
            </div>
            <button
              className="primary"
              onClick={() => void save({ languages })}
            >
              Save Languages
            </button>
          </article>
        </section>
      )}
      {tab === "about" && (
        <section className="clinic-form">
          <article>
            <h2>About</h2>
            <label>
              About
              <RichTextEditor
                value={valueOf(draft.aboutHtml === "—" ? "" : draft.aboutHtml)}
                onChange={(value) => setValue("aboutHtml", value)}
                placeholder="Write clinic description..."
              />
            </label>
            <button
              className="primary"
              onClick={() => save({ aboutHtml: draft.aboutHtml })}
            >
              Save About
            </button>
          </article>
        </section>
      )}
      {tab === "visitors" && (
        <section className="profile-visitors clinic-visitors">
          <h3>Visitors ({valueOf(data.visitorCount ?? 0)})</h3>
          {((data.visitors ?? []) as RecordValue[]).map((visitor, index) => (
            <article key={String(visitor.id ?? index)}>
              <span className="mini-avatar">
                {rowName(visitor).slice(0, 1).toUpperCase()}
              </span>
              <div>
                <b>
                  {rowName(visitor)}{" "}
                  {settingBoolean(visitor.verified) && (
                    <span className="verified-mark">
                      <AdminIcon name="circleCheck" />
                    </span>
                  )}
                </b>
                <p>{valueOf(visitor.profileEmail)}</p>
              </div>
              <p>
                {valueOf(visitor.viewCount)}{" "}
                {Number(visitor.viewCount) === 1 ? "view" : "views"}
              </p>
              <small>
                {compactDate(visitor.updatedAt ?? visitor.createdAt)}
              </small>
            </article>
          ))}
          {!(data.visitors as unknown[] | undefined)?.length && (
            <p className="empty">No visitors.</p>
          )}
        </section>
      )}
      <section className="clinic-danger-zone">
        <div>
          <h3>Permanent Delete</h3>
          <p>
            Permanently delete this clinic, its partner account, all chats, and
            S3 files. This action cannot be undone.
          </p>
        </div>
        <button className="danger" onClick={() => setConfirmDelete(true)}>
          Delete Permanently
        </button>
      </section>
      <ConfirmModal
        open={confirmDelete}
        title="Permanently Delete Clinic"
        message="This action cannot be undone. It will permanently delete this clinic and its connected data."
        confirmLabel="Delete Permanently"
        busy={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={permanentDelete}
      />
    </>
  );
}

function LawyerDetail() {
  const { id = "" } = useParams();
  const [data, setData] = useState<RecordValue | null>(null);
  const [draft, setDraft] = useState<RecordValue>({});
  const [tab, setTab] = useState<"info" | "areas">("info");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    api
      .get<RecordValue>(`/admin/lawyers/${encodeURIComponent(id)}/overview`)
      .then((result) => {
        setData(result);
        setDraft((result.lawyer ?? {}) as RecordValue);
      })
      .catch(() => setError("Could not load lawyer details."));
  useEffect(() => {
    void load();
  }, [id]);
  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="loading-inline">Loading lawyer…</p>;
  const lawyer = (data.lawyer ?? {}) as RecordValue;
  const options = (data.practiceAreaOptions ?? []) as RecordValue[];
  const selected = Array.isArray(draft.practiceAreas)
    ? (draft.practiceAreas as unknown[])
    : [];
  const selectedSlugs = selected.map((area) =>
    typeof area === "object" && area
      ? String((area as RecordValue).slug ?? (area as RecordValue).name ?? "")
      : String(area),
  );
  const lawyerDirty = JSON.stringify(draft) !== JSON.stringify(lawyer);
  const setValue = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async (values = draft) => {
    setBusy(true);
    try {
      await api.patch(`/admin/lawyers/${encodeURIComponent(id)}`, { values });
      setNotice("Changes saved.");
      await load();
    } catch {
      setNotice("Could not save changes.");
    } finally {
      setBusy(false);
    }
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      await api.upload(`/admin/lawyers/${encodeURIComponent(id)}/photo`, form);
      setNotice("Photo uploaded.");
      await load();
    } finally {
      setBusy(false);
      event.currentTarget.value = "";
    }
  };
  const toggleArea = async (option: RecordValue) => {
    const slug = String(option.slug ?? option.name ?? "");
    const next = selectedSlugs.includes(slug)
      ? selected.filter(
          (area) =>
            (typeof area === "object" && area
              ? String(
                  (area as RecordValue).slug ??
                    (area as RecordValue).name ??
                    "",
                )
              : String(area)) !== slug,
        )
      : [...selected, { slug, name: option.name ?? label(slug) }];
    setValue("practiceAreas", next);
    await save({ practiceAreas: next });
  };
  return (
    <>
      <Link className="back" to="/lawyers">
        <AdminIcon name="arrowLeft" /> Back to Lawyers
      </Link>
      {notice && <p className="notice">{notice}</p>}
      <header className="clinic-heading lawyer-heading">
        <div className="clinic-logo lawyer-photo">
          {draft.photoUrl ? (
            <img src={String(draft.photoUrl)} alt="" />
          ) : (
            <AdminIcon name="scale" />
          )}
        </div>
        <div>
          <h1>{valueOf(lawyer.name)}</h1>
          <p>
            {[lawyer.city, lawyer.state, userCountryName(lawyer.country)]
              .filter(Boolean)
              .join(", ") || "—"}
          </p>
        </div>
        <span
          className={`table-badge status-${String(lawyer.status ?? "").toLowerCase()}`}
        >
          {valueOf(lawyer.status)}
        </span>
      </header>
      <nav className="detail-tabs clinic-tabs">
        <button
          className={tab === "info" ? "active" : ""}
          onClick={() => setTab("info")}
        >
          Info
        </button>
        <button
          className={tab === "areas" ? "active" : ""}
          onClick={() => setTab("areas")}
        >
          Practice Areas ({selected.length})
        </button>
      </nav>
      {tab === "info" && (
        <section className="clinic-form lawyer-form">
          <article>
            <h3>Photo</h3>
            <div className="logo-editor">
              <div className="clinic-logo lawyer-photo">
                {draft.photoUrl ? (
                  <img src={String(draft.photoUrl)} alt="Photo" />
                ) : (
                  <AdminIcon name="scale" />
                )}
              </div>
              <div>
                <label className="secondary-button">
                  Upload Photo
                  <input
                    type="file"
                    hidden
                    accept="image/jpeg,image/png,image/webp"
                    onChange={upload}
                  />
                </label>
                <p>JPEG, PNG or WebP. Max 5MB. Will be resized to 400x400.</p>
              </div>
            </div>
          </article>
          <article>
            <h3>General Info</h3>
            <div className="form-grid">
              {[
                ["name", "Name *"],
                ["slug", "Slug"],
                ["website", "Website"],
                ["phone", "Phone"],
                ["fax", "Fax"],
              ].map(([key, title]) => (
                <label key={key}>
                  {title}
                  <input
                    value={
                      valueOf(draft[key]) === "—" ? "" : valueOf(draft[key])
                    }
                    onChange={(event) => setValue(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </article>
          <article>
            <h3>Location</h3>
            <div className="form-grid">
              {[
                ["location", "Address"],
                ["country", "Country"],
                ["state", "State"],
                ["city", "City"],
                ["zip", "ZIP Code"],
              ].map(([key, title]) => (
                <label key={key}>
                  {title}
                  <input
                    value={
                      valueOf(draft[key]) === "—" ? "" : valueOf(draft[key])
                    }
                    onChange={(event) => setValue(key, event.target.value)}
                  />
                </label>
              ))}
              <label>
                Coordinates
                <input
                  value={[draft.latitude, draft.longitude]
                    .filter(
                      (value) =>
                        value !== undefined && value !== null && value !== "",
                    )
                    .join(", ")}
                  disabled
                  readOnly
                />
              </label>
            </div>
          </article>
          <article>
            <h3>Social Links</h3>
            <div className="form-grid">
              {[
                ["facebookUrl", "Facebook"],
                ["instagramUrl", "Instagram"],
                ["linkedinUrl", "LinkedIn"],
              ].map(([key, title]) => (
                <label key={key}>
                  {title}
                  <input
                    value={
                      valueOf(draft[key]) === "—" ? "" : valueOf(draft[key])
                    }
                    onChange={(event) => setValue(key, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </article>
          <article className="settings-row">
            <div>
              <h3>Lawyer Status</h3>
              <p>Toggle whether this lawyer is visible in the public catalog</p>
            </div>
            <button
              className={
                settingBoolean(draft.isActive) ? "danger" : "secondary-button"
              }
              onClick={() =>
                void save({ isActive: !settingBoolean(draft.isActive) })
              }
            >
              {settingBoolean(draft.isActive) ? "Deactivate" : "Activate"}
            </button>
          </article>
          <div className="form-actions">
            <button
              className="primary"
              disabled={busy || !lawyerDirty}
              onClick={() => void save()}
            >
              {busy ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </section>
      )}
      {tab === "areas" && (
        <section className="clinic-form lawyer-form">
          <article>
            <h3>Practice Areas</h3>
            <div className="service-grid lawyer-areas">
              {options.map((option) => {
                const slug = String(option.slug ?? option.name ?? "");
                return (
                  <label className="check" key={slug}>
                    <input
                      type="checkbox"
                      checked={selectedSlugs.includes(slug)}
                      disabled={busy}
                      onChange={() => void toggleArea(option)}
                    />
                    {valueOf(option.name ?? label(slug))}
                  </label>
                );
              })}
            </div>
          </article>
        </section>
      )}
    </>
  );
}

export function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [navCounts, setNavCounts] = useState<RecordValue>({});
  const [contentTransitioning, setContentTransitioning] = useState(false);
  const transitionTimer = useRef<number | null>(null);
  const transitionStarted = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    api
      .get<Session>("/admin/session")
      .then(setSession)
      .catch(() => setSession(null));
  }, []);
  useEffect(() => {
    if (!session) return;
    api
      .get<RecordValue>("/admin/stats")
      .then((payload) => setNavCounts((payload.counts ?? {}) as RecordValue))
      .catch(() => setNavCounts({}));
  }, [session]);
  useEffect(
    () => () => {
      if (transitionTimer.current !== null)
        window.clearTimeout(transitionTimer.current);
    },
    [],
  );
  const beginContentTransition = () => {
    setContentTransitioning(true);
    transitionStarted.current = performance.now();
    if (transitionTimer.current !== null)
      window.clearTimeout(transitionTimer.current);
    const finishWhenReady = () => {
      const elapsed = performance.now() - transitionStarted.current;
      const contentIsLoading = Boolean(
        document.querySelector(".content .loading-inline"),
      );
      if ((elapsed >= 240 && !contentIsLoading) || elapsed >= 10_000) {
        setContentTransitioning(false);
        transitionTimer.current = null;
        return;
      }
      transitionTimer.current = window.setTimeout(finishWhenReady, 80);
    };
    transitionTimer.current = window.setTimeout(finishWhenReady, 240);
  };
  if (session === undefined) return <main className="loading">Loading…</main>;
  if (!session) return <Login onAuthenticated={setSession} />;
  const logout = async () => {
    try {
      await api.post("/admin/logout");
    } finally {
      setSession(null);
      navigate("/dashboard", { replace: true });
    }
  };
  const activeNav = (path: string, active: boolean) =>
    active ||
    (path === "/users" && location.pathname.startsWith("/users/")) ||
    (path === "/clinics" && location.pathname.startsWith("/clinics/")) ||
    (path === "/lawyers" && location.pathname.startsWith("/lawyers/")) ||
    (path === "/articles" && location.pathname.startsWith("/articles/")) ||
    (path === "/static-pages" &&
      location.pathname.startsWith("/static-pages/")) ||
    (path === "/marketing" && location.pathname.startsWith("/marketing/")) ||
    (path === "/support" && location.pathname.startsWith("/support/")) ||
    (path === "/moderation/photos" &&
      location.pathname.startsWith("/moderation/photos"));
  const permissions = new Set(session.permissions ?? ["*"]);
  const permissionForPath = (path: string) =>
    path.startsWith("/moderation/photos")
      ? "moderation-photos"
      : path.startsWith("/moderation/reports")
        ? "moderation-reports"
        : path.startsWith("/static-pages")
          ? "static-pages"
          : path.startsWith("/livekit")
            ? "livekit"
            : path.startsWith("/support")
              ? "support"
              : path.startsWith("/users")
                ? "users"
                : path.startsWith("/clinics")
                  ? "clinics"
                  : path.startsWith("/settings")
                    ? "settings"
                    : path.split("/").filter(Boolean)[0] || "dashboard";
  const canAccess = (path: string) =>
    session.role !== "STAFF" ||
    permissions.has("*") ||
    permissions.has(permissionForPath(path));
  const allowedNav = nav.filter((item) => canAccess(item.path));
  const fallbackPath = allowedNav[0]?.path ?? "/dashboard";
  return (
    <div
      className="app"
      onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        const control = target.closest(
          "aside nav a, .brand, .dashboard-tabs button, .range-tabs button, .member-tabs a, .member-tabs button, .detail-tabs button, .support-tabs button, .moderation-tabs button, .livekit-tabs button, .monitor-tabs button, .storage-tabs button, .status-segments button, .article-language-tabs button, .campaign-tabs button, .campaign-language-tabs button, .settings-tabs button",
        );
        if (!control) return;
        if (control instanceof HTMLButtonElement && control.disabled) return;
        beginContentTransition();
      }}
    >
      <aside>
        <Link className="brand" to="/dashboard">
          LetsBeParents
          <br />
          Admin
        </Link>
        <nav>
          {allowedNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                activeNav(item.path, isActive) ? "active" : ""
              }
            >
              <AdminIcon name={item.icon} />
              <span>{item.title}</span>
              {item.badge && Number(navCounts[item.badge] ?? 0) > 0 && (
                <b className="nav-badge">{valueOf(navCounts[item.badge])}</b>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="admin-account">
          <div className="admin-version">v4.3.50 (f16e15ad)</div>
          <div className="admin-identity">
            <strong>{session.email}</strong>
            <small>{session.role ?? "ADMIN"}</small>
          </div>
          <button
            className="plain-button"
            type="button"
            onClick={() => void logout()}
          >
            <AdminIcon name="logout" />
            Sign Out
          </button>
        </div>
      </aside>
      <main
        className={`content ${location.pathname.startsWith("/support") ? "support-content" : ""}`}
        aria-busy={contentTransitioning}
      >
        {contentTransitioning && (
          <div
            className="content-loading-overlay"
            role="status"
            aria-label="Loading content"
          >
            <span />
          </div>
        )}
        {!canAccess(location.pathname) ? (
          <Navigate to={fallbackPath} replace />
        ) : (
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/monitoring"
              element={<Operations kind="monitoring" />}
            />
            <Route path="/storage" element={<Operations kind="storage" />} />
            <Route path="/support" element={<Support />} />
            <Route path="/support/:id" element={<Support />} />
            <Route path="/photo-moderation" element={<ModerationPhotos />} />
            <Route path="/moderation/photos" element={<ModerationPhotos />} />
            <Route path="/moderation/reports" element={<ModerationReports />} />
            <Route path="/livekit" element={<LiveKitCalls />} />
            <Route path="/static-pages" element={<StaticPages />} />
            <Route
              path="/static-pages/create"
              element={<StaticPageRoute create />}
            />
            <Route path="/static-pages/:slug" element={<StaticPageRoute />} />
            <Route path="/marketing" element={<MarketingFeature />} />
            <Route
              path="/marketing/new"
              element={<MarketingCampaignPage isNew />}
            />
            <Route
              path="/marketing/:campaignId"
              element={<MarketingCampaignPage />}
            />
            <Route
              path="/users/deletion-feedback"
              element={<DeletionFeedback />}
            />
            <Route
              path="/users/partners"
              element={<GenericList view="users" />}
            />
            <Route path="/users/:id" element={<UserDetail />} />
            <Route path="/clinics/:id" element={<ClinicDetail />} />
            <Route path="/lawyers/:id" element={<LawyerDetail />} />
            <Route
              path="/articles/categories"
              element={<ArticlesList view="categories" />}
            />
            <Route
              path="/articles"
              element={<ArticlesList view="articles" />}
            />
            <Route path="/articles/new" element={<ArticleRoute create />} />
            <Route path="/articles/:id" element={<ArticleRoute />} />
            <Route
              path="/settings/api-keys"
              element={<SettingsList view="settings-api-keys" />}
            />
            <Route
              path="/settings/moderation"
              element={<SettingsList view="settings-moderation" />}
            />
            <Route
              path="/settings/modules"
              element={<SettingsList view="settings-modules" />}
            />
            <Route
              path="/settings/ranking"
              element={<SettingsList view="settings-ranking" />}
            />
            <Route
              path="/settings/app-stores"
              element={<SettingsList view="settings-app-stores" />}
            />
            <Route
              path="/settings/audit-log"
              element={<SettingsList view="settings-audit-log" />}
            />
            <Route
              path="/settings"
              element={<SettingsList view="settings" />}
            />
            {allowedNav
              .filter(
                (item) =>
                  item.view &&
                  ![
                    "/support",
                    "/photo-moderation",
                    "/moderation/photos",
                    "/moderation/reports",
                    "/articles",
                    "/livekit",
                    "/static-pages",
                    "/marketing",
                    "/settings",
                  ].includes(item.path),
              )
              .map((item) => (
                <Route
                  key={item.path}
                  path={item.path}
                  element={<GenericList view={item.view!} />}
                />
              ))}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        )}
      </main>
    </div>
  );
}
