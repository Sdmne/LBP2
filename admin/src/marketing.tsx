import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createApiClient } from "./api";

const api = createApiClient("/admin/api");
type RecordValue = Record<string, unknown>;
type MarketingPreview = { total: number; byLocale: Record<string, number> };
type MarketingIconName =
  | "plus"
  | "ellipsis"
  | "arrowLeft"
  | "save"
  | "send"
  | "x"
  | "alert";
type MarketingCampaign = RecordValue & {
  id: number;
  title: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  scheduledFor?: string | null;
  sentAt?: string | null;
  recipientCount?: number;
  channel?: string;
  contentVariants?: Record<string, string>;
  cohortFilter?: {
    locales?: string[];
    wizardCompleted?: boolean;
    isPremium?: boolean;
  };
  respectMarketingPref?: boolean;
  deliveryStats?: RecordValue;
  lastError?: string | null;
};

const statuses = [
  "",
  "DRAFT",
  "SCHEDULED",
  "SENDING",
  "SENT",
  "FAILED",
  "CANCELLED",
];
const locales = [
  ["en", "English"],
  ["ru", "Russian"],
  ["es", "Spanish"],
] as const;
const channelLabels: Record<string, string> = {
  CHAT_AND_PUSH: "Chat + Push",
  CHAT_MESSAGE: "Chat",
  PUSH_ONLY: "Push",
  CHAT_PUSH: "Chat + Push",
  CHAT: "Chat",
  PUSH: "Push",
};

function MarketingIcon({ name }: { name: MarketingIconName }) {
  const paths: Record<MarketingIconName, JSX.Element> = {
    plus: (
      <>
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </>
    ),
    ellipsis: (
      <>
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
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
    send: (
      <>
        <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
        <path d="m21.854 2.147-10.94 10.939" />
      </>
    ),
    x: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    alert: (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
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

function statusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function displayDate(value: unknown) {
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
    : displayValue(value);
}

function fieldLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function MarketingFeature() {
  const navigate = useNavigate();
  const [result, setResult] = useState<{
    items: MarketingCampaign[];
    total: number;
    page: number;
    totalPages: number;
  } | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setResult(null);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "50" });
    if (status) params.set("status", status);
    api
      .get<{
        items: MarketingCampaign[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/admin/marketing/campaigns?${params}`)
      .then((value) => live && setResult(value))
      .catch(
        (reason: unknown) =>
          live &&
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load campaigns",
          ),
      );
    return () => {
      live = false;
    };
  }, [status, page]);
  const rows = result?.items ?? [];
  return (
    <>
      <header className="page-heading marketing-heading">
        <div>
          <h1>
            Marketing <span>({result?.total ?? 0})</span>
          </h1>
          <p>
            Broadcast campaigns sent as chat messages and/or push notifications.
          </p>
        </div>
        <button
          className="primary marketing-new"
          onClick={() => navigate("/marketing/new")}
        >
          <MarketingIcon name="plus" /> New Campaign
        </button>
      </header>
      <nav className="campaign-tabs" aria-label="Campaign status">
        {statuses.map((value) => (
          <button
            key={value || "all"}
            className={status === value ? "active" : ""}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {value ? statusLabel(value) : "All"}
          </button>
        ))}
      </nav>
      <section className="table campaign-table">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Recipients</th>
              <th>Channel</th>
              <th>Created by</th>
              <th>When</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    className="campaign-title"
                    onClick={() => navigate(`/marketing/${row.id}`)}
                  >
                    {row.title}
                  </button>
                </td>
                <td>
                  <span
                    className={`table-badge status-${row.status.toLowerCase()}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </td>
                <td>{Number(row.recipientCount ?? 0).toLocaleString()}</td>
                <td>
                  {channelLabels[String(row.channel ?? "")] ??
                    displayValue(row.channel)}
                </td>
                <td>{displayValue(row.createdBy ?? "Admin")}</td>
                <td>
                  {displayDate(row.scheduledFor ?? row.sentAt ?? row.createdAt)}
                </td>
                <td>
                  <button
                    className="campaign-manage"
                    aria-label={`Open ${row.title}`}
                    onClick={() => navigate(`/marketing/${row.id}`)}
                  >
                    <MarketingIcon name="ellipsis" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!result && !error && (
          <div className="campaign-empty">Loading campaigns…</div>
        )}
        {error && (
          <div className="campaign-empty campaign-load-error">{error}</div>
        )}
        {result && !rows.length && (
          <div className="campaign-empty">
            No campaigns yet — click 'New Campaign' to create one.
          </div>
        )}
      </section>
      {result && result.totalPages > 1 && (
        <nav className="campaign-pager" aria-label="Campaign pages">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {result.totalPages}
          </span>
          <button
            disabled={page >= result.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}

export function MarketingCampaignPage({ isNew = false }: { isNew?: boolean }) {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isNew || !campaignId) return;
    let live = true;
    api
      .get<MarketingCampaign>(
        `/admin/marketing/campaigns/${encodeURIComponent(campaignId)}`,
      )
      .then((value) => live && setCampaign(value))
      .catch(
        (reason: unknown) =>
          live &&
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load campaign",
          ),
      );
    return () => {
      live = false;
    };
  }, [campaignId, isNew]);
  useEffect(() => {
    if (
      !campaignId ||
      !campaign ||
      !["SCHEDULED", "SENDING"].includes(campaign.status)
    )
      return;
    const timer = window.setInterval(() => {
      api
        .get<MarketingCampaign>(
          `/admin/marketing/campaigns/${encodeURIComponent(campaignId)}`,
        )
        .then(setCampaign)
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [campaignId, campaign?.status]);
  if (isNew) return <CampaignEditor />;
  if (error)
    return (
      <section className="campaign-state">
        <h1>Campaign unavailable</h1>
        <p>{error}</p>
        <Link to="/marketing">Back to Marketing</Link>
      </section>
    );
  if (!campaign) return <div className="campaign-state">Loading campaign…</div>;
  if (campaign.status === "DRAFT")
    return <CampaignEditor campaign={campaign} />;
  return <CampaignDetail campaign={campaign} onChange={setCampaign} />;
}

function initialDate(value?: string | null) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function CampaignEditor({ campaign }: { campaign?: MarketingCampaign }) {
  const navigate = useNavigate();
  const legacy = (campaign?.data ?? {}) as RecordValue;
  const initialMessages = (campaign?.contentVariants ??
    legacy.messages ??
    {}) as Record<string, string>;
  const initialFilter = (campaign?.cohortFilter ??
    legacy.cohortFilter ??
    {}) as RecordValue;
  const legacyAudience = String(legacy.audienceLocale ?? "");
  const [title, setTitle] = useState(String(campaign?.title ?? ""));
  const [contentLocale, setContentLocale] = useState("en");
  const [messages, setMessages] = useState<Record<string, string>>({
    en: "",
    ru: "",
    es: "",
    ...initialMessages,
  });
  const [audienceLocales, setAudienceLocales] = useState<string[]>(
    Array.isArray(initialFilter.locales)
      ? initialFilter.locales.map(String)
      : legacyAudience
        ? [legacyAudience]
        : ["en", "ru", "es"],
  );
  const initialWizard =
    typeof initialFilter.wizardCompleted === "boolean"
      ? initialFilter.wizardCompleted
        ? "completed"
        : "incomplete"
      : String(legacy.wizard ?? "all");
  const initialPremium =
    typeof initialFilter.isPremium === "boolean"
      ? initialFilter.isPremium
        ? "premium"
        : "free"
      : String(legacy.premium ?? "all");
  const legacyDelivery = String(legacy.delivery ?? "");
  const normalizedDelivery =
    (
      {
        CHAT_PUSH: "CHAT_AND_PUSH",
        CHAT: "CHAT_MESSAGE",
        PUSH: "PUSH_ONLY",
      } as Record<string, string>
    )[legacyDelivery] ?? legacyDelivery;
  const [wizard, setWizard] = useState(initialWizard);
  const [premium, setPremium] = useState(initialPremium);
  const [delivery, setDelivery] = useState(
    String(campaign?.channel ?? (normalizedDelivery || "CHAT_AND_PUSH")),
  );
  const [respectPreference, setRespectPreference] = useState(
    campaign?.respectMarketingPref ?? legacy.respectPreference !== false,
  );
  const [schedule, setSchedule] = useState(
    campaign?.scheduledFor || legacy.scheduledAt ? "later" : "now",
  );
  const [scheduledAt, setScheduledAt] = useState(
    initialDate(
      String(campaign?.scheduledFor ?? legacy.scheduledAt ?? "") || null,
    ),
  );
  const [preview, setPreview] = useState<MarketingPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let live = true;
    setPreviewError("");
    setPreview(null);
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        locales: audienceLocales.join(","),
        respectMarketingPref: String(respectPreference),
      });
      if (wizard !== "all")
        params.set("wizardCompleted", String(wizard === "completed"));
      if (premium !== "all")
        params.set("isPremium", String(premium === "premium"));
      api
        .get<MarketingPreview>(`/admin/marketing/preview?${params}`)
        .then((value) => {
          if (live) setPreview(value);
        })
        .catch((reason: unknown) => {
          if (live) {
            setPreview(null);
            setPreviewError(
              reason instanceof Error
                ? reason.message
                : "Could not load recipients",
            );
          }
        });
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [audienceLocales, wizard, premium, respectPreference]);

  const currentMessage = messages[contentLocale] ?? "";
  const scheduleValid = schedule === "now" || Boolean(scheduledAt);
  const formValid = Boolean(
    title.trim() &&
      messages.en.trim() &&
      audienceLocales.length &&
      scheduleValid &&
      Object.values(messages).every((value) => value.length <= 5000),
  );
  const payload = () => ({
    title: title.trim(),
    contentVariants: Object.fromEntries(
      Object.entries(messages)
        .filter(([, value]) => value.trim())
        .map(([key, value]) => [key, value.trim()]),
    ),
    cohortFilter: {
      locales: audienceLocales,
      ...(wizard === "all" ? {} : { wizardCompleted: wizard === "completed" }),
      ...(premium === "all" ? {} : { isPremium: premium === "premium" }),
    },
    channel: delivery,
    respectMarketingPref: respectPreference,
  });
  const persist = async () => {
    if (campaign?.id) {
      await api.patch<RecordValue>(
        `/admin/marketing/campaigns/${campaign.id}`,
        payload(),
      );
      return campaign.id;
    }
    const created = await api.post<{ id: number }>(
      "/admin/marketing/campaigns",
      payload(),
    );
    return created.id;
  };
  const saveDraft = async () => {
    if (!formValid) return;
    setBusy(true);
    setError("");
    try {
      await persist();
      navigate("/marketing");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save the campaign",
      );
    } finally {
      setBusy(false);
    }
  };
  const dispatch = async () => {
    if (!formValid || confirmation !== title.trim()) return;
    setBusy(true);
    setError("");
    try {
      const id = await persist();
      if (schedule === "later")
        await api.post<RecordValue>(
          `/admin/marketing/campaigns/${id}/schedule`,
          { scheduledFor: new Date(scheduledAt).toISOString() },
        );
      else
        await api.post<RecordValue>(
          `/admin/marketing/campaigns/${id}/send-now`,
        );
      navigate(`/marketing/${id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not dispatch the campaign",
      );
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };
  const insertFirstName = () => {
    const field = textareaRef.current;
    const start = field?.selectionStart ?? currentMessage.length;
    const end = field?.selectionEnd ?? currentMessage.length;
    const next = `${currentMessage.slice(0, start)}{firstName}${currentMessage.slice(end)}`;
    setMessages({ ...messages, [contentLocale]: next });
    window.setTimeout(() => {
      field?.focus();
      field?.setSelectionRange(start + 11, start + 11);
    }, 0);
  };
  const toggleLocale = (code: string) =>
    setAudienceLocales((values) =>
      values.includes(code)
        ? values.length === 1
          ? values
          : values.filter((value) => value !== code)
        : [...values, code],
    );

  return (
    <section className="campaign-editor-page">
      <header className="campaign-editor-heading">
        <button
          type="button"
          className="article-back"
          aria-label="Back"
          onClick={() => navigate("/marketing")}
        >
          <MarketingIcon name="arrowLeft" />
        </button>
        <h1>{campaign ? "Edit Campaign" : "New Campaign"}</h1>
      </header>
      <div className="campaign-editor-grid">
        <div className="campaign-editor-main">
          <section className="campaign-card campaign-title-card">
            <label>
              Title (internal — never shown to recipients)
              <input
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Q3 re-engagement push to ru/es users"
              />
            </label>
            <small>{title.length}/200</small>
          </section>
          <section className="campaign-card">
            <h3>Content</h3>
            <nav className="campaign-language-tabs">
              {locales.map(([code, name]) => (
                <button
                  type="button"
                  key={code}
                  className={contentLocale === code ? "active" : ""}
                  onClick={() => setContentLocale(code)}
                >
                  {name}
                  {code === "en" ? "*" : ""}
                </button>
              ))}
            </nav>
            <div className="variable-row">
              Insert variable:{" "}
              <button
                type="button"
                title="Recipient's first name"
                onClick={insertFirstName}
              >
                {"{firstName}"}
              </button>
            </div>
            <textarea
              ref={textareaRef}
              rows={7}
              maxLength={5000}
              value={currentMessage}
              onChange={(event) =>
                setMessages({
                  ...messages,
                  [contentLocale]: event.target.value,
                })
              }
              placeholder={
                contentLocale === "en"
                  ? "Write the broadcast message (required)..."
                  : "Optional — falls back to English if empty."
              }
            />
            <div className="campaign-counter">
              <span>
                {contentLocale !== "en" && "Falls back to EN if left empty"}
              </span>
              <small>{currentMessage.length}/5000</small>
            </div>
          </section>
          <section className="campaign-card campaign-audience">
            <h3>Audience</h3>
            <div className="campaign-locks">
              <b>Status: ACTIVE</b>
              <span>(locked)</span>
              <b>Role: USER</b>
              <span>(locked)</span>
              <small>
                System users, staff, banned, and deleted users are always
                excluded.
              </small>
            </div>
            <fieldset>
              <legend>Locale *</legend>
              <div className="campaign-locale-chips">
                {locales.map(([code, name]) => (
                  <button
                    type="button"
                    key={code}
                    className={audienceLocales.includes(code) ? "active" : ""}
                    aria-pressed={audienceLocales.includes(code)}
                    onClick={() => toggleLocale(code)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </fieldset>
            <CampaignRadios
              title="Wizard completed"
              value={wizard}
              setValue={setWizard}
              options={[
                ["all", "All"],
                ["completed", "Completed only"],
                ["incomplete", "Not completed"],
              ]}
            />
            <CampaignRadios
              title="Premium status"
              value={premium}
              setValue={setPremium}
              options={[
                ["all", "All"],
                ["premium", "Premium only"],
                ["free", "Free only"],
              ]}
            />
          </section>
          <section className="campaign-card">
            <CampaignRadios
              title="Delivery"
              value={delivery}
              setValue={setDelivery}
              options={[
                [
                  "CHAT_AND_PUSH",
                  "Chat message + Push notification (recommended)",
                  "Writes a message into each recipient's support chat AND sends a push notification.",
                ],
                ["CHAT_MESSAGE", "Chat only", "In-app chat message. No push."],
                [
                  "PUSH_ONLY",
                  "Push only",
                  "Push notification only. No chat record.",
                ],
              ]}
              stacked
            />
            <label className="campaign-checkbox">
              <input
                type="checkbox"
                checked={respectPreference}
                onChange={(event) => setRespectPreference(event.target.checked)}
              />
              <span>
                Respect “marketing notifications” user preference{" "}
                <small>
                  (recommended — required for transactional vs marketing
                  separation)
                </small>
              </span>
            </label>
          </section>
          <section className="campaign-card">
            <CampaignRadios
              title="Schedule"
              value={schedule}
              setValue={setSchedule}
              options={[
                ["now", "Send now"],
                ["later", "Schedule for later..."],
              ]}
            />
            {schedule === "later" && (
              <label className="campaign-schedule-input">
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
                <small>
                  Must be in the future. Server will reject past dates.
                </small>
              </label>
            )}
          </section>
        </div>
        <aside className="campaign-editor-side">
          <section
            className={`campaign-preview ${previewError ? "error" : ""}`}
          >
            <span>Live recipient preview</span>
            {previewError ? (
              <p>{previewError}</p>
            ) : (
              <>
                <b>{preview ? preview.total.toLocaleString() : "—"}</b>
                <small>recipients</small>
                <div>
                  {locales.map(([code]) => (
                    <span key={code}>
                      <i>{code}</i>:{" "}
                      {(preview?.byLocale?.[code] ?? 0).toLocaleString()}
                    </span>
                  ))}
                </div>
                {preview?.total === 0 && (
                  <p>No matching users — narrow or broaden the cohort.</p>
                )}
              </>
            )}
          </section>
          <div className="campaign-actions">
            <button
              className="secondary-button"
              disabled={busy || !formValid}
              onClick={() => void saveDraft()}
            >
              <MarketingIcon name="save" /> Save draft
            </button>
            <button
              className="primary"
              disabled={busy || !formValid || !preview?.total}
              onClick={() => {
                setConfirmation("");
                setConfirming(true);
              }}
            >
              <MarketingIcon name="send" />{" "}
              {schedule === "later" ? "Schedule" : "Send now"}
            </button>
          </div>
          {error && <p className="campaign-form-error">{error}</p>}
        </aside>
      </div>
      {confirming && (
        <CampaignConfirm
          title={title.trim()}
          messages={messages}
          audienceLocales={audienceLocales}
          wizard={wizard}
          premium={premium}
          total={preview?.total ?? 0}
          schedule={schedule}
          scheduledAt={scheduledAt}
          confirmation={confirmation}
          setConfirmation={setConfirmation}
          busy={busy}
          onClose={() => setConfirming(false)}
          onConfirm={dispatch}
        />
      )}
    </section>
  );
}

function CampaignConfirm({
  title,
  messages,
  audienceLocales,
  wizard,
  premium,
  total,
  schedule,
  scheduledAt,
  confirmation,
  setConfirmation,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  messages: Record<string, string>;
  audienceLocales: string[];
  wizard: string;
  premium: string;
  total: number;
  schedule: string;
  scheduledAt: string;
  confirmation: string;
  setConfirmation: (value: string) => void;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const action = schedule === "later" ? "Schedule" : "Send now";
  return (
    <div
      className="modal-backdrop campaign-confirm-backdrop"
      role="presentation"
    >
      <section
        className="modal campaign-confirm"
        role="dialog"
        aria-modal="true"
        aria-label={`Confirm ${action}`}
      >
        <button
          className="modal-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          <MarketingIcon name="x" />
        </button>
        <header>
          <h2>Confirm {action}</h2>
          <p>Review the campaign details below before proceeding.</p>
        </header>
        <div className="campaign-confirm-section">
          <span>Title</span>
          <p>{title}</p>
        </div>
        <div className="campaign-confirm-section">
          <span>Content preview</span>
          {locales
            .filter(([code]) => messages[code]?.trim())
            .map(([code, name]) => (
              <div className="campaign-confirm-copy" key={code}>
                <div>
                  <i>{code}</i>
                  {name}
                </div>
                <p>{messages[code]}</p>
              </div>
            ))}
        </div>
        <div className="campaign-confirm-section">
          <span>Audience</span>
          <div className="campaign-confirm-audience">
            <i>Locales: {audienceLocales.join(", ")}</i>
            {wizard !== "all" && (
              <i>
                Wizard: {wizard === "completed" ? "completed" : "not completed"}
              </i>
            )}
            {premium !== "all" && (
              <i>{premium === "premium" ? "Premium" : "Free"}</i>
            )}
          </div>
        </div>
        <div
          className={`campaign-confirm-section campaign-confirm-total ${total > 10000 ? "large" : ""}`}
        >
          <span>Total recipients</span>
          <p>{total.toLocaleString()}</p>
          {total > 10000 && (
            <small>Large audience — double-check the cohort filter.</small>
          )}
        </div>
        <div className="campaign-confirm-section">
          <span>Estimated send time</span>
          <p>
            {schedule === "later"
              ? new Date(scheduledAt).toLocaleString()
              : "Immediately"}
          </p>
        </div>
        <div className="campaign-warning">
          <b>
            <MarketingIcon name="alert" /> <span>Sent campaigns cannot be recalled.</span>
          </b>
          <p>
            Once dispatched, messages are written to recipient chat threads and
            push notifications may already be in flight. You can cancel an
            in-progress send, but already-delivered messages will remain.
          </p>
        </div>
        <label>
          Type the campaign title to confirm: {title}
          <input
            autoFocus
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={title}
          />
        </label>
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy || confirmation !== title}
            onClick={() => void onConfirm()}
          >
            {busy ? "Working…" : action}
          </button>
        </div>
      </section>
    </div>
  );
}

function CampaignDetail({
  campaign,
  onChange,
}: {
  campaign: MarketingCampaign;
  onChange: (campaign: MarketingCampaign) => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cancel = async () => {
    setBusy(true);
    setError("");
    try {
      onChange(
        await api.post<MarketingCampaign>(
          `/admin/marketing/campaigns/${campaign.id}/cancel`,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not cancel the campaign",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="campaign-detail">
      <header className="campaign-editor-heading">
        <button
          type="button"
          className="article-back"
          aria-label="Back"
          onClick={() => navigate("/marketing")}
        >
          <MarketingIcon name="arrowLeft" />
        </button>
        <div>
          <h1>{campaign.title}</h1>
          <span
            className={`table-badge status-${campaign.status.toLowerCase()}`}
          >
            {statusLabel(campaign.status)}
          </span>
        </div>
      </header>
      <div className="campaign-detail-grid">
        <section className="campaign-card">
          <h3>Content</h3>
          {locales
            .filter(([code]) => campaign.contentVariants?.[code])
            .map(([code, name]) => (
              <article key={code}>
                <div>
                  <i>{code}</i>
                  {name}
                </div>
                <p>{campaign.contentVariants?.[code]}</p>
              </article>
            ))}
        </section>
        <section className="campaign-card">
          <h3>Audience</h3>
          <p>Locales: {campaign.cohortFilter?.locales?.join(", ") || "—"}</p>
          <p>
            Recipients: {Number(campaign.recipientCount ?? 0).toLocaleString()}
          </p>
          <p>
            Wizard:{" "}
            {campaign.cohortFilter?.wizardCompleted === undefined
              ? "All"
              : campaign.cohortFilter.wizardCompleted
                ? "Completed only"
                : "Not completed"}
          </p>
          <p>
            Premium:{" "}
            {campaign.cohortFilter?.isPremium === undefined
              ? "All"
              : campaign.cohortFilter.isPremium
                ? "Premium only"
                : "Free only"}
          </p>
        </section>
        <section className="campaign-card">
          <h3>Delivery</h3>
          <p>
            {channelLabels[String(campaign.channel ?? "")] ??
              displayValue(campaign.channel)}
          </p>
          <p>
            {campaign.respectMarketingPref
              ? "Marketing notification preference is respected"
              : "Marketing notification preference is ignored"}
          </p>
        </section>
        <section className="campaign-card">
          <h3>Timing</h3>
          <p>Created: {displayDate(campaign.createdAt)}</p>
          {campaign.scheduledFor && (
            <p>Scheduled: {displayDate(campaign.scheduledFor)}</p>
          )}
          {campaign.sentAt && <p>Sent: {displayDate(campaign.sentAt)}</p>}
        </section>
        {campaign.deliveryStats && (
          <section className="campaign-card campaign-delivery-progress">
            <h3>Delivery progress</h3>
            <div className="campaign-stat-grid">
              {Object.entries(campaign.deliveryStats).map(([key, value]) => (
                <div key={key}>
                  <span>{fieldLabel(key)}</span>
                  <b>{displayValue(value)}</b>
                </div>
              ))}
            </div>
          </section>
        )}
        {campaign.lastError && (
          <p className="campaign-form-error">{campaign.lastError}</p>
        )}
      </div>
      {["SCHEDULED", "SENDING"].includes(campaign.status) && (
        <button
          className="danger campaign-cancel"
          disabled={busy}
          onClick={() => void cancel()}
        >
          {busy ? "Working…" : "Cancel campaign"}
        </button>
      )}
      {error && <p className="campaign-form-error">{error}</p>}
    </section>
  );
}

function CampaignRadios({
  title,
  value,
  setValue,
  options,
  stacked = false,
}: {
  title: string;
  value: string;
  setValue: (value: string) => void;
  options: string[][];
  stacked?: boolean;
}) {
  return (
    <fieldset className={`campaign-radios ${stacked ? "stacked" : ""}`}>
      <legend>{title}</legend>
      <div>
        {options.map(([key, name, description]) => (
          <label key={key}>
            <input
              type="radio"
              name={title}
              checked={value === key}
              onChange={() => setValue(key)}
            />
            <span>
              {name}
              {description && <small>{description}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
