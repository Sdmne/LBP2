import { FormEvent, useEffect, useMemo, useState } from "react";
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

const api = createApiClient("/admin/api");
type Session = { email: string; role?: string; permissions?: string[] };
type RecordValue = Record<string, unknown>;
type ListResponse = {
  items: RecordValue[];
  total: number;
  limit: number;
  offset: number;
};
type FilterOption = { value?: unknown; label?: unknown; count?: unknown };
type AdminIconName =
  | "dashboard" | "users" | "crown" | "shield" | "building" | "scale"
  | "file" | "headphones" | "image" | "flag" | "phone" | "activity"
  | "drive" | "code" | "megaphone" | "settings" | "logout" | "userCheck"
  | "alert";
const nav: ReadonlyArray<{ path: string; title: string; view?: string; icon: AdminIconName; badge?: string }> = [
  { path: "/dashboard", title: "Dashboard", icon: "dashboard" },
  { path: "/users", title: "Users", view: "users", icon: "users" },
  { path: "/subscriptions", title: "Subscriptions", view: "subscriptions", icon: "crown" },
  { path: "/verifications", title: "Verifications", view: "verifications", icon: "shield", badge: "pending_verifications" },
  { path: "/clinics", title: "Clinics", view: "clinics", icon: "building" },
  { path: "/lawyers", title: "Lawyers", view: "lawyers", icon: "scale" },
  { path: "/articles", title: "Articles", view: "articles", icon: "file" },
  { path: "/support", title: "Support Chat", view: "support", icon: "headphones", badge: "unanswered_support" },
  {
    path: "/moderation/photos",
    title: "Photo Moderation",
    view: "moderation-photos",
    icon: "image",
  },
  { path: "/moderation/reports", title: "Reports", view: "moderation-reports", icon: "flag", badge: "pending_reports" },
  { path: "/livekit", title: "LiveKit Calls", view: "livekit", icon: "phone" },
  { path: "/monitoring", title: "Monitoring", icon: "activity" },
  { path: "/storage", title: "Storage", icon: "drive" },
  { path: "/static-pages", title: "Static Pages", view: "static-pages", icon: "code" },
  { path: "/marketing", title: "Marketing", view: "marketing", icon: "megaphone" },
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
const detailTabs: Array<[string, string, string]> = [
  ["profile", "Profile", "profile"],
  ["devices", "Devices", "devices"],
  ["verification", "Verification", "verifications"],
  ["support", "Support Chat", "supportMessages"],
  ["messages", "Messages", "messages"],
  ["photos", "Photos", "photos"],
  ["sent-likes", "He Liked", "sentLikes"],
  ["received-likes", "Liked Him", "receivedLikes"],
  ["matches", "Matches", "matches"],
  ["subscriptions", "Subscriptions", "subscriptions"],
  ["clinics", "Liked Clinics", "likedClinics"],
  ["visitors", "Visitors", "visitors"],
  ["blocked", "Blocked", "blocked"],
  ["blocked-by", "Blocked By", "blockedBy"],
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
  if (typeof value === "string") return !["", "0", "false", "off", "no", "null"].includes(value.trim().toLowerCase());
  return Boolean(value);
}
function countryName(value: unknown) {
  const code = String(value ?? "").trim();
  if (!code) return "";
  if (code.length !== 2) return code;
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code === "UK" ? "GB" : code.toUpperCase()) ?? code; }
  catch { return code; }
}
function columnLabel(view: string, column: string) {
  if (view === "users") {
    return ({ displayName: "User", profileType: "Type", createdAt: "Created", blocksCount: "Blocked", reportsCount: "Reports" } as Record<string, string>)[column] ?? label(column);
  }
  if (view === "subscriptions" && column === "profileName") return "User";
  if (view === "verifications") {
    return ({ profileName: "User", verificationStatus: "Status", createdAt: "Created", completed_at: "Completed" } as Record<string, string>)[column] ?? label(column);
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
    ? date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : valueOf(value);
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
  if (!category || typeof category !== "object") return valueOf(meta.categoryName ?? category);
  const value = category as RecordValue;
  const translations = Array.isArray(value.translations) ? value.translations as RecordValue[] : [];
  const english = translations.find((item) => String(item.locale ?? "").toLowerCase() === "en") ?? translations[0];
  return valueOf(english?.name ?? value.name ?? value.slug);
}
function articleDate(value: unknown) {
  return compactDate(value).replaceAll("/", ".");
}

function AdminIcon({ name }: { name: AdminIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<AdminIconName, JSX.Element> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    crown: <path d="m3 6 4 4 5-7 5 7 4-4-2 12H5L3 6Zm2 15h14"/>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4"/>,
    building: <><path d="M3 21h18M6 21V7l6-4 6 4v14"/><path d="M9 9h1m4 0h1M9 13h1m4 0h1M9 17h1m4 0h1"/></>,
    scale: <><path d="m16 16 3-8 3 8a5 5 0 0 1-6 0ZM2 16l3-8 3 8a5 5 0 0 1-6 0ZM7 21h10M12 3v18M3 7h18"/></>,
    file: <><path d="M6 2h9l5 5v15H6zM14 2v6h6"/><path d="M9 13h6M9 17h6"/></>,
    headphones: <><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></>,
    flag: <><path d="M5 22V4"/><path d="M5 4h11l-1 4 1 4H5"/></>,
    phone: <><path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.9Z"/></>,
    activity: <path d="M3 12h4l2-8 4 16 2-8h6"/>,
    drive: <><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 16h.01M10 16h.01M2 12h20"/></>,
    code: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><path d="m10 13-2 2 2 2m4-4 2 2-2 2"/></>,
    megaphone: <><path d="m3 11 18-5v12L3 13v-2Zm5 3 1 6H5l-1-7"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63 1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></>,
    userCheck: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></>,
    alert: <><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" {...common}>{paths[name]}</svg>;
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
  icon?: string;
}) {
  const metricIcon: AdminIconName = title === "Banned" ? "alert" : title === "Active" || title === "Verified" ? "userCheck" : "users";
  return (
    <article className="metric-card">
      <div className="metric-title">
        <span>{title}</span>
        {icon && <i aria-hidden="true"><AdminIcon name={metricIcon} /></i>}
      </div>
      <strong>{valueOf(value)}</strong>
      {hint && <p>{hint}</p>}
    </article>
  );
}
function BarGroup({ title, rows }: { title: string; rows: RecordValue[] }) {
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
        {!rows.length && <p className="empty">No data.</p>}
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
  const partners = (dashboard.partners ?? {}) as RecordValue;
  const devices = (dashboard.devices ?? {}) as RecordValue;
  const funnel = (dashboard.funnel ?? {}) as RecordValue;
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
  return (
    <>
      <header className="page-heading">
        <h1>Dashboard</h1>
      </header>
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
      {tab === "users" && (
        <>
          <section className="metric-grid">
            <MetricCard title="Total Users" value={counts.profiles} icon="♧" />
            <MetricCard
              title="Active"
              value={counts.active_users}
              hint="status active"
              icon="♧"
            />
            <MetricCard title="Banned" value={counts.banned_users} icon="⚠" />
            <MetricCard
              title="DAU"
              value={counts.dau}
              hint="active today (rolling)"
              icon="♧"
            />
            <MetricCard
              title="WAU"
              value={counts.wau}
              hint="active last 7 days"
              icon="♧"
            />
            <MetricCard
              title="MAU"
              value={counts.mau}
              hint="active last 30 days"
              icon="♧"
            />
          </section>
          <DashboardSeries
            series={stats.series as RecordValue | undefined}
            counts={counts}
          />
        </>
      )}
      {tab === "profiles" && (
        <>
          <section className="metric-grid metric-grid-four">
            <MetricCard
              title="Total Profiles"
              value={profiles.totalProfiles}
              hint={`${valueOf(profiles.withoutProfile)} without profile`}
              icon="♧"
            />
            <MetricCard
              title="Avg Completeness"
              value={
                profiles.avgCompleteness ? `${profiles.avgCompleteness}%` : "—"
              }
              hint="profile score"
              icon="%"
            />
            <MetricCard
              title="Verified"
              value={profiles.verified}
              hint={`${valueOf(profiles.unverified)} unverified`}
              icon="♧"
            />
            <MetricCard
              title="Visible"
              value={profiles.visible}
              hint={`${valueOf(profiles.hidden)} hidden`}
              icon="◉"
            />
          </section>
          <h2 className="dashboard-section-title">Identity Verifications</h2>
          <section className="verification-grid">
            {(["approved", "pending", "declined", "abandoned", "expired"] as const).map((status) => {
              const values = (profiles.verifications ?? {}) as RecordValue;
              return (
                <article className={`verification-card verification-${status}`} key={status}>
                  <div><span>{label(status)}</span><AdminIcon name="shield" /></div>
                  <strong>{valueOf(values[status])}</strong>
                </article>
              );
            })}
          </section>
          <h2 className="dashboard-section-title comparison-title">Предложение (профили по типу) vs Спрос (кого ищут)</h2>
          <section className="dashboard-split">
            <BarGroup title="Profile Types" rows={profileTypes} />
            <BarGroup title="Looking For" rows={lookingFor} />
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
              icon="♡"
            />
            <MetricCard
              title="Total Matches"
              value={engagement.totalMatches}
              hint={`${valueOf(engagement.matchesToday)} today`}
              icon="♡"
            />
            <MetricCard
              title="Active Matches"
              value={engagement.activeMatches}
              hint="currently active"
              icon="♧"
            />
            <MetricCard
              title="Match Rate"
              value={engagement.matchRate ? `${engagement.matchRate}%` : "0%"}
              hint="users with matches"
              icon="↗"
            />
          </section>
          <DashboardSeries series={{ engagement: engagement.daily }} mode="engagement" />
          <LikeFlow
            ranges={engagement.likeFlowByRange as RecordValue | undefined}
          />
          <h2 className="dashboard-section-title">Moderation Queue</h2>
          <section className="metric-grid metric-grid-two">
            <MetricCard title="Pending Photos" value={engagement.pendingPhotos} hint="awaiting review" icon="image" />
            <MetricCard title="Pending Reports" value={engagement.pendingReports} hint="awaiting review" icon="flag" />
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
              icon="♧"
            />
            <MetricCard
              title="Premium Users"
              value={subscriptions.premiumUsers}
              hint="isPremium = true"
              icon="♧"
            />
            <MetricCard
              title="Conversion Rate"
              value={`${valueOf(subscriptions.conversionRate)}%`}
              hint="paid / total users"
              icon="%"
            />
            <article className="metric-card plan-card">
              <div className="metric-title"><span>By Plan</span><i><AdminIcon name="crown" /></i></div>
              <div className="plan-list">
                {(Array.isArray(subscriptions.plans) ? (subscriptions.plans as RecordValue[]) : []).map((row, index) => (
                  <p key={`${valueOf(row.label)}-${index}`}><span>{valueOf(row.label)}</span><b>{valueOf(row.count)}</b></p>
                ))}
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
            icon="♧"
          />
          <MetricCard
            title="Total Clinics"
            value={partners.clinics}
            hint={`${valueOf(partners.activeClinics)} active`}
            icon="▥"
          />
          <MetricCard
            title="Total Lawyers"
            value={partners.lawyers}
            hint={`${valueOf(partners.activeLawyers)} active`}
            icon="⚖"
          />
          <MetricCard
            title="New Partners (7d)"
            value={partners.newPartners7d}
            hint="signups this week"
            icon="↗"
          />
          <MetricCard
            title="New Partners (30d)"
            value={partners.newPartners30d}
            hint="signups this month"
            icon="↗"
          />
        </section>
      )}
      {tab === "devices" && (
        <>
          <section className="dashboard-split">
            <BarGroup
              title="Top Countries"
              rows={
                Array.isArray(devices.countries)
                  ? (devices.countries as RecordValue[])
                  : []
              }
            />
            <BarGroup
              title="Device Types"
              rows={
                Array.isArray(devices.devices)
                  ? (devices.devices as RecordValue[])
                  : []
              }
            />
            <BarGroup
              title="Top Browsers"
              rows={
                Array.isArray(devices.browsers)
                  ? (devices.browsers as RecordValue[])
                  : []
              }
            />
          </section>
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
  const width = 980;
  const height = 300;
  const pad = { left: 48, right: 18, top: 16, bottom: 42 };
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
  const path = (values: number[]) =>
    values
      .map(
        (value, index) =>
          `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`,
      )
      .join(" ");
  const active = hovered === null ? null : rows[hovered];
  return (
    <section className="dashboard-panel chart-panel">
      <h2>{title}</h2>
      {!rows.length ? (
        <p className="empty">No event data.</p>
      ) : (
        <>
          <div className="line-chart-wrap">
            <svg
              className="line-chart"
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={title}
              onMouseLeave={() => setHovered(null)}
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
                  (index % Math.max(1, Math.ceil(rows.length / 8)) === 0 ||
                    index === rows.length - 1) && (
                    <text
                      className="x-label"
                      key={String(row.date ?? index)}
                      x={x(index)}
                      y={height - 12}
                      textAnchor="middle"
                    >
                      {String(row.date ?? row.day ?? "").slice(5)}
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
                    onMouseEnter={() => setHovered(index)}
                  />
                )),
              )}
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
              <aside className="chart-tooltip">
                <b>{String(active.date ?? active.day)}</b>
                {series.map((entry) => (
                  <span key={entry.key} style={{ color: entry.color }}>
                    {entry.label}: {entry.values[hovered]}
                  </span>
                ))}
              </aside>
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
function DashboardSeries({ series, counts, mode }: { series?: RecordValue; counts?: RecordValue; mode?: "engagement" }) {
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
  const registrationSeries: ChartSeries[] = [{
    key: "registrations",
    label: "Registrations",
    color: "#f31260",
    values: registrations.slice(-30).map((row) => Number(row.count ?? 0)),
  }];
  return (
    <>
      {!isEngagement && (
        <>
          <div className="registration-heading">
            <h2>Registrations</h2>
            <div className="registration-badges">
              <span className="active">Last 24h: {valueOf(counts?.registrations_1d)}</span>
              <span>Last 7 days: {valueOf(counts?.registrations_7d)}</span>
              <span>Last 30 days: {valueOf(counts?.registrations_30d)}</span>
            </div>
          </div>
          <LineChart
            title="Registrations"
            rows={registrations.slice(-30)}
            series={registrationSeries}
          />
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
              {value}d
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
              {value}d
            </button>
          ))}
        </div>
      </div>
      <p className="muted">Row = sender, column = receiver.</p>
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
    <section className="dashboard-panel">
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
              <th>Messages avg/med</th>
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
      <p className="funnel-note">Каждый % — это доля зарегистрированной когорты той недели, достигшая данной вехи (сами вехи — флаги, выставляемые в мастере регистрации), и считается независимо — это НЕ последовательная воронка, поэтому поздние столбцы могут быть выше ранних (например, «≥1 матч» может оказаться выше «верифицирован»). У когорт старше ~30 дней теряются последующие события удалённых пользователей (% считается среди оставшихся); число регистраций за старые недели может быть занижено.</p>
    </section>
  );
}

function Operations({ kind }: { kind: "monitoring" | "storage" }) {
  const [operations, setOperations] = useState<RecordValue | null>(null);
  const [meta, setMeta] = useState<RecordValue | null>(null);
  const [health, setHealth] = useState<RecordValue | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    setError("");
    Promise.all([
      api.get<RecordValue>("/admin/operations"),
      api.get<RecordValue>("/meta"),
      ...(kind === "monitoring" ? [api.get<RecordValue>("/health")] : []),
    ])
      .then((items) => {
        setOperations(items[0]);
        setMeta(items[1]);
        setHealth((items[2] as RecordValue | undefined) ?? null);
      })
      .catch(() => setError("Could not load operational data."));
  };
  useEffect(load, [kind]);
  const storage = (operations?.storage ?? {}) as RecordValue;
  const integrations = (operations?.integrations ?? {}) as RecordValue;
  const counts = (meta?.counts ?? {}) as RecordValue;
  const rowsTotal = (Object.values(counts) as unknown[]).reduce<number>(
    (sum, value) => sum + (typeof value === "number" ? value : 0),
    0,
  );
  return (
    <>
      <header className="page-heading">
        <h1>{kind === "monitoring" ? "Monitoring" : "Storage"}</h1>
        <button onClick={load}>Refresh</button>
      </header>
      {error && <p className="error">{error}</p>}
      {!operations ? (
        <p className="loading-inline">Loading…</p>
      ) : kind === "monitoring" ? (
        <section className="cards operations">
          <article>
            <span>API</span>
            <strong>{health?.ok ? "Operational" : "Unknown"}</strong>
            <p>
              Database: {valueOf(operations.database ?? health?.database)}
              <br />
              Checked: {valueOf(operations.time)}
            </p>
          </article>
          <article>
            <span>Data rows</span>
            <strong>{rowsTotal}</strong>
            <p>
              {Object.entries(counts)
                .map(([key, value]) => `${key}: ${valueOf(value)}`)
                .join(" · ")}
            </p>
          </article>
          <article>
            <span>Integrations</span>
            <strong>
              {integrations.firebaseProject ? "Connected" : "Review required"}
            </strong>
            <p>
              Firebase:{" "}
              {integrations.firebaseProject ? "configured" : "not configured"}
              <br />
              Vision:{" "}
              {integrations.visionConfigured ? "configured" : "manual review"}
              <br />
              Didit:{" "}
              {integrations.diditConfigured ? "configured" : "not configured"}
              <br />
              Email:{" "}
              {integrations.emailConfigured ? "configured" : "not configured"}
            </p>
          </article>
        </section>
      ) : (
        <section className="cards operations">
          <article>
            <span>Public media</span>
            <strong>
              {Math.round(Number(storage.uploadsFree ?? 0) / 1024 / 1024)} MB
            </strong>
            <p>
              Available of{" "}
              {Math.round(Number(storage.uploadsTotal ?? 0) / 1024 / 1024)} MB
              <br />
              {valueOf(storage.uploadsPath)}
            </p>
          </article>
          <article>
            <span>Media table</span>
            <strong>{valueOf(counts.media_files ?? 0)}</strong>
            <p>media_files rows</p>
          </article>
          <article>
            <span>Quarantine</span>
            <strong>
              {Math.round(Number(storage.quarantineFree ?? 0) / 1024 / 1024)} MB
            </strong>
            <p>Pending photos remain private until moderation approves them.</p>
          </article>
        </section>
      )}
    </>
  );
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
          <button className={unanswered ? "active" : ""} onClick={() => { setOffset(0); setUnanswered(true); }}>Unanswered {unanswered && result ? `(${total})` : ""}</button>
          <button className={!unanswered ? "active" : ""} onClick={() => { setOffset(0); setUnanswered(false); }}>All {!unanswered && result ? `(${total})` : ""}</button>
        </nav>
        <div className="support-search"><input value={query} onChange={(event) => { setOffset(0); setQuery(event.target.value); }} placeholder="Search by name or email..." /></div>
        {error && <p className="error">{error}</p>}
        <div className="support-conversation-list">
          {!result ? <p className="loading-inline">Loading…</p> : items.map((row) => (
            <button className={active?.id === row.id ? "selected" : ""} key={String(row.id)} onClick={() => setActive(row)}>
              <i>{rowName(row).slice(0, 1).toUpperCase()}</i>
              <span><b>{rowName(row)}</b><small>{valueOf(row.profileType ?? row.type ?? row.email)}</small><p>{valueOf(row.lastMessage)}</p></span>
              <time>{compactDate(row.lastMessageAt ?? row.updated_at)}</time>
              {Number(row.unreadCount ?? 0) > 0 && <em>{valueOf(row.unreadCount)}</em>}
            </button>
          ))}
          {result && !items.length && <div className="support-list-empty">No support conversations.</div>}
        </div>
        {total > limit && <div className="support-pager"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - limit))}>‹</button><span>{Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)}</span><button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>›</button></div>}
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
            <div className="support-empty"><AdminIcon name="headphones" /><h2>Select a conversation</h2><p>Choose a support chat from the list to start responding</p></div>
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
          {items.map((row, index) => (
            <article key={String(row.id ?? index)}>
              <img
                src={String(
                  row.publicUrl ??
                    row.url ??
                    (row.data as RecordValue | undefined)?.publicUrl ??
                    "",
                )}
                alt=""
              />
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
          ))}
          {!items.length && <div className="moderation-empty"><b>No photos {status === "PENDING" ? "pending moderation" : `in ${status.toLowerCase()} queue`}</b><p>{status === "PENDING" ? "All photos have been reviewed" : "There are no photos in this section"}</p></div>}
        </section>
      )}
    </>
  );
}

function ModerationReports() {
  const [status, setStatus] = useState("PENDING");
  const [result, setResult] = useState<ListResponse | null>(null);
  const [notice, setNotice] = useState("");
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
  const review = async (row: RecordValue, next: "RESOLVED" | "DISMISSED") => {
    if (!window.confirm(`Mark this report as ${next.toLowerCase()}?`)) return;
    try {
      await api.patch(
        `/admin/item/moderation-reports/${encodeURIComponent(String(row.id))}`,
        { values: { status: next } },
      );
      setNotice(next === "RESOLVED" ? "Report resolved." : "Report dismissed.");
      load();
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
            {title}
          </button>
        ))}
      </nav>
      {notice && (
        <p className={notice.includes("Could not") ? "error" : "notice"}>
          {notice}
        </p>
      )}
      <section className="table">
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
                        Resolve
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => void review(row, "DISMISSED")}
                      >
                        Dismiss
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td className="empty" colSpan={status === "PENDING" ? 6 : 5}>
                    No reports in this section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

function LiveKitCalls() {
  const [tab, setTab] = useState<"live" | "history" | "statistics">("live");
  const [result, setResult] = useState<ListResponse | null>(null);
  const [updatedAt, setUpdatedAt] = useState(new Date());
  const load = () => {
    setResult(null);
    api.get<ListResponse>("/admin/list/livekit?limit=100&offset=0")
      .then((data) => { setResult(data); setUpdatedAt(new Date()); })
      .catch(() => setResult({ items: [], total: 0, limit: 100, offset: 0 }));
  };
  useEffect(() => { void load(); }, []);
  const rows = result?.items ?? [];
  const activeRows = rows.filter((row) => ["ACTIVE", "CONNECTED", "RINGING"].includes(String(row.status ?? (row.data as RecordValue | undefined)?.status ?? "").toUpperCase()));
  const endedRows = rows.filter((row) => !activeRows.includes(row));
  return (
    <>
      <header className="livekit-heading"><h1>LiveKit Calls</h1><p>Monitor video and voice calls in real-time</p></header>
      <nav className="livekit-tabs">
        <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>⌕&nbsp; Live Calls</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>◷&nbsp; Call History</button>
        <button className={tab === "statistics" ? "active" : ""} onClick={() => setTab("statistics")}>▥&nbsp; Statistics</button>
      </nav>
      {tab === "live" && <>
        <div className="livekit-toolbar"><span><i />{activeRows.length} active calls&nbsp; · Updated {Math.max(0, Math.floor((Date.now() - updatedAt.valueOf()) / 1000))}s ago</span><button className="secondary-button" onClick={load}>↻&nbsp; Refresh</button></div>
        <section className="livekit-empty"><b>✓</b><h2>{result ? "No active calls" : "Loading..."}</h2><p>{result ? "All quiet right now" : ""}</p></section>
      </>}
      {tab === "history" && <section className="livekit-history">
        <select aria-label="Call status"><option>All statuses</option><option>Ended</option><option>Declined</option><option>Missed</option></select>
        <div className="table"><table><thead><tr><th>Date</th><th>Caller</th><th>Callee</th><th>Type</th><th>Duration</th><th>Status</th></tr></thead><tbody>{endedRows.map((row, index) => { const data = (row.data ?? row) as RecordValue; return <tr key={String(row.id ?? index)}><td>{verificationDate(data.createdAt ?? row.created_at)}</td><td>{valueOf(data.callerName ?? data.caller)}</td><td>{valueOf(data.calleeName ?? data.callee)}</td><td>{valueOf(data.type)}</td><td>{valueOf(data.duration)}</td><td><span className={`table-badge status-${String(data.status ?? row.status ?? "").toLowerCase()}`}>{valueOf(data.status ?? row.status)}</span></td></tr>; })}{result && !endedRows.length && <tr><td className="empty" colSpan={6}>No call history</td></tr>}</tbody></table></div>
      </section>}
      {tab === "statistics" && <section className="livekit-statistics">
        <select aria-label="Statistics period"><option>Last 7 days</option><option>Last 30 days</option></select>
        <div className="metric-grid metric-grid-four"><MetricCard title="Total Calls" value={rows.length} hint="in last 7 days" icon="phone" /><MetricCard title="Avg Duration" value="0s" hint="per call" icon="activity" /><MetricCard title="Missed Rate" value="0%" icon="alert" /><MetricCard title="Video / Audio" value="0 / 0" hint="calls by type" icon="phone" /></div>
        <article className="dashboard-panel livekit-chart"><h3>Calls per day</h3><p>Last 7 days</p><div>{Array.from({length: 7}, (_, index) => <span key={index}>{new Date(Date.now() - (6-index)*86400000).toLocaleDateString('en-CA',{month:'2-digit',day:'2-digit'})}</span>)}</div></article>
      </section>}
    </>
  );
}

function StaticPages() {
  const [result, setResult] = useState<ListResponse | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<RecordValue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get<ListResponse>("/admin/list/static-pages?limit=100&offset=0").then(setResult);
  useEffect(() => { void load(); }, []);
  const groups = useMemo(() => {
    const map = new Map<string, RecordValue[]>();
    for (const row of result?.items ?? []) {
      const key = String(row.slug ?? row.id);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return [...map.entries()].map(([slug, rows]) => {
      const primary = rows.find((row) => row.locale === "en") ?? rows[0];
      const meta = (primary.data && typeof primary.data === "object" ? primary.data : {}) as RecordValue;
      const inFooter = Boolean(meta.inFooter ?? meta.in_footer ?? ["terms-of-use", "privacy-policy"].includes(slug));
      return { slug, rows, primary, inFooter };
    }).filter((group) => !query.trim() || `${group.primary.title} ${group.slug}`.toLowerCase().includes(query.trim().toLowerCase()));
  }, [result, query]);
  const toggleFooter = async (group: typeof groups[number]) => {
    setBusy(true);
    try {
      await Promise.all(group.rows.map((row) => api.patch(`/admin/item/static-pages/${encodeURIComponent(String(row.id))}`, { values: { meta: { ...((row.data ?? {}) as RecordValue), inFooter: !group.inFooter } } })));
      await load();
    } finally { setBusy(false); }
  };
  const archive = async (group: typeof groups[number]) => {
    if (!window.confirm(`Delete ${valueOf(group.primary.title)}?`)) return;
    setBusy(true);
    try { await Promise.all(group.rows.map((row) => api.delete(`/admin/item/static-pages/${encodeURIComponent(String(row.id))}`))); await load(); }
    finally { setBusy(false); }
  };
  if (editing) return <StaticPageEditor rows={editing} busy={busy} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />;
  const renderGroup = (group: typeof groups[number], draggable = false) => <div className="static-page-row" key={group.slug}>
    {draggable && <button type="button" className="drag-handle" aria-label="Drag to reorder">⠿</button>}
    <button type="button" className="static-page-name" onClick={() => setEditing(group.rows)}><b>{valueOf(group.primary.title)}</b><small>/{group.slug}</small></button>
    <span className={`table-badge status-${String(group.primary.status ?? "").toLowerCase()}`}>{valueOf(group.primary.status)}</span>
    <label className="static-footer-toggle"><input type="checkbox" role="switch" aria-label="In footer" checked={group.inFooter} disabled={busy} onChange={() => void toggleFooter(group)} /><span /> In footer</label>
    <button type="button" className="static-icon-button" aria-label="Edit page" onClick={() => setEditing(group.rows)}>✎</button>
    <button type="button" className="static-icon-button delete" aria-label="Delete page" onClick={() => void archive(group)}>♲</button>
  </div>;
  const footerPages = groups.filter((group) => group.inFooter);
  const otherPages = groups.filter((group) => !group.inFooter);
  return <>
    <header className="page-heading static-heading"><div><h1>Static Pages</h1><p>Manage legal, policy, and informational pages. Toggle In footer to show a page in the website footer, and drag to reorder footer links.</p></div><button className="primary" onClick={() => setEditing([{ __new: true, locale: "en", slug: "", title: "", status: "DRAFT", data: {} }])}>＋ New Page</button></header>
    <div className="static-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages..." /></div>
    <section className="static-page-section"><header><h2>Shown in footer</h2><span>{footerPages.length} {footerPages.length === 1 ? "page" : "pages"}· drag to reorder</span></header><div>{footerPages.map((group) => renderGroup(group, true))}</div></section>
    <section className="static-page-section"><header><h2>Other pages</h2><span>{otherPages.length} {otherPages.length === 1 ? "page" : "pages"}</span></header><div>{otherPages.map((group) => renderGroup(group))}</div></section>
  </>;
}

function StaticPageEditor({ rows, busy, onClose, onSaved }: { rows: RecordValue[]; busy: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [locale, setLocale] = useState(String(rows[0]?.locale ?? "en"));
  const current = rows.find((row) => row.locale === locale) ?? rows[0];
  const [title, setTitle] = useState(String(current?.title ?? ""));
  const [slug, setSlug] = useState(String(current?.slug ?? ""));
  const [body, setBody] = useState(String(current?.body_html ?? ""));
  const [status, setStatus] = useState(String(current?.status ?? "DRAFT").toUpperCase());
  const pageMeta = (row: RecordValue | undefined) => {
    const next = {...((row?.data ?? {}) as RecordValue)};
    if (next.inFooter === undefined) next.inFooter = ["terms-of-use", "privacy-policy"].includes(String(row?.slug ?? ""));
    return next;
  };
  const [meta, setMeta] = useState<RecordValue>(() => pageMeta(current));
  const switchLocale = (next: string) => {
    const row = rows.find((item) => item.locale === next);
    setLocale(next); setTitle(String(row?.title ?? "")); setSlug(String(row?.slug ?? rows[0]?.slug ?? "")); setBody(String(row?.body_html ?? "")); setStatus(String(row?.status ?? "DRAFT").toUpperCase()); setMeta(pageMeta(row));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const values = { locale, title, slug, body_html: body, status, meta };
    if (current?.__new || !current?.id) await api.post("/admin/create/static-pages", { values });
    else await api.patch(`/admin/item/static-pages/${encodeURIComponent(String(current.id))}`, { values });
    await onSaved();
  };
  return <form className="article-editor-page" onSubmit={submit}>
    <header className="article-editor-heading"><button type="button" className="article-back" aria-label="Back" onClick={onClose}>←</button><h1>{current?.__new ? "New Page" : "Edit Page"}</h1></header>
    <div className="article-editor-grid"><section className="article-editor-main">
      <nav className="article-language-tabs">{[["en","English"],["ru","Russian"],["es","Spanish"]].map(([code,name]) => <button type="button" key={code} className={locale === code ? "active" : ""} onClick={() => switchLocale(code)}>{name}</button>)}</nav>
      <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Page title" required /></label>
      <label>Content<div className="rich-editor"><div className="editor-toolbar"><button type="button" onClick={() => document.execCommand('bold')}><b>B</b></button><button type="button" onClick={() => document.execCommand('italic')}><i>I</i></button><button type="button" onClick={() => document.execCommand('insertUnorderedList')}>•≡</button><button type="button" onClick={() => document.execCommand('insertOrderedList')}>1≡</button></div><div className="article-content-editor" contentEditable suppressContentEditableWarning onInput={(event) => setBody(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{__html: body}} data-placeholder="Write page content..." /></div></label>
    </section><aside className="article-editor-side"><section className="article-settings-card"><h3>Settings</h3><label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="page-slug" required /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label><label className="static-footer-toggle editor-toggle"><input type="checkbox" role="switch" checked={Boolean(meta.inFooter)} onChange={(event) => setMeta({...meta, inFooter:event.target.checked})} /><span /> In footer</label></section><div className="article-editor-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy || !title.trim() || !slug.trim()}>Save Page</button></div></aside></div>
  </form>;
}

function Marketing() {
  const [result, setResult] = useState<ListResponse | null>(null);
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<RecordValue | null>(null);
  const load = () => api.get<ListResponse>(`/admin/list/marketing?limit=100&offset=0${status ? `&status=${status}` : ""}`).then(setResult);
  useEffect(() => { void load(); }, [status]);
  if (editing) return <CampaignEditor row={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />;
  const rows = result?.items ?? [];
  return <>
    <header className="page-heading marketing-heading"><div><h1>Marketing <span>({result?.total ?? 0})</span></h1><p>Broadcast campaigns sent as chat messages and/or push notifications.</p></div><button className="primary" onClick={() => setEditing({__new:true,title:"",status:"DRAFT",locale:"en",data:{}})}>＋ New Campaign</button></header>
    <nav className="campaign-tabs">{["","DRAFT","SCHEDULED","SENDING","SENT","FAILED","CANCELLED"].map((value) => <button key={value || 'all'} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{value ? statusLabel(value) : "All"}</button>)}</nav>
    <section className="table campaign-table"><table><thead><tr><th>Title</th><th>Status</th><th>Recipients</th><th>Channel</th><th>Created by</th><th>When</th><th>Actions</th></tr></thead><tbody>{rows.map((row,index) => { const data=(row.data ?? {}) as RecordValue; return <tr key={String(row.id ?? index)}><td><button className="campaign-title" onClick={() => setEditing(row)}>{valueOf(row.title)}</button></td><td><span className={`table-badge status-${String(row.status ?? '').toLowerCase()}`}>{valueOf(row.status)}</span></td><td>{valueOf(data.recipients ?? data.recipientCount ?? 0)}</td><td>{valueOf(data.delivery ?? data.channel)}</td><td>{valueOf(data.createdBy ?? 'Admin')}</td><td>{verificationDate(data.scheduledAt ?? row.created_at)}</td><td><button className="row-action" onClick={() => setEditing(row)}>Manage</button></td></tr>; })}</tbody></table>{result && !rows.length && <div className="campaign-empty">No campaigns yet — click 'New Campaign' to create one.</div>}</section>
  </>;
}

function CampaignEditor({ row, onClose, onSaved }: { row: RecordValue; onClose: () => void; onSaved: () => Promise<void> }) {
  const initial = (row.data ?? {}) as RecordValue;
  const [title, setTitle] = useState(String(row.title ?? ""));
  const [contentLocale, setContentLocale] = useState("en");
  const [messages, setMessages] = useState<Record<string,string>>((initial.messages ?? {}) as Record<string,string>);
  const [audienceLocale, setAudienceLocale] = useState(String(initial.audienceLocale ?? "en"));
  const [wizard, setWizard] = useState(String(initial.wizard ?? "all"));
  const [premium, setPremium] = useState(String(initial.premium ?? "all"));
  const [delivery, setDelivery] = useState(String(initial.delivery ?? "CHAT_PUSH"));
  const [respectPreference, setRespectPreference] = useState(initial.respectPreference !== false);
  const [schedule, setSchedule] = useState(String(initial.schedule ?? "now"));
  const [scheduledAt, setScheduledAt] = useState(String(initial.scheduledAt ?? ""));
  const [recipients, setRecipients] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get<RecordValue>("/admin/stats").then((data) => setRecipients(Number(((data.counts ?? {}) as RecordValue).profiles ?? 0))).catch(() => setRecipients(0)); }, []);
  const save = async (nextStatus: string) => {
    if (!title.trim() || !messages[contentLocale]?.trim()) return;
    setBusy(true);
    const data = {...initial,messages,audienceLocale,wizard,premium,delivery,respectPreference,schedule,scheduledAt: schedule === 'later' ? scheduledAt : null,recipients};
    const values={title:title.trim(),status:nextStatus,locale:contentLocale,slug:String(row.slug ?? `campaign-${Date.now()}`),data};
    try { if (row.__new) await api.post("/admin/create/marketing",{values}); else await api.patch(`/admin/item/marketing/${encodeURIComponent(String(row.id))}`,{values}); await onSaved(); } finally { setBusy(false); }
  };
  const message = messages[contentLocale] ?? "";
  return <section className="campaign-editor"><header className="article-editor-heading"><button type="button" className="article-back" aria-label="Back" onClick={onClose}>←</button><h1>{row.__new ? "New Campaign" : "Edit Campaign"}</h1></header>
    <label>Title (internal — never shown to recipients)<input maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Q3 re-engagement push to ru/es users" /><small>{title.length}/200</small></label>
    <section className="campaign-card"><h3>Content</h3><nav className="article-language-tabs">{[["en","English*"],["ru","Russian"],["es","Spanish"]].map(([code,name]) => <button type="button" key={code} className={contentLocale === code ? "active" : ""} onClick={() => setContentLocale(code)}>{name}</button>)}</nav><div className="variable-row">Insert variable: <button type="button" onClick={() => setMessages({...messages,[contentLocale]:`${message}{firstName}`})}>{'{firstName}'}</button></div><textarea rows={7} maxLength={5000} value={message} onChange={(event) => setMessages({...messages,[contentLocale]:event.target.value})} placeholder="Write the broadcast message (required)..." /><small>{message.length}/5000</small></section>
    <section className="campaign-card"><h3>Audience</h3><p><b>Status: ACTIVE</b> <span>(locked)</span>&nbsp;&nbsp; <b>Role: USER</b> <span>(locked)</span></p><p className="muted">System users, staff, banned, and deleted users are always excluded.</p><label>Locale *<select value={audienceLocale} onChange={(event) => setAudienceLocale(event.target.value)}><option value="en">English</option><option value="ru">Russian</option><option value="es">Spanish</option></select></label><CampaignRadios title="Wizard completed" value={wizard} setValue={setWizard} options={[["all","All"],["completed","Completed only"],["incomplete","Not completed"]]} /><CampaignRadios title="Premium status" value={premium} setValue={setPremium} options={[["all","All"],["premium","Premium only"],["free","Free only"]]} /></section>
    <section className="campaign-card"><CampaignRadios title="Delivery" value={delivery} setValue={setDelivery} options={[["CHAT_PUSH","Chat message + Push notification (recommended)"],["CHAT","Chat only"],["PUSH","Push only"]]} /><label className="campaign-checkbox"><input type="checkbox" checked={respectPreference} onChange={(event) => setRespectPreference(event.target.checked)} />Respect “marketing notifications” user preference (recommended)</label></section>
    <section className="campaign-card"><CampaignRadios title="Schedule" value={schedule} setValue={setSchedule} options={[["now","Send now"],["later","Schedule for later..."]]} />{schedule === "later" && <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />}</section>
    <section className="campaign-preview"><span>Live recipient preview</span><b>{recipients.toLocaleString()}</b><small>recipients</small></section>
    <div className="campaign-actions"><button className="secondary-button" disabled={busy || !title.trim() || !message.trim()} onClick={() => void save("DRAFT")}>Save draft</button><button className="primary" disabled={busy || !title.trim() || !message.trim()} onClick={() => void save(schedule === "later" ? "SCHEDULED" : "SENDING")}>{schedule === "later" ? "Schedule" : "Send now"}</button></div>
  </section>;
}

function CampaignRadios({ title, value, setValue, options }: { title: string; value: string; setValue: (value:string)=>void; options: string[][] }) {
  return <fieldset className="campaign-radios"><legend>{title}</legend><div>{options.map(([key,name]) => <label key={key}><input type="radio" name={title} checked={value===key} onChange={() => setValue(key)} />{name}</label>)}</div></fieldset>;
}

function GenericList({ view }: { view: string }) {
  const location = useLocation();
  const isPartnerUsers =
    view === "users" && location.pathname.endsWith("/partners");
  const [result, setResult] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<Record<string, string>>({});
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
  const limit = view === "articles" ? 100 : ["users", "verifications", "clinics", "lawyers"].includes(view) ? 50 : 25;
  useEffect(() => {
    setFilters(
      isPartnerUsers
        ? { role: "PARTNER" }
        : view === "users"
          ? { role: "USER" }
          : {},
    );
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
    api.get<RecordValue>("/admin/stats")
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
  const maxOffset = Math.max(0, total - limit);
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
    if (view === "articles") setEditing(row);
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
          {label(view)} {!["subscriptions", "articles"].includes(view) && result ? <span>({total})</span> : ""}
        </h1>
        <div className="page-actions">
          {view === "subscriptions" && (
            <button className="primary grant-premium-button" onClick={() => setGrantOpen(true)}>
              <AdminIcon name="crown" /> Grant Premium
            </button>
          )}
          {view === "articles" && (
            <button className="secondary-button categories-button" type="button" onClick={() => setCategoriesOpen(true)}>☷&nbsp; Categories</button>
          )}
          {view === "users" && (
            <Link className="secondary-button" to="/users/deletion-feedback">
              Deletion feedback
            </Link>
          )}
          {creatable && (
            <button
              className="primary"
              onClick={() =>
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
                })
              }
            >
              New {label(view).replace(/s$/, "")}
            </button>
          )}
        </div>
      </header>
      {view === "subscriptions" && (
        <section className="metric-grid metric-grid-four subscription-summary">
          <MetricCard title="Total Premium" value={summaryCounts.active_subscriptions} hint={`${valueOf(summaryCounts.active_subscriptions && total ? Math.round((Number(summaryCounts.active_subscriptions) / Math.max(1, Number(summaryCounts.profiles ?? total))) * 1000) / 10 : 0)}% conversion rate`} icon="crown" />
          <MetricCard title="Manual Grants" value={summaryCounts.manual_subscriptions} hint={`${valueOf(summaryCounts.manual_subscriptions_30d)} in last 30 days`} icon="userCheck" />
          <MetricCard title="App Store" value={summaryCounts.app_store_subscriptions} icon="phone" />
          <MetricCard title="Play Store" value={summaryCounts.play_store_subscriptions} icon="drive" />
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
      <section className={`list-controls ${view === "users" ? "user-list-controls" : view === "subscriptions" ? "subscription-list-controls" : view === "verifications" ? "verification-list-controls" : ["clinics", "lawyers"].includes(view) ? "directory-list-controls" : view === "articles" ? "article-list-controls" : ""}`}>
        <input
          value={query}
          onChange={(event) => {
            setOffset(0);
            setQuery(event.target.value);
          }}
          placeholder={`Search ${label(view).toLowerCase()}...`}
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
            {["clinics", "lawyers", "verifications"].includes(
              view,
            ) && (
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
                  ? ["PENDING", "APPROVED", "DECLINED", "ABANDONED", "EXPIRED"].map((value) => ({ value }))
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
                        setFilters((current) => ({ ...current, hasWebsite: event.target.value }));
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
                        setFilters((current) => ({ ...current, hasLogo: event.target.value }));
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
                  placeholder="Filter by city..."
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
                    setFilters((current) => ({ ...current, plan: event.target.value }));
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
                    setFilters((current) => ({ ...current, status: event.target.value }));
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
                    setFilters((current) => ({ ...current, source: event.target.value }));
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
          {total > limit && <div className="pager">
            <button
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </button>
            <span>
              Page {Math.floor(offset / limit) + 1} of{" "}
              {Math.max(1, Math.ceil(total / limit))}
            </span>
            <button
              disabled={offset >= maxOffset}
              onClick={() => setOffset(Math.min(maxOffset, offset + limit))}
            >
              Next
            </button>
          </div>}
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
                          view === "articles"
                            ? "clickable"
                            : ""
                        }
                      >
                        {visibleColumns.map((column) => (
                          <td key={column}>
                            {view === "articles" && column === "title" ? (
                              <div className="article-title-cell"><b>{valueOf(row.title)}</b><small>{valueOf(row.slug)}</small></div>
                            ) : view === "articles" && column === "category" ? (
                              <span className="category-badge">{articleCategory(row)}</span>
                            ) : view === "articles" && column === "views" ? (
                              valueOf((row.data as RecordValue | undefined)?.views ?? 0)
                            ) : column === "location" ? (
                              [row.city, countryName(row.country)].filter(Boolean).map(valueOf).join(", ") || "—"
                            ) : column === "partner" ? (
                              valueOf(row.partnerName ?? row.partner)
                            ) : column === "services" ? (
                              valueOf(row.servicesCount ?? row.services)
                            ) : column === "practiceAreas" ? (
                              Array.isArray(row[column]) ? (row[column] as unknown[]).length : valueOf(row.practiceAreasCount ?? row[column])
                            ) : column === "status" || column === "verificationStatus" ? (
                              <span className={`table-badge status-${String(row[column] ?? "").toLowerCase()}`}>
                                {valueOf(row[column])}
                              </span>
                            ) : column.toLowerCase().includes("created") ||
                            column.toLowerCase().includes("completed") ? (
                              view === "verifications"
                                ? verificationDate(row[column])
                                : compactDate(row[column])
                            ) : view === "articles" && column === "updated_at" ? (
                              articleDate(row[column])
                            ) : ["displayName", "profileName", "name"].includes(
                                column,
                              ) ? (
                              <div className="person-cell">
                                {row.avatarUrl ||
                                row.logoUrl ||
                                row.photoUrl ? (
                                  <img
                                    src={String(
                                      row.avatarUrl ??
                                        row.logoUrl ??
                                        row.photoUrl,
                                    )}
                                    alt=""
                                  />
                                ) : (
                                  <i>
                                    {rowName(row).slice(0, 1).toUpperCase()}
                                  </i>
                                )}
                                <span>
                                  <b>{rowName(row)}</b>
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
                              <span className="row-actions">
                                {String(row.status ?? "").toUpperCase() ===
                                  "PENDING" && (
                                  <>
                                    <button
                                      className="row-action"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setSubscriptionReview({
                                          row,
                                          status: "APPROVED",
                                        });
                                      }}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      className="row-action"
                                      onClick={(event) => {
                                        event.stopPropagation();
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
                                  className="row-action danger-text"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSubscriptionToRevoke(row);
                                  }}
                                >
                                  Revoke Premium
                                </button>
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
        </>
      )}
      {grantOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal grant-modal" onSubmit={grantSubscription}>
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setGrantOpen(false)}>×</button>
            <h2><AdminIcon name="crown" /> Grant Premium</h2>
            <label>
              User
              <input value={grantUser} onChange={(event) => setGrantUser(event.target.value)} placeholder="Search by email or name..." required />
            </label>
            <label>
              Plan
              <select value={grantPlan} onChange={(event) => setGrantPlan(event.target.value)}>
                <option value="MONTHLY">Premium Monthly</option>
                <option value="QUARTERLY">Premium Quarterly</option>
                <option value="ANNUAL">Premium Annual</option>
              </select>
            </label>
            <label>
              Duration (days)
              <input type="number" min={1} max={3650} value={grantDays} onChange={(event) => setGrantDays(Number(event.target.value) || 30)} />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={() => setGrantOpen(false)}>Cancel</button>
              <button className="primary" disabled={saving}>{saving ? "Working…" : "Grant Premium"}</button>
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
        <CategoryManager open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
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
  return view === "categories" ? <Navigate to="/articles" replace /> : <GenericList view={view} />;
}

function CategoryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [items, setItems] = useState<RecordValue[]>([]);
  const [nameEn, setNameEn] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [slug, setSlug] = useState("");
  const [editing, setEditing] = useState<RecordValue | null>(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get<ListResponse>("/admin/list/categories?limit=100&offset=0").then((data) => setItems(data.items));
  useEffect(() => { if (open) void load(); }, [open]);
  if (!open) return null;
  const fields = (row: RecordValue) => {
    const data = (row.data && typeof row.data === "object" ? row.data : row) as RecordValue;
    const translations = Array.isArray(data.translations) ? data.translations as RecordValue[] : [];
    return {
      data,
      en: valueOf(translations.find((item) => item.locale === "en")?.name ?? data.name ?? row.title),
      ru: valueOf(translations.find((item) => item.locale === "ru")?.name ?? ""),
      slug: valueOf(data.slug ?? row.slug ?? row.title),
    };
  };
  const reset = () => { setEditing(null); setNameEn(""); setNameRu(""); setSlug(""); };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!nameEn.trim() || !slug.trim()) return;
    setBusy(true);
    const original = editing ? fields(editing).data : {};
    const values = {
      title: nameEn.trim(), slug: slug.trim(), status: "active", locale: "en",
      data: {
        ...original,
        name: nameEn.trim(), slug: slug.trim(), isActive: true,
        translations: [
          { locale: "en", name: nameEn.trim() },
          ...(nameRu.trim() ? [{ locale: "ru", name: nameRu.trim() }] : []),
        ],
      },
    };
    try {
      if (editing) await api.patch(`/admin/item/categories/${encodeURIComponent(String(editing.id))}`, { values });
      else await api.post("/admin/create/categories", { values });
      reset();
      await load();
    } finally { setBusy(false); }
  };
  return (
    <div className="modal-backdrop category-backdrop" role="presentation">
      <section className="modal category-manager" role="dialog" aria-modal="true" aria-label="Manage Categories">
        <h2>Manage Categories</h2>
        <form className="category-add-row" onSubmit={save}>
          <label>Name (EN)<input value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="Category name" /></label>
          <label>Name (RU)<input value={nameRu} onChange={(event) => setNameRu(event.target.value)} placeholder="Название категории" /></label>
          <label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="category-slug" /></label>
          <button className="primary" disabled={busy || !nameEn.trim() || !slug.trim()}>{editing ? "Save" : "Add"}</button>
        </form>
        <div className="category-list">
          {items.map((item) => {
            const data = fields(item);
            return <div className="category-row" key={String(item.id)}><span><b>{data.en}</b><small>{data.slug}</small></span><div><button type="button" aria-label={`Edit ${data.en}`} onClick={() => { setEditing(item); setNameEn(data.en === "—" ? "" : data.en); setNameRu(data.ru === "—" ? "" : data.ru); setSlug(data.slug === "—" ? "" : data.slug); }}>✎</button><button type="button" aria-label={`Delete ${data.en}`} onClick={async () => { if (!window.confirm(`Archive ${data.en}?`)) return; await api.delete(`/admin/item/categories/${encodeURIComponent(String(item.id))}`); await load(); }}>♲</button></div></div>;
          })}
        </div>
        <div className="category-footer"><button type="button" className="secondary-button" onClick={onClose}>Close</button></div>
      </section>
    </div>
  );
}

function ArticleEditor({
  row,
  busy,
  onClose,
  onSave,
}: {
  row: RecordValue;
  busy: boolean;
  onClose: () => void;
  onSave: (values: RecordValue) => Promise<void>;
}) {
  const initialMeta = (row.data && typeof row.data === "object" ? row.data : {}) as RecordValue;
  const [locale, setLocale] = useState(String(row.locale ?? "en"));
  const [title, setTitle] = useState(String(row.title ?? ""));
  const [excerpt, setExcerpt] = useState(String(row.excerpt ?? ""));
  const [body, setBody] = useState(String(row.body_html ?? ""));
  const [slug, setSlug] = useState(String(row.slug ?? ""));
  const [status, setStatus] = useState(String(row.status ?? "DRAFT").toUpperCase());
  const [coverUrl, setCoverUrl] = useState(String(row.cover_url ?? ""));
  const [tags, setTags] = useState(Array.isArray(initialMeta.tags) ? (initialMeta.tags as unknown[]).join(", ") : String(initialMeta.tags ?? ""));
  const [metaTitle, setMetaTitle] = useState(String(initialMeta.metaTitle ?? initialMeta.seoTitle ?? ""));
  const [metaDescription, setMetaDescription] = useState(String(initialMeta.metaDescription ?? initialMeta.seoDescription ?? ""));
  const [ogImage, setOgImage] = useState(String(initialMeta.ogImage ?? ""));
  const [category, setCategory] = useState<RecordValue | null>(initialMeta.category && typeof initialMeta.category === "object" ? initialMeta.category as RecordValue : null);
  const [categories, setCategories] = useState<RecordValue[]>([]);
  useEffect(() => {
    api.get<ListResponse>("/admin/list/categories?limit=100&offset=0")
      .then((data) => setCategories(data.items))
      .catch(() => setCategories([]));
  }, []);
  const categoryId = String(category?.id ?? category?.sourceId ?? category?.slug ?? "");
  const runFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    const editor = document.querySelector(".article-content-editor");
    if (editor) setBody(editor.innerHTML);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const meta: RecordValue = {
      ...initialMeta,
      category,
      tags: tags.split(",").map((item) => item.trim()).filter(Boolean),
      metaTitle,
      metaDescription,
      ogImage,
    };
    await onSave({ locale, title, excerpt, body_html: body, slug, cover_url: coverUrl, status, meta });
  };
  return (
    <form className="article-editor-page" onSubmit={submit}>
      <header className="article-editor-heading">
        <button type="button" className="article-back" aria-label="Back" onClick={onClose}>←</button>
        <h1>{row.__new ? "New Article" : "Edit Article"}</h1>
      </header>
      <div className="article-editor-grid">
        <section className="article-editor-main">
          <nav className="article-language-tabs">
            {[['en', 'English'], ['ru', 'Russian'], ['es', 'Spanish']].map(([code, name]) => (
              <button type="button" key={code} className={locale === code ? "active" : ""} onClick={() => setLocale(code)}>{name}</button>
            ))}
          </nav>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Article title" required /></label>
          <label>Excerpt<textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="Short description..." rows={3} /></label>
          <label>Content
            <div className="rich-editor">
              <div className="editor-toolbar">
                <button type="button" aria-label="Bold" onClick={() => runFormat('bold')}><b>B</b></button>
                <button type="button" aria-label="Italic" onClick={() => runFormat('italic')}><i>I</i></button>
                <button type="button" aria-label="Underline" onClick={() => runFormat('underline')}><u>U</u></button>
                <button type="button" aria-label="Strikethrough" onClick={() => runFormat('strikeThrough')}><s>S</s></button>
                {[2,3,4].map((level) => <button type="button" key={level} aria-label={`Heading ${level}`} onClick={() => runFormat('formatBlock', `h${level}`)}>H<sub>{level}</sub></button>)}
                <button type="button" aria-label="Bullet list" onClick={() => runFormat('insertUnorderedList')}>•≡</button>
                <button type="button" aria-label="Ordered list" onClick={() => runFormat('insertOrderedList')}>1≡</button>
                <button type="button" aria-label="Blockquote" onClick={() => runFormat('formatBlock', 'blockquote')}>❞</button>
                <button type="button" aria-label="Horizontal rule" onClick={() => runFormat('insertHorizontalRule')}>—</button>
                <button type="button" aria-label="Align left" onClick={() => runFormat('justifyLeft')}>≡</button>
                <button type="button" aria-label="Align center" onClick={() => runFormat('justifyCenter')}>≣</button>
                <button type="button" aria-label="Align right" onClick={() => runFormat('justifyRight')}>≡</button>
                <button type="button" aria-label="Add link" onClick={() => { const url = window.prompt('URL'); if (url) runFormat('createLink', url); }}>⌁</button>
                <button type="button" aria-label="Undo" onClick={() => runFormat('undo')}>↶</button>
                <button type="button" aria-label="Redo" onClick={() => runFormat('redo')}>↷</button>
              </div>
              <div className="article-content-editor" contentEditable suppressContentEditableWarning onInput={(event) => setBody(event.currentTarget.innerHTML)} dangerouslySetInnerHTML={{ __html: body }} data-placeholder="Write your article..." />
            </div>
          </label>
          <label>Cover Image
            <div className="cover-picker">
              <input value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} placeholder="Image URL" />
              <input type="file" accept="image/*" aria-label="Choose File" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setCoverUrl(String(reader.result ?? ""));
                reader.readAsDataURL(file);
              }} />
            </div>
          </label>
        </section>
        <aside className="article-editor-side">
          <section className="article-settings-card">
            <h3>Settings</h3>
            <label>Slug<input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="article-slug" required /></label>
            <label>Category<select value={categoryId} onChange={(event) => {
              const next = categories.find((item) => String(item.id ?? item.sourceId ?? item.slug ?? "") === event.target.value) ?? null;
              setCategory(next ? ((next.data && typeof next.data === 'object' ? next.data : next) as RecordValue) : null);
            }}><option value="">Select category</option>{categories.map((item, index) => {
              const data = (item.data && typeof item.data === 'object' ? item.data : item) as RecordValue;
              const id = String(data.id ?? item.id ?? data.slug ?? index);
              return <option value={id} key={id}>{valueOf(data.name ?? item.title ?? data.slug)}</option>;
            })}</select></label>
            <label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Type tag and press Enter..." /></label>
            <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>
          </section>
          <section className="article-settings-card">
            <h3>SEO ({locale.toUpperCase()})</h3>
            <label>Meta Title<input maxLength={70} value={metaTitle} onChange={(event) => setMetaTitle(event.target.value)} placeholder="SEO title (max 70 chars)" /><small>{metaTitle.length}/70</small></label>
            <label>Meta Description<textarea maxLength={160} rows={4} value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} placeholder="SEO description (max 160 chars)" /><small>{metaDescription.length}/160</small></label>
            <label>OG Image URL<input value={ogImage} onChange={(event) => setOgImage(event.target.value)} placeholder="OpenGraph image URL" /></label>
          </section>
          <div className="article-editor-actions">
            <button type="button" className="secondary-button" disabled={!slug} onClick={() => window.open(`https://test.letsbeparents.com/${locale}/knowledge-hub/${slug}`, '_blank')}>Preview</button>
            <button className="primary" disabled={busy || !title.trim() || !slug.trim()}>{busy ? "Saving…" : "Save Article"}</button>
          </div>
        </aside>
      </div>
    </form>
  );
}

function SettingsList({ view }: { view: string }) {
  const initial = ({"settings-api-keys":"API Keys","settings-moderation":"Moderation","settings-modules":"Modules","settings-ranking":"Ranking","settings-app-stores":"App Stores","settings-audit-log":"Audit Log"} as Record<string,string>)[view] ?? "Admins";
  const [tab, setTab] = useState(initial);
  const [settings, setSettings] = useState<RecordValue[]>([]);
  const [auditRows, setAuditRows] = useState<RecordValue[]>([]);
  const [operations, setOperations] = useState<RecordValue>({});
  const [session, setSession] = useState<Session | null>(null);
  const [adminAccounts, setAdminAccounts] = useState<RecordValue[]>([]);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<RecordValue | null>(null);
  const [savingKey, setSavingKey] = useState("");
  const tabs = ["Admins", "API Keys", "Moderation", "Platform", "Modules", "Ranking", "App Stores", "Audit Log"];
  const reload = () => Promise.all([
    api.get<ListResponse>("/admin/list/settings?limit=200&offset=0"),
    api.get<RecordValue>("/admin/operations"),
    api.get<Session>("/admin/session"),
    api.get<ListResponse>("/admin/list/settings-audit-log?limit=50&offset=0"),
    api.get<ListResponse>("/admin/accounts"),
  ]).then(([settingsResult, operationResult, sessionResult, auditResult, accountsResult]) => { setSettings(settingsResult.items); setOperations(operationResult); setSession(sessionResult); setAuditRows(auditResult.items); setAdminAccounts(accountsResult.items); }).catch(() => undefined);
  useEffect(() => { void reload(); }, []);
  const findSetting = (key: string) => settings.find((row) => String(row.source_key ?? row.sourceKey ?? row.slug ?? row.title) === key || String(((row.data ?? {}) as RecordValue).key ?? "") === key);
  const getValue = (key: string, fallback: unknown) => { const row=findSetting(key); const data=(row?.data ?? {}) as RecordValue; return data.value ?? data.enabled ?? fallback; };
  const saveValue = async (key: string, value: unknown, group: string) => {
    setSavingKey(key);
    const row=findSetting(key); const data=(row?.data ?? {}) as RecordValue;
    const values={title:key,status:"active",slug:key,data:{...data,key,group,value}};
    try { if(row?.id) await api.patch(`/admin/item/settings/${encodeURIComponent(String(row.id))}`,{values}); else await api.post("/admin/create/settings",{values:{...values,source_key:key}}); await reload(); } finally { setSavingKey(""); }
  };
  const renderConfig = (title: string, description: string, group: string, fields: Array<{key:string;title:string;description?:string;type:"toggle"|"number"|"text";fallback:unknown}>) => <section className="settings-section"><header><h2>{title}</h2><p>{description}</p></header><article className="settings-card"><h3>{group}</h3>{fields.map((field) => <SettingControl key={field.key} field={field} value={getValue(field.key,field.fallback)} busy={savingKey===field.key} onSave={(value)=>saveValue(field.key,value,group)} />)}</article></section>;
  return (
    <>
      <header className="page-heading"><h1>Settings</h1></header>
      <nav className="settings-tabs">{tabs.map((title)=><button key={title} className={tab===title?"active":""} onClick={()=>setTab(title)}>{title}</button>)}</nav>
      {tab === "Admins" && <section className="settings-section"><header className="settings-title-action"><div><h2>Admin Users</h2><p>Manage who has access to the admin panel</p></div><button className="primary" aria-expanded={addingAdmin} onClick={()=>setAddingAdmin(true)}>＋ Add Admin</button></header><div className="table"><table><thead><tr><th>Email</th><th>Role</th><th>Permissions</th><th>Status</th><th>Last Login</th><th>Created</th><th>Actions</th></tr></thead><tbody>{adminAccounts.map((account,index)=>{const permissions=Array.isArray(account.permissions)?account.permissions as string[]:[];return <tr key={String(account.id??account.email??index)}><td>{valueOf(account.email)} {String(account.email)===session?.email&&<small className="you-badge">You</small>}</td><td><span className="table-badge">{valueOf(account.role)}</span></td><td>{permissions.includes("*")?"All (super)":<div className="permission-badges">{permissions.map((permission)=><small key={permission}>{label(permission)}</small>)}</div>}</td><td><span className="table-badge status-active">{valueOf(account.status)}</span></td><td>{String(account.email)===session?.email?"Current session":account.lastLoginAt?verificationDate(account.lastLoginAt):"—"}</td><td>{account.createdAt?verificationDate(account.createdAt):"—"}</td><td><button className="row-action" aria-label={`Actions for ${String(account.email)}`} onClick={()=>account.configured?window.alert("This protected account is managed through server configuration."):setEditingAdmin(account)}>•••</button></td></tr>})}{!adminAccounts.length&&<tr><td colSpan={7} className="empty">Loading admin users…</td></tr>}</tbody></table></div></section>}
      {tab === "API Keys" && <section className="settings-section"><header><h2>API Keys</h2><p>Status of external API integrations</p></header><div className="settings-api-grid"><article><div><h3>Google Places API</h3><p>City autocomplete in profile editing and clinic management</p></div><span className={`integration-status ${((operations.integrations??{}) as RecordValue).googlePlacesConfigured?'configured':''}`}>{((operations.integrations??{}) as RecordValue).googlePlacesConfigured?'Configured':'Not Configured'}</span></article><article><div><h3>Google Vision API</h3><p>Automatic photo moderation (SafeSearch detection)</p><small>Shares the same API key as Google Places</small></div><span className={`integration-status ${((operations.integrations??{}) as RecordValue).visionConfigured?'configured':''}`}>{((operations.integrations??{}) as RecordValue).visionConfigured?'Configured':'Not Configured'}</span></article></div><p className="settings-note">API keys are managed via protected server environment variables.</p></section>}
      {tab === "Moderation" && renderConfig("Moderation Settings","Configure automatic moderation and content review","Moderation",[{key:"moderation.auto_enabled",title:"Auto-moderate photos via Vision API",description:"When ON, new profile photos are screened automatically. When OFF, every new photo stays in PENDING for manual review.",type:"toggle",fallback:true}])}
      {tab === "Platform" && <>{renderConfig("Platform Settings","Configure platform-wide settings and limits","Platform",[
        {key:"platform.livekit_enabled",title:"Enable LiveKit (audio/video calls)",description:"Emergency kill-switch for audio and video calls.",type:"toggle",fallback:true},
        {key:"platform.maintenance_full",title:"Maintenance: hard mode (kick users, end calls)",description:"Only effective while maintenance mode is enabled.",type:"toggle",fallback:false},
        {key:"platform.maintenance_mode",title:"Maintenance mode",description:"Turns the public website into a maintenance page.",type:"toggle",fallback:false},
        {key:"platform.registration_enabled",title:"Allow new user registrations",description:"Existing users can still sign in when disabled.",type:"toggle",fallback:true},
        {key:"platform.system_email",title:"System Email (contact form recipient)",description:"Destination address for contact form messages.",type:"text",fallback:""},
      ])}{renderConfig("Limits","Hard limits applied across the app.","Limits",[
        {key:"limits.free_cold_chats_per_day",title:"Free plan daily cold-chat limit",type:"number",fallback:0},{key:"limits.free_likes_per_day",title:"Free plan daily likes limit",type:"number",fallback:3},{key:"limits.max_message_length",title:"Maximum message length",type:"number",fallback:5000},{key:"limits.max_photos",title:"Maximum profile photos",type:"number",fallback:10},{key:"limits.min_photos",title:"Minimum profile photos",type:"number",fallback:1},{key:"limits.premium_cold_chats_per_day",title:"Premium plan daily cold-chat limit",type:"number",fallback:5},{key:"limits.premium_likes_per_day",title:"Premium plan daily likes limit",type:"number",fallback:15}
      ])}</>}
      {tab === "Modules" && renderConfig("Modules","Enable or disable user-facing features. Disabled modules are hidden from the website navigation.","User-Facing Modules",[
        {key:"modules.articles",title:"Articles",description:"Knowledge Hub section with articles and guides",type:"toggle",fallback:true},{key:"modules.clinics",title:"Clinics",description:"Fertility clinic directory with search and filters",type:"toggle",fallback:true},{key:"modules.lawyers",title:"Lawyer Catalog",description:"Legal services directory",type:"toggle",fallback:true},{key:"modules.matchmaking",title:"Matchmaking (Find a Match)",description:"Profile catalog, likes, matches, and chat",type:"toggle",fallback:true}
      ])}
      {tab === "Ranking" && renderConfig("Ranking Settings","Weights and tuning for the catalog ranking formula","Ranking",[
        {key:"ranking.honeymoon.durationDays",title:"Honeymoon duration (days)",type:"number",fallback:5},{key:"ranking.recency.halfLifeHours",title:"Recency half-life (hours)",type:"number",fallback:48},{key:"ranking.v2.enabled",title:"Ranking v2 enabled",type:"toggle",fallback:true},{key:"ranking.weights.completeness",title:"Completeness weight",type:"number",fallback:25},{key:"ranking.weights.honeymoon",title:"Honeymoon weight",type:"number",fallback:5},{key:"ranking.weights.premium",title:"Premium weight",type:"number",fallback:30},{key:"ranking.weights.recency",title:"Recency weight",type:"number",fallback:25},{key:"ranking.weights.verified",title:"Verified weight",type:"number",fallback:100}
      ])}
      {tab === "App Stores" && renderConfig("App Store Settings","Configure mobile app version requirements and store URLs","App Stores",[
        {key:"app_stores.android_store_url",title:"Android store URL",type:"text",fallback:"https://play.google.com/store/apps/details?id=com.letsBeParents.letsBeParents"},{key:"app_stores.force_update_below_android",title:"Force update below Android version",type:"text",fallback:"0.0.0"},{key:"app_stores.force_update_below_ios",title:"Force update below iOS version",type:"text",fallback:"0.0.0"},{key:"app_stores.ios_store_url",title:"iOS store URL",type:"text",fallback:"https://apps.apple.com/"}
      ])}
      {tab === "Audit Log" && <section className="settings-section"><header><h2>Audit Log</h2><p>Administrative and system activity</p></header><div className="table"><table><thead><tr><th>Date</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead><tbody>{auditRows.map((row,index)=><tr key={String(row.id??index)}><td>{verificationDate(row.created_at)}</td><td>{valueOf(row.actor??row.email)}</td><td>{valueOf(row.action??row.title)}</td><td>{valueOf(row.target_type??((row.data??{}) as RecordValue).target)}</td></tr>)}{!auditRows.length&&<tr><td colSpan={4} className="empty">No audit entries.</td></tr>}</tbody></table></div></section>}
      {addingAdmin && <AdminAccountModal onClose={()=>setAddingAdmin(false)} onSaved={async()=>{setAddingAdmin(false);await reload();}} />}
      {editingAdmin && <AdminAccountModal account={editingAdmin} onClose={()=>setEditingAdmin(null)} onSaved={async()=>{setEditingAdmin(null);await reload();}} />}
    </>
  );
}

function AdminAccountModal({account,onClose,onSaved}:{account?:RecordValue;onClose:()=>void;onSaved:()=>Promise<void>}) {
  const editing=Boolean(account?.id); const [email,setEmail]=useState(String(account?.email??"")); const [password,setPassword]=useState(""); const [role,setRole]=useState(String(account?.role??"STAFF")); const [permissions,setPermissions]=useState<string[]>(Array.isArray(account?.permissions)?account.permissions as string[]:[]); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const options: Array<[string,string]> = [["dashboard","Dashboard"],["users","Users"],["subscriptions","Subscriptions"],["verifications","Verifications"],["clinics","Clinics"],["lawyers","Lawyers"],["articles","Articles"],["support","Support Chat"],["moderation-photos","Photo Moderation"],["moderation-reports","Reports"],["livekit","LiveKit Calls"],["monitoring","Monitoring"],["storage","Storage"],["static-pages","Static Pages"],["marketing","Marketing"],["settings","Settings"]];
  const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);setError("");try{if(editing)await api.patch(`/admin/accounts/${encodeURIComponent(String(account?.id))}`,{password:password||null,role,permissions});else await api.post("/admin/accounts",{email,password,role,permissions});await onSaved();}catch(reason){let message=reason instanceof Error?reason.message:"Could not save the admin account.";try{message=String((JSON.parse(message) as RecordValue).detail??message);}catch{}setError(message);}finally{setBusy(false);}};
  return <div className="modal-backdrop" role="presentation"><form className="modal admin-account-modal" role="dialog" aria-modal="true" aria-label={editing?"Edit Admin User":"Add Admin User"} onSubmit={submit}><button className="modal-close" type="button" aria-label="Close" onClick={onClose}>×</button><h2>{editing?"Edit Admin User":"Add Admin User"}</h2><p>{editing?"Update this account's role, permissions, or password":"Create a new admin account or upgrade an existing user"}</p>{error&&<p className="error">{error}</p>}<label>Email<input type="email" value={email} onChange={(event)=>setEmail(event.target.value)} placeholder="admin@example.com" disabled={editing} required /></label><label>Password<input type="password" value={password} onChange={(event)=>setPassword(event.target.value)} placeholder={editing?"Leave blank to keep current password":"Min 8 chars, uppercase + number"} minLength={editing?undefined:8} required={!editing} /></label><label>Role<select value={role} onChange={(event)=>setRole(event.target.value)}><option value="STAFF">Staff</option><option value="ADMIN">Admin</option></select></label>{role==="STAFF"&&<><p className="admin-role-note">Staff can only access the sections explicitly granted below.</p><fieldset><legend>Initial permissions</legend><div className="admin-permissions">{options.map(([key,title])=><label key={key}><input type="checkbox" checked={permissions.includes(key)} onChange={()=>setPermissions((current)=>current.includes(key)?current.filter((item)=>item!==key):[...current,key])}/>{title}</label>)}</div></fieldset><p className="admin-role-note">You can adjust permissions later from the row actions menu.</p></>}<div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button className="primary" disabled={busy||!email||(!editing&&password.length<8)}>{busy?"Saving…":editing?"Save Changes":"Add Admin"}</button></div></form></div>;
}

function SettingControl({field,value,busy,onSave}:{field:{key:string;title:string;description?:string;type:"toggle"|"number"|"text";fallback:unknown};value:unknown;busy:boolean;onSave:(value:unknown)=>Promise<void>}) {
  const [draft,setDraft]=useState(String(value??""));
  useEffect(()=>setDraft(String(value??"")),[value]);
  return <div className="setting-control"><div><b>{field.title}</b>{field.description&&<p>{field.description}</p>}<small>{field.key}</small></div>{field.type==="toggle"?<label className="static-footer-toggle"><input type="checkbox" role="switch" checked={settingBoolean(value)} disabled={busy} onChange={(event)=>void onSave(event.target.checked)}/><span /></label>:<input type={field.type} value={draft} disabled={busy} onChange={(event)=>setDraft(event.target.value)} onBlur={()=>{const next=field.type==="number"?Number(draft):draft;if(String(next)!==String(value))void onSave(next);}}/>}</div>;
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
        <button className="modal-close" type="button" onClick={onClose}>
          ×
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
          ×
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
          ×
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
    if (Array.isArray(value)) return value.map((item) => label(String(item).toLowerCase())).join(", ") || "-";
    const text = String(value);
    if (["true", "false"].includes(text.toLowerCase())) return text.toLowerCase() === "true" ? "Yes" : "No";
    return /^[A-Z0-9_ -]+$/.test(text) ? label(text.toLowerCase()) : text;
  };
  const detailDate = (value: unknown) => {
    const date = value ? new Date(String(value)) : null;
    return date && !Number.isNaN(date.valueOf())
      ? date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "-";
  };
  const tabCount = (key: string) => {
    const fallback = key === "sentLikes" ? dataValue("likesCount") : key === "receivedLikes" ? dataValue("likedByCount") : key === "reports" ? dataValue("reportCount") : null;
    return Number(counts[key] ?? 0) || Number(fallback ?? 0);
  };
  const section = (title: string, fields: Array<[string, unknown]>) => <section className="profile-section" key={title}><h4>{title}</h4>{fields.map(([name, value]) => <p key={name}><span>{name}</span><b>{humanValue(value)}</b></p>)}</section>;
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
    await api.patch(`/admin/item/users/${encodeURIComponent(profileId)}`, { values: { data: { ...profileData, isVerified: enabled, verifiedAt: enabled ? new Date().toISOString() : null } } });
    setNotice(enabled ? "User verified." : "Verification removed.");
    setReload((value) => value + 1);
  };
  const avatarUrl = String(dataValue("avatarUrl", "avatar_url") ?? "");
  const verified = settingBoolean(dataValue("isVerified", "verified"));
  const online = settingBoolean(dataValue("isOnlineNow", "online"));
  return (
    <>
      <Link className="back" to="/users">
        ← Back to Users
      </Link>
      {notice && <p className="notice">{notice}</p>}
      <header className="detail-heading user-detail-heading">
        <div className="user-detail-identity">
          <div className="user-detail-avatar"><i>{String(profile.display_name ?? profile.displayName ?? "U").slice(0,1).toUpperCase()}</i>{avatarUrl && <img src={avatarUrl} alt="" onError={(event) => event.currentTarget.remove()} />}</div>
          <div><h1>{valueOf(profile.display_name ?? profile.displayName ?? "No profile")} {verified && <span className="verified-mark" title="Verified">✓</span>} <em>{online ? "Online" : "Offline"}</em></h1><p>{valueOf(profile.email)}</p><p>Blocked by <b>{tabCount("blockedBy")}</b> users　 <b>{tabCount("reports")}</b> reports</p></div>
        </div>
        <div className="detail-actions user-detail-actions">
          <span className="status">{valueOf(profile.status)}</span>
          <button onClick={openAmplitude}>↗ Open in Amplitude</button>
          <button
            onClick={() => setModal({ kind: "grant", title: "Grant Premium" })}
          >
            ♕ Grant Premium
          </button>
          <button onClick={() => void toggleVerification()}>{verified ? "Unverify" : "Verify"}</button>
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
            ◉ Shadow ban
          </button>
          <button
            className="danger"
            onClick={() =>
              setModal({ kind: "delete", title: "Permanently Delete User" })
            }
          >
            ⌫ Delete
          </button>
        </div>
      </header>
      <nav className="detail-tabs">
        {detailTabs.map(([key, title, countKey]) => (
          <button
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
            key={key}
          >
            {title}
            {key !== "profile" ? ` (${tabCount(countKey)})` : ""}
          </button>
        ))}
      </nav>
      {tab === "profile" ? (
        <section className="detail-grid user-profile-grid">
          <article>
            {section("IDs", [["User ID", dataValue("id", "userId") ?? id], ["Profile ID", dataValue("profileId", "profile_id") ?? profile.id]])}
            {section("Basic Info", [["Display Name", dataValue("displayName", "display_name")], ["User Type (legacy)", dataValue("donorType", "userType")], ["Date of Birth", dataValue("dateOfBirth", "birthDate")], ["Country", dataValue("country")], ["City", dataValue("city")]])}
            {section("Reproductive Model", [["Profile Type", dataValue("profileType")], ["Willing to Donate", dataValue("donorType", "willingToDonate")], ["Looking For", dataValue("lookingFor")], ["Contact with the Child", dataValue("contactWillingness", "contactWithChild")], ["Desired Donor Contact", dataValue("desiredDonorContact")]])}
            {section("Appearance", [["Height", dataValue("height")], ["Weight", dataValue("weight")], ["Eye Color", dataValue("eyeColor")], ["Hair Color", dataValue("hairColor")], ["Ethnicity", dataValue("ethnicity")]])}
            {section("About Me", [["Education", dataValue("education")], ["Occupation", dataValue("occupation")], ["Smoking", dataValue("smoking")], ["Drinking", dataValue("drinking")], ["Religion", dataValue("religion")], ["Languages", dataValue("languages")]])}
            <section className="profile-section profile-bio"><p><span>Bio</span></p><div>{humanValue(dataValue("bio", "aboutMe"))}</div></section>
          </article>
          <article>
            <section className="profile-section acquisition-card"><h3>Acquisition</h3><p>{dataValue("acquisition", "attribution") ? humanValue(dataValue("acquisition", "attribution")) : "No attribution captured."}</p></section>
            {section("Account", [["Email", dataValue("email")], ["Email Verified", dataValue("emailVerified", "isEmailVerified")], ["Auth Type", dataValue("authType")], ["Premium", dataValue("isPremium")], ["Status", profile.status], ["Locale", dataValue("locale")]])}
            {section("Activity", [["Registered", detailDate(dataValue("createdAt", "created_at") ?? profile.created_at)], ["Last Login", detailDate(dataValue("lastLoginAt"))], ["Registration Source", dataValue("registrationSource")], ["Last Login Source", dataValue("lastLoginSource")]])}
            {section("Profile Status", [["Visible in Catalog", dataValue("visibleInCatalog", "isVisible")], ["Verified", verified], ["Verified At", detailDate(dataValue("verifiedAt"))], ["Wizard Completed", dataValue("wizardCompleted")], ["Completeness Score", dataValue("completenessScore")]])}
            {section("Donor Details", [["Contact Willingness", dataValue("contactWillingness")], ["Previous Donations", dataValue("previousDonations")], ["Willing to Donate To", dataValue("willingToDonateTo")]])}
          </article>
        </section>
      ) : (
        <section className="detail-list">
          {tabError ? (
            <p className="error">{tabError}</p>
          ) : (
            <>
              {list.map((row, index) => (
                <article key={String(row.id ?? index)}>
                  <b>{rowName(row)}</b>
                  <p>
                    {valueOf(row.body ?? row.reason ?? row.status ?? row.title)}
                  </p>
                  <small>{compactDate(row.created_at ?? row.createdAt)}</small>
                </article>
              ))}
              {!list.length && <p className="empty">No records.</p>}
            </>
          )}
        </section>
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
    ? (draft.services as string[])
    : [];
  const serviceCount = services.length || Number(draft.servicesCount ?? 0);
  const setValue = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = async (values = draft) => {
    await api.patch(`/admin/clinics/${encodeURIComponent(id)}`, { values });
    setNotice("Changes saved.");
    load();
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
        ← Back to Clinics
      </Link>
      {notice && <p className="notice">{notice}</p>}
      <header className="clinic-heading">
        <div className="clinic-logo">
          {draft.logoUrl ? <img src={String(draft.logoUrl)} alt="" /> : "⌂"}
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
                  "⌂"
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
              {settingBoolean(draft.chatEnabled) ? "Disable Chat" : "Enable Chat"}
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
                void updateClinicSetting("isActive", !settingBoolean(draft.isActive))
              }
            >
              {settingBoolean(draft.isActive) ? "Deactivate" : "Activate"}
            </button>
          </article>
          <div className="form-actions">
            <button className="primary" onClick={() => void save()}>
              Save Changes
            </button>
            <button className="danger" onClick={() => setConfirmDelete(true)}>
              Delete Permanently
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
                          onChange={() =>
                            setValue(
                              "services",
                              services.includes(slug)
                                ? services.filter((item) => item !== slug)
                                : [...services, slug],
                            )
                          }
                        />
                        {valueOf(entry.label)}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <button className="primary" onClick={() => save({ services })}>
              Save Services
            </button>
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
                    {language} <span aria-label={`Remove ${language}`}>×</span>
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
              <textarea
                rows={10}
                value={valueOf(draft.aboutHtml === "—" ? "" : draft.aboutHtml)}
                onChange={(event) => setValue("aboutHtml", event.target.value)}
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
        <section className="detail-list">
          {((data.visitors ?? []) as RecordValue[]).map((visitor, index) => (
            <article key={String(visitor.id ?? index)}>
              <b>{rowName(visitor)}</b>
              <p>{valueOf(visitor.profileEmail)}</p>
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

export function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [navCounts, setNavCounts] = useState<RecordValue>({});
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
    (path === "/support" && location.pathname.startsWith("/support/")) ||
    (path === "/moderation/photos" &&
      location.pathname.startsWith("/moderation/photos"));
  const permissions = new Set(session.permissions ?? ["*"]);
  const permissionForPath = (path: string) => path.startsWith("/moderation/photos") ? "moderation-photos" : path.startsWith("/moderation/reports") ? "moderation-reports" : path.startsWith("/static-pages") ? "static-pages" : path.startsWith("/livekit") ? "livekit" : path.startsWith("/support") ? "support" : path.startsWith("/users") ? "users" : path.startsWith("/clinics") ? "clinics" : path.startsWith("/settings") ? "settings" : path.split("/").filter(Boolean)[0] || "dashboard";
  const canAccess = (path: string) => session.role !== "STAFF" || permissions.has("*") || permissions.has(permissionForPath(path));
  const allowedNav = nav.filter((item) => canAccess(item.path));
  const fallbackPath = allowedNav[0]?.path ?? "/dashboard";
  return (
    <div className="app">
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
      <main className={`content ${location.pathname.startsWith("/support") ? "support-content" : ""}`}>
        {!canAccess(location.pathname) ? <Navigate to={fallbackPath} replace /> : <Routes>
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
          <Route path="/marketing" element={<Marketing />} />
          <Route
            path="/users/deletion-feedback"
            element={<GenericList view="deletion-feedback" />}
          />
          <Route
            path="/users/partners"
            element={<GenericList view="users" />}
          />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="/clinics/:id" element={<ClinicDetail />} />
          <Route
            path="/articles/categories"
            element={<ArticlesList view="categories" />}
          />
          <Route path="/articles" element={<ArticlesList view="articles" />} />
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
          <Route path="/settings" element={<SettingsList view="settings" />} />
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
        </Routes>}
      </main>
    </div>
  );
}
