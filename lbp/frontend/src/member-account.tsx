import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiError, createApiClient } from "./api";
import {
  ACCOUNT_COPY,
  ACCOUNT_DELETION_REASONS,
  ACCOUNT_ICONS,
} from "./member-account-reference";
import {
  Icon,
  Overlay,
  PremiumDialog,
  ProfileGallery,
  profileAge,
  profileCountry,
  profileList,
  profileOption,
} from "./member-profile";
import { firstAvatarText, UserAvatar } from "./user-avatar";

export type MemberRow = Record<string, unknown>;
export type MemberLocale = keyof typeof ACCOUNT_COPY;
type Session = { user: MemberRow } | null;
const api = createApiClient("/api");
export const memberText = (...values: unknown[]) =>
  firstAvatarText(
    ...values.map((value) =>
      typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : value,
    ),
  );
const text = memberText;
export const memberRow = (value: unknown): MemberRow =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as MemberRow)
    : {};
export const memberBoolean = (value: unknown) =>
  value === true ||
  value === 1 ||
  ["true", "1", "yes"].includes(String(value).toLowerCase());
const COPY = {
  en: {
    loading: "Loading…",
    loadError: "Could not load this page.",
    saveError: "Could not save changes. Please try again.",
    retry: "Try again",
    saved: "Changes saved.",
    deleteTitle: "Are you sure you want to delete your account?",
    deleteBody:
      "Access ends immediately. Your account, profile, photos, matches, and conversations will be permanently deleted after 30 days.",
    deleteDone:
      "Access has ended. Your account is scheduled for permanent deletion in 30 days.",
    reason: "Select a reason",
    back: "Go back",
    premiumTitle: "Verify to go Premium",
    premiumBody:
      "Premium is for verified members. Verify your profile photo to continue — it's free, it's fast, and no documents are required — just a quick selfie.",
    verify: "Verify now",
    later: "Not now",
  },
  ru: {
    loading: "Загрузка…",
    loadError: "Не удалось загрузить страницу.",
    saveError: "Не удалось сохранить изменения. Попробуйте ещё раз.",
    retry: "Повторить",
    saved: "Изменения сохранены.",
    deleteTitle: "Вы уверены, что хотите удалить аккаунт?",
    deleteBody:
      "Доступ прекратится сразу. Аккаунт, профиль, фотографии, совпадения и переписка будут окончательно удалены через 30 дней.",
    deleteDone: "Доступ прекращён. Аккаунт будет окончательно удалён через 30 дней.",
    reason: "Выберите причину",
    back: "Назад",
    premiumTitle: "Подтвердите профиль для Premium",
    premiumBody:
      "Premium доступен верифицированным участникам. Подтвердите фото профиля, чтобы продолжить — это бесплатно, быстро и без документов, нужен только короткий селфи.",
    verify: "Подтвердить сейчас",
    later: "Не сейчас",
  },
  es: {
    loading: "Cargando…",
    loadError: "No se pudo cargar la página.",
    saveError: "No se pudieron guardar los cambios. Inténtalo de nuevo.",
    retry: "Reintentar",
    saved: "Cambios guardados.",
    deleteTitle: "¿Seguro que quieres eliminar tu cuenta?",
    deleteBody:
      "El acceso termina inmediatamente. La cuenta, el perfil, las fotos, las coincidencias y las conversaciones se eliminarán definitivamente después de 30 días.",
    deleteDone:
      "El acceso ha terminado. La cuenta se eliminará definitivamente después de 30 días.",
    reason: "Selecciona un motivo",
    back: "Volver",
    premiumTitle: "Verifica para acceder a Premium",
    premiumBody:
      "Premium es para miembros verificados. Verifica la foto de tu perfil para continuar: es gratis, rápido y no requiere documentos, solo un selfie rápido.",
    verify: "Verificar ahora",
    later: "Ahora no",
  },
};

export function AccountIcon({ name }: { name: keyof typeof ACCOUNT_ICONS }) {
  const svg = ACCOUNT_ICONS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{
        __html: svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, ""),
      }}
    />
  );
}

export function ownProfileData(value: unknown): MemberRow {
  const profile = memberRow(value);
  return { ...profile, ...memberRow(profile.data) };
}

export function profileCompletion(
  profile: MemberRow,
  fallbackName = "",
): number {
  const data = ownProfileData(profile);
  const present = (value: unknown): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    if (Array.isArray(value)) return value.some(present);
    return Boolean(text(value));
  };
  const fields: [unknown, number][] = [
    [text(data.displayName, fallbackName), 6],
    [data.dateOfBirth, 6],
    [data.country, 6],
    [data.city, 6],
    [data.profileType, 4],
    [
      profileList(data.donorType).some(present) ||
        profileList(data.lookingFor).some(present),
      4,
    ],
    [
      data.desiredDonorContact ||
        data.donorContactWillingness ||
        data.surrogateContactPreference,
      4,
    ],
    [profileList(data.lookingFor), 6],
    [data.height, 4],
    [data.weight, 4],
    [text(data.bio, data.about), 10],
    [data.eyeColor, 5],
    [data.hairColor, 5],
    [data.ethnicity, 5],
    [data.occupation, 5],
    [data.education, 5],
    [data.smokingStatus || data.smoking, 5],
    [data.drinkingStatus || data.alcohol, 5],
    [data.religion, 5],
  ];
  return Math.min(
    100,
    fields.reduce(
      (sum, [value, weight]) => sum + (present(value) ? weight : 0),
      0,
    ),
  );
}

export function useMemberResource<T>(path: string, enabled: boolean) {
  const [state, setState] = useState<{
    path: string;
    data?: T;
    error?: number;
  }>({ path });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ path });
    if (enabled)
      void api
        .get<T>(path)
        .then((data) => {
          if (active) setState({ path, data });
        })
        .catch((error) => {
          if (active)
            setState({
              path,
              error: error instanceof ApiError ? error.status : 0,
            });
        });
    return () => {
      active = false;
    };
  }, [path, enabled, revision]);
  return {
    data: state.path === path ? state.data : undefined,
    error: state.path === path ? state.error : undefined,
    replace: (data: T) => setState({ path, data }),
    retry: () => setRevision((value) => value + 1),
  };
}

export function MemberLoading({ locale }: { locale: MemberLocale }) {
  return (
    <div
      className="account-loading"
      role="status"
      aria-label={COPY[locale].loading}
    >
      <span />
    </div>
  );
}

export function MemberError({
  locale,
  retry,
  status,
}: {
  locale: MemberLocale;
  retry: () => void;
  status?: number;
}) {
  if (status === 401) return <Navigate to={`/${locale}/auth/login`} replace />;
  return (
    <div className="account-error" role="alert">
      <p>{COPY[locale].loadError}</p>
      <button type="button" className="account-secondary" onClick={retry}>
        {COPY[locale].retry}
      </button>
    </div>
  );
}

export function notifyMemberChanged() {
  window.dispatchEvent(new Event("lbp-member-changed"));
}

export function AccountDialog({
  title,
  locale,
  close,
  busy = false,
  narrow = false,
  children,
}: {
  title: string;
  locale: MemberLocale;
  close: () => void;
  busy?: boolean;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <Overlay
      className="account-overlay"
      label={title}
      close={close}
      busy={busy}
    >
      <section
        className={`account-dialog${narrow ? " account-dialog-narrow" : ""}`}
      >
        <h2>{title}</h2>
        <button
          className="account-dialog-close"
          type="button"
          disabled={busy}
          aria-label={ACCOUNT_COPY[locale].close}
          onClick={close}
        >
          <Icon name="closeIcon" />
        </button>
        {children}
      </section>
    </Overlay>
  );
}

export function AccountPremium({
  locale,
  close,
}: {
  locale: MemberLocale;
  close: () => void;
}) {
  const [verify, setVerify] = useState(false);
  const c = COPY[locale];
  return verify ? (
    <AccountDialog title={c.premiumTitle} locale={locale} close={close}>
      <p>{c.premiumBody}</p>
      <div className="account-dialog-actions">
        <button className="account-secondary" type="button" onClick={close}>
          {c.later}
        </button>
        <Link
          className="account-primary"
          to={`/${locale}/profile/verification`}
          onClick={close}
        >
          {c.verify}
        </Link>
      </div>
    </AccountDialog>
  ) : (
    <PremiumDialog
      locale={locale}
      close={close}
      verify={() => setVerify(true)}
    />
  );
}

function LanguageDialog({
  locale,
  close,
}: {
  locale: MemberLocale;
  close: () => void;
}) {
  const settings = useMemberResource<MemberRow>("/member/settings", true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const pending = useRef(false);
  const navigate = useNavigate();
  const choose = async (language: string) => {
    if (pending.current || !settings.data) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      await api.patch("/member/settings", { interfaceLanguage: language });
      const current = await api.get<MemberRow>("/member/settings");
      if (current.interfaceLanguage !== language)
        throw new Error("Language was not persisted");
      notifyMemberChanged();
      close();
      navigate(`/${language}/profile`);
    } catch {
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <AccountDialog
      title={ACCOUNT_COPY[locale].language}
      locale={locale}
      close={close}
      busy={busy}
      narrow
    >
      {settings.error !== undefined ? (
        <MemberError
          locale={locale}
          status={settings.error}
          retry={settings.retry}
        />
      ) : !settings.data ? (
        <MemberLoading locale={locale} />
      ) : (
        <div className="account-language-options">
          {(
            [
              ["en", "English"],
              ["ru", "Русский"],
              ["es", "Español"],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              disabled={busy}
              aria-pressed={settings.data?.interfaceLanguage === code}
              onClick={() => void choose(code)}
            >
              <span>{label}</span>
              {settings.data?.interfaceLanguage === code && (
                <AccountIcon name="languageCheckIcon" />
              )}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="account-error" role="alert">
          {COPY[locale].saveError}
        </p>
      )}
    </AccountDialog>
  );
}

function DeleteAccountDialog({
  locale,
  close,
  onHidden,
}: {
  locale: MemberLocale;
  close: () => void;
  onHidden: () => void;
}) {
  const c = ACCOUNT_COPY[locale],
    messages = COPY[locale];
  const [reason, setReason] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [done, setDone] = useState(false);
  const pending = useRef(false);
  const valid =
    Boolean(reason) && confirmation.trim().toLowerCase() === "delete";
  return (
    <AccountDialog
      title={messages.deleteTitle}
      locale={locale}
      close={close}
      busy={busy}
    >
      {done ? (
        <>
          <p role="status">{messages.deleteDone}</p>
          <button className="account-primary" type="button" onClick={close}>
            {c.close}
          </button>
        </>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!valid || pending.current) return;
            pending.current = true;
            setBusy(true);
            setError(false);
            try {
              await api.post("/member/account-deletion", { reason, confirmation: "DELETE" });
              setDone(true);
              onHidden();
              notifyMemberChanged();
              window.setTimeout(() => window.location.assign(`/${locale}/auth/login`), 1200);
            } catch {
              setError(true);
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          <p>{messages.deleteBody}</p>
          <label>
            {c.deleteReason}
            <select
              required
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            >
              <option value="">{messages.reason}</option>
              {ACCOUNT_DELETION_REASONS[locale].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            {c.deleteConfirm}
            <input
              autoComplete="off"
              value={confirmation}
              disabled={busy}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {error && (
            <p className="account-error" role="alert">
              {messages.saveError}
            </p>
          )}
          <div className="account-dialog-actions">
            <button
              className="account-secondary"
              type="button"
              disabled={busy}
              onClick={close}
            >
              {messages.back}
            </button>
            <button
              className="account-primary account-danger"
              type="submit"
              disabled={!valid || busy}
            >
              {busy ? messages.loading : c.deleteButton}
            </button>
          </div>
        </form>
      )}
    </AccountDialog>
  );
}

function Overview({
  session,
  locale,
  onLogout,
}: {
  session: NonNullable<Session>;
  locale: MemberLocale;
  onLogout: () => Promise<void>;
}) {
  const member = useMemberResource<MemberRow>("/member/me", true);
  const settings = useMemberResource<MemberRow>("/member/settings", true);
  const [dialog, setDialog] = useState<
    "language" | "delete" | "premium" | null
  >(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const pending = useRef(false);
  const c = ACCOUNT_COPY[locale];
  if (member.error !== undefined)
    return (
      <MemberError locale={locale} status={member.error} retry={member.retry} />
    );
  if (!member.data) return <MemberLoading locale={locale} />;
  const profile = memberRow(member.data.profile),
    data = ownProfileData(profile);
  const name = text(
    data.displayName,
    session.user.displayName,
    session.user.display_name,
  );
  const age = profileAge(profile),
    completion = profileCompletion(profile, name);
  const verified = memberBoolean(profile.isVerified ?? data.isVerified);
  const location = [text(data.city), profileCountry(data.country, locale)]
    .filter(Boolean)
    .join(", ");
  const type = text(data.profileType)
    ? profileOption("profileTypes", data.profileType, locale)
    : "";
  const photos = (Array.isArray(member.data.photos) ? member.data.photos : [])
    .map(memberRow)
    .filter(
      (photo) =>
        !["REJECTED", "DELETED"].includes(String(photo.status).toUpperCase()) &&
        String(photo.moderationStatus).toUpperCase() !== "REJECTED",
    )
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
  const gallery: MemberRow = {
    photos,
    avatarUrl: photos.length ? undefined : data.avatarUrl,
  };
  const visibility = memberBoolean(
    settings.data?.visibleInCatalog ?? data.visibleInCatalog ?? true,
  );
  const changeVisibility = async () => {
    if (pending.current || !settings.data) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    const previous = settings.data,
      next = !visibility;
    settings.replace({ ...previous, visibleInCatalog: next });
    try {
      await api.patch("/member/settings", { visibleInCatalog: next });
      const saved = await api.get<MemberRow>("/member/settings");
      settings.replace(saved);
      if (memberBoolean(saved.visibleInCatalog) !== next)
        throw new Error("Visibility was not persisted");
      notifyMemberChanged();
    } catch {
      settings.replace(previous);
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const summary = (mobile: boolean) => (
    <div
      className={`account-summary ${mobile ? "account-summary-mobile" : "account-summary-desktop"}`}
    >
      <h1>
        {name}
        {age ? `, ${age}` : ""}
        <Icon name={verified ? "verifiedIcon" : "unverifiedIcon"} />
      </h1>
      {location && (
        <p>
          <Icon name="locationIcon" />
          {location}
        </p>
      )}
    </div>
  );
  const setting = (
    action: keyof typeof ACCOUNT_ICONS,
    label: string,
    href?: string,
    click?: () => void,
    extra?: string,
  ) => {
    const content = (
      <>
        <span className="account-setting-icon">
          <AccountIcon name={action} />
        </span>
        <span className="account-setting-label">{label}</span>
        {extra && <span className="account-setting-value">{extra}</span>}
        {(href || action === "language") && <Icon name="arrowRightIcon" />}
      </>
    );
    const className = `account-setting${["delete", "signout"].includes(action) ? " account-setting-danger" : ""}${action === "verification" && verified ? " account-setting-verified" : ""}`;
    return href ? (
      <Link className={className} to={href}>
        {content}
      </Link>
    ) : (
      <button
        className={className}
        type="button"
        disabled={busy && action === "signout"}
        onClick={click}
      >
        {content}
      </button>
    );
  };
  return (
    <div className="account-overview">
      {summary(true)}
      <div className="account-grid">
        <aside>
          <div className="member-profile-surface">
            <ProfileGallery
              key={String(profile.id)}
              profile={gallery}
              name={name}
              locale={locale}
              tags={
                <>
                  {type && <span className="tag">{type}</span>}
                  {profileList(data.donorType).map((value) => {
                    const token = text(value).toUpperCase();
                    const donor = ["SPERM_DONOR", "SPERM"].includes(token)
                      ? "SPERM"
                      : ["EGG_DONOR", "EGG", "EGGS"].includes(token)
                        ? "EGG"
                        : "";
                    const label = donor
                      ? `${donor === "SPERM" ? "🧬" : "🥚"} ${profileOption("donorTypes", donor, locale)}`
                      : "";
                    return label ? (
                      <span className="tag" key={token}>
                        {label}
                      </span>
                    ) : null;
                  })}
                </>
              }
            />
          </div>
          <Link
            className="account-primary account-edit-photos"
            to={`/${locale}/profile/photos`}
          >
            <AccountIcon name="cameraIcon" />
            {c.photos}
          </Link>
        </aside>
        <div>
          {summary(false)}
          <div className="account-progress-row">
            <div>
              <p>{c.completed}</p>
              <div className="account-progress-line">
                <span
                  className="account-progress"
                  role="progressbar"
                  aria-label={c.completed}
                  aria-valuenow={completion}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${completion}%` }} />
                </span>
                <strong>{completion}%</strong>
              </div>
            </div>
            <label className="account-visibility">
              <span>{c.visible}</span>
              <button
                className="account-switch"
                type="button"
                role="switch"
                aria-label={c.visible}
                aria-checked={visibility}
                disabled={busy || !settings.data}
                onClick={() => void changeVisibility()}
              >
                <span />
              </button>
            </label>
          </div>
          {settings.error !== undefined && (
            <MemberError
              locale={locale}
              status={settings.error}
              retry={settings.retry}
            />
          )}
          {error && (
            <p className="account-error" role="alert">
              {COPY[locale].saveError}
            </p>
          )}
          <div className="account-settings-list">
            {setting("edit", c.edit, `/${locale}/profile/edit`)}
            {setting("premium", c.premium, undefined, () =>
              setDialog("premium"),
            )}
            {setting(
              "verification",
              c.verification,
              `/${locale}/profile/verification`,
            )}
            {setting(
              "notifications",
              c.notifications,
              `/${locale}/profile/notifications`,
            )}
            {setting(
              "language",
              c.language,
              undefined,
              () => setDialog("language"),
              (
                { en: "English", ru: "Русский", es: "Español" } as Record<
                  string,
                  string
                >
              )[text(settings.data?.interfaceLanguage, locale)] || locale,
            )}
            {setting("blocked", c.blocked, `/${locale}/profile/blocked`)}
            {setting("delete", c.delete, undefined, () => setDialog("delete"))}
            {setting("signout", c.signOut, undefined, () => {
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              void onLogout().catch(() => {
                setError(true);
                setBusy(false);
                pending.current = false;
              });
            })}
          </div>
        </div>
      </div>
      {dialog === "language" && (
        <LanguageDialog locale={locale} close={() => setDialog(null)} />
      )}
      {dialog === "delete" && (
        <DeleteAccountDialog
          locale={locale}
          close={() => setDialog(null)}
          onHidden={() =>
            settings.replace({ ...settings.data, visibleInCatalog: false })
          }
        />
      )}
      {dialog === "premium" && (
        <AccountPremium locale={locale} close={() => setDialog(null)} />
      )}
    </div>
  );
}

const NOTIFICATION_KEYS = {
  NEW_MATCH: ["newMatch", "newMatchHelp"],
  NEW_LIKE: ["newLike", "newLikeHelp"],
  NEW_MESSAGE: ["newMessage", "newMessageHelp"],
  PROFILE_VIEW: ["profileView", "profileViewHelp"],
  MARKETING: ["marketing", "marketingHelp"],
} as const;
export function updatedNotificationRows(
  settings: MemberRow,
  type: string,
  checked: boolean,
) {
  return (
    Array.isArray(settings.notificationSettings)
      ? settings.notificationSettings
      : []
  )
    .map(memberRow)
    .map((row) =>
      row.type === type ? { ...row, emailEnabled: checked } : row,
    );
}

function Notifications({ locale }: { locale: MemberLocale }) {
  const resource = useMemberResource<MemberRow>("/member/settings", true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [saved, setSaved] = useState(false);
  const pending = useRef(false),
    c = ACCOUNT_COPY[locale];
  if (resource.error !== undefined)
    return (
      <MemberError
        locale={locale}
        status={resource.error}
        retry={resource.retry}
      />
    );
  if (!resource.data) return <MemberLoading locale={locale} />;
  const toggle = async (type: string, checked: boolean) => {
    if (pending.current || !resource.data) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    setSaved(false);
    const previous = resource.data;
    const rows = updatedNotificationRows(previous, type, checked);
    resource.replace({ ...previous, notificationSettings: rows });
    try {
      await api.patch("/member/settings", { notificationSettings: rows });
      const persisted = await api.get<MemberRow>("/member/settings");
      resource.replace(persisted);
      const actual = (
        Array.isArray(persisted.notificationSettings)
          ? persisted.notificationSettings
          : []
      )
        .map(memberRow)
        .find((row) => row.type === type);
      if (!actual || memberBoolean(actual.emailEnabled) !== checked)
        throw new Error("Notification was not persisted");
      setSaved(true);
    } catch {
      resource.replace(previous);
      setError(true);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="account-notifications">
      <div className="account-page-heading">
        <Link to={`/${locale}/profile`} aria-label={c.back}>
          <Icon name="pageBackIcon" />
        </Link>
        <h1>
          <AccountIcon name="mailIcon" />
          {c.notificationsTitle}
        </h1>
      </div>
      <p className="account-intro">{c.notificationsIntro}</p>
      <div className="account-notification-panel" aria-busy={busy}>
        {(Array.isArray(resource.data.notificationSettings)
          ? resource.data.notificationSettings
          : []
        )
          .map(memberRow)
          .map((row) => {
            const labels =
              NOTIFICATION_KEYS[row.type as keyof typeof NOTIFICATION_KEYS];
            if (!labels) return null;
            return (
              <label
                className="account-notification-row"
                key={String(row.type)}
              >
                <span>
                  <strong>{c[labels[0]]}</strong>
                  <small>{c[labels[1]]}</small>
                </span>
                <button
                  className="account-switch"
                  type="button"
                  role="switch"
                  aria-label={c[labels[0]]}
                  aria-checked={memberBoolean(row.emailEnabled)}
                  disabled={busy}
                  onClick={() =>
                    void toggle(
                      String(row.type),
                      !memberBoolean(row.emailEnabled),
                    )
                  }
                >
                  <span />
                </button>
              </label>
            );
          })}
      </div>
      {error && (
        <p className="account-error" role="alert">
          {COPY[locale].saveError}
        </p>
      )}
      {saved && (
        <span className="account-sr-only" role="status">
          {COPY[locale].saved}
        </span>
      )}
    </section>
  );
}

function Blocked({ locale }: { locale: MemberLocale }) {
  const resource = useMemberResource<{ items: MemberRow[] }>(
    "/member/blocks",
    true,
  );
  const [selected, setSelected] = useState<MemberRow | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const pending = useRef(false),
    c = ACCOUNT_COPY[locale];
  if (resource.error !== undefined)
    return (
      <MemberError
        locale={locale}
        status={resource.error}
        retry={resource.retry}
      />
    );
  return (
    <section className="account-blocked">
      <Link className="account-back" to={`/${locale}/profile`}>
        <Icon name="pageBackIcon" />
        {c.blockedBack}
      </Link>
      <h1>{c.blockedTitle}</h1>
      {!resource.data ? (
        <MemberLoading locale={locale} />
      ) : !resource.data.items.length ? (
        <p className="account-empty">{c.noBlocked}</p>
      ) : (
        <div className="account-blocked-list">
          {resource.data.items.map((item) => {
            const id = text(item.profileId, item.id),
              name = text(item.displayName, item.name);
            return (
              <article className="account-blocked-row" key={id}>
                <UserAvatar
                  src={text(item.avatarUrl, memberRow(item.data).avatarUrl)}
                  name={name}
                />
                <div>
                  <strong>{name}</strong>
                  <small>
                    {[text(item.city), profileCountry(item.country, locale)]
                      .filter(Boolean)
                      .join(", ")}
                  </small>
                </div>
                <button
                  className="account-secondary"
                  onClick={() => {
                    setSelected(item);
                    setError(false);
                  }}
                >
                  {c.unblock}
                </button>
              </article>
            );
          })}
        </div>
      )}
      {selected && (
        <AccountDialog
          title={`${c.unblockConfirmPrefix} ${text(selected.displayName, selected.name)}?`}
          locale={locale}
          close={() => setSelected(null)}
          busy={busy}
        >
          <p>{c.unblockConfirmBody}</p>
          {error && (
            <p className="account-error" role="alert">
              {COPY[locale].saveError}
            </p>
          )}
          <div className="account-dialog-actions">
            <button
              className="account-secondary"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              {c.cancel}
            </button>
            <button
              className="account-primary"
              disabled={busy}
              onClick={() => {
                if (pending.current) return;
                pending.current = true;
                setBusy(true);
                setError(false);
                void api
                  .delete(
                    `/member/blocks/${encodeURIComponent(text(selected.profileId, selected.id))}`,
                  )
                  .then(async () => {
                    resource.replace(
                      await api.get<{ items: MemberRow[] }>("/member/blocks"),
                    );
                    setSelected(null);
                    notifyMemberChanged();
                  })
                  .catch(() => setError(true))
                  .finally(() => {
                    pending.current = false;
                    setBusy(false);
                  });
              }}
            >
              {busy ? COPY[locale].loading : c.unblock}
            </button>
          </div>
        </AccountDialog>
      )}
    </section>
  );
}

export function MemberAccount({
  session,
  locale,
  onLogout,
  view = "overview",
}: {
  session: Session;
  locale: MemberLocale;
  onLogout: () => Promise<void>;
  view?: "overview" | "notifications" | "blocked";
}) {
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  return (
    <div
      className="member-account-surface"
      key={`${session.user.id}:${locale}:${view}`}
    >
      {view === "notifications" ? (
        <Notifications locale={locale} />
      ) : view === "blocked" ? (
        <Blocked locale={locale} />
      ) : (
        <Overview session={session} locale={locale} onLogout={onLogout} />
      )}
    </div>
  );
}
