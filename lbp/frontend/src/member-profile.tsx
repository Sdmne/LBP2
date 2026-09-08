import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, createApiClient } from "./api";
import { firstAvatarText, userInitials } from "./user-avatar";
import {
  PROFILE_COPY,
  PROFILE_ICONS,
  PROFILE_OPTIONS,
  PROFILE_TRANSLATIONS,
} from "./member-profile-reference";
import { PREMIUM_COPY, PREMIUM_ICONS } from "./member-premium-reference";

type Row = Record<string, unknown>;
type Locale = keyof typeof PROFILE_COPY;
type Session = { user: Row } | null;
const api = createApiClient("/api");
const icons = { ...PROFILE_ICONS, ...PREMIUM_ICONS };
const modalStack: HTMLDivElement[] = [];
let modalBodyOverflow = "";
let modalBodyWidth = "";
const closingOverlays = new WeakSet<HTMLDivElement>();
function closeProfileOverlay(close: () => void) {
  const element = modalStack[modalStack.length - 1];
  if (
    !element ||
    !element.matches(
      ".profile-dialog, .detail-gallery-lightbox, .premium-paywall, .premium-mobile-only",
    ) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    close();
    return;
  }
  if (closingOverlays.has(element)) return;
  closingOverlays.add(element);
  element.classList.remove("open");
  element.inert = true;
  window.setTimeout(() => {
    if (element.isConnected) close();
  }, 180);
}
const text = firstAvatarText;
const bool = (value: unknown) =>
  value === true || ["1", "true", "yes"].includes(String(value).toLowerCase());
const row = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};

export function profileList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
      : typeof parsed === "string"
        ? [parsed]
        : [];
  } catch {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
}

export function profileOption(field: string, value: unknown, locale: Locale) {
  const token = text(value).toUpperCase();
  return (
    PROFILE_TRANSLATIONS[locale]?.[token] ||
    PROFILE_OPTIONS[field]?.find((option) => option[0] === token)?.[1] ||
    text(value)
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function profileAge(item: Row, now = new Date()): string {
  const data = row(item.data);
  const match = text(data.dateOfBirth, item.dateOfBirth).match(
    /^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/,
  );
  if (match) {
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      const age =
        now.getUTCFullYear() -
        year -
        (now.getUTCMonth() + 1 < month ||
        (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)
          ? 1
          : 0);
      if (age >= 18 && age < 120) return String(age);
    }
  }
  const age = Number(item.age ?? data.age);
  return Number.isInteger(age) && age >= 18 && age < 120 ? String(age) : "";
}

export function profileCountry(value: unknown, locale: Locale) {
  const country = text(value);
  const code =
    ({ USA: "US", UK: "GB", UAE: "AE" } as Record<string, string>)[
      country.toUpperCase()
    ] || country.toUpperCase();
  try {
    return /^[A-Z]{2}$/.test(code)
      ? new Intl.DisplayNames([locale], { type: "region" }).of(code) || country
      : country;
  } catch {
    return country;
  }
}

export function profilePhotos(item: Row): string[] {
  const data = row(item.data);
  const source = [
    ...profileList(item.photos),
    ...profileList(data.photos),
    item.avatarUrl,
    data.avatarUrl,
    item.photoUrl,
    data.photoUrl,
  ];
  return [
    ...new Set(
      source
        .map((value) =>
          typeof value === "string"
            ? text(value)
            : text(row(value).publicUrl, row(value).url),
        )
        .filter((url) => /^(?:https?:\/\/|\/(?!\/)|blob:)/i.test(url)),
    ),
  ];
}

export function profileLanguages(data: Row, locale: Locale): string[] {
  const source =
    [
      data.languages,
      data.spokenLanguages,
      data.languageCodes,
      data.profileLanguages,
    ]
      .map(profileList)
      .find((items) => items.length) || [];
  return [
    ...new Set(
      source
        .map((value) => {
          if (typeof value === "object") {
            const entry = row(value),
              nested = row(entry.language);
            return (
              text(
                entry.nativeName,
                entry.name,
                entry.label,
                nested.nativeName,
                nested.name,
              ) || languageName(text(entry.code, nested.code))
            );
          }
          return languageName(text(value));
        })
        .filter(Boolean),
    ),
  ];
  function languageName(value: string) {
    try {
      return /^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(value)
        ? new Intl.DisplayNames([locale], { type: "language" }).of(value) ||
            value
        : value;
    } catch {
      return value;
    }
  }
}

export function Icon({ name, label }: { name: keyof typeof icons; label?: string }) {
  // Only the fixed, reviewed SVG literals from the existing HTML implementation.
  const source = icons[name];
  return (
    <svg
      className={source.match(/class="([^"]*)"/)?.[1]}
      viewBox="0 0 24 24"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{
        __html: source.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, ""),
      }}
    />
  );
}

export function Overlay({
  className,
  label,
  close,
  busy = false,
  children,
  onArrow,
  initialFocus,
  fullViewport = false,
  surfaceClassName = "",
}: {
  className: string;
  label: string;
  close: () => void;
  busy?: boolean;
  children: ReactNode;
  onArrow?: (direction: number) => void;
  initialFocus?: string;
  fullViewport?: boolean | "page";
  surfaceClassName?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const pageGutter = useRef(window.innerWidth - document.body.getBoundingClientRect().width);
  const controls = useRef({ close, busy, onArrow });
  controls.current = { close, busy, onArrow };
  useEffect(() => {
    if (!fullViewport) return;
    const size = () => { root.current?.style.setProperty("width", `${window.innerWidth - (fullViewport === "page" ? pageGutter.current : 0)}px`, "important"); };
    size();
    window.addEventListener("resize", size);
    return () => { window.removeEventListener("resize", size); };
  }, [fullViewport]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (!modalStack.length) {
      modalBodyOverflow = document.body.style.overflow;
      modalBodyWidth = document.body.style.width;
      if (surfaceClassName.includes("profile-tools-surface") && pageGutter.current > 0) {
        document.body.style.width = `calc(100% - ${pageGutter.current}px)`;
      }
    }
    const element = root.current;
    if (element) modalStack.push(element);
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      root.current?.classList.add("open");
      root.current
        ?.querySelector<HTMLElement>(initialFocus || "button, select, [tabindex='0']")
        ?.focus();
    });
    const keydown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== root.current) return;
      if (event.key === "Escape" && !controls.current.busy) {
        event.preventDefault();
        controls.current.close();
      }
      if (
        ["ArrowLeft", "ArrowRight"].includes(event.key) &&
        controls.current.onArrow
      ) {
        event.preventDefault();
        controls.current.onArrow(event.key === "ArrowRight" ? 1 : -1);
      }
      if (event.key !== "Tab") return;
      const elements = [
        ...(root.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']",
        ) || []),
      ].filter((el) => el.tabIndex >= 0 && el.getClientRects().length);
      const first = elements[0],
        last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        root.current?.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          !root.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !root.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keydown);
      if (element) modalStack.splice(modalStack.indexOf(element), 1);
      document.body.style.overflow = modalStack.length
        ? "hidden"
        : modalBodyOverflow;
      if (!modalStack.length) document.body.style.width = modalBodyWidth;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <div className={`member-profile-surface ${surfaceClassName}`}>
      <div
        className={className}
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-busy={busy}
        tabIndex={-1}
        onClick={(event) => {
          if (event.target === event.currentTarget && !busy) close();
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function PremiumDialog({
  locale,
  close,
  verify,
}: {
  locale: Locale;
  close: () => void;
  verify: () => void;
}) {
  const c = PREMIUM_COPY[locale],
    common = PROFILE_COPY[locale];
  const [subscription, setSubscription] = useState<Row | null>(null);
  const [error, setError] = useState(false);
  const [plan, setPlan] = useState("quarterly");
  const [mobile, setMobile] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    api
      .get<Row>("/member/subscription")
      .then((result) => {
        if (!cancelled) {
          if (result.isVerified === false) verify();
          else setSubscription(result);
        }
      })
      .catch((failure) => {
        if (!cancelled) {
          if (failure instanceof ApiError && failure.status === 403) verify();
          else setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  const active =
    subscription?.isPremium !== undefined
      ? bool(subscription.isPremium)
      : subscription?.status === "ACTIVE";
  const limit = (key: string) => {
    const value = row(subscription?.limits)[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  };
  const features: [
    string,
    string,
    keyof typeof icons,
    boolean | number | null,
    boolean | number | null,
  ][] = [
    [
      "likes",
      c.likes,
      "heartIcon",
      limit("freeLikesPerDay"),
      limit("premiumLikesPerDay"),
    ],
    ["directMessage", c.directMessage, "messageIcon", false, true],
    ["likedMe", c.likedMe, "heartIcon", false, true],
    ["visitors", c.visitors, "eyeIcon", false, true],
    ["videoCalls", c.videoCalls, "videoIcon", false, true],
    ["filters", c.filters, "slidersIcon", false, true],
    ["priority", c.priority, "starIcon", false, true],
  ];
  const feature = (value: boolean | number | null) =>
    value === null || typeof value === "number" ? (
      <span className="premium-feature-number">{value ?? "—"}</span>
    ) : (
      <span
        className={`premium-feature-state ${value ? "included" : "excluded"}`}
      >
        <Icon
          name={value ? "premiumCheckIcon" : "premiumXIcon"}
          label={value ? c.included : c.notIncluded}
        />
      </span>
    );
  return (
    <>
      <Overlay className="premium-paywall" label={c.title} close={close}>
        <div className="premium-paywall-backdrop" onClick={close} />
        <section className="premium-paywall-dialog">
          <button
            className="premium-paywall-close"
            type="button"
            aria-label={common.close}
            onClick={close}
          >
            <Icon name="closeIcon" />
          </button>
          <div className="premium-paywall-scroll">
            <div className="premium-paywall-hero">
              <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                aria-hidden="true"
              >
                <source
                  src="/web-static/images/paywall/hero-bg-c8afbbab.mp4"
                  type="video/mp4"
                />
              </video>
              <div className="premium-paywall-gradient" />
              <div className="premium-paywall-heading">
                <h2>{c.title}</h2>
                <p>{c.subtitle}</p>
              </div>
            </div>
            {error ? (
              <div className="premium-current-plan">
                <p role="alert">
                  {
                    {
                      en: "Could not load your Premium access.",
                      ru: "Не удалось загрузить данные Premium.",
                      es: "No se pudo cargar tu acceso Premium.",
                    }[locale]
                  }
                </p>
                <button
                  type="button"
                  className="soft-button"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  {
                    { en: "Try again", ru: "Повторить", es: "Reintentar" }[
                      locale
                    ]
                  }
                </button>
              </div>
            ) : !subscription ? (
              <div className="loading" role="status" aria-label={c.title}>
                <span className="loading-spinner" />
              </div>
            ) : active ? (
              <section className="premium-current-plan">
                <span>
                  <Icon name="premiumCheckIcon" />
                </span>
                <div>
                  <strong>{c.alreadyPremium}</strong>
                  <p>{c.alreadyPremiumDesc}</p>
                </div>
              </section>
            ) : (
              <>
                <div
                  className="premium-plan-grid"
                  role="radiogroup"
                  aria-label={c.title}
                >
                  {["monthly", "quarterly"].map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      data-premium-plan={value}
                      className={`premium-plan${plan === value ? " selected" : ""}`}
                      aria-checked={plan === value}
                      onClick={() => setPlan(value)}
                      onKeyDown={(event) => {
                        if (
                          [
                            "ArrowLeft",
                            "ArrowRight",
                            "ArrowUp",
                            "ArrowDown",
                          ].includes(event.key)
                        ) {
                          event.preventDefault();
                          const next =
                            value === "monthly" ? "quarterly" : "monthly";
                          setPlan(next);
                          const group = event.currentTarget.parentElement;
                          group
                            ?.querySelectorAll<HTMLButtonElement>("button")
                            [next === "monthly" ? 0 : 1]?.focus();
                        }
                      }}
                      tabIndex={plan === value ? 0 : -1}
                    >
                      {value === "quarterly" && <b>{c.save}</b>}
                      <span>
                        {value === "monthly" ? c.monthly : c.quarterly}
                      </span>
                      <strong>
                        {value === "monthly"
                          ? c.monthlyPrice
                          : c.quarterlyPrice}
                      </strong>
                      <em>{c.perMonth}</em>
                      {value === "quarterly" && (
                        <small>{c.billedQuarterly}</small>
                      )}
                    </button>
                  ))}
                </div>
                <div className="premium-comparison">
                  <div className="premium-comparison-head">
                    <span />
                    <strong>{c.free}</strong>
                    <strong>{c.premium}</strong>
                  </div>
                  {features.map(([key, label, icon, free, premium]) => (
                    <div className="premium-comparison-row" key={key}>
                      <span className="premium-feature-label">
                        <i>
                          <Icon name={icon} />
                        </i>
                        <span>{label}</span>
                      </span>
                      {feature(free)}
                      {feature(premium)}
                    </div>
                  ))}
                </div>
                <div className="premium-paywall-spacer" aria-hidden="true" />
              </>
            )}
          </div>
          {subscription && !active && (
            <footer className="premium-paywall-footer">
              <button type="button" onClick={() => setMobile(true)}>
                {plan === "monthly" ? c.getMonthly : c.getQuarterly}
              </button>
            </footer>
          )}
        </section>
      </Overlay>
      {mobile && (
        <Overlay
          className="premium-mobile-only"
          label={c.mobileTitle}
          close={() => closeProfileOverlay(() => setMobile(false))}
        >
          <div
            className="premium-mobile-only-backdrop"
            onClick={() => closeProfileOverlay(() => setMobile(false))}
          />
          <section className="premium-mobile-only-dialog">
            <button
              className="premium-mobile-only-close"
              type="button"
              aria-label={common.close}
              onClick={() => closeProfileOverlay(() => setMobile(false))}
            >
              <Icon name="closeIcon" />
            </button>
            <span className="premium-mobile-only-icon">
              <Icon name="smartphoneIcon" />
            </span>
            <h2>{c.mobileTitle}</h2>
            <p>{c.mobileBody}</p>
            <a
              className="premium-mobile-only-store"
              href="https://apps.apple.com/app/letsbeparents/id1636495669"
              target="_blank"
              rel="noopener noreferrer"
            >
              {c.appStore}
            </a>
            <small>{c.androidNote}</small>
            <button
              className="premium-mobile-only-later"
              type="button"
              onClick={() => closeProfileOverlay(() => setMobile(false))}
            >
              {c.maybeLater}
            </button>
          </section>
        </Overlay>
      )}
    </>
  );
}

export function ProfileGallery({
  profile,
  name,
  locale,
  tags,
}: {
  profile: Row;
  name: string;
  locale: Locale;
  tags: ReactNode;
}) {
  const c = PROFILE_COPY[locale];
  const [failed, setFailed] = useState<string[]>([]);
  const photos = profilePhotos(profile).filter((url) => !failed.includes(url));
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const thumbnails = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ previous: false, next: false });
  const active = photos.length ? Math.min(index, photos.length - 1) : 0;
  const show = (next: number) =>
    setIndex(
      photos.length
        ? ((next % photos.length) + photos.length) % photos.length
        : 0,
    );
  const fail = (url: string) =>
    setFailed((current) =>
      current.includes(url) ? current : [...current, url],
    );
  useEffect(() => {
    if (!photos.length) setFullscreen(false);
  }, [photos.length]);
  useEffect(() => {
    const list = thumbnails.current;
    if (!list) return;
    const measure = () =>
      setOverflow({
        previous: list.scrollLeft > 1,
        next: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    list.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      list.removeEventListener("scroll", measure);
    };
  }, [photos.length]);
  useEffect(() => {
    const list = thumbnails.current,
      thumbnail = list?.children[active] as HTMLElement | undefined;
    if (list && thumbnail) {
      if (thumbnail.offsetLeft < list.scrollLeft)
        list.scrollTo({ left: thumbnail.offsetLeft, behavior: "smooth" });
      else if (
        thumbnail.offsetLeft + thumbnail.offsetWidth >
        list.scrollLeft + list.clientWidth
      )
        list.scrollTo({
          left: thumbnail.offsetLeft + thumbnail.offsetWidth - list.clientWidth,
          behavior: "smooth",
        });
    }
  }, [active]);
  const dots = (prefix: string) =>
    photos.length > 1 && (
      <div
        className={`${prefix}-dots`}
        role="group"
        aria-label={c.profilePhotos}
      >
        {photos.map((url, position) => (
          <button
            key={url}
            type="button"
            className={`${prefix}-dot${position === active ? " active" : ""}`}
            aria-label={`${c.showPhoto} ${position + 1}`}
            aria-current={position === active}
            onClick={() => show(position)}
          />
        ))}
      </div>
    );
  return (
    <>
      <div
        className="detail-photo-stage"
        role="group"
        aria-label={c.profilePhotos}
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            show(active + (event.key === "ArrowRight" ? 1 : -1));
          }
        }}
      >
        <div className="detail-photo-track">
          <div className="empty-photo detail-photo-fallback" aria-hidden="true">
            {userInitials(name)}
          </div>
          {photos.map((url, position) => (
            <img
              key={url}
              className={`detail-gallery-image${position === active ? " active" : ""}`}
              src={url}
              alt={name}
              loading={position ? "lazy" : "eager"}
              aria-hidden={position !== active}
              onError={() => fail(url)}
            />
          ))}
        </div>
        {photos.length > 0 && (
          <button
            className="profile-photo-fullscreen-trigger"
            type="button"
            aria-label={c.profilePhotos}
            onClick={() => setFullscreen(true)}
          />
        )}
        <div className="tags">{tags}</div>
        {photos.length > 1 && (
          <>
            <button
              className="detail-gallery-arrow previous"
              type="button"
              aria-label={c.previousPhoto}
              onClick={() => show(active - 1)}
            >
              <Icon name="arrowLeftIcon" />
            </button>
            <button
              className="detail-gallery-arrow next"
              type="button"
              aria-label={c.nextPhoto}
              onClick={() => show(active + 1)}
            >
              <Icon name="arrowRightIcon" />
            </button>
            {dots("detail-gallery")}
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="detail-thumbnails-wrap">
          <button
            className={`detail-thumbnails-arrow${overflow.previous ? " visible" : ""}`}
            aria-label={c.previousPhoto}
            type="button"
            onClick={() =>
              thumbnails.current?.scrollBy({ left: -160, behavior: "smooth" })
            }
          >
            <Icon name="arrowLeftIcon" />
          </button>
          <div
            className="detail-thumbnails"
            ref={thumbnails}
            role="group"
            aria-label={c.profilePhotos}
          >
            {photos.map((url, position) => (
              <button
                className={`detail-thumbnail${position === active ? " active" : ""}`}
                type="button"
                key={url}
                aria-label={`${c.showPhoto} ${position + 1}`}
                aria-current={position === active}
                onClick={() => show(position)}
              >
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  onError={() => fail(url)}
                />
              </button>
            ))}
          </div>
          <button
            className={`detail-thumbnails-arrow${overflow.next ? " visible" : ""}`}
            aria-label={c.nextPhoto}
            type="button"
            onClick={() =>
              thumbnails.current?.scrollBy({ left: 160, behavior: "smooth" })
            }
          >
            <Icon name="arrowRightIcon" />
          </button>
        </div>
      )}
      {fullscreen && photos.length > 0 && (
        <Overlay
          className="detail-gallery-lightbox"
          label={c.profilePhotos}
          close={() => closeProfileOverlay(() => setFullscreen(false))}
          onArrow={(direction) => show(active + direction)}
        >
          <button
            className="detail-gallery-lightbox-close"
            type="button"
            aria-label={c.close}
            onClick={() => closeProfileOverlay(() => setFullscreen(false))}
          >
            <Icon name="closeIcon" />
          </button>
          <img
            className="detail-gallery-lightbox-image"
            src={photos[active]}
            alt={name}
            onError={() => fail(photos[active])}
          />
          {photos.length > 1 && (
            <>
              <button
                className="detail-gallery-lightbox-arrow previous"
                type="button"
                aria-label={c.previousPhoto}
                onClick={() => show(active - 1)}
              >
                <Icon name="arrowLeftIcon" />
              </button>
              <button
                className="detail-gallery-lightbox-arrow next"
                type="button"
                aria-label={c.nextPhoto}
                onClick={() => show(active + 1)}
              >
                <Icon name="arrowRightIcon" />
              </button>
              <div className="detail-gallery-lightbox-count" aria-live="polite">
                {active + 1} / {photos.length}
              </div>
              {dots("detail-gallery-lightbox")}
            </>
          )}
        </Overlay>
      )}
    </>
  );
}

export function MemberProfile({
  session,
  locale,
}: {
  session: Session;
  locale: Locale;
}) {
  const { id = "" } = useParams();
  return (
    <ProfileScreen
      key={`${locale}:${session?.user.id}:${id}`}
      id={id}
      session={session}
      locale={locale}
    />
  );
}

function ProfileScreen({
  id,
  session,
  locale,
}: {
  id: string;
  session: Session;
  locale: Locale;
}) {
  const c = PROFILE_COPY[locale];
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Row | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const [retry, setRetry] = useState(0);
  const [dialog, setDialog] = useState<
    "menu" | "block" | "report" | "verification" | "premium" | null
  >(null);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const back = `/${locale}/catalog`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    api
      .get<Row>(`/member/catalog/${encodeURIComponent(id)}`)
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch((failure) => {
        if (cancelled) return;
        if (failure instanceof ApiError && failure.status === 401)
          navigate(`/${locale}/auth/login`, { replace: true });
        else setLoadError(c.profileNotFound);
      });
    return () => {
      cancelled = true;
    };
  }, [id, retry, c.profileNotFound, locale, navigate]);
  const close = () => {
    if (!inFlight.current) {
      closeProfileOverlay(() => {
        setDialog(null);
        setError("");
      });
    }
  };
  const open = (kind: typeof dialog) => {
    setError("");
    setNotice("");
    if (kind === "report") {
      setReason("");
      setDetails("");
    }
    setDialog(kind);
  };
  const action = async (kind: "like" | "message" | "block" | "report") => {
    if (!session) {
      navigate(`/${locale}/auth/login`);
      return;
    }
    if (
      (kind === "like" || kind === "message") &&
      !bool(session.user.profileVerified)
    ) {
      open("verification");
      return;
    }
    if (
      inFlight.current ||
      !profile ||
      (kind === "like" && bool(profile.likedByViewer)) ||
      (kind === "report" && !reason)
    )
      return;
    inFlight.current = true;
    setPending(true);
    setError("");
    setNotice("");
    const target = encodeURIComponent(text(profile.id, id));
    try {
      if (kind === "like") {
        await api.post(`/member/likes/${target}`);
        if (mounted.current)
          setProfile((current) =>
            current ? { ...current, likedByViewer: true } : current,
          );
      }
      if (kind === "message") {
        const result = await api.post<Row>("/member/conversations", {
          targetProfileId: text(profile.id, id),
        });
        if (!text(String(result.conversationId ?? "")))
          throw new Error("Conversation could not be opened.");
        if (mounted.current)
          navigate(
            `/${locale}/chat/${encodeURIComponent(String(result.conversationId))}`,
          );
      }
      if (kind === "block") {
        await api.post(`/member/blocks/${target}`, {
          reason: "Blocked from profile screen",
        });
        if (mounted.current) navigate(back, { replace: true });
      }
      if (kind === "report") {
        await api.post(`/member/reports/${target}`, {
          reason,
          details: details.trim(),
        });
        if (mounted.current) {
          setDialog(null);
          setNotice(c.reportSent);
        }
      }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof ApiError && failure.status === 401)
        navigate(`/${locale}/auth/login`);
      else if (
        failure instanceof ApiError &&
        failure.status === 403 &&
        /verify your profile/i.test(failure.message)
      )
        setDialog("verification");
      else if (failure instanceof ApiError && failure.status === 402)
        setDialog("premium");
      else {
        let message = {
          en: "Unable to complete this action. Please try again.",
          ru: "Не удалось выполнить действие. Попробуйте ещё раз.",
          es: "No se pudo completar la acción. Inténtalo de nuevo.",
        }[locale];
        if (failure instanceof ApiError && failure.status < 500) {
          try {
            const parsed = JSON.parse(failure.message);
            if (typeof parsed.detail === "string") message = parsed.detail;
          } catch {
            /* Keep the safe localized message. */
          }
        }
        setError(message);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  };
  if (loadError)
    return (
      <section className="member-profile-surface">
        <p role="alert">{loadError}</p>
        <Link to={back}>{c.goBack}</Link>
        <button
          className="soft-button"
          onClick={() => setRetry((value) => value + 1)}
        >
          {{ en: "Try again", ru: "Повторить", es: "Reintentar" }[locale]}
        </button>
      </section>
    );
  if (!profile)
    return (
      <section
        className="member-profile-surface loading"
        role="status"
        aria-busy="true"
        aria-label={
          {
            en: "Loading profile",
            ru: "Загрузка профиля",
            es: "Cargando perfil",
          }[locale]
        }
      >
        <span className="loading-spinner" aria-hidden="true" />
      </section>
    );
  const data = row(profile.data),
    name =
      text(profile.displayName, profile.display_name, data.displayName) ||
      c.member;
  const age = profileAge(profile),
    title = age ? `${name}, ${age}` : name;
  const location =
    [
      text(profile.city, data.city),
      profileCountry(
        text(
          profile.countryName,
          data.countryName,
          profile.country,
          data.country,
        ),
        locale,
      ),
    ]
      .filter(Boolean)
      .join(", ") || c.locationHidden;
  const own =
    text(String(session?.user.profileId ?? session?.user.profile_id ?? "")) ===
    text(String(profile.id ?? ""));
  const verified = bool(profile.isVerified ?? data.isVerified);
  const lookingFor = (
    [
      data.lookingFor,
      profile.lookingFor,
      data.recipientType,
      profile.recipientType,
    ]
      .map(profileList)
      .find((items) => items.length) || []
  )
    .map((value) => text(value).toUpperCase())
    .filter((value) =>
      PROFILE_OPTIONS.lookingFor.some((option) => option[0] === value),
    );
  const donors = (
    [data.donorType, profile.donorType]
      .map(profileList)
      .find((items) => items.length) || []
  ).map((value) => text(value).toUpperCase());
  const languages = profileLanguages(data, locale);
  const contact = (
    {
      FULL_ANONYMITY: c.fullAnonymity,
      IDENTITY_DISCLOSURE_AT_18: c.identity,
      LIMITED_CONTACT: c.limitedContact,
      CONTACT_BY_AGREEMENT: c.limitedContact,
      OPEN_CONTACT: c.openContact,
    } as Record<string, string>
  )[text(data.desiredDonorContact)];
  const label = (field: string, value: unknown) => {
    const result = profileOption(field, value, locale);
    return (
      ["religion", "eyeColor", "hairColor", "ethnicity"].includes(field)
        ? result.replace(/\b\w/g, (letter) => letter.toUpperCase())
        : result
    ).replace(/\s*\/\s*/g, "/");
  };
  const line = (key: string, heading: string, value: unknown, unit = "") =>
    text(typeof value === "number" ? String(value) : value) && (
      <div className="detail-line" key={key}>
        <span>{heading}</span>
        <strong>{unit ? `${value} ${unit}` : label(key, value)}</strong>
      </div>
    );
  const personal = [
    data.occupation ? (
      <div className="detail-line" key="occupation">
        <span>{c.occupation}</span>
        <strong>{text(data.occupation)}</strong>
      </div>
    ) : null,
    line("education", c.education, data.education),
    line("religion", c.religion, data.religion),
    line("smokingStatus", c.smoking, data.smokingStatus),
    line("drinkingStatus", c.alcohol, data.drinkingStatus),
  ].filter(Boolean);
  const appearance = [
    line("height", c.height, data.height, "cm"),
    line("weight", c.weight, data.weight, "kg"),
    line("eyeColor", c.eyeColor, data.eyeColor),
    line("hairColor", c.hairColor, data.hairColor),
    line("ethnicity", c.ethnicity, data.ethnicity),
  ].filter(Boolean);
  const badge = (
    <Icon
      name={verified ? "verifiedIcon" : "unverifiedIcon"}
      label={verified ? c.verified : undefined}
    />
  );
  const locationLine = (
    <>
      <Icon name="locationIcon" />
      <span>{location}</span>
    </>
  );
  const reasons = {
    en: [
      "Spam",
      "Harassment",
      "Inappropriate Content",
      "Fake Profile",
      "Scam",
      "Other",
    ],
    ru: [
      "Спам",
      "Домогательства",
      "Недопустимый контент",
      "Фейковый профиль",
      "Мошенничество",
      "Другое",
    ],
    es: [
      "Spam",
      "Acoso",
      "Contenido inapropiado",
      "Perfil falso",
      "Estafa",
      "Otro",
    ],
  }[locale];
  const errorNode = error && (
    <p className="member-profile-error" role="alert">
      {error}
    </p>
  );
  return (
    <div className="member-profile-surface">
      <article className="detail-profile">
        <Link className="detail-back" to={back}>
          <Icon name="pageBackIcon" />
          <span>{c.goBack}</span>
        </Link>
        <div className="detail-mobile-heading">
          <Link to={back} aria-label={c.goBack}>
            <Icon name="pageBackIcon" />
          </Link>
          <div>
            <h1>
              {title} {badge}
            </h1>
            <p>{locationLine}</p>
          </div>
          {!own && (
            <button
              type="button"
              aria-label={c.moreOptions}
              aria-expanded={dialog === "menu"}
              onClick={() => open("menu")}
            >
              <Icon name="moreVerticalIcon" />
            </button>
          )}
        </div>
        <section className="detail-layout">
          <aside className="detail-sidebar">
            <ProfileGallery
              key={id}
              profile={profile}
              name={name}
              locale={locale}
              tags={
                <>
                  <span className="tag">
                    {profileOption(
                      "profileTypes",
                      data.profileType || profile.profileType,
                      locale,
                    ) || c.notSpecified}
                  </span>
                  {donors.map((donor) => (
                    <span className="tag donor-tag" key={donor}>
                      <span aria-hidden="true">
                        {["SPERM", "SPERM_DONOR"].includes(donor)
                          ? "🧬"
                          : ["EGG", "EGG_DONOR"].includes(donor)
                            ? "🥚"
                            : ""}
                      </span>
                      <span>{profileOption("donorTypes", donor, locale)}</span>
                    </span>
                  ))}
                </>
              }
            />
            {!own && (
              <div className="detail-actions">
                <button
                  className="primary detail-message"
                  type="button"
                  disabled={pending}
                  onClick={() => void action("message")}
                >
                  <Icon name="messageIcon" />
                  <span>{c.sendMessage}</span>
                </button>
                <button
                  className={`soft-button detail-like${bool(profile.likedByViewer) ? " active" : ""}`}
                  type="button"
                  disabled={pending}
                  aria-pressed={bool(profile.likedByViewer)}
                  onClick={() => void action("like")}
                >
                  <Icon name="thumbsUpIcon" />
                  <span>{bool(profile.likedByViewer) ? c.liked : c.like}</span>
                </button>
                <button
                  className="soft-button danger detail-block"
                  type="button"
                  disabled={pending}
                  onClick={() => open("block")}
                >
                  <Icon name="banIcon" />
                  <span>{c.blockUser}</span>
                </button>
                <button
                  className="soft-button danger detail-report"
                  type="button"
                  disabled={pending}
                  onClick={() => open("report")}
                >
                  <Icon name="flagIcon" />
                  <span>{c.report}</span>
                </button>
              </div>
            )}
            {!dialog && errorNode}
            {notice && (
              <p role="status" className="member-profile-notice">
                {notice}
              </p>
            )}
          </aside>
          <div className="detail-content">
            <div className="detail-summary">
              <h1>
                {title} {badge}
              </h1>
              <p className="location">{locationLine}</p>
            </div>
            {lookingFor.length > 0 && (
              <article className="detail-panel detail-looking">
                <div className="detail-looking-grid">
                  <div>
                    <h2>{c.lookingFor}</h2>
                    <div className="chip-row">
                      {lookingFor.map((value) => (
                        <span className="chip" key={value}>
                          {profileOption("lookingFor", value, locale)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {contact && (
                    <div>
                      <h2>
                        {lookingFor.some((value) =>
                          ["SPERM_DONOR", "EGG_DONOR"].includes(value),
                        )
                          ? {
                              en: "Donor's contact",
                              ru: "Контакт донора",
                              es: "Contacto del donante",
                            }[locale]
                          : c.childContact}
                      </h2>
                      <div className="chip-row">
                        <span className="chip">{contact}</span>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )}
            <article className="detail-panel detail-about">
              <h2>{c.aboutMe}</h2>
              <p>
                {text(
                  data.about,
                  data.bio,
                  data.description,
                  data.introduction,
                ) || c.descriptionFallback}
              </p>
              {languages.length > 0 && (
                <div className="detail-languages">
                  <h3>{c.languages}</h3>
                  <div className="chip-row">
                    {languages.map((language) => (
                      <span className="chip" key={language}>
                        {language}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {personal.length > 0 && (
                <div className="detail-personal">{personal}</div>
              )}
            </article>
            {appearance.length > 0 && (
              <article className="detail-panel detail-appearance">
                <h2>{c.appearance}</h2>
                {appearance}
              </article>
            )}
          </div>
        </section>
        {dialog === "menu" && (
          <Overlay
            className="detail-mobile-menu"
            label={c.profileActions}
            close={close}
          >
            <div className="detail-menu-backdrop" onClick={close} />
            <section className="detail-menu-sheet">
              <div className="detail-menu-handle" />
              <div className="detail-menu-actions">
                <button
                  type="button"
                  className="danger"
                  onClick={() => open("block")}
                >
                  <Icon name="banIcon" />
                  <span>{c.blockUser}</span>
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => open("report")}
                >
                  <Icon name="flagIcon" />
                  <span>{c.report}</span>
                </button>
              </div>
            </section>
          </Overlay>
        )}
        {dialog === "block" && (
          <Overlay
            className="block-confirm-modal"
            label={c.blockConfirm}
            close={close}
            busy={pending}
          >
            <div className="block-confirm-backdrop" onClick={close} />
            <section className="block-confirm-dialog">
              <button
                className="block-confirm-close"
                type="button"
                aria-label={c.close}
                disabled={pending}
                onClick={close}
              >
                <Icon name="closeIcon" />
              </button>
              <h2>
                {c.blockConfirmLabel} {name}?
              </h2>
              <p>{c.blockConfirmBody}</p>
              {errorNode}
              <div className="block-confirm-actions">
                <button
                  className="soft-button"
                  type="button"
                  disabled={pending}
                  onClick={close}
                >
                  {c.blockConfirmCancel}
                </button>
                <button
                  className="primary danger-primary"
                  type="button"
                  disabled={pending}
                  onClick={() => void action("block")}
                >
                  {c.blockConfirmAction}
                </button>
              </div>
            </section>
          </Overlay>
        )}
        {dialog === "report" && (
          <Overlay
            className="profile-dialog report-dialog"
            label={c.reportTitle}
            close={close}
            busy={pending}
          >
            <div className="profile-dialog-backdrop" onClick={close} />
            <section className="profile-dialog-panel">
              <div className="profile-dialog-head">
                <h2>{c.reportTitle}</h2>
                <button
                  type="button"
                  aria-label={c.close}
                  disabled={pending}
                  onClick={close}
                >
                  <Icon name="closeIcon" />
                </button>
              </div>
              <form
                className="report-dialog-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void action("report");
                }}
              >
                <label className="report-field">
                  <span>{c.reportReason}</span>
                  <select
                    name="reason"
                    required
                    value={reason}
                    disabled={pending}
                    onChange={(event) => setReason(event.target.value)}
                  >
                    <option value="" disabled>
                      {c.reportChoose}
                    </option>
                    {reasons.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="report-field">
                  <span>{c.reportDetails}</span>
                  <textarea
                    name="details"
                    rows={4}
                    maxLength={4000}
                    value={details}
                    disabled={pending}
                    placeholder={c.reportPlaceholder}
                    onChange={(event) => setDetails(event.target.value)}
                  />
                </label>
                {errorNode}
                <div className="report-dialog-actions">
                  <button
                    className="soft-button"
                    type="button"
                    disabled={pending}
                    onClick={close}
                  >
                    {c.reportCancel}
                  </button>
                  <button
                    className="primary danger-primary"
                    type="submit"
                    disabled={pending || !reason}
                  >
                    {c.reportSubmit}
                  </button>
                </div>
              </form>
            </section>
          </Overlay>
        )}
        {dialog === "verification" && (
          <Overlay
            className="verification-prompt"
            label={c.verifyProfile}
            close={close}
          >
            <div className="verification-prompt-backdrop" onClick={close} />
            <section className="verification-prompt-dialog">
              <button
                className="verification-prompt-close"
                type="button"
                aria-label={c.close}
                onClick={close}
              >
                <Icon name="closeIcon" />
              </button>
              <div className="verification-prompt-icon">
                <Icon name="shieldCheckIcon" />
              </div>
              <h2>{c.verifyProfile}</h2>
              <p>{c.verifyBody}</p>
              <div className="verification-prompt-actions">
                <button
                  className="primary"
                  type="button"
                  onClick={() => navigate(`/${locale}/verification`)}
                >
                  {c.verifyNow}
                </button>
                <button className="soft-button" type="button" onClick={close}>
                  {c.notNow}
                </button>
              </div>
            </section>
          </Overlay>
        )}
        {dialog === "premium" && (
          <PremiumDialog
            locale={locale}
            close={close}
            verify={() => setDialog("verification")}
          />
        )}
      </article>
    </div>
  );
}
