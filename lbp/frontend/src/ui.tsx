import {
  FormEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Room, RoomEvent } from "livekit-client";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { createApiClient } from "./api";
import {
  signInWithSocial,
  socialErrorMessage,
  type SocialProvider,
} from "./firebase-auth";
import {
  referenceArticleMeta,
  referenceArticleNavigation,
  referenceKnowledgeArticles,
} from "./reference-article-meta";

const api = createApiClient("/api");
type Row = Record<string, unknown>;
type Session = { user: Row } | null;
type Page<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore?: boolean;
};
const asText = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : String(value);
type CookieLocale = "en" | "ru" | "es";

function ScrollToTopOnNavigation() {
  const { pathname, search } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
}
type CookieTab = "consent" | "details" | "about";
type CookieCategoryKey = "necessary" | "preferences" | "statistics";
type CookieDefinition = { name: string; duration: string; description: string };

const localeOf = (): CookieLocale => {
  const locale = window.location.pathname.split("/").filter(Boolean)[0] || "en";
  return (["en", "ru", "es"] as string[]).includes(locale) ? (locale as CookieLocale) : "en";
};
const refreshSession = async (fallback: Session): Promise<Session> => {
  try {
    return await api.get<Session>("/auth/me");
  } catch {
    return fallback;
  }
};

const COOKIE_MAX_AGE = 180 * 24 * 60 * 60;
const COOKIE_LOCALE_MAX_AGE = 365 * 24 * 60 * 60;

const readCookie = (name: string) => {
  const match = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
};

const writeCookie = (name: string, value: string, maxAge: number) => {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
};

const readConsentCookie = () => {
  const level = readCookie("lbp_consent");
  if (!["necessary", "preferences", "analytics", "all"].includes(level)) return null;
  return {
    preferences: level === "preferences" || level === "all",
    statistics: level === "analytics" || level === "all",
  };
};

const ensureConsentId = () => {
  const current = readCookie("lbp_consent_id");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(current)) {
    return current;
  }
  const next = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(16).padStart(8, "0")}-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, "0")}`;
  writeCookie("lbp_consent_id", next, COOKIE_MAX_AGE);
  return next;
};

const saveConsentCookies = (
  preferences: boolean,
  statistics: boolean,
  locale: CookieLocale,
  consentId: string,
) => {
  const level = preferences && statistics
    ? "all"
    : preferences
      ? "preferences"
      : statistics
        ? "analytics"
        : "necessary";
  writeCookie("lbp_consent", level, COOKIE_MAX_AGE);
  writeCookie("lbp_consent_id", consentId, COOKIE_MAX_AGE);
  if (preferences) writeCookie("NEXT_LOCALE", locale, COOKIE_LOCALE_MAX_AGE);
  else writeCookie("NEXT_LOCALE", "", 0);
};

const COOKIE_TEXT = {
  en: {
    heading: "This website uses cookies",
    tabs: { consent: "Consent", details: "Details", about: "About" },
    consent: "We use cookies to keep the app working, personalise your experience and analyse our traffic. We also share information about your use of our site with our analytics partners, who may combine it with other information you've provided to them or that they've collected through your use of their services.",
    privacyPolicy: "Privacy Policy",
    categories: { necessary: "Necessary", preferences: "Preferences", statistics: "Statistics" },
    descriptions: {
      necessary: "Necessary cookies help make the website usable by enabling basic functions like session and login handling, security, and remembering the consent choice you make here. The website cannot function properly without these cookies.",
      preferences: "Preference cookies enable the website to remember information that changes the way it behaves or looks, like your preferred language.",
      statistics: "Statistic cookies help us understand how visitors interact with the app by collecting and reporting information.",
    },
    cookies: {
      necessary: [
        { name: "lbp_consent", duration: "180 days", description: "Stores your cookie consent choice." },
        { name: "authjs.session-token", duration: "Session / 7 days", description: "Keeps you signed in (session and CSRF protection). Prefixed with __Secure- on HTTPS." },
        { name: "lbp_attr_first", duration: "90 days", description: "Remembers how you first reached us (first touch), used to understand where new members come from." },
        { name: "lbp_attr_last", duration: "90 days", description: "Remembers how you most recently reached us (last touch), used to understand where new members come from." },
        { name: "lbp_consent_id", duration: "180 days", description: "Anonymous consent reference id, kept as proof of the consent choice you made here (GDPR Art. 7(1))." },
      ],
      preferences: [
        { name: "NEXT_LOCALE", duration: "1 year", description: "Remembers your selected interface language." },
      ],
      statistics: [
        { name: "AMP_*", duration: "Up to 1 year", description: "Product analytics — measures usage to improve the product." },
        { name: "AMP_MKTG_*", duration: "Up to 1 year", description: "Product analytics — measures how visitors first reached the app." },
      ],
    },
    about: [
      "Cookies are small text files that websites can use to make a user's experience more efficient.",
      "The law states that we can store cookies on your device if they are strictly necessary for the operation of this site. For all other types of cookies, we need your permission. Necessary cookies are processed under Art. 6(1)(f) GDPR; all other categories only with your consent under Art. 6(1)(a) GDPR.",
      "This site uses different types of cookies. Some cookies are placed by third-party services that appear on our pages.",
      "You can change or withdraw your consent at any time from the Cookie settings link at the bottom of the page.",
    ],
    learnMore: "Learn more about how we process personal data in our Privacy Policy.",
    rejectAll: "Reject all",
    customize: "Customize",
    allowSelection: "Allow selection",
    acceptAll: "Accept all",
  },
  ru: {
    heading: "Этот сайт использует cookies",
    tabs: { consent: "Согласие", details: "Подробно", about: "О cookies" },
    consent: "Мы используем cookies, чтобы приложение работало, чтобы персонализировать ваш опыт и анализировать наш трафик. Мы также передаём информацию о вашем использовании сайта нашим партнёрам по аналитике, которые могут объединить её с другой информацией, предоставленной вами им или собранной в ходе вашего использования их сервисов.",
    privacyPolicy: "Политика конфиденциальности",
    categories: { necessary: "Необходимые", preferences: "Предпочтения", statistics: "Статистика" },
    descriptions: {
      necessary: "Необходимые cookies помогают сделать сайт удобным, обеспечивая базовые функции: сессию и вход, безопасность и запоминание вашего выбора по cookies. Без них сайт не может работать корректно.",
      preferences: "Cookies предпочтений позволяют сайту запоминать информацию, которая меняет его поведение или внешний вид, например выбранный вами язык.",
      statistics: "Cookies статистики помогают нам понять, как посетители взаимодействуют с приложением, собирая и передавая информацию.",
    },
    cookies: {
      necessary: [
        { name: "lbp_consent", duration: "180 дней", description: "Хранит ваш выбор по cookies." },
        { name: "authjs.session-token", duration: "Сессия / 7 дней", description: "Сохраняет вход в систему (сессия и защита от CSRF). На HTTPS имеет префикс __Secure-." },
        { name: "lbp_attr_first", duration: "90 дней", description: "Запоминает, как вы впервые попали к нам (первое посещение), чтобы понимать, откуда приходят новые участники." },
        { name: "lbp_attr_last", duration: "90 дней", description: "Запоминает, как вы попали к нам в последний раз (последнее посещение), чтобы понимать, откуда приходят новые участники." },
        { name: "lbp_consent_id", duration: "180 дней", description: "Анонимный идентификатор согласия, хранится как подтверждение сделанного вами здесь выбора (GDPR ст. 7(1))." },
      ],
      preferences: [{ name: "NEXT_LOCALE", duration: "1 год", description: "Запоминает выбранный язык интерфейса." }],
      statistics: [
        { name: "AMP_*", duration: "До 1 года", description: "Продуктовая аналитика — измеряет использование для улучшения продукта." },
        { name: "AMP_MKTG_*", duration: "До 1 года", description: "Продуктовая аналитика — измеряет, как посетители впервые попали в приложение." },
      ],
    },
    about: [
      "Cookies — это небольшие текстовые файлы, которые сайты используют, чтобы сделать работу пользователя более эффективной.",
      "Закон позволяет нам хранить cookies, строго необходимые для работы этого сайта; для всего остального нам нужно ваше разрешение. Необходимые cookies используются на основании ст. 6(1)(f) GDPR; все остальные категории — только с вашего согласия (ст. 6(1)(a) GDPR).",
      "Этот сайт использует разные типы cookies; некоторые из них устанавливаются сторонними сервисами, представленными на наших страницах.",
      "Вы можете изменить или отозвать своё согласие в любое время через ссылку «Настройки cookies» в нижней части страницы.",
    ],
    learnMore: "Узнайте больше о том, как мы обрабатываем персональные данные, в нашей Политике конфиденциальности.",
    rejectAll: "Отклонить все",
    customize: "Настроить",
    allowSelection: "Сохранить выбор",
    acceptAll: "Принять все",
  },
  es: {
    heading: "Este sitio web usa cookies",
    tabs: { consent: "Consentimiento", details: "Detalles", about: "Acerca de" },
    consent: "Usamos cookies para que la aplicación funcione, personalizar tu experiencia y analizar nuestro tráfico. También compartimos información sobre tu uso del sitio con nuestros socios de análisis, que pueden combinarla con otra información que les hayas proporcionado o que hayan recopilado durante tu uso de sus servicios.",
    privacyPolicy: "Política de privacidad",
    categories: { necessary: "Necesarias", preferences: "Preferencias", statistics: "Estadísticas" },
    descriptions: {
      necessary: "Las cookies necesarias ayudan a que el sitio sea utilizable, habilitando funciones básicas como la gestión de la sesión y el inicio de sesión, la seguridad y recordar la elección de consentimiento que haces aquí. El sitio no puede funcionar correctamente sin ellas.",
      preferences: "Las cookies de preferencias permiten al sitio recordar información que cambia su comportamiento o aspecto, como tu idioma preferido.",
      statistics: "Las cookies de estadísticas nos ayudan a entender cómo interactúan los visitantes con la app, recopilando y comunicando información.",
    },
    cookies: {
      necessary: [
        { name: "lbp_consent", duration: "180 días", description: "Guarda tu elección de consentimiento de cookies." },
        { name: "authjs.session-token", duration: "Sesión / 7 días", description: "Mantiene tu sesión iniciada (sesión y protección CSRF). Con el prefijo __Secure- en HTTPS." },
        { name: "lbp_attr_first", duration: "90 días", description: "Recuerda cómo llegaste a nosotros por primera vez (primer contacto), para entender de dónde vienen los nuevos miembros." },
        { name: "lbp_attr_last", duration: "90 días", description: "Recuerda cómo llegaste a nosotros la última vez (último contacto), para entender de dónde vienen los nuevos miembros." },
        { name: "lbp_consent_id", duration: "180 días", description: "Identificador de consentimiento anónimo, conservado como prueba de la elección de consentimiento que hizo aquí (RGPD art. 7(1))." },
      ],
      preferences: [{ name: "NEXT_LOCALE", duration: "1 año", description: "Recuerda el idioma de interfaz que has seleccionado." }],
      statistics: [
        { name: "AMP_*", duration: "Hasta 1 año", description: "Análisis de producto — mide el uso para mejorar el producto." },
        { name: "AMP_MKTG_*", duration: "Hasta 1 año", description: "Análisis de producto — mide cómo llegaron los visitantes a la app por primera vez." },
      ],
    },
    about: [
      "Las cookies son pequeños archivos de texto que los sitios web pueden utilizar para mejorar la experiencia del usuario.",
      "La ley permite almacenar cookies estrictamente necesarias para el funcionamiento de este sitio. Para todos los demás tipos de cookies, necesitamos tu permiso. Las cookies necesarias se tratan según el art. 6(1)(f) del RGPD; todas las demás categorías solo con tu consentimiento según el art. 6(1)(a) del RGPD.",
      "Este sitio utiliza distintos tipos de cookies. Algunas se establecen mediante servicios de terceros presentes en nuestras páginas.",
      "Puedes cambiar o retirar tu consentimiento en cualquier momento desde el enlace de configuración de cookies situado al final de la página.",
    ],
    learnMore: "Obtén más información sobre cómo tratamos los datos personales en nuestra Política de privacidad.",
    rejectAll: "Rechazar todo",
    customize: "Personalizar",
    allowSelection: "Permitir selección",
    acceptAll: "Aceptar todo",
  },
} satisfies Record<CookieLocale, {
  heading: string;
  tabs: Record<CookieTab, string>;
  consent: string;
  privacyPolicy: string;
  categories: Record<CookieCategoryKey, string>;
  descriptions: Record<CookieCategoryKey, string>;
  cookies: Record<CookieCategoryKey, CookieDefinition[]>;
  about: string[];
  learnMore: string;
  rejectAll: string;
  customize: string;
  allowSelection: string;
  acceptAll: string;
}>;

function CookieConsent() {
  const locale = localeOf();
  const text = COOKIE_TEXT[locale];
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CookieTab>("consent");
  const [preferences, setPreferences] = useState(false);
  const [statistics, setStatistics] = useState(false);
  const [expanded, setExpanded] = useState<Record<CookieCategoryKey, boolean>>({
    necessary: false,
    preferences: false,
    statistics: false,
  });
  const [consentId, setConsentId] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    const browserChoice = readConsentCookie();
    const browserConsentId = ensureConsentId();
    setConsentId(browserConsentId);
    if (browserChoice) {
      setPreferences(browserChoice.preferences);
      setStatistics(browserChoice.statistics);
      setOpen(false);
    }
    api
      .get<Row>("/privacy/consent")
      .then((result) => {
        if (!live) return;
        const saved = result.saved === true;
        const choice = (result.preferences ?? {}) as Row;
        setPreferences(Boolean(choice.preferences));
        setStatistics(Boolean(choice.statistics));
        setOpen(!saved);
        setConsentId(readCookie("lbp_consent_id") || browserConsentId);
      })
      .catch(() => live && setOpen(!browserChoice));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const showSettings = () => {
      setActiveTab("details");
      setOpen(true);
    };
    window.addEventListener("open-cookie-settings", showSettings);
    return () => window.removeEventListener("open-cookie-settings", showSettings);
  }, []);
  const save = async (nextPreferences: boolean, nextStatistics: boolean) => {
    setSaving(true);
    saveConsentCookies(nextPreferences, nextStatistics, locale, consentId || ensureConsentId());
    setPreferences(nextPreferences);
    setStatistics(nextStatistics);
    setOpen(false);
    window.dispatchEvent(
      new CustomEvent("cookie-consent-change", {
        detail: { necessary: true, preferences: nextPreferences, statistics: nextStatistics },
      }),
    );
    try {
      await api.post("/privacy/consent", {
        preferences: nextPreferences,
        statistics: nextStatistics,
        locale,
      });
      setConsentId(readCookie("lbp_consent_id") || consentId);
    } catch {
      // The browser cookies are the source of truth; API synchronisation is best effort.
    } finally {
      setSaving(false);
    }
  };
  const categories: Array<{
    key: CookieCategoryKey;
    count: number;
    disabled?: boolean;
    checked: boolean;
    cookies: CookieDefinition[];
  }> = [
    { key: "necessary", count: 5, disabled: true, checked: true, cookies: text.cookies.necessary },
    { key: "preferences", count: 1, checked: preferences, cookies: text.cookies.preferences },
    { key: "statistics", count: 2, checked: statistics, cookies: text.cookies.statistics },
  ];
  const setCategory = (key: CookieCategoryKey, checked: boolean) => {
    if (key === "preferences") setPreferences(checked);
    if (key === "statistics") setStatistics(checked);
  };
  if (!open) return null;
  return (
    <div className="cookie-backdrop" role="presentation">
      <section
        className="cookie-modal"
        role="region"
        aria-label={text.heading}
      >
        <div className="cookie-tabs" role="tablist" aria-label={text.heading}>
          {(["consent", "details", "about"] as CookieTab[]).map((tab) => (
            <button
              className={activeTab === tab ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`cookie-panel-${tab}`}
              id={`cookie-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              key={tab}
            >
              {text.tabs[tab]}
            </button>
          ))}
        </div>
        {activeTab === "consent" && (
          <div
            className="cookie-copy"
            role="tabpanel"
            id="cookie-panel-consent"
            aria-labelledby="cookie-tab-consent"
          >
            <h2>{text.heading}</h2>
            <p>
              {text.consent}{" "}
              <Link to={`/${locale}/pages/privacy-policy`} target="_blank">
                {text.privacyPolicy}
              </Link>
            </p>
          </div>
        )}
        {activeTab === "details" && (
          <div
            className="cookie-details"
            role="tabpanel"
            id="cookie-panel-details"
            aria-labelledby="cookie-tab-details"
          >
            <div className="cookie-category-list">
              {categories.map(({ key, count, disabled, checked, cookies }) => (
                <section className="cookie-category" key={key}>
                  <div className="cookie-category-row">
                    <button
                      className="cookie-category-toggle"
                      type="button"
                      aria-expanded={expanded[key]}
                      onClick={() => setExpanded((value) => ({ ...value, [key]: !value[key] }))}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="m6 8 4 4 4-4" />
                      </svg>
                      <strong>{text.categories[key]}</strong>
                      <span>{count}</span>
                    </button>
                    <label className={`cookie-switch${disabled ? " disabled" : ""}`}>
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={text.categories[key]}
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) => setCategory(key, event.target.checked)}
                      />
                      <span aria-hidden="true" />
                    </label>
                  </div>
                  {expanded[key] && (
                    <div className="cookie-category-content">
                      <p>{text.descriptions[key]}</p>
                      <div className="cookie-definition-list">
                        {cookies.map((cookie) => (
                          <div className="cookie-definition" key={cookie.name}>
                            <div>
                              <code>{cookie.name}</code>
                              <span>{cookie.duration}</span>
                            </div>
                            <p>{cookie.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
        {activeTab === "about" && (
          <div
            className="cookie-about"
            role="tabpanel"
            id="cookie-panel-about"
            aria-labelledby="cookie-tab-about"
          >
            {text.about.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p>
              {text.learnMore}{" "}
              <Link to={`/${locale}/pages/privacy-policy`} target="_blank">
                {text.privacyPolicy}
              </Link>
            </p>
          </div>
        )}
        <div className="cookie-actions">
          <button
            className="cookie-action secondary"
            type="button"
            disabled={saving}
            onClick={() => void save(false, false)}
          >
            {text.rejectAll}
          </button>
          <button
            className="cookie-action secondary"
            type="button"
            disabled={saving}
            onClick={() => activeTab === "details" ? void save(preferences, statistics) : setActiveTab("details")}
          >
            {activeTab === "details" ? text.allowSelection : text.customize}
          </button>
          <button
            className="cookie-action primary"
            type="button"
            disabled={saving}
            onClick={() => void save(true, true)}
          >
            {text.acceptAll}
          </button>
        </div>
      </section>
    </div>
  );
}

function CallManager({ session }: { session: Session }) {
  const [incoming, setIncoming] = useState<Row | null>(null);
  const [active, setActive] = useState<Row | null>(null);
  const [state, setState] = useState("");
  const media = useRef<HTMLDivElement | null>(null);
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    if (!session || active) return;
    let alive = true;
    const poll = () => {
      void api
        .get<{ items: Row[] }>("/member/calls/incoming")
        .then((result) => alive && setIncoming(result.items?.[0] || null))
        .catch(() => undefined);
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [session, active]);

  useEffect(() => {
    if (!active) return;
    const serverUrl = asText(active.serverUrl);
    const token = asText(active.token);
    if (serverUrl === "—" || token === "—") return;
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;
    room.on(RoomEvent.TrackSubscribed, (track) => {
      const element = track.attach();
      element.autoplay = true;
      if (element instanceof HTMLVideoElement) element.playsInline = true;
      media.current?.append(element);
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) =>
      track.detach().forEach((element) => element.remove()),
    );
    room.on(RoomEvent.Disconnected, () => {
      if (!cancelled) {
        setState("Call ended.");
        setActive(null);
      }
    });
    void (async () => {
      try {
        setState("Connecting…");
        await room.connect(serverUrl, token);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (asText(active.callType).toUpperCase() === "VIDEO")
          await room.localParticipant.setCameraEnabled(true);
        if (!cancelled) setState("Connected");
      } catch {
        if (!cancelled) {
          setState("Unable to connect the call.");
          setActive(null);
        }
      }
    })();
    return () => {
      cancelled = true;
      room.disconnect();
      if (roomRef.current === room) roomRef.current = null;
      media.current?.replaceChildren();
    };
  }, [active]);

  useEffect(() => {
    const start = (event: Event) => {
      const call = (event as CustomEvent<Row>).detail;
      if (call) setActive(call);
    };
    window.addEventListener("lbp-call-start", start);
    return () => window.removeEventListener("lbp-call-start", start);
  }, []);

  const decline = async () => {
    if (!incoming?.id) return;
    const call = incoming;
    setIncoming(null);
    try {
      await api.post(
        `/member/calls/${encodeURIComponent(asText(call.id))}/decline`,
      );
    } catch {
      setState("Could not decline the call.");
    }
  };
  const accept = async () => {
    if (!incoming?.id) return;
    const call = incoming;
    setIncoming(null);
    try {
      const result = await api.post<{ call: Row }>(
        `/member/calls/${encodeURIComponent(asText(call.id))}/accept`,
      );
      setActive(result.call);
    } catch {
      setState("This call is no longer available.");
    }
  };
  const end = async () => {
    if (!active?.id) return;
    const call = active;
    setActive(null);
    roomRef.current?.disconnect();
    try {
      await api.post(
        `/member/calls/${encodeURIComponent(asText(call.id))}/end`,
      );
    } catch {
      setState("The call was closed locally.");
    }
  };

  return (
    <>
      {incoming && (
        <div
          className="call-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Incoming call"
        >
          <section>
            <p className="eyebrow">
              Incoming {asText(incoming.callType).toLowerCase()} call
            </p>
            <h2>{asText(incoming.peerName)}</h2>
            <div className="actions">
              <button className="secondary" onClick={() => void decline()}>
                Decline
              </button>
              <button className="primary" onClick={() => void accept()}>
                Accept
              </button>
            </div>
          </section>
        </div>
      )}
      {active && (
        <div
          className="call-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Active call"
        >
          <section>
            <p className="eyebrow">{asText(active.callType)} call</p>
            <h2>{asText(active.peerName)}</h2>
            <p className="notice">{state || "Calling…"}</p>
            <div className="call-media" ref={media} />
            <button className="secondary" onClick={() => void end()}>
              End call
            </button>
          </section>
        </div>
      )}
    </>
  );
}

const SITE_TEXT = {
  en: {
    knowledge: "Knowledge Hub", match: "Find a match", clinics: "Clinics", lawyers: "Lawyers", resources: "Resources & Tools", safety: "Safety", pricing: "Pricing",
    profile: "Profile", signOut: "Sign out", signIn: "Sign in", signUp: "Sign up",
    likes: "Likes", messages: "Messages", notifications: "Member notifications",
    tagline: "Helping every family find their way.", platform: "Platform", company: "Company",
    contact: "Contact us", terms: "Terms of Use", privacy: "Privacy Policy",
    rights: "© 2026 LetsBeParents. All rights reserved.", cookies: "Cookie settings", language: "Language",
  },
  ru: {
    knowledge: "База знаний", match: "Найти пару", clinics: "Клиники", lawyers: "Юристы", resources: "Ресурсы и инструменты", safety: "Безопасность", pricing: "Цены",
    profile: "Мой профиль", signOut: "Выйти", signIn: "Войти", signUp: "Регистрация",
    likes: "Лайки", messages: "Сообщения", notifications: "Уведомления участника",
    tagline: "Помогаем каждой семье найти свой путь.", platform: "Платформа", company: "Компания",
    contact: "Связаться с нами", terms: "Условия использования", privacy: "Политика конфиденциальности",
    rights: "© 2026 LetsBeParents. Все права защищены.", cookies: "Настройки cookies", language: "Язык",
  },
  es: {
    knowledge: "Centro de conocimiento", match: "Buscar match", clinics: "Clínicas", lawyers: "Abogados", resources: "Recursos y herramientas", safety: "Seguridad", pricing: "Precios",
    profile: "Mi perfil", signOut: "Cerrar sesión", signIn: "Iniciar sesión", signUp: "Registrarse",
    likes: "Me gusta", messages: "Mensajes", notifications: "Notificaciones de miembro",
    tagline: "Ayudamos a cada familia a encontrar su camino.", platform: "Plataforma", company: "Empresa",
    contact: "Contáctanos", terms: "Términos de uso", privacy: "Política de privacidad",
    rights: "© 2026 LetsBeParents. Todos los derechos reservados.", cookies: "Preferencias de cookies", language: "Idioma",
  },
} satisfies Record<CookieLocale, Record<string, string>>;

function MemberCounters({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => Promise<void>;
}) {
  const locale = localeOf();
  const text = SITE_TEXT[locale];
  const [counts, setCounts] = useState<Row>({});
  const [member, setMember] = useState<Row>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!session) {
      setCounts({});
      return;
    }
    let alive = true;
    const load = () => {
      void api
        .get<{ counts: Row }>("/member/counters")
        .then((result) => alive && setCounts(result.counts || {}))
        .catch(() => alive && setCounts({}));
    };
    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [session]);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    void api
      .get<Row>("/member/me")
      .then((result) => alive && setMember(result || {}))
      .catch(() => alive && setMember({}));
    return () => { alive = false; };
  }, [session]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);
  if (!session) return null;
  const likes = Number(counts.likesYou ?? counts.likesyou ?? member.likesYou ?? member.likesyou ?? 0);
  const messages = Number(counts.unreadMessages ?? counts.unreadmessages ?? member.unreadMessages ?? member.unreadmessages ?? 0);
  const profile = member.profile && typeof member.profile === "object" ? member.profile as Row : {};
  const data = profile.data && typeof profile.data === "object" ? profile.data as Row : {};
  const photos = Array.isArray(member.photos) ? member.photos : [];
  const firstPhoto = photos[0] && typeof photos[0] === "object" ? photos[0] as Row : {};
  const avatar = String(profile.avatarUrl ?? data.avatarUrl ?? firstPhoto.publicUrl ?? firstPhoto.url ?? "");
  const displayName = String(session.user.displayName ?? profile.displayName ?? data.displayName ?? "Member");
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <div className="member-header-actions" aria-label={text.notifications}>
      <Link className="member-icon-link" to={`/${locale}/likes`} aria-label={text.likes}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /><path d="M7 10v12" /></svg>
        {likes > 0 ? <b>{likes > 99 ? "99+" : likes}</b> : null}
      </Link>
      <Link className="member-icon-link" to={`/${locale}/messages`} aria-label={text.messages}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /></svg>
        {messages > 0 ? <b>{messages > 99 ? "99+" : messages}</b> : null}
      </Link>
      <div className="member-avatar-menu" ref={menuRef}>
        <button type="button" className="member-avatar-button" aria-label={text.profile} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
          {avatar ? <img src={avatar} alt="" /> : <span>{initials}</span>}
        </button>
        {menuOpen ? <div className="member-avatar-dropdown">
          <Link onClick={() => setMenuOpen(false)} to={`/${locale}/profile`}>{text.profile}</Link>
          <button type="button" onClick={() => void onLogout()}>{text.signOut}</button>
        </div> : null}
      </div>
    </div>
  );
}

function Shell({
  session,
  onLogout,
  children,
}: {
  session: Session;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const locale = localeOf();
  const text = SITE_TEXT[locale];
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(() => window.scrollY > 24);
  const isLanding = new RegExp(`^/${locale}/?$`).test(window.location.pathname);
  const isAuth = new RegExp(`^/${locale}/auth/`).test(window.location.pathname);
  const isStandaloneAuth = new RegExp(`^/${locale}/auth/(?:reset-password|verify-email)/?$`).test(window.location.pathname);
  const isKnowledge = new RegExp(`^/${locale}/knowledge-hub(?:/|$)`).test(window.location.pathname);
  const isCatalog = new RegExp(`^/${locale}/catalog(?:/|$)`).test(window.location.pathname);
  const isClinics = new RegExp(`^/${locale}/clinics(?:/|$)`).test(window.location.pathname);
  const isLawyers = new RegExp(`^/${locale}/lawyers(?:/|$)`).test(window.location.pathname);
  const isDirectory = isClinics || isLawyers;
  const isDirectoryDetail = new RegExp(`^/${locale}/(?:clinics|lawyers)/[^/]+/?$`).test(window.location.pathname);
  const isArticle = new RegExp(`^/${locale}/knowledge-hub/[^/]+/?$`).test(window.location.pathname);
  const isContact = new RegExp(`^/${locale}/contact/?$`).test(window.location.pathname);
  const isTrustSafety = new RegExp(`^/${locale}/trust-safety/?$`).test(window.location.pathname);
  const isPricing = new RegExp(`^/${locale}/pricing/?$`).test(window.location.pathname);
  const isResources = new RegExp(`^/${locale}/resources(?:/|$)`).test(window.location.pathname);
  const isFindYourPath = new RegExp(`^/${locale}/find-your-path(?:/|$)`).test(window.location.pathname);
  const isStaticPage = new RegExp(`^/${locale}/pages/[^/]+/?$`).test(window.location.pathname);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    let scrolled = window.scrollY > 24;
    let frame = 0;
    const applyHeaderState = () => {
      frame = 0;
      if (!scrolled && window.scrollY > 24) scrolled = true;
      if (scrolled && window.scrollY < 4) scrolled = false;
      setHeaderScrolled((current) => current === scrolled ? current : scrolled);
    };
    const scheduleHeaderState = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(applyHeaderState);
    };
    applyHeaderState();
    window.addEventListener("scroll", scheduleHeaderState, { passive: true });
    return () => {
      window.removeEventListener("scroll", scheduleHeaderState);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  const switchLocale = (nextLocale: string) => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (["en", "ru", "es"].includes(parts[0] || "")) parts[0] = nextLocale;
    else parts.unshift(nextLocale);
    window.location.assign(`/${parts.join("/")}${window.location.search}${window.location.hash}`);
  };
  const navigation = (
    <nav className={menuOpen ? "open" : ""}>
      <Link className={isKnowledge ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/knowledge-hub`}>
        {text.knowledge}
      </Link>
      <Link className={isCatalog ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/catalog`}>
        {text.match}
      </Link>
      <Link className={isClinics ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/clinics`}>
        {text.clinics}
      </Link>
      <Link className={isLawyers ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/lawyers`}>
        {text.lawyers}
      </Link>
      <Link className={isResources ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/resources`}>
        {text.resources}
      </Link>
      <Link className={isTrustSafety ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/trust-safety`}>
        {text.safety}
      </Link>
      <Link className={isPricing ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/pricing`}>
        {text.pricing}
      </Link>
      <div className="mobile-nav-actions">
        {session ? (
          <>
            <Link onClick={() => setMenuOpen(false)} to={`/${locale}/profile`}>{text.profile}</Link>
            <button className="plain-button" onClick={() => void onLogout()}>{text.signOut}</button>
          </>
        ) : (
          <>
            <Link onClick={() => setMenuOpen(false)} to={`/${locale}/auth/login`}>{text.signIn}</Link>
            <Link onClick={() => setMenuOpen(false)} to={`/${locale}/auth/register`}>{text.signUp}</Link>
          </>
        )}
      </div>
    </nav>
  );
  return (
    <div className="web-app">
      {!isStandaloneAuth && <header className={`web-header${headerScrolled ? " is-scrolled" : ""}`}>
        <div className="web-header-inner">
          <Link className="logo" to={`/${locale}`} aria-label="LetsBeParents">
            <img src="/web-static/logo-db535d28.svg" alt="LetsBeParents" />
          </Link>
          {navigation}
          <button
            className={`mobile-menu${session ? " has-member-actions" : ""}`}
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
          {session ? (
            <div className="header-actions member-header-actions-wrap">
              <MemberCounters session={session} onLogout={onLogout} />
            </div>
          ) : (
            <div className="header-actions">
              <Link className="sign-in" to={`/${locale}/auth/login`}>
                {text.signIn}
              </Link>
              <Link className="sign-up" to={`/${locale}/auth/register`}>
                {text.signUp}
              </Link>
            </div>
          )}
        </div>
      </header>}
      <main className={`web-main${isLanding ? " landing-main" : ""}${isAuth ? " auth-main" : ""}${isStandaloneAuth ? " standalone-auth-main" : ""}${isKnowledge ? " knowledge-main" : ""}${isCatalog ? " catalog-main" : ""}${isDirectory && !isDirectoryDetail ? " directory-main" : ""}${isDirectoryDetail ? " directory-detail-main" : ""}${isArticle ? " article-main" : ""}${isContact ? " contact-main" : ""}${isTrustSafety ? " trust-main" : ""}${isPricing ? " pricing-main" : ""}${isResources ? " resources-main" : ""}${isFindYourPath ? " resources-main" : ""}${isStaticPage ? " static-main" : ""}`}>{children}</main>
      <footer className="web-footer">
        <div className="web-footer-inner">
          <div className="footer-brand">
            <Link to={`/${locale}`} aria-label="LetsBeParents">
              <img src="/web-static/logo-db535d28.svg" alt="LetsBeParents" />
            </Link>
            <p>{text.tagline}</p>
          </div>
          <div className="footer-column">
            <h3>{text.platform}</h3>
            <nav>
              <Link to={`/${locale}/knowledge-hub`}>{text.knowledge}</Link>
              <Link to={`/${locale}/catalog`}>{text.match}</Link>
              <Link to={`/${locale}/clinics`}>{text.clinics}</Link>
              <Link to={`/${locale}/lawyers`}>{text.lawyers}</Link>
              <Link to={`/${locale}/resources`}>{text.resources}</Link>
              <Link to={`/${locale}/trust-safety`}>{text.safety}</Link>
              <Link to={`/${locale}/pricing`}>{text.pricing}</Link>
            </nav>
          </div>
          <div className="footer-column">
            <h3>{text.company}</h3>
            <nav>
              <Link to={`/${locale}/contact`}>{text.contact}</Link>
              <Link to={`/${locale}/pages/terms-of-use`}>{text.terms}</Link>
              <Link to={`/${locale}/pages/privacy-policy`}>{text.privacy}</Link>
            </nav>
          </div>
          <div className="footer-bottom">
            <span>{text.rights}</span>
            <div className="footer-controls">
              <button className="cookie-link" onClick={() => window.dispatchEvent(new Event("open-cookie-settings"))}>{text.cookies}</button>
              <label className="locale-switcher">
                <span className="sr-only">{text.language}</span>
                <select aria-label={text.language} value={locale} onChange={(event) => switchLocale(event.target.value)}>
                  <option value="en">English</option>
                  <option value="ru">Русский</option>
                  <option value="es">Español</option>
                </select>
              </label>
              <a className="social-link" href="https://www.instagram.com/letsbeparents.app/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
                  <path d="M17.5 6.5h.01" />
                </svg>
              </a>
              <a className="social-link" href="https://www.facebook.com/profile.php?id=100084773163793" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
      <CallManager session={session} />
      <CookieConsent />
    </div>
  );
}

function LandingReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const articleRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.1 },
    );
    observer.observe(article);
    return () => observer.disconnect();
  }, []);

  return (
    <article ref={articleRef} className={`landing-reveal ${visible ? "is-visible" : ""} ${className}`.trim()}>
      {children}
    </article>
  );
}

const LANDING_TEXT = {
  en: {
    pill: "Family-building platform",
    title: "Your path to parenthood starts here",
    intro: "Find a donor, co-parent or family-building partner - then take the next steps with trusted clinics, legal experts and practical guidance.",
    start: "Find your path", how: "HOW IT WORKS", stepsTitle: "Five steps to your family",
    trustLine: "Every profile is identity-verified - see what we check.",
    steps: [
      ["01", "Create your profile", "Tell us about yourself, your preferences and what kind of family you dream of building.", "profile"],
      ["02", "Find your match", "Browse profiles of donors, co-parents and family-building partners. Filter by values and connect.", "match"],
      ["03", "Understand your compatibility", "See your compatibility score and what matters most to talk through before you decide.", "compatibility"],
      ["04", "Plan your family together", "Build a shared Family Plan - parenting, finances, legal steps - in one place.", "plan"],
      ["05", "Get expert support", "Connect with vetted fertility clinics and reproductive law specialists whenever you need them.", "support"],
    ],
    pathSelector: {
      label: "FIND YOUR PATH", title: "What brings you here?",
      intro: "Every family starts differently. Choose the path that fits you best - you can always explore more later.",
      options: [
        ["coparent", "I'm looking for a co-parent"],
        ["donor", "I'm looking for a donor"],
        ["partner", "I'm looking for a family-building partner"],
        ["couple-donor", "We're a couple looking for a donor"],
        ["exploring", "I'm exploring my options"],
      ],
    },
    features: [
      { label: "MATCHMAKING", title: "Find your donor, co-parent or partner", copy: "Our thoughtful matching system helps you connect with the right person. Filter by location, values, and preferences. Like profiles, get matched, then chat and video call - all in a safe, private space.", points: ["Advanced filters by location, type, and preferences", "Built-in messaging and HD video calls", "Privacy-first: control who sees your profile"] },
      { label: "CLINICS", title: "World-class fertility clinics, one click away", copy: "Browse verified clinics across 20+ countries. Read detailed profiles, compare services, and start a video consultation - all from your living room. Every clinic is vetted for quality and inclusivity.", points: ["Video consultations with top specialists", "Clinics verified for LGBTQ+ and single-parent inclusivity", "Transparent pricing and real patient reviews"] },
      { label: "LAWYERS", title: "Legal guidance you can trust", copy: "Donor agreements, parental rights - reproductive law is complex. Our directory of 350+ verified lawyers across 20+ countries ensures you get expert legal support tailored to your family structure.", points: ["Specialists in donor and family law", "Filter by country, language, and practice area", "Save favorites and compare legal professionals"] },
      { label: "FAMILY PLANNING", title: "Plan your family, together", copy: "Once you've matched, keep building together. See your Compatibility Report, talk through what matters, and create a shared Family Plan covering parenting, finances and legal steps - all in one place.", points: ["Compatibility Report with real talking points, not a pass/fail score", "Shared Family Plan for parenting, finances and legal steps", "One place to keep planning after the match, not just chat"] },
      { label: "BECOME A DONOR", title: "Give the gift of parenthood", copy: "You have the power to change someone's life forever. Whether you're considering egg or sperm donation - our platform connects you with people who dream of starting a family. Create your profile, set your terms, and help make parenthood possible.", points: ["Safe, verified matching with intended parents", "Full control over your profile, terms, and privacy", "Built-in chat and video calls to get to know each other"] },
      { label: "FOR CLINICS & LAWYERS", title: "Grow your practice, reach more families", copy: "Join our professional directory and connect with thousands of potential clients. Get your own partner dashboard to manage appointments, communicate with patients through secure chat and video calls, run promotional campaigns, and build your reputation in the reproductive health community.", points: ["Personal partner dashboard with analytics", "Secure chat and video consultations with clients", "Promotional tools and targeted email campaigns"] },
    ],
    stats: [["15.1K", "Members worldwide"], ["7.3K", "Donors"], ["4.5K", "Partner clinics"], ["369", "Lawyers"]],
    ctaTitle: "Ready to start your family?", ctaCopy: "Join thousands of future parents. Create your free account today.",
    ctaButton: "Create free account", appLabel: "Also available as a free mobile app",
  },
  ru: {
    pill: "Платформа для создания семьи",
    title: "Ваш путь к родительству начинается здесь",
    intro: "Найдите донора, со-родителя или партнёра для создания семьи - а затем сделайте следующие шаги с проверенными клиниками, юридическими экспертами и практическими рекомендациями.",
    start: "Найти свой путь", how: "КАК ЭТО РАБОТАЕТ", stepsTitle: "Пять шагов к вашей семье",
    trustLine: "Каждый профиль проходит проверку личности - узнайте, что мы проверяем.",
    steps: [
      ["01", "Создайте профиль", "Расскажите о себе, своих предпочтениях и о какой семье вы мечтаете.", "profile"],
      ["02", "Найдите пару", "Просматривайте профили доноров, со-родителей и партнёров для создания семьи. Фильтруйте по ценностям и общайтесь.", "match"],
      ["03", "Оцените совместимость", "Узнайте свою оценку совместимости и что стоит обсудить, прежде чем принять решение.", "compatibility"],
      ["04", "Спланируйте семью вместе", "Постройте общий Family Plan - воспитание, финансы, юридические шаги - всё в одном месте.", "plan"],
      ["05", "Получите поддержку экспертов", "Свяжитесь с проверенными клиниками репродуктивной медицины и юристами, когда это понадобится.", "support"],
    ],
    pathSelector: {
      label: "НАЙДИТЕ СВОЙ ПУТЬ", title: "Что привело вас сюда?",
      intro: "Каждая семья начинается по-своему. Выберите путь, который подходит вам сейчас - позже вы всегда сможете изучить другие варианты.",
      options: [
        ["coparent", "Я ищу со-родителя"],
        ["donor", "Я ищу донора"],
        ["partner", "Я ищу партнёра для создания семьи"],
        ["couple-donor", "Мы пара, ищем донора"],
        ["exploring", "Я изучаю варианты"],
      ],
    },
    features: [
      { label: "ПОДБОР ПАРЫ", title: "Найдите донора, со-родителя или партнёра", copy: "Наша продуманная система подбора поможет вам найти подходящего человека. Фильтруйте по локации, ценностям и предпочтениям. Ставьте лайки, получайте совпадения, общайтесь в чате и по видеосвязи - всё в безопасном, приватном пространстве.", points: ["Расширенные фильтры по местоположению, типу и предпочтениям", "Встроенные сообщения и HD видеозвонки", "Конфиденциальность: контролируйте, кто видит ваш профиль"] },
      { label: "КЛИНИКИ", title: "Лучшие клиники репродуктивной медицины в один клик", copy: "Просматривайте проверенные клиники в 20+ странах. Изучайте подробные профили, сравнивайте услуги и начинайте видеоконсультацию - всё из дома. Каждая клиника проверена на качество и инклюзивность.", points: ["Видеоконсультации с ведущими специалистами", "Клиники, проверенные на инклюзивность для ЛГБТК+ и одиноких родителей", "Прозрачные цены и реальные отзывы пациентов"] },
      { label: "ЮРИСТЫ", title: "Юридическая поддержка, которой можно доверять", copy: "Донорские соглашения, родительские права - репродуктивное право сложно. Наш каталог из 350+ проверенных юристов в 20+ странах обеспечит вам экспертную юридическую поддержку, адаптированную к вашей семейной ситуации.", points: ["Специалисты по донорскому и семейному праву", "Фильтрация по стране, языку и области практики", "Сохраняйте избранное и сравнивайте юристов"] },
      { label: "ПЛАНИРОВАНИЕ СЕМЬИ", title: "Планируйте семью вместе", copy: "После совпадения продолжайте строить отношения вместе. Смотрите свой отчёт о совместимости, обсуждайте важное и создавайте общий Family Plan - воспитание, финансы, юридические шаги - всё в одном месте.", points: ["Отчёт о совместимости с реальными темами для обсуждения, а не оценкой «прошёл/не прошёл»", "Общий Family Plan для воспитания, финансов и юридических шагов", "Одно место для планирования после совпадения, а не только чат"] },
      { label: "СТАТЬ ДОНОРОМ", title: "Подарите дар родительства", copy: "У вас есть возможность навсегда изменить чью-то жизнь. Если вы рассматриваете донорство яйцеклетки или спермы - наша платформа связывает вас с людьми, которые мечтают о семье. Создайте профиль, установите свои условия и помогите сделать родительство возможным.", points: ["Безопасный, проверенный подбор с будущими родителями", "Полный контроль над профилем, условиями и конфиденциальностью", "Встроенный чат и видеозвонки для знакомства"] },
      { label: "ДЛЯ КЛИНИК И ЮРИСТОВ", title: "Развивайте практику, охватите больше семей", copy: "Присоединяйтесь к нашему профессиональному каталогу и связывайтесь с тысячами потенциальных клиентов. Получите собственный партнёрский кабинет для управления записями, общения с пациентами через безопасный чат и видеосвязь, проведения промо-кампаний и укрепления репутации в сфере репродуктивного здоровья.", points: ["Персональный партнёрский кабинет с аналитикой", "Безопасный чат и видеоконсультации с клиентами", "Инструменты продвижения и целевые email-рассылки"] },
    ],
    stats: [["15.1K", "Участников по всему миру"], ["7.3K", "Доноров"], ["4.5K", "Партнёрских клиник"], ["369", "Юристов"]],
    ctaTitle: "Готовы создать семью?", ctaCopy: "Присоединяйтесь к тысячам будущих родителей. Создайте бесплатный аккаунт сегодня.",
    ctaButton: "Создать бесплатный аккаунт", appLabel: "Также доступно как бесплатное мобильное приложение",
  },
  es: {
    pill: "Plataforma de formación de familias",
    title: "Tu camino a la maternidad o paternidad empieza aquí",
    intro: "Encuentra un donante, co-padre o pareja para formar una familia - y luego da los siguientes pasos con clínicas de confianza, expertos legales y orientación práctica.",
    start: "Encuentra tu camino", how: "CÓMO FUNCIONA", stepsTitle: "Cinco pasos hacia tu familia",
    trustLine: "Cada perfil verifica su identidad - descubre qué comprobamos.",
    steps: [
      ["01", "Crea tu perfil", "Cuéntanos sobre ti, tus preferencias y qué tipo de familia sueñas formar.", "profile"],
      ["02", "Encuentra tu match", "Explora perfiles de donantes, co-padres y parejas para formar una familia. Filtra por valores y conecta.", "match"],
      ["03", "Evalúa tu compatibilidad", "Descubre tu puntuación de compatibilidad y qué conviene hablar antes de decidir.", "compatibility"],
      ["04", "Planifica tu familia juntos", "Crea un Family Plan compartido - crianza, finanzas, pasos legales - todo en un solo lugar.", "plan"],
      ["05", "Recibe apoyo experto", "Conecta con clínicas de fertilidad verificadas y especialistas en derecho reproductivo cuando lo necesites.", "support"],
    ],
    pathSelector: {
      label: "ENCUENTRA TU CAMINO", title: "¿Qué te trae por aquí?",
      intro: "Cada familia empieza de una forma distinta. Elige el camino que mejor te encaje - siempre podrás explorar otras opciones más adelante.",
      options: [
        ["coparent", "Busco un co-padre o co-madre"],
        ["donor", "Busco un donante"],
        ["partner", "Busco una pareja para formar una familia"],
        ["couple-donor", "Somos una pareja y buscamos un donante"],
        ["exploring", "Estoy explorando mis opciones"],
      ],
    },
    features: [
      { label: "MATCHMAKING", title: "Encuentra a tu donante, co-padre o pareja", copy: "Nuestro sistema de emparejamiento te ayuda a conectar con la persona adecuada. Filtra por ubicación, valores y preferencias. Da like a perfiles, haz match, chatea y haz videollamadas, todo en un espacio seguro y privado.", points: ["Filtros avanzados por ubicación, tipo y preferencias", "Mensajería integrada y videollamadas HD", "Privacidad primero: controla quién ve tu perfil"] },
      { label: "CLÍNICAS", title: "Clínicas de fertilidad de primer nivel, a un clic", copy: "Explora clínicas verificadas en más de 20 países. Lee perfiles detallados, compara servicios e inicia una videoconsulta, todo desde casa. Cada clínica está validada por calidad e inclusividad.", points: ["Videoconsultas con los mejores especialistas", "Clínicas verificadas para LGBTQ+ y familias monoparentales", "Precios transparentes y reseñas reales de pacientes"] },
      { label: "ABOGADOS", title: "Orientación legal de confianza", copy: "Acuerdos de donantes, derechos parentales: el derecho reproductivo es complejo. Nuestro directorio de más de 350 abogados verificados en más de 20 países te garantiza apoyo legal experto adaptado a tu familia.", points: ["Especialistas en donación y derecho de familia", "Filtra por país, idioma y área de práctica", "Guarda favoritos y compara profesionales legales"] },
      { label: "PLANIFICACIÓN FAMILIAR", title: "Planifica tu familia, juntos", copy: "Una vez que hagáis match, seguid construyendo juntos. Consulta tu Informe de Compatibilidad, habla de lo que importa y crea un Family Plan compartido que cubra crianza, finanzas y pasos legales - todo en un solo lugar.", points: ["Informe de compatibilidad con temas reales para hablar, no una puntuación de aprobado/reprobado", "Family Plan compartido para crianza, finanzas y pasos legales", "Un solo lugar para seguir planificando después del match, no solo chat"] },
      { label: "SÉ DONANTE", title: "Regala la oportunidad de ser madres o padres", copy: "Tienes el poder de cambiar la vida de alguien para siempre. Si estás considerando donar óvulos o esperma, nuestra plataforma te conecta con personas que sueñan con formar una familia. Crea tu perfil, fija tus condiciones y ayuda a hacer posible la parentalidad.", points: ["Emparejamiento seguro y verificado con padres y madres intencionales", "Control total sobre tu perfil, condiciones y privacidad", "Chat y videollamadas integrados para conoceros"] },
      { label: "PARA CLÍNICAS Y ABOGADOS", title: "Haz crecer tu práctica, llega a más familias", copy: "Únete a nuestro directorio profesional y conecta con miles de potenciales clientes. Accede a tu panel de partner para gestionar citas, comunicarte con pacientes por chat seguro y videollamadas, lanzar campañas y construir tu reputación en la comunidad de salud reproductiva.", points: ["Panel de partner personal con analíticas", "Chat seguro y videoconsultas con clientes", "Herramientas promocionales y campañas de email segmentadas"] },
    ],
    stats: [["15.1K", "Miembros en el mundo"], ["7.3K", "Donantes"], ["4.5K", "Clínicas partner"], ["369", "Abogados"]],
    ctaTitle: "¿Listo para formar tu familia?", ctaCopy: "Únete a miles de futuros padres y madres. Crea tu cuenta gratis hoy.",
    ctaButton: "Crear cuenta gratis", appLabel: "También disponible como app móvil gratuita",
  },
} as const;

const LANDING_FEATURE_IMAGES = [
  "/web-static/images/landing/feature-matchmaking-4122e02d.jpg",
  "/web-static/images/landing/feature-clinics-e8a42166.jpg",
  "/web-static/images/landing/feature-lawyers-3681de6d.jpg",
  "/web-static/images/landing/feature-matchmaking-4122e02d.jpg",
  "/web-static/images/landing/feature-donors-80e118c5.jpg",
  "/web-static/images/landing/feature-partners-a2b6d846.jpg",
] as const;

function pathIcon(key: string) {
  if (key === "donor") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>;
  if (key === "partner") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>;
  if (key === "couple-donor") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m17 11 2 2 4-4"/></svg>;
  if (key === "exploring") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

// Maps the Path Selector's internal keys (also used for ?path= on registration) to the
// Find Your Path URL slugs from LBP_findyourpath_TZ.md - only "coparent" differs.
function pathSlug(key: string) {
  return key === "coparent" ? "co-parenting" : key;
}

function Home() {
  const locale = localeOf();
  const text = LANDING_TEXT[locale];
  const steps = text.steps;
  const stepIcon = (icon: string) => {
    if (icon === "profile") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>;
    if (icon === "match") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762"/></svg>;
    if (icon === "clinic") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/></svg>;
    if (icon === "compatibility") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>;
    if (icon === "plan") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>;
    if (icon === "support") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/></svg>;
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/></svg>;
  };
  const pathImage = (key: string) => {
    if (key === "donor") return "/web-static/images/landing/path-donor.jpg";
    if (key === "partner") return "/web-static/images/landing/path-partner.jpg";
    if (key === "couple-donor") return "/web-static/images/landing/path-couple-donor.jpg";
    if (key === "exploring") return "/web-static/images/landing/path-exploring.jpg";
    return "/web-static/images/landing/path-coparent.jpg";
  };
  const features = text.features.map((feature, index) => ({ ...feature, image: LANDING_FEATURE_IMAGES[index] }));
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          poster="/web-static/images/landing/hero-bg-280fbbea.jpg"
          aria-hidden="true"
        >
          <source src="/web-static/images/landing/hero-bg-4dd68bec.mp4" type="video/mp4" />
        </video>
        <div className="landing-hero-shade" />
        <div className="landing-hero-content">
          <div className="landing-pill"><i /><span>{text.pill}</span></div>
          <h1>{text.title}</h1>
          <p>{text.intro}</p>
          <a className="landing-gradient-button" href="#path-selector">
            {text.start}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
          </a>
        </div>
      </section>

      <section className="landing-path-selector" id="path-selector">
        <div className="landing-section-intro">
          <span>{text.pathSelector.label}</span>
          <h2>{text.pathSelector.title}</h2>
          <p className="landing-path-intro">{text.pathSelector.intro}</p>
        </div>
        <div className="landing-path-grid">
          {text.pathSelector.options.map(([key, label]) => (
            <Link key={key} className="landing-path-card" style={{ backgroundImage: `url(${pathImage(key)})` }} to={`/${locale}/find-your-path/${pathSlug(key)}`}>
              <span className="landing-path-shade" />
              <svg className="landing-path-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
              <span className="landing-path-icon">{pathIcon(key)}</span>
              <span className="landing-path-label">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-steps">
        <div className="landing-section-intro">
          <span>{text.how}</span>
          <h2>{text.stepsTitle}</h2>
        </div>
        <div className="landing-step-grid">
          {steps.map(([number, title, copy, icon]) => (
            <article key={number}>
              <div className="landing-step-icon">{stepIcon(icon)}</div>
              <div className="landing-step-number">{number}</div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-features">
        {features.map((feature, index) => (
          <LandingReveal className={index % 2 ? "reverse" : ""} key={feature.label}>
            <img src={feature.image} alt="" />
            <div className="landing-feature-copy">
              <span className="landing-feature-label">{feature.label}</span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
              <ul>{feature.points.map((point) => <li key={point}><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></i><span>{point}</span></li>)}</ul>
            </div>
          </LandingReveal>
        ))}
      </section>

      <section className="landing-stats">
        {text.stats.map(([value, label]) => (
          <div key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </section>

      <section className="landing-trust-line">
        <Link to={`/${locale}/trust-safety`}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
          <span>{text.trustLine}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
        </Link>
      </section>

      <section className="landing-cta">
        <h2>{text.ctaTitle}</h2>
        <p>{text.ctaCopy}</p>
        <Link to={`/${locale}/auth/register`}>{text.ctaButton} <span>→</span></Link>
        <small>{text.appLabel}</small>
        <div className="landing-store-links">
          <a href="https://letsbeparents.onelink.me/wg1x?pid=website&c=landing_cta"><img src="/web-static/images/badges/appstore-white-b32c87ae.png" alt="Download on the App Store" /></a>
          <a href="https://letsbeparents.onelink.me/wg1x?pid=website&c=landing_cta"><img src="/web-static/images/badges/googleplay-white-7aebf78f.png" alt="Get it on Google Play" /></a>
        </div>
      </section>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17.2 17.2 0 0 1-3.1 3.9" />
      <path d="M6.6 6.6C3.7 8.5 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

const authPageCopy: Record<CookieLocale, {
  loginTitle: string; loginLead: string; email: string; password: string;
  emailPlaceholder: string; passwordPlaceholder: string; showPassword: string; hidePassword: string;
  forgot: string; signIn: string; signingIn: string; signInError: string; loginDivider: string;
  noAccount: string; createAccountLink: string; registerTitle: string; registerLead: string;
  confirmPassword: string; confirmPlaceholder: string; acceptPrefix: string; terms: string;
  and: string; privacy: string; createAccount: string; creatingAccount: string; registerDivider: string;
  alreadyAccount: string; signInLink: string; mismatch: string; createError: string;
  forgotTitle: string; forgotLead: string; forgotPlaceholder: string; sendLink: string;
  sending: string; backToSignIn: string; resetSent: string; resetError: string;
}> = {
  en: {
    loginTitle: "Welcome back", loginLead: "We've missed you! Please sign in to your account.",
    email: "Email", password: "Password", emailPlaceholder: "Enter your email", passwordPlaceholder: "Enter your password",
    showPassword: "Show password", hidePassword: "Hide password", forgot: "Forgot password?", signIn: "Sign in",
    signingIn: "Signing in…", signInError: "Sign-in failed. Check your email and password.", loginDivider: "Or continue with",
    noAccount: "Don't have an account?", createAccountLink: "Create account", registerTitle: "Create account",
    registerLead: "Join our community and start your journey", confirmPassword: "Confirm password",
    confirmPlaceholder: "Confirm your password", acceptPrefix: "I accept the", terms: "Terms of Use", and: "and",
    privacy: "Privacy policy", createAccount: "Create account", creatingAccount: "Creating account…",
    registerDivider: "Or continue with", alreadyAccount: "Already have an account?", signInLink: "Sign in",
    mismatch: "Passwords do not match.", createError: "Could not create the account. Use a unique email and a password of at least 8 characters.",
    forgotTitle: "Forgot password", forgotLead: "Enter your email and we'll send you a link to reset your password.",
    forgotPlaceholder: "Enter your email", sendLink: "Send reset link", sending: "Sending…", backToSignIn: "Back to sign in",
    resetSent: "If an active account exists for this email, we sent a password reset link.",
    resetError: "We could not submit the request. Please try again.",
  },
  ru: {
    loginTitle: "С возвращением", loginLead: "Мы скучали! Войдите в свой аккаунт.",
    email: "Email", password: "Пароль", emailPlaceholder: "Введите email", passwordPlaceholder: "Введите пароль",
    showPassword: "Показать пароль", hidePassword: "Скрыть пароль", forgot: "Забыли пароль?", signIn: "Войти",
    signingIn: "Вход…", signInError: "Не удалось войти. Проверьте email и пароль.", loginDivider: "Или продолжить с",
    noAccount: "Нет аккаунта?", createAccountLink: "Регистрация", registerTitle: "Создать аккаунт",
    registerLead: "Присоединяйтесь к сообществу и начните свой путь", confirmPassword: "Повторите пароль",
    confirmPlaceholder: "Повторите пароль", acceptPrefix: "Я принимаю", terms: "Условия использования", and: "и",
    privacy: "Политику конфиденциальности", createAccount: "Создать аккаунт", creatingAccount: "Создание аккаунта…",
    registerDivider: "Или продолжить через", alreadyAccount: "Уже есть аккаунт?", signInLink: "Войти",
    mismatch: "Пароли не совпадают.", createError: "Не удалось создать аккаунт. Используйте уникальный email и пароль не короче 8 символов.",
    forgotTitle: "Забыли пароль?", forgotLead: "Введите email, и мы отправим вам ссылку для смены пароля.",
    forgotPlaceholder: "Введите ваш email", sendLink: "Отправить ссылку", sending: "Отправка…", backToSignIn: "Вернуться ко входу",
    resetSent: "Если активный аккаунт с таким email существует, мы отправили ссылку для смены пароля.",
    resetError: "Не удалось отправить запрос. Попробуйте ещё раз.",
  },
  es: {
    loginTitle: "Bienvenido de nuevo", loginLead: "¡Te hemos echado de menos! Inicia sesión en tu cuenta.",
    email: "Email", password: "Contraseña", emailPlaceholder: "Introduce tu email", passwordPlaceholder: "Introduce tu contraseña",
    showPassword: "Mostrar contraseña", hidePassword: "Ocultar contraseña", forgot: "¿Olvidaste tu contraseña?", signIn: "Iniciar sesión",
    signingIn: "Iniciando sesión…", signInError: "No se pudo iniciar sesión. Comprueba tu correo y contraseña.", loginDivider: "O continúa con",
    noAccount: "¿No tienes cuenta?", createAccountLink: "Crear cuenta", registerTitle: "Crear cuenta",
    registerLead: "Únete a la comunidad y empieza tu camino", confirmPassword: "Confirmar contraseña",
    confirmPlaceholder: "Confirma tu contraseña", acceptPrefix: "Acepto los", terms: "Términos de uso", and: "y la",
    privacy: "Política de privacidad", createAccount: "Crear cuenta", creatingAccount: "Creando cuenta…",
    registerDivider: "O continuar con", alreadyAccount: "¿Ya tienes cuenta?", signInLink: "Iniciar sesión",
    mismatch: "Las contraseñas no coinciden.", createError: "No se pudo crear la cuenta. Usa un correo único y una contraseña de al menos 8 caracteres.",
    forgotTitle: "¿Olvidaste tu contraseña?", forgotLead: "Introduce tu correo y te enviaremos un enlace para restablecer tu contraseña.",
    forgotPlaceholder: "Introduce tu correo", sendLink: "Enviar enlace", sending: "Enviando…", backToSignIn: "Volver al inicio de sesión",
    resetSent: "Si existe una cuenta activa con este correo, hemos enviado un enlace para restablecer la contraseña.",
    resetError: "No se pudo enviar la solicitud. Inténtalo de nuevo.",
  },
};

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const locale = localeOf();
  const copy = authPageCopy[locale];
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.post<{ user: Row }>("/auth/login", {
        email,
        password,
      });
      onLogin(await refreshSession({ user: response.user }));
      navigate(`/${locale}/catalog`);
    } catch {
      setError(copy.signInError);
    } finally {
      setBusy(false);
    }
  };
  const social = async (provider: SocialProvider) => {
    setBusy(true);
    setError("");
    try {
      const response = await signInWithSocial(provider, "login");
      onLogin(await refreshSession(response));
      navigate(`/${locale}/${response.isNewUser ? "profile" : "catalog"}`);
    } catch (error) {
      setError(socialErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="auth-page auth-login-page">
      <div className="auth-illustration" aria-hidden="true">
        <img src="/web-static/images/auth/login-silhouette-b9e0cd83.webp" alt="" />
      </div>
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>{copy.loginTitle}</h1>
          <p>{copy.loginLead}</p>
        </div>
        <form onSubmit={submit}>
          <label>
            <span>{copy.email}</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder={copy.emailPlaceholder}
              autoComplete="username"
              required
            />
          </label>
          <label>
            <span>{copy.password}</span>
            <div className="password-input">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder={copy.passwordPlaceholder}
                autoComplete="current-password"
                required
              />
              <button type="button" aria-label={showPassword ? copy.hidePassword : copy.showPassword} onClick={() => setShowPassword((shown) => !shown)}>
                <PasswordVisibilityIcon visible={showPassword} />
              </button>
            </div>
          </label>
          <Link className="forgot-link" to={`/${locale}/auth/forgot-password`}>{copy.forgot}</Link>
          {error && <p className="error">{error}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? copy.signingIn : copy.signIn}</button>
        </form>
        <p className="auth-divider">{copy.loginDivider}</p>
        <div className="auth-socials">
          <button type="button" disabled={busy} aria-label="Continue with Google" onClick={() => void social("google")}><GoogleIcon /></button>
          <button type="button" disabled={busy} aria-label="Continue with Apple" onClick={() => void social("apple")}><AppleIcon /></button>
        </div>
        <p className="auth-account-link">{copy.noAccount} <Link to={`/${locale}/auth/register`}>{copy.createAccountLink}</Link></p>
      </div>
    </section>
  );
}

function Signup({ onLogin }: { onLogin: (session: Session) => void }) {
  const locale = localeOf();
  const copy = authPageCopy[locale];
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(copy.mismatch);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api.post<{ user: Row }>("/auth/signup", {
        displayName: email.split("@")[0] || email,
        email,
        password,
        locale,
      });
      onLogin(await refreshSession({ user: response.user }));
      navigate(`/${locale}/profile`);
    } catch {
      setError(
        copy.createError,
      );
    } finally {
      setBusy(false);
    }
  };
  const social = async (provider: SocialProvider) => {
    setBusy(true);
    setError("");
    try {
      const response = await signInWithSocial(provider, "register");
      onLogin(await refreshSession(response));
      navigate(`/${locale}/profile`);
    } catch (error) {
      setError(socialErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="auth-page auth-login-page auth-register-page">
      <div className="auth-illustration" aria-hidden="true">
        <img src="/web-static/images/auth/login-silhouette-b9e0cd83.webp" alt="" />
      </div>
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>{copy.registerTitle}</h1>
          <p>{copy.registerLead}</p>
        </div>
        <form onSubmit={submit}>
          <label>
            <span>{copy.email}</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder={copy.emailPlaceholder}
              autoComplete="username"
              required
            />
          </label>
          <label>
            <span>{copy.password}</span>
            <div className="password-input">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder={copy.passwordPlaceholder}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button type="button" aria-label={showPassword ? copy.hidePassword : copy.showPassword} onClick={() => setShowPassword((shown) => !shown)}>
                <PasswordVisibilityIcon visible={showPassword} />
              </button>
            </div>
          </label>
          <label>
            <span>{copy.confirmPassword}</span>
            <div className="password-input">
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showConfirmPassword ? "text" : "password"}
                placeholder={copy.confirmPlaceholder}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <button type="button" aria-label={showConfirmPassword ? copy.hidePassword : copy.showPassword} onClick={() => setShowConfirmPassword((shown) => !shown)}>
                <PasswordVisibilityIcon visible={showConfirmPassword} />
              </button>
            </div>
          </label>
          <label className="auth-terms">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required />
            <span>{copy.acceptPrefix} <Link to={`/${locale}/pages/terms-of-use`}>{copy.terms}</Link> {copy.and} <Link to={`/${locale}/pages/privacy-policy`}>{copy.privacy}</Link></span>
          </label>
          {error && <p className="error">{error}</p>}
          <button className="auth-submit" disabled={busy}>{busy ? copy.creatingAccount : copy.createAccount}</button>
        </form>
        <p className="auth-divider">{copy.registerDivider}</p>
        <div className="auth-socials">
          <button type="button" disabled={busy} aria-label="Continue with Google" onClick={() => void social("google")}><GoogleIcon /></button>
          <button type="button" disabled={busy} aria-label="Continue with Apple" onClick={() => void social("apple")}><AppleIcon /></button>
        </div>
        <p className="auth-account-link">{copy.alreadyAccount} <Link to={`/${locale}/auth/login`}>{copy.signInLink}</Link></p>
      </div>
    </section>
  );
}

function ForgotPassword() {
  const locale = localeOf();
  const copy = authPageCopy[locale];
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email, locale });
      setNotice(
        copy.resetSent,
      );
    } catch {
      setNotice(copy.resetError);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="auth-page auth-login-page auth-forgot-page">
      <div className="auth-illustration" aria-hidden="true">
        <img src="/web-static/images/auth/login-silhouette-b9e0cd83.webp" alt="" />
      </div>
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>{copy.forgotTitle}</h1>
          <p>{copy.forgotLead}</p>
        </div>
        <form onSubmit={submit}>
          <label>
            <span>{copy.email}</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={copy.forgotPlaceholder}
              autoComplete="email"
              required
            />
          </label>
          {notice && <p className="notice">{notice}</p>}
          <button className="auth-submit" disabled={busy}>
            {busy ? copy.sending : copy.sendLink}
          </button>
        </form>
        <p className="auth-account-link"><Link to={`/${locale}/auth/login`}>{copy.backToSignIn}</Link></p>
      </div>
    </section>
  );
}

const standaloneAuthCopy = {
  en: {
    resetTitle: "Choose a new password",
    resetLead: "The one-time link can be used only once.",
    password: "New password",
    confirmPassword: "Confirm password",
    savePassword: "Save new password",
    back: "Back to sign in",
    mismatch: "Passwords do not match.",
    invalid: "This link is invalid, expired, or has already been used.",
    resetDone: "Password updated. You can now sign in.",
    wait: "Please wait...",
    verifyTitle: "Confirm your email",
    verifyLead: "Open the link in your email, or request a new confirmation message.",
    resend: "Resend email",
    verifySent: "We sent a confirmation link to your email.",
    verifyDone: "Email confirmed. You can continue to LetsBeParents.",
    alreadyVerified: "Your email is already confirmed.",
    recentlySent: "A confirmation email was sent recently. Check your inbox.",
    deliveryFailed: "The email could not be delivered. Please try again later.",
    generic: "Something went wrong. Please try again.",
    continue: "Continue",
  },
  ru: {
    resetTitle: "Установите новый пароль",
    resetLead: "Одноразовую ссылку можно использовать только один раз.",
    password: "Новый пароль",
    confirmPassword: "Подтвердите пароль",
    savePassword: "Сохранить пароль",
    back: "Назад ко входу",
    mismatch: "Пароли не совпадают.",
    invalid: "Ссылка недействительна, устарела или уже была использована.",
    resetDone: "Пароль изменён. Теперь можно войти.",
    wait: "Подождите...",
    verifyTitle: "Подтвердите email",
    verifyLead: "Откройте ссылку из письма или запросите новое письмо для подтверждения.",
    resend: "Отправить повторно",
    verifySent: "Мы отправили ссылку для подтверждения на вашу почту.",
    verifyDone: "Email подтверждён. Можно продолжить работу с LetsBeParents.",
    alreadyVerified: "Ваш email уже подтверждён.",
    recentlySent: "Письмо уже было недавно отправлено. Проверьте почту.",
    deliveryFailed: "Не удалось доставить письмо. Повторите попытку позже.",
    generic: "Не удалось выполнить запрос. Повторите попытку.",
    continue: "Продолжить",
  },
  es: {
    resetTitle: "Elige una contraseña nueva",
    resetLead: "El enlace de un solo uso solo se puede utilizar una vez.",
    password: "Nueva contraseña",
    confirmPassword: "Confirmar contraseña",
    savePassword: "Guardar contraseña",
    back: "Volver al inicio de sesión",
    mismatch: "Las contraseñas no coinciden.",
    invalid: "Este enlace no es válido, ha caducado o ya se ha utilizado.",
    resetDone: "Contraseña actualizada. Ya puedes iniciar sesión.",
    wait: "Espera...",
    verifyTitle: "Confirma tu correo",
    verifyLead: "Abre el enlace del correo o solicita un nuevo mensaje de confirmación.",
    resend: "Reenviar correo",
    verifySent: "Hemos enviado un enlace de confirmación a tu correo.",
    verifyDone: "Correo confirmado. Ya puedes continuar en LetsBeParents.",
    alreadyVerified: "Tu correo ya está confirmado.",
    recentlySent: "El correo de confirmación se envió hace poco. Revisa tu bandeja de entrada.",
    deliveryFailed: "No se pudo enviar el correo. Inténtalo de nuevo más tarde.",
    generic: "No se pudo completar la solicitud. Inténtalo de nuevo.",
    continue: "Continuar",
  },
} satisfies Record<CookieLocale, Record<string, string>>;

function StandaloneAuthBackLink({ locale, label }: { locale: CookieLocale; label: string }) {
  return (
    <Link className="standalone-auth-link" to={`/${locale}/auth/login`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
      {label}
    </Link>
  );
}

function ResetPassword() {
  const locale = localeOf();
  const copy = standaloneAuthCopy[locale];
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setNotice(copy.invalid);
      return;
    }
    if (password !== confirm) {
      setNotice(copy.mismatch);
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setNotice(copy.resetDone);
    } catch {
      setNotice(copy.invalid);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="standalone-auth-page">
      <div className="standalone-auth-visual"><img src="/web-static/logo-db535d28.svg" alt="LetsBeParents" /></div>
      <div className="standalone-auth-form-wrap">
        <div className="standalone-auth-form-card">
          <h1>{copy.resetTitle}</h1>
          <p>{copy.resetLead}</p>
          <form onSubmit={submit}>
            <label htmlFor="reset-password">{copy.password}</label>
            <input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            <label htmlFor="reset-password-confirm">{copy.confirmPassword}</label>
            <input id="reset-password-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} required />
            <button className="standalone-auth-primary" disabled={busy}>{busy ? copy.wait : copy.savePassword}</button>
          </form>
          {notice && <p className="standalone-auth-message" data-kind={notice === copy.resetDone ? "info" : "error"}>{notice}</p>}
          <StandaloneAuthBackLink locale={locale} label={copy.back} />
        </div>
      </div>
    </section>
  );
}

function VerifyEmail() {
  const locale = localeOf();
  const copy = standaloneAuthCopy[locale];
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [status, setStatus] = useState(
    token
      ? copy.wait
      : copy.verifySent,
  );
  const [busy, setBusy] = useState(Boolean(token));
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!token) return;
    window.history.replaceState(null, "", window.location.pathname);
    api
      .post("/auth/email-verification/confirm", { token })
      .then(() => {
        setConfirmed(true);
        setStatus(copy.verifyDone);
      })
      .catch(() => setStatus(copy.invalid))
      .finally(() => setBusy(false));
  }, [copy.invalid, copy.verifyDone, token]);
  const resend = async () => {
    setBusy(true);
    try {
      const response = await api.post<Row>("/auth/email-verification/resend", {
        locale,
      });
      const code = asText(response.status);
      setStatus(
        code === "EMAIL_ALREADY_VERIFIED"
          ? copy.alreadyVerified
          : code === "EMAIL_RECENTLY_SENT"
            ? copy.recentlySent
            : code === "EMAIL_DELIVERY_FAILED"
              ? copy.deliveryFailed
              : copy.verifySent,
      );
    } catch {
      setStatus(copy.generic);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="standalone-auth-page">
      <div className="standalone-auth-visual"><img src="/web-static/logo-db535d28.svg" alt="LetsBeParents" /></div>
      <div className="standalone-auth-form-wrap">
        <div className="standalone-auth-form-card">
          <h1>{copy.verifyTitle}</h1>
          <p>{copy.verifyLead}</p>
          <form onSubmit={(event) => { event.preventDefault(); if (confirmed) navigate(`/${locale}/catalog`); else void resend(); }}>
            <button className="standalone-auth-primary" disabled={busy}>{busy ? copy.wait : confirmed ? copy.continue : copy.resend}</button>
          </form>
          <p className="standalone-auth-message" data-kind={status === copy.invalid || status === copy.deliveryFailed || status === copy.generic ? "error" : "info"}>{status}</p>
          <StandaloneAuthBackLink locale={locale} label={copy.back} />
        </div>
      </div>
    </section>
  );
}

function LoadingIndicator({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div
      className={`loading${fullPage ? " loading-page" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
      aria-busy="true"
    >
      <span className="loading-spinner" aria-hidden="true" />
    </div>
  );
}

function Pager({
  result,
  onChange,
}: {
  result: Page<Row> | null;
  onChange: (offset: number) => void;
}) {
  if (!result) return <LoadingIndicator />;
  return (
    <div className="web-pager">
      <button
        disabled={!result.offset}
        onClick={() => onChange(Math.max(0, result.offset - result.limit))}
      >
        ← Previous
      </button>
      <span>
        Page {Math.floor(result.offset / result.limit) + 1} of{" "}
        {Math.max(1, Math.ceil(result.total / result.limit))}
      </span>
      <button
        disabled={!result.hasMore}
        onClick={() => onChange(result.offset + result.limit)}
      >
        Next →
      </button>
    </div>
  );
}

function Directory({ kind }: { kind: "clinics" | "lawyers" }) {
  const locale = localeOf();
  const navigate = useNavigate();
  const stateKey = `lbpDirectory:${locale}:${kind}`;
  const stored = (() => {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(stateKey) || "{}");
      return value && typeof value === "object" ? value as Row : {};
    } catch {
      return {};
    }
  })();
  const [items, setItems] = useState<Row[]>([]);
  const [options, setOptions] = useState<Row>({});
  const [q, setQ] = useState(() => String(stored.q || ""));
  const [search, setSearch] = useState(() => String(stored.q || "").trim());
  const [country, setCountry] = useState(() => String(stored.country || ""));
  const [countryInput, setCountryInput] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [language, setLanguage] = useState(() => String(stored.language || ""));
  const [languageInput, setLanguageInput] = useState("");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [selections, setSelections] = useState<string[]>(() => Array.isArray(stored.selections) ? stored.selections.map(String) : []);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [pendingFavourite, setPendingFavourite] = useState<Set<string>>(new Set());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [draftCountry, setDraftCountry] = useState("");
  const [draftLanguage, setDraftLanguage] = useState("");
  const [draftSelections, setDraftSelections] = useState<string[]>([]);
  const countryPickerRef = useRef<HTMLDivElement>(null);
  const languagePickerRef = useRef<HTMLDivElement>(null);

  const copy = {
    en: {
      lawyersTitle: "Family lawyers", lawyersLead: "Find an experienced attorney for adoption and family formation",
      clinicsTitle: "Fertility clinics", clinicsLead: "Find the right fertility clinic for your journey",
      searchLawyers: "Search lawyers...", searchClinics: "Search clinics...", filters: "Filters", country: "Country",
      anyCountry: "Any country", practice: "Practice areas", services: "Services", language: "Language", anyLanguage: "Any language", clear: "Clear all",
      apply: "Apply filters", loadMore: "Load more", loading: "Loading ...", like: "Like", liked: "Liked",
      website: "Visit website", noLawyers: "No lawyers found", noClinics: "No clinics found", error: "Could not load the directory. Please try again.",
    },
    ru: {
      lawyersTitle: "Семейные юристы", lawyersLead: "Найдите опытного адвоката по усыновлению и созданию семьи",
      clinicsTitle: "Клиники репродукции", clinicsLead: "Найдите подходящую клинику для вашего пути к родительству",
      searchLawyers: "Поиск юристов...", searchClinics: "Поиск клиник...", filters: "Фильтры", country: "Страна",
      anyCountry: "Любая страна", practice: "Области практики", services: "Услуги", language: "Язык", anyLanguage: "Любой язык", clear: "Сбросить всё",
      apply: "Применить фильтры", loadMore: "Показать ещё", loading: "Загрузка ...", like: "Нравится", liked: "В избранном",
      website: "Перейти на сайт", noLawyers: "Юристы не найдены", noClinics: "Клиники не найдены", error: "Не удалось загрузить каталог. Попробуйте ещё раз.",
    },
    es: {
      lawyersTitle: "Abogados de familia", lawyersLead: "Encuentra asesoramiento para adopción y formación familiar",
      clinicsTitle: "Clínicas de fertilidad", clinicsLead: "Encuentra la clínica adecuada para tu camino hacia la paternidad",
      searchLawyers: "Buscar abogados...", searchClinics: "Buscar clínicas...", filters: "Filtros", country: "País",
      anyCountry: "Cualquier país", practice: "Áreas de práctica", services: "Servicios", language: "Idioma", anyLanguage: "Cualquier idioma", clear: "Borrar todo",
      apply: "Aplicar filtros", loadMore: "Mostrar más", loading: "Cargando ...", like: "Me gusta", liked: "Guardado",
      website: "Visitar sitio web", noLawyers: "No se encontraron abogados", noClinics: "No se encontraron clínicas", error: "No se pudo cargar el directorio.",
    },
  }[locale];

  const referenceLanguageCodes = ["en", "ar", "af", "be", "bn", "bg", "hu", "vi", "el", "ka", "da", "he", "id", "es", "it", "ca", "zh", "ko", "lv", "lt", "ms", "de", "nl", "no", "fa", "pl", "pt", "ro", "ru", "sr", "sk", "sl", "th", "tr", "uk", "fi", "fr", "hi", "hr", "cs", "sv", "et", "ja"];
  const clinicCardServicePriority = new Map(["hiv_positive_male", "hiv_positive_female", "icsi_ivf", "hepatitis_bc_male", "hepatitis_bc_female"].map((value, index) => [value, index]));

  const tagTranslations: Record<string, Record<CookieLocale, string>> = {
    assisted_reproduction: { en: "Assisted Reproduction", ru: "Вспомогательная репродукция", es: "Reproducción asistida" },
    contested_adoption: { en: "Contested Adoption", ru: "Оспариваемое усыновление", es: "Adopción impugnada" },
    domestic_adoption: { en: "Domestic Adoption", ru: "Внутреннее усыновление", es: "Adopción nacional" },
    icpc_adoption: { en: "Interstate (ICPC) Adoption", ru: "Межштатное (ICPC) усыновление", es: "Adopción interestatal (ICPC)" },
    intercountry_adoption: { en: "Intercountry Adoption", ru: "Международное усыновление", es: "Adopción internacional" },
    lgbtq_family_formation: { en: "LGBTQ Family Formation", ru: "Создание ЛГБТК+ семей", es: "Formación de familias LGBTQ" },
    private_networking: { en: "Private Networking", ru: "Частный нетворкинг", es: "Red privada" },
    egg_donation: { en: "Egg Donation", ru: "Донорство яйцеклеток", es: "Donación de óvulos" },
    embryo_donation: { en: "Embryo Donation", ru: "Донорство эмбрионов", es: "Donación de embriones" },
    sperm_donation: { en: "Sperm Donation", ru: "Донорство спермы", es: "Donación de esperma" },
    surrogacy: { en: "Surrogacy", ru: "Суррогатное материнство", es: "Gestación subrogada" },
    grandparent_representation: { en: "Grandparent Representation", ru: "Представительство бабушек и дедушек", es: "Representación de abuelos" },
    special_needs_children: { en: "Special Needs Children", ru: "Дети с особыми потребностями", es: "Niños con necesidades especiales" },
    mediation: { en: "Mediation", ru: "Медиация", es: "Mediación" },
    ivf: { en: "IVF", ru: "ЭКО", es: "FIV" },
    icsi_ivf: { en: "ICSI IVF", ru: "ИКСИ ЭКО", es: "FIV ICSI" },
    own_egg_sperm_ivf: { en: "Own Egg & Sperm IVF", ru: "ЭКО с собственными клетками", es: "FIV con óvulos y esperma propios" },
    egg_donation_ivf: { en: "Egg Donation IVF", ru: "ЭКО с донорской яйцеклеткой", es: "FIV con óvulos donados" },
    sperm_donations_ivf: { en: "Sperm Donation IVF", ru: "ЭКО с донорской спермой", es: "FIV con esperma donado" },
    embryo_donations_ivf: { en: "Embryo Donation IVF", ru: "ЭКО с донорским эмбрионом", es: "FIV con embriones donados" },
    genetic_testing_ivf: { en: "Genetic Testing IVF", ru: "Генетическое тестирование ЭКО", es: "Pruebas genéticas FIV" },
    freezing: { en: "Freezing", ru: "Криоконсервация", es: "Criopreservación" },
    egg_freezing: { en: "Egg Freezing", ru: "Заморозка яйцеклеток", es: "Congelación de óvulos" },
    sperm_freezing: { en: "Sperm Freezing", ru: "Заморозка спермы", es: "Congelación de esperma" },
    embryo_freezing: { en: "Embryo Freezing", ru: "Заморозка эмбрионов", es: "Congelación de embriones" },
    iui_intrauterine: { en: "IUI - Intrauterine", ru: "ВМИ — внутриматочная", es: "Inseminación intrauterina" },
    ici_intracervical: { en: "ICI - Intracervical", ru: "ИЦИ — интрацервикальная", es: "Inseminación intracervical" },
    iutpi_tuboperitoneal: { en: "IUTPI - Tuboperitoneal", ru: "ИУТПИ — тубоперитонеальная", es: "Inseminación tuboperitoneal" },
    iti_intratubal: { en: "ITI - Intratubal", ru: "ИТИ — интратубарная", es: "Inseminación intratubárica" },
    women_over_46: { en: "Women over 46", ru: "Женщины старше 46 лет", es: "Mujeres mayores de 46 años" },
    hiv_positive_female: { en: "HIV+ Female", ru: "ВИЧ+ женщина", es: "Mujer VIH+" },
    hiv_positive_male: { en: "HIV+ Male", ru: "ВИЧ+ мужчина", es: "Hombre VIH+" },
    hepatitis_bc_female: { en: "Hepatitis B/C Female", ru: "Гепатит B/C женщина", es: "Mujer con hepatitis B/C" },
    hepatitis_bc_male: { en: "Hepatitis B/C Male", ru: "Гепатит B/C мужчина", es: "Hombre con hepatitis B/C" },
  };
  const practiceOrder = ["assisted_reproduction", "contested_adoption", "domestic_adoption", "icpc_adoption", "intercountry_adoption", "lgbtq_family_formation", "private_networking", "egg_donation", "embryo_donation", "sperm_donation", "surrogacy", "grandparent_representation", "special_needs_children", "mediation"];
  const rowData = (item: Row) => item.data && typeof item.data === "object" ? item.data as Row : {};
  const cleanText = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
  const tagKey = (tag: unknown) => cleanText(typeof tag === "object" && tag ? (tag as Row).slug ?? (tag as Row).value ?? (tag as Row).name ?? (tag as Row).label : tag).toLowerCase().replace(/[\s-]+/g, "_");
  const tagLabel = (tag: unknown) => {
    const key = tagKey(tag);
    const raw = typeof tag === "object" && tag ? (tag as Row).label ?? (tag as Row).name ?? (tag as Row).slug ?? (tag as Row).value : tag;
    return tagTranslations[key]?.[locale] || cleanText(raw);
  };
  const itemTags = (item: Row) => {
    const data = rowData(item);
    const value = kind === "lawyers" ? item.practiceAreas ?? data.practiceAreas : item.services ?? data.services;
    return Array.isArray(value) ? value : [];
  };
  const cardTags = (item: Row) => {
    const tags = itemTags(item);
    if (kind !== "clinics") return tags.slice(0, 5);
    return tags.map((tag, index) => ({ tag, index }))
      .sort((left, right) => (clinicCardServicePriority.get(tagKey(left.tag)) ?? 999) - (clinicCardServicePriority.get(tagKey(right.tag)) ?? 999) || left.index - right.index)
      .slice(0, 5)
      .map((entry) => entry.tag);
  };
  const itemSlug = (item: Row) => cleanText(item.slug ?? rowData(item).slug ?? item.id);
  const itemImage = (item: Row) => {
    const data = rowData(item);
    const nestedLogo = data.logo && typeof data.logo === "object" ? data.logo as Row : {};
    const nestedPhoto = data.photo && typeof data.photo === "object" ? data.photo as Row : {};
    const nestedImage = data.image && typeof data.image === "object" ? data.image as Row : {};
    return cleanText(item.logoUrl ?? item.photoUrl ?? item.imageUrl ?? data.logoUrl ?? data.photoUrl ?? data.imageUrl ?? nestedLogo.url ?? nestedPhoto.url ?? nestedImage.url ?? (data.logoStorageKey ? `/uploads/${cleanText(data.logoStorageKey).replace(/^\/+/, "")}` : ""));
  };
  const itemWebsite = (item: Row) => {
    const data = rowData(item);
    const contact = item.contact && typeof item.contact === "object" ? item.contact as Row : {};
    return cleanText(contact.website ?? item.website ?? data.website);
  };
  const countryName = (code: unknown) => {
    const value = cleanText(code).toUpperCase();
    if (!value) return "";
    try { return new Intl.DisplayNames([locale], { type: "region" }).of(value) || value; } catch { return value; }
  };
  const locationCountryName = (code: unknown) => ({ US: "USA", GB: "UK", AE: "UAE" }[cleanText(code).toUpperCase()] || countryName(code));
  const itemLocation = (item: Row) => {
    const data = rowData(item);
    return cleanText(data.location ?? item.location) || [cleanText(item.city ?? data.city), cleanText(item.state ?? data.state), locationCountryName(item.country ?? data.country)].filter(Boolean).join(", ");
  };
  const plainText = (value: unknown) => {
    const element = document.createElement("div");
    element.innerHTML = cleanText(value).replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div)>/gi, (match) => `${match}\n`);
    return cleanText(element.textContent).split(/\n+/).map((part) => part.trim()).filter(Boolean).join(" ");
  };
  const itemExcerpt = (item: Row) => plainText(item.aboutHtml ?? rowData(item).aboutHtml);
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const countries = Array.isArray(options.countries) ? (options.countries as Row[]).slice().sort((a, b) => countryName(a.value).localeCompare(countryName(b.value), locale)) : [];
  const filterChoices = Array.isArray(kind === "lawyers" ? options.practiceAreas : options.serviceCategories)
    ? ((kind === "lawyers" ? options.practiceAreas : options.serviceCategories) as Row[]).slice().sort((a, b) => {
      if (kind !== "lawyers") return 0;
      return (practiceOrder.indexOf(tagKey(a)) < 0 ? 999 : practiceOrder.indexOf(tagKey(a))) - (practiceOrder.indexOf(tagKey(b)) < 0 ? 999 : practiceOrder.indexOf(tagKey(b)));
    }) : [];
  const countryLabel = (value: string) => {
    const option = countries.find((item) => cleanText(item.value) === value);
    return option ? `${countryName(option.value)}${Number(option.count || 0) ? ` (${Number(option.count)})` : ""}` : copy.anyCountry;
  };
  const languageName = (value: string) => {
    try { return new Intl.DisplayNames([locale], { type: "language" }).of(value) || value.toUpperCase(); } catch { return value.toUpperCase(); }
  };
  const languageValues = new Set(referenceLanguageCodes);
  if (Array.isArray(options.languages)) (options.languages as Row[]).forEach((item) => languageValues.add(cleanText(item.value).toLowerCase()));
  const languages = [...languageValues].filter(Boolean).sort((a, b) => languageName(a).localeCompare(languageName(b), locale));
  const languageLabel = (value: string) => value ? languageName(value) : copy.anyLanguage;
  const activeFilterCount = selections.length + (country ? 1 : 0) + (kind === "clinics" && language ? 1 : 0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(q.trim()), 500);
    return () => window.clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(stateKey, JSON.stringify({ q, country, language, selections }));
    } catch {
      // Session storage is optional; the directory remains fully functional without it.
    }
  }, [stateKey, q, country, language, selections.join("|")]);
  useEffect(() => {
    api.get<Row>(`/public/${kind}/options?locale=${encodeURIComponent(locale)}`).then(setOptions).catch(() => setOptions({}));
  }, [kind, locale]);
  useEffect(() => {
    api.get<Row>("/member/favourites").then((data) => {
      const rows = Array.isArray(data[kind]) ? data[kind] as Row[] : [];
      setFavourites(new Set(rows.map((item) => cleanText(item.id))));
    }).catch(() => undefined);
  }, [kind]);
  useEffect(() => {
    setCountryInput(countryLabel(country));
  }, [country, options]);
  useEffect(() => {
    setLanguageInput(languageLabel(language));
  }, [language, options, locale]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!countryPickerRef.current?.contains(event.target as Node)) setCountryOpen(false);
      if (!languagePickerRef.current?.contains(event.target as Node)) setLanguageOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    document.body.classList.toggle("reference-filters-open", mobileFiltersOpen);
    return () => document.body.classList.remove("reference-filters-open");
  }, [mobileFiltersOpen]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "12", offset: "0" });
    if (search) params.set("q", search);
    if (country) params.set("country", country);
    if (kind === "clinics" && language) params.set("language", language);
    selections.forEach((value) => params.append(kind === "lawyers" ? "practiceArea" : "serviceCategory", value));
    api
      .get<Page<Row>>(`/public/${kind}?${params}`)
      .then((data) => {
        if (!alive) return;
        setItems(data.items || []);
        setHasMore(Boolean(data.hasMore ?? ((data.items?.length || 0) < Number(data.total || 0))));
      })
      .catch(() => alive && setError(copy.error))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [kind, search, country, language, selections.join("|")]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const started = Date.now();
    try {
      const params = new URLSearchParams({ limit: "12", offset: String(items.length) });
      if (search) params.set("q", search);
      if (country) params.set("country", country);
      if (kind === "clinics" && language) params.set("language", language);
      selections.forEach((value) => params.append(kind === "lawyers" ? "practiceArea" : "serviceCategory", value));
      const data = await api.get<Page<Row>>(`/public/${kind}?${params}`);
      const remaining = Math.max(0, 300 - (Date.now() - started));
      if (remaining) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setItems((current) => current.concat(data.items || []));
      setHasMore(Boolean(data.hasMore ?? (items.length + (data.items?.length || 0) < Number(data.total || 0))));
    } catch {
      setError(copy.error);
    } finally {
      setLoadingMore(false);
    }
  };
  const toggleFavourite = async (item: Row) => {
    const id = cleanText(item.id);
    if (!id || pendingFavourite.has(id)) return;
    const active = favourites.has(id);
    setPendingFavourite((current) => new Set(current).add(id));
    setFavourites((current) => {
      const next = new Set(current);
      if (active) next.delete(id); else next.add(id);
      return next;
    });
    try {
      if (active) await api.delete(`/member/favourites/${kind}/${encodeURIComponent(id)}`);
      else await api.post(`/member/favourites/${kind}/${encodeURIComponent(id)}`);
    } catch {
      setFavourites((current) => {
        const next = new Set(current);
        if (active) next.add(id); else next.delete(id);
        return next;
      });
    } finally {
      setPendingFavourite((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };
  const clearFilters = () => { setCountry(""); setLanguage(""); setSelections([]); };
  const openMobileFilters = () => { setDraftCountry(country); setDraftLanguage(language); setDraftSelections(selections); setMobileFiltersOpen(true); };
  const applyMobileFilters = () => { setCountry(draftCountry); setLanguage(draftLanguage); setSelections(draftSelections); setMobileFiltersOpen(false); };
  const icon = (name: "search" | "sliders" | "pin" | "globe" | "like" | "chevron" | "close") => {
    const paths = {
      search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
      sliders: <><path d="M10 5H3M12 19H3M14 3v4M16 17v4M21 12h-9M21 19h-5M21 5h-7M8 10v4M8 12H3" /></>,
      pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
      globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
      like: <><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /><path d="M7 10v12" /></>,
      chevron: <path d="m6 9 6 6 6-6" />,
      close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
    };
    return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
  };
  const filterFields = (mobile = false) => {
    const selectedCountry = mobile ? draftCountry : country;
    const selectedLanguage = mobile ? draftLanguage : language;
    const selectedChoices = mobile ? draftSelections : selections;
    const setSelectedCountry = mobile ? setDraftCountry : setCountry;
    const setSelectedLanguage = mobile ? setDraftLanguage : setLanguage;
    const setSelectedChoices = mobile ? setDraftSelections : setSelections;
    return <>
      <label className="reference-filter-label reference-country-filter">
        <span>{copy.country}</span>
        {mobile ? <select value={selectedCountry} onChange={(event) => setSelectedCountry(event.target.value)}>
          <option value="">{copy.anyCountry}</option>
          {countries.map((item) => <option key={cleanText(item.value)} value={cleanText(item.value)}>{countryLabel(cleanText(item.value))}</option>)}
        </select> : <div className="reference-country-picker" ref={countryPickerRef}>
          <input type="search" value={countryInput} aria-expanded={countryOpen} onFocus={(event) => { setCountryOpen(true); event.currentTarget.select(); }} onChange={(event) => { setCountryInput(event.target.value); setCountryOpen(true); }} />
          <span>{icon("chevron")}</span>
          {countryOpen ? <div className="reference-country-options" role="listbox">
            {[{ value: "", label: copy.anyCountry }, ...countries.map((item) => ({ value: cleanText(item.value), label: countryLabel(cleanText(item.value)) }))]
              .filter((item) => item.label.toLocaleLowerCase(locale).startsWith(countryInput.toLocaleLowerCase(locale)) || countryInput === countryLabel(country))
              .map((item) => <button className={item.value === country ? "selected" : ""} type="button" role="option" aria-selected={item.value === country} key={item.value || "any"} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCountry(item.value); setCountryInput(item.label); setCountryOpen(false); }}><span>{item.value === country ? "✓" : ""}</span><span>{item.label}</span></button>)}
          </div> : null}
        </div>}
      </label>
      <fieldset className="reference-filter-group">
        <legend>{kind === "lawyers" ? copy.practice : copy.services}</legend>
        {filterChoices.map((item) => {
          const value = cleanText(item.value ?? item.slug ?? item.name);
          return <label key={value}><input type="checkbox" value={value} checked={selectedChoices.includes(value)} onChange={() => setSelectedChoices((current) => current.includes(value) ? current.filter((entry) => entry !== value) : current.concat(value))} /><span>{tagLabel(item)}</span></label>;
        })}
      </fieldset>
      {kind === "clinics" ? <label className="reference-filter-label">
        <span>{copy.language}</span>
        {mobile ? <select value={selectedLanguage} onChange={(event) => setSelectedLanguage(event.target.value)}>
          <option value="">{copy.anyLanguage}</option>
          {languages.map((value) => <option key={value} value={value}>{languageName(value)}</option>)}
        </select> : <div className="reference-language-picker" ref={languagePickerRef}>
          <input type="search" value={languageInput} aria-expanded={languageOpen} onFocus={(event) => { setLanguageOpen(true); event.currentTarget.select(); }} onChange={(event) => { setLanguageInput(event.target.value); setLanguageOpen(true); }} />
          <span>{icon("chevron")}</span>
          {languageOpen ? <div className="reference-country-options" role="listbox">
            {[{ value: "", label: copy.anyLanguage }, ...languages.map((value) => ({ value, label: languageName(value) }))]
              .filter((item) => item.label.toLocaleLowerCase(locale).startsWith(languageInput.toLocaleLowerCase(locale)) || languageInput === languageLabel(language))
              .map((item) => <button className={item.value === language ? "selected" : ""} type="button" role="option" aria-selected={item.value === language} key={item.value || "any"} onMouseDown={(event) => event.preventDefault()} onClick={() => { setLanguage(item.value); setLanguageInput(item.label); setLanguageOpen(false); }}><span>{item.value === language ? "✓" : ""}</span><span>{item.label}</span></button>)}
          </div> : null}
        </div>}
      </label> : null}
    </>;
  };
  return (
    <section className="reference-directory">
      <div className="reference-directory-heading">
        <h1>{kind === "lawyers" ? copy.lawyersTitle : copy.clinicsTitle}</h1>
        <p>{kind === "lawyers" ? copy.lawyersLead : copy.clinicsLead}</p>
      </div>
      <div className="reference-directory-toolbar">
        <label className="reference-directory-search">
          {icon("search")}
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder={kind === "lawyers" ? copy.searchLawyers : copy.searchClinics} type="search" autoComplete="off" spellCheck={false} />
        </label>
        <button className="reference-mobile-filter-button" type="button" onClick={openMobileFilters}>{icon("sliders")}<span>{copy.filters}</span>{activeFilterCount ? <b>{activeFilterCount}</b> : null}</button>
      </div>
      <div className="reference-directory-columns">
        <section className="reference-directory-results" aria-busy={loading || loadingMore}>
          <div className="reference-directory-list-shell">
            <div className="reference-directory-grid">
              {items.map((item) => {
                const name = cleanText(item.name) || (kind === "lawyers" ? copy.lawyersTitle : copy.clinicsTitle);
                const href = `/${locale}/${kind}/${encodeURIComponent(itemSlug(item))}`;
                const image = itemImage(item);
                const website = itemWebsite(item);
                const excerpt = kind === "clinics" ? itemExcerpt(item) : "";
                const id = cleanText(item.id);
                const liked = favourites.has(id);
                return <article className="reference-directory-card" key={id || itemSlug(item)} role="link" tabIndex={0} onClick={(event) => { if ((event.target as HTMLElement).closest("a,button,input,label,select")) return; navigate(href); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate(href); }}>
                  <div className="reference-directory-card-link">
                    <Link className={`reference-directory-card-media ${kind}`} to={href}><span>{initials(name)}</span>{image ? <img src={image} alt="" loading="lazy" onError={(event) => event.currentTarget.remove()} /> : null}</Link>
                    <div className="reference-directory-card-content">
                      <h2><Link to={href}>{name}</Link></h2>
                      <p className="reference-directory-location">{icon("pin")}<span>{itemLocation(item)}</span>{website ? <a className="reference-website-label" href={website} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>{icon("globe")}<span>{copy.website}</span></a> : null}</p>
                      <div className="reference-directory-tags">{cardTags(item).map((tag, index) => <span key={`${tagKey(tag)}-${index}`}>{tagLabel(tag)}</span>)}</div>
                      {excerpt ? <p className="reference-directory-excerpt">{excerpt}</p> : null}
                    </div>
                  </div>
                  <button className="reference-favourite-button" type="button" disabled={pendingFavourite.has(id)} aria-pressed={liked} onClick={(event) => { event.stopPropagation(); void toggleFavourite(item); }}>{icon("like")}<span>{liked ? copy.liked : copy.like}</span></button>
                </article>;
              })}
            </div>
            {loading ? <div className="reference-directory-loading"><LoadingIndicator /></div> : null}
          </div>
          {!loading && !items.length && !error ? <div className="reference-directory-empty">{kind === "lawyers" ? copy.noLawyers : copy.noClinics}</div> : null}
          {error ? <p className="reference-directory-status">{error}</p> : null}
          {hasMore && items.length ? <button className="reference-load-more" type="button" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? copy.loading : copy.loadMore}</button> : null}
        </section>
        <aside className="reference-directory-filters">
          <div className="reference-filter-head"><h2>{copy.filters}</h2>{activeFilterCount ? <button type="button" onClick={clearFilters}>{copy.clear}</button> : null}</div>
          {filterFields(false)}
        </aside>
      </div>
      {mobileFiltersOpen ? <>
        <button className="reference-filter-backdrop" aria-label={copy.clear} type="button" onClick={() => setMobileFiltersOpen(false)} />
        <aside className="reference-mobile-filter-sheet" role="dialog" aria-modal="true" aria-label={copy.filters}>
          <div className="reference-mobile-filter-header"><h2>{copy.filters}</h2>{draftCountry || draftLanguage || draftSelections.length ? <button className="reference-mobile-filter-clear" type="button" onClick={() => { setDraftCountry(""); setDraftLanguage(""); setDraftSelections([]); }}>{copy.clear}</button> : null}<button className="reference-filter-close" type="button" aria-label="Close" onClick={() => setMobileFiltersOpen(false)}>{icon("close")}</button></div>
          {filterFields(true)}
          <button className="reference-filter-apply" type="button" onClick={applyMobileFilters}>{copy.apply}</button>
        </aside>
      </> : null}
    </section>
  );
}

type DirectoryDetailIconName =
  | "arrow"
  | "award"
  | "building"
  | "clock"
  | "external"
  | "facebook"
  | "globe"
  | "instagram"
  | "languages"
  | "linkedin"
  | "mail"
  | "phone"
  | "pin"
  | "printer";

function DirectoryDetailIcon({ name }: { name: DirectoryDetailIconName }) {
  const content: Record<DirectoryDetailIconName, ReactNode> = {
    arrow: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
    award: <><path d="M8.2 13.7 7 22l5-3 5 3-1.2-8.3" /><circle cx="12" cy="8" r="6" /></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M9 21v-5h6v5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    external: <><path d="M14 3h7v7M10 14 21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></>,
    facebook: <path d="M14 8h3V4h-3a5 5 0 0 0-5 5v3H6v4h3v6h4v-6h3l1-4h-4V9a1 1 0 0 1 1-1Z" />,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".5" fill="currentColor" stroke="none" /></>,
    languages: <path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6" />,
    linkedin: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 10v7M8 7v.01M12 17v-4a3 3 0 0 1 6 0v4M12 10v7" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.4 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
    printer: <><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24">{content[name]}</svg>;
}

function DirectoryDetail({ kind }: { kind: "clinics" | "lawyers" }) {
  const { slug = "" } = useParams();
  const locale = localeOf();
  const [item, setItem] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const copy = {
    en: {
      backLawyers: "Back to lawyers", backClinics: "Back to clinics", contacts: "Contacts", about: "About",
      clinicAbout: "About the clinic", hours: "Working hours", languages: "Languages", services: "Services",
      practice: "Practice areas", website: "Visit website", fax: "Fax", otherServices: "Other services",
      error: "Could not load the directory. Please try again.",
    },
    ru: {
      backLawyers: "Назад к юристам", backClinics: "Назад к клиникам", contacts: "Контакты", about: "О компании",
      clinicAbout: "О клинике", hours: "Часы работы", languages: "Языки", services: "Услуги",
      practice: "Области практики", website: "Перейти на сайт", fax: "Факс", otherServices: "Другие услуги",
      error: "Не удалось загрузить каталог. Попробуйте ещё раз.",
    },
    es: {
      backLawyers: "Volver a abogados", backClinics: "Volver a clínicas", contacts: "Contactos", about: "Acerca de",
      clinicAbout: "Sobre la clínica", hours: "Horario", languages: "Idiomas", services: "Servicios",
      practice: "Áreas de práctica", website: "Visitar sitio web", fax: "Fax", otherServices: "Otros servicios",
      error: "No se pudo cargar el directorio.",
    },
  }[locale];
  useEffect(() => {
    let active = true;
    setItem(null);
    setError("");
    api
      .get<Row>(`/public/${kind}/${encodeURIComponent(slug)}`)
      .then((result) => {
        if (!active) return;
        setItem(typeof result === "string" ? JSON.parse(result) as Row : result);
      })
      .catch(() => { if (active) setError(copy.error); });
    return () => { active = false; };
  }, [copy.error, kind, slug]);

  const backLabel = kind === "lawyers" ? copy.backLawyers : copy.backClinics;
  if (error) return <section className="reference-directory-detail"><Link className="detail-back" to={`/${locale}/${kind}`}><DirectoryDetailIcon name="arrow" />{backLabel}</Link><p>{error}</p></section>;
  if (!item) return <div className="reference-directory-detail directory-detail-pending"><div className="directory-detail-loader"><LoadingIndicator /></div></div>;

  const data = (item.data ?? {}) as Row;
  const contact = (item.contact && typeof item.contact === "object" ? item.contact : {}) as Row;
  const text = (value: unknown) => value === null || value === undefined ? "" : String(value).trim();
  const list = (value: unknown) => Array.isArray(value) ? value : [];
  const name = text(item.name ?? data.name);
  const initials = (name || (kind === "clinics" ? "C" : "L")).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const image = [item.logoUrl, item.logourl, item.photoUrl, item.imageUrl, data.logoUrl, data.photoUrl, data.imageUrl]
    .map(text)
    .find((value) => value && !/^(?:null|none|undefined)$/i.test(value)) || "";
  const countryCode = text(item.country ?? data.country).toUpperCase();
  const displayCountry = (code: string, displayLocale = locale) => {
    if (!code) return "";
    if (displayLocale === "en" && code === "US") return "USA";
    try { return new Intl.DisplayNames([displayLocale], { type: "region" }).of(code) || code; } catch { return code; }
  };
  const locationLabel = kind === "clinics"
    ? [text(item.city ?? data.city), text(item.region ?? data.region), displayCountry(countryCode, "en")].filter(Boolean).join(", ")
    : text(item.location ?? data.location) || [text(item.city ?? data.city), text(item.state ?? data.state), displayCountry(countryCode)].filter(Boolean).join(", ");
  const latitude = Number(item.latitude ?? data.latitude);
  const longitude = Number(item.longitude ?? data.longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;
  const languages = list(item.languages ?? data.languages).map((value) => text(typeof value === "object" && value ? (value as Row).name ?? (value as Row).code : value)).filter(Boolean);
  const nativeLanguageName = (code: string) => {
    if (!/^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(code)) return code;
    const normalized = code.toLowerCase();
    try {
      const label = new Intl.DisplayNames([normalized.split("-")[0]], { type: "language" }).of(normalized) || normalized;
      return label.charAt(0).toUpperCase() + label.slice(1);
    } catch { return normalized.toUpperCase(); }
  };
  const localizedLanguageName = (code: string) => {
    if (!/^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(code)) return code;
    try { return new Intl.DisplayNames([locale], { type: "language" }).of(code.toLowerCase()) || code; } catch { return code.toUpperCase(); }
  };
  const localizedTags: Partial<Record<CookieLocale, Record<string, string>>> = {
    ru: {
      ivf: "ЭКО", icsi_ivf: "ИКСИ ЭКО", own_egg_sperm_ivf: "ЭКО с собственными клетками", egg_donation_ivf: "ЭКО с донорской яйцеклеткой",
      sperm_donations_ivf: "ЭКО с донорской спермой", embryo_donations_ivf: "ЭКО с донорским эмбрионом", genetic_testing_ivf: "Генетическое тестирование ЭКО",
      freezing: "Криоконсервация", egg_freezing: "Заморозка яйцеклеток", sperm_freezing: "Заморозка спермы", embryo_freezing: "Заморозка эмбрионов",
      iui_intrauterine: "ВМИ — внутриматочная", ici_intracervical: "ИЦИ — интрацервикальная", iutpi_tuboperitoneal: "ИУТПИ — тубоперитонеальная",
      iti_intratubal: "ИТИ — интратубарная", women_over_46: "Женщины старше 46 лет", hiv_positive_female: "ВИЧ+ женщина", hiv_positive_male: "ВИЧ+ мужчина",
      hepatitis_bc_female: "Гепатит B/C женщина", hepatitis_bc_male: "Гепатит B/C мужчина",
    },
    es: {
      ivf: "FIV", icsi_ivf: "FIV ICSI", egg_donation_ivf: "FIV con óvulos donados", sperm_donations_ivf: "FIV con esperma donado",
      embryo_donations_ivf: "FIV con embriones donados", freezing: "Criopreservación", egg_freezing: "Congelación de óvulos", sperm_freezing: "Congelación de esperma",
      embryo_freezing: "Congelación de embriones", iui_intrauterine: "Inseminación intrauterina", women_over_46: "Mujeres mayores de 46 años",
      hiv_positive_female: "Mujer VIH+", hiv_positive_male: "Hombre VIH+", hepatitis_bc_female: "Mujer con hepatitis B/C", hepatitis_bc_male: "Hombre con hepatitis B/C",
    },
  };
  const tagKey = (tag: unknown) => {
    const value = typeof tag === "object" && tag ? (tag as Row).slug ?? (tag as Row).value ?? (tag as Row).name ?? (tag as Row).label : tag;
    return text(value).toLowerCase().replace(/[\s-]+/g, "_");
  };
  const tagLabel = (tag: unknown) => localizedTags[locale]?.[tagKey(tag)] || text(typeof tag === "object" && tag ? (tag as Row).label ?? (tag as Row).name ?? (tag as Row).slug ?? (tag as Row).value : tag);
  const tags = list(kind === "clinics" ? item.services ?? data.services : item.practiceAreas ?? data.practiceAreas);
  const serviceGroups = [
    { key: "ivf_treatments", slugs: ["ivf", "icsi_ivf", "egg_donation_ivf", "sperm_donations_ivf", "genetic_testing_ivf", "own_egg_sperm_ivf", "embryo_donations_ivf"] },
    { key: "fertility_preservation", slugs: ["freezing", "egg_freezing", "sperm_freezing", "embryo_freezing"] },
    { key: "artificial_insemination", slugs: ["iui_intrauterine", "ici_intracervical", "iutpi_tuboperitoneal", "iti_intratubal"] },
    { key: "special_situations", slugs: ["women_over_46", "hiv_positive_female", "hiv_positive_male", "hepatitis_bc_male", "hepatitis_bc_female"] },
  ];
  const serviceGroupLabels = {
    en: { ivf_treatments: "IVF treatments", fertility_preservation: "Fertility preservation", artificial_insemination: "Artificial insemination", special_situations: "Special situations" },
    ru: { ivf_treatments: "ЭКО процедуры", fertility_preservation: "Сохранение фертильности", artificial_insemination: "Искусственная инсеминация", special_situations: "Особые случаи" },
    es: { ivf_treatments: "Tratamientos de FIV", fertility_preservation: "Preservación de la fertilidad", artificial_insemination: "Inseminación artificial", special_situations: "Situaciones especiales" },
  }[locale];
  const remainingTags = new Map(tags.map((tag) => [tagKey(tag), tag]));
  const groupedServices = serviceGroups.map((group) => {
    const groupTags = group.slugs.map((serviceSlug) => remainingTags.get(serviceSlug)).filter((tag): tag is unknown => Boolean(tag));
    groupTags.forEach((tag) => remainingTags.delete(tagKey(tag)));
    return { ...group, tags: groupTags };
  }).filter((group) => group.tags.length);
  if (remainingTags.size) groupedServices.push({ key: "other_services", slugs: [], tags: [...remainingTags.values()] });
  const htmlBlocks = (value: unknown) => {
    const element = document.createElement("div");
    element.innerHTML = text(value).replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "</p>\n").replace(/<\/div>/gi, "</div>\n");
    return text(element.textContent).split(/\n+/).map((part) => part.trim()).filter(Boolean);
  };
  const aboutBlocks = htmlBlocks(item.aboutHtml ?? item.about ?? data.aboutHtml ?? data.about);
  const website = text(contact.website ?? item.website ?? data.website);
  const phone = text(contact.phone ?? item.phone ?? data.phone ?? data.phoneNumber);
  const fax = text(contact.fax ?? item.fax ?? data.fax);
  const email = text(contact.email ?? item.email ?? data.email);
  const baseAddress = text(contact.location ?? contact.address ?? item.location ?? data.location ?? data.address);
  const addressParts = baseAddress ? [baseAddress] : [];
  const englishCountry = displayCountry(countryCode, "en");
  const localizedCountry = displayCountry(countryCode);
  [text(item.city ?? data.city), text(contact.state ?? item.state ?? data.state), text(contact.zip ?? item.zip ?? data.zip), localizedCountry].forEach((part) => {
    const haystack = addressParts.join(", ").toLocaleLowerCase();
    if (part && !haystack.includes(part.toLocaleLowerCase()) && !(part === localizedCountry && englishCountry && haystack.includes(englishCountry.toLocaleLowerCase()))) addressParts.push(part);
  });
  const address = addressParts.join(", ") || locationLabel;
  const hours = text(item.hours ?? data.hours);
  const socials: Array<[DirectoryDetailIconName, string, string]> = [
    ["instagram", text(contact.instagramUrl ?? item.instagramUrl ?? data.instagramUrl), "Instagram"],
    ["linkedin", text(contact.linkedinUrl ?? item.linkedinUrl ?? data.linkedinUrl), "LinkedIn"],
    ["facebook", text(contact.facebookUrl ?? item.facebookUrl ?? data.facebookUrl), "Facebook"],
  ].filter((entry) => Boolean(entry[1])) as Array<[DirectoryDetailIconName, string, string]>;

  return (
    <article className="reference-directory-detail">
      <Link className="detail-back" to={`/${locale}/${kind}`}><DirectoryDetailIcon name="arrow" />{backLabel}</Link>
      <div className="detail-identity">
        <div className={`detail-image detail-image-${kind}`}><span>{initials}</span>{image ? <img src={image} alt="" onError={(event) => event.currentTarget.remove()} /> : null}</div>
        <div>
          <h1>{name}</h1>
          {locationLabel ? hasCoordinates
            ? <a className="detail-location" href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer"><DirectoryDetailIcon name="pin" /><span>{locationLabel}</span></a>
            : <p className="detail-location"><DirectoryDetailIcon name="pin" /><span>{locationLabel}</span></p>
            : null}
          {kind === "clinics" && languages.length ? <p className="detail-language"><DirectoryDetailIcon name="languages" /><span>{languages.map(nativeLanguageName).join(", ")}</span></p> : null}
        </div>
      </div>
      <div className="detail-columns">
        <div>
          {tags.length ? <section className="directory-detail-section services-section">
            <h2><DirectoryDetailIcon name="award" /><span>{kind === "lawyers" ? copy.practice : copy.services}</span></h2>
            {kind === "clinics" ? <div className="clinic-service-groups">{groupedServices.map((group) => <div className="clinic-service-group" key={group.key}>
              <h3>{group.key === "other_services" ? copy.otherServices : serviceGroupLabels[group.key as keyof typeof serviceGroupLabels]}</h3>
              <div className="reference-directory-tags detail-tags">{group.tags.map((tag, index) => <span key={`${tagKey(tag)}-${index}`}>{tagLabel(tag)}</span>)}</div>
            </div>)}</div> : <div className="reference-directory-tags detail-tags">{tags.map((tag, index) => <span key={`${tagKey(tag)}-${index}`}>{tagLabel(tag)}</span>)}</div>}
          </section> : null}
          {aboutBlocks.length ? <section className="directory-detail-section about-section">
            <h2>{kind === "clinics" ? <DirectoryDetailIcon name="building" /> : null}<span>{kind === "clinics" ? copy.clinicAbout : copy.about}</span></h2>
            {aboutBlocks.map((paragraph, index) => <p className="detail-copy" key={index}>{paragraph}</p>)}
          </section> : null}
          {kind === "lawyers" && languages.length ? <section className="directory-detail-section languages-section">
            <h2><span>{copy.languages}</span></h2>
            <div className="reference-directory-tags detail-tags">{languages.map((language) => <span key={language}>{localizedLanguageName(language)}</span>)}</div>
          </section> : null}
        </div>
        <aside>
          {website || phone || fax || email || address ? <section className="directory-detail-section contact-section">
            <h3><span>{copy.contacts}</span></h3>
            <div className="contact-list">
              {website ? <a href={website} target="_blank" rel="noopener noreferrer"><DirectoryDetailIcon name="globe" /><span>{copy.website}</span><DirectoryDetailIcon name="external" /></a> : null}
              {phone ? <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}><DirectoryDetailIcon name="phone" /><span>{phone}</span></a> : null}
              {fax ? <p className="contact-muted"><DirectoryDetailIcon name="printer" /><span>{copy.fax}: {fax}</span></p> : null}
              {email ? <a href={`mailto:${email}`}><DirectoryDetailIcon name="mail" /><span>{email}</span></a> : null}
              {address ? <p><DirectoryDetailIcon name="pin" /><span>{address}</span></p> : null}
            </div>
          </section> : null}
          {socials.length ? <section className="directory-detail-section social-section"><div className="detail-socials">{socials.map(([iconName, href, label]) => <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} key={label}><DirectoryDetailIcon name={iconName} /></a>)}</div></section> : null}
          {hours ? <section className="directory-detail-section hours-section"><h3><DirectoryDetailIcon name="clock" /><span>{copy.hours}</span></h3><p className="detail-copy">{hours}</p></section> : null}
        </aside>
      </div>
    </article>
  );
}

type CatalogFilters = {
  country: string[];
  city: string;
  profileTypes: string[];
  donorTypes: string[];
  lookingFor: string[];
  verifiedOnly: boolean;
  ageMin: string;
  ageMax: string;
  ethnicity: string;
  hairColor: string;
  eyeColor: string;
  education: string;
  religion: string;
};

type CatalogOption = { value: string; label: string; icon?: string };

const CATALOG_COPY = {
  en: {
    browse: "Browse profiles", collections: "Collections", all: "All", day: "day", days: "days", month: "month",
    filters: "Filters", allFilters: "All filters", closeFilters: "Close filters", clear: "Clear all", apply: "Apply filters",
    country: "Country", city: "City", anyCountry: "Any country", cityFirst: "Select a single country to filter by city",
    profileType: "Profile type", donor: "Donor", lookingFor: "Looking for", allTypes: "All types",
    matches: "Matches profiles that fit any of these options", verified: "Verified only", age: "Age", from: "From", to: "To",
    ethnicity: "Ethnicity", hair: "Hair color", eye: "Eye color", education: "Education", religion: "Religion",
    premium: "Premium only", search: "Search...", none: "No options found", noProfiles: "No profiles found", noProfilesHelp: "Try changing or clearing the filters.",
    loadMore: "Load more", loading: "Loading ...", locationHidden: "Location hidden", message: "Message", like: "Like", liked: "Liked",
    ageError: "Minimum age cannot be greater than maximum age.", failed: "Could not load the catalog.", actionFailed: "This action could not be completed.",
  },
  ru: {
    browse: "Каталог профилей", collections: "Коллекции", all: "Все", day: "день", days: "дней", month: "месяц",
    filters: "Фильтры", allFilters: "Все фильтры", closeFilters: "Закрыть фильтры", clear: "Очистить всё", apply: "Применить фильтры",
    country: "Страна", city: "Город", anyCountry: "Любая страна", cityFirst: "Сначала выберите одну страну",
    profileType: "Тип профиля", donor: "Донор", lookingFor: "Ищет", allTypes: "Все типы",
    matches: "Показываем анкеты, соответствующие любому из выбранных вариантов", verified: "Только подтверждённые", age: "Возраст", from: "От", to: "До",
    ethnicity: "Этническая принадлежность", hair: "Цвет волос", eye: "Цвет глаз", education: "Образование", religion: "Религия",
    premium: "Только Premium", search: "Поиск...", none: "Варианты не найдены", noProfiles: "Анкеты не найдены", noProfilesHelp: "Измените или очистите фильтры.",
    loadMore: "Показать ещё", loading: "Загрузка ...", locationHidden: "Местоположение скрыто", message: "Написать", like: "Нравится", liked: "Liked",
    ageError: "Минимальный возраст не может быть больше максимального.", failed: "Не удалось загрузить каталог.", actionFailed: "Не удалось выполнить действие.",
  },
  es: {
    browse: "Explorar perfiles", collections: "Colecciones", all: "Todos", day: "día", days: "días", month: "mes",
    filters: "Filtros", allFilters: "Todos los filtros", closeFilters: "Cerrar filtros", clear: "Borrar todo", apply: "Aplicar filtros",
    country: "País", city: "Ciudad", anyCountry: "Cualquier país", cityFirst: "Selecciona primero un país",
    profileType: "Tipo de perfil", donor: "Donante", lookingFor: "Busca", allTypes: "Todos los tipos",
    matches: "Muestra perfiles que coincidan con cualquiera de estas opciones", verified: "Solo verificados", age: "Edad", from: "Desde", to: "Hasta",
    ethnicity: "Origen étnico", hair: "Color de pelo", eye: "Color de ojos", education: "Educación", religion: "Religión",
    premium: "Solo Premium", search: "Buscar...", none: "No se encontraron opciones", noProfiles: "No se encontraron perfiles", noProfilesHelp: "Cambia o borra los filtros.",
    loadMore: "Mostrar más", loading: "Cargando ...", locationHidden: "Ubicación oculta", message: "Escribir", like: "Me gusta", liked: "Liked",
    ageError: "La edad mínima no puede superar la máxima.", failed: "No se pudo cargar el catálogo.", actionFailed: "No se pudo completar la acción.",
  },
} satisfies Record<CookieLocale, Record<string, string>>;

const CATALOG_ENUM_OPTIONS: Record<string, CatalogOption[]> = {
  profileTypes: [
    { value: "SINGLE_WOMAN", label: "Single Woman" }, { value: "SINGLE_MAN", label: "Single Man" },
    { value: "HETERO_COUPLE", label: "Heterosexual Couple" }, { value: "LESBIAN_COUPLE", label: "Lesbian Couple" },
    { value: "GAY_COUPLE", label: "Gay Couple" },
  ],
  donorTypes: [
    { value: "SPERM", label: "Sperm Donor", icon: "🧬" }, { value: "EGG", label: "Egg Donor", icon: "🥚" },
  ],
  lookingFor: [
    { value: "SPERM_DONOR", label: "Sperm donor" }, { value: "EGG_DONOR", label: "Egg donor" },
    { value: "CO_PARENTING_PARTNER", label: "Co-parenting partner" },
  ],
  ethnicity: [
    { value: "CAUCASIAN_WHITE", label: "Caucasian / White" }, { value: "AFRICAN_AMERICAN_BLACK", label: "African American / Black" },
    { value: "HISPANIC_LATINO", label: "Hispanic / Latino" }, { value: "ASIAN_EAST", label: "East Asian" },
    { value: "ASIAN_SOUTH", label: "South Asian" }, { value: "MIXED_MULTIRACIAL", label: "Mixed / Multiracial" },
  ],
  hairColor: [
    { value: "BLONDE", label: "Blonde" }, { value: "LIGHT_BROWN", label: "Light brown" },
    { value: "DARK_BROWN", label: "Dark brown" }, { value: "BLACK", label: "Black" }, { value: "RED", label: "Red" },
  ],
  eyeColor: [
    { value: "GREY", label: "Grey" }, { value: "BLUE", label: "Blue" }, { value: "GREEN", label: "Green" },
    { value: "BROWN_HAZEL", label: "Brown / hazel" }, { value: "BLACK", label: "Black" },
  ],
  education: [
    { value: "HIGH_SCHOOL", label: "High school" }, { value: "VOCATIONAL", label: "Vocational" },
    { value: "BACHELORS", label: "Bachelor's degree" }, { value: "MASTERS", label: "Master's degree" }, { value: "PHD", label: "PhD" },
  ],
  religion: [
    { value: "CHRISTIAN_ORTHODOX", label: "Christian Orthodox" }, { value: "CHRISTIAN_CATHOLIC", label: "Christian Catholic" },
    { value: "JEWISH_SECULAR", label: "Jewish Secular" }, { value: "SPIRITUAL", label: "Spiritual" },
    { value: "NOT_RELIGIOUS", label: "Not religious" },
  ],
};

const emptyCatalogFilters = (): CatalogFilters => ({
  country: [], city: "", profileTypes: [], donorTypes: [], lookingFor: [], verifiedOnly: false,
  ageMin: "", ageMax: "", ethnicity: "", hairColor: "", eyeColor: "", education: "", religion: "",
});

const catalogText = (value: unknown, fallback = "") =>
  value === null || value === undefined || value === "" ? fallback : String(value);

const catalogBoolean = (value: unknown) =>
  typeof value === "boolean" ? value : ["1", "true", "yes", "active"].includes(String(value || "").toLowerCase());

const catalogList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

const catalogData = (item: Row): Row =>
  item.data && typeof item.data === "object" && !Array.isArray(item.data) ? item.data as Row : {};

const catalogOptionLabel = (field: string, value: unknown) => {
  const token = String(value || "").toUpperCase();
  return CATALOG_ENUM_OPTIONS[field]?.find((option) => option.value === token)?.label
    || token.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const catalogPhotoUrls = (item: Row) => {
  const data = catalogData(item);
  const urls: string[] = [];
  const add = (value: unknown) => {
    const url = typeof value === "string"
      ? value.trim()
      : value && typeof value === "object"
        ? catalogText((value as Row).publicUrl ?? (value as Row).url)
        : "";
    if (url && url !== "—" && !urls.includes(url)) urls.push(url);
  };
  if (Array.isArray(item.photos)) item.photos.forEach(add);
  else catalogList(item.photos).forEach(add);
  if (Array.isArray(data.photos)) data.photos.forEach(add);
  [item.avatarUrl, data.avatarUrl, item.photoUrl, data.photoUrl].forEach(add);
  return urls;
};

const catalogProfileType = (item: Row) => {
  const data = catalogData(item);
  const value = data.profileType ?? item.profileType ?? item.role;
  return catalogOptionLabel("profileTypes", value === "USER" ? "SINGLE_MAN" : value);
};

const activeCatalogFilterCount = (filters: CatalogFilters) => [
  filters.country.length > 0, Boolean(filters.city), filters.profileTypes.length > 0,
  filters.donorTypes.length > 0, filters.lookingFor.length > 0, filters.verifiedOnly,
  Boolean(filters.ageMin || filters.ageMax), Boolean(filters.ethnicity), Boolean(filters.hairColor),
  Boolean(filters.eyeColor), Boolean(filters.education), Boolean(filters.religion),
].filter(Boolean).length;

function CatalogCard({
  item,
  locale,
  onLike,
  onMessage,
}: {
  item: Row;
  locale: CookieLocale;
  onLike: (item: Row) => void;
  onMessage: (item: Row) => void;
}) {
  const copy = CATALOG_COPY[locale];
  const data = catalogData(item);
  const photos = catalogPhotoUrls(item);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [failedPhotoUrls, setFailedPhotoUrls] = useState<Set<string>>(() => new Set());
  const name = catalogText(item.displayName ?? data.displayName, "LetsBeParents member");
  const age = catalogText(item.age ?? data.age);
  const location = [item.city ?? data.city, item.countryName ?? data.countryName ?? item.country ?? data.country]
    .filter(Boolean).map(String).join(", ");
  const donorTypes = catalogList(item.donorType ?? data.donorType);
  const lookingFor = catalogList(item.lookingFor ?? data.lookingFor ?? item.recipientType ?? data.recipientType);
  const verified = catalogBoolean(item.isVerified ?? data.isVerified);
  const liked = catalogBoolean(item.likedByViewer ?? data.likedByViewer);
  const id = catalogText(item.id ?? data.id);
  const detailPath = `/${locale}/catalog/${encodeURIComponent(id)}`;
  const title = age ? `${name}, ${age}` : name;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const activePhoto = photos[photoIndex];
  const movePhoto = (direction: number) => setPhotoIndex((current) => (current + direction + photos.length) % photos.length);
  return (
    <article className="catalog-profile-card">
      <div className="catalog-photo-stage">
        <div className="catalog-photo-frame">
          {activePhoto && !failedPhotoUrls.has(activePhoto) ? (
            <img
              src={activePhoto}
              alt={name}
              loading="lazy"
              onError={() => setFailedPhotoUrls((current) => new Set(current).add(activePhoto))}
            />
          ) : <div className="catalog-photo-fallback">{initials}</div>}
          <Link className="catalog-photo-link" to={detailPath} aria-label={name} />
          <div className="catalog-card-tags">
            <span>{catalogProfileType(item)}</span>
            {donorTypes.map((value) => (
              <span key={value}>{value.toUpperCase().includes("SPERM") ? "🧬 " : value.toUpperCase().includes("EGG") ? "🥚 " : ""}{catalogOptionLabel("donorTypes", value)}</span>
            ))}
          </div>
          <div className="catalog-card-actions">
            <button type="button" aria-label={`${copy.message} ${name}`} onClick={() => onMessage(item)}>
              <svg className="catalog-message-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" /></svg>
            </button>
            <button type="button" className={liked ? "active" : ""} aria-label={`${liked ? copy.liked : copy.like} ${name}`} aria-pressed={liked} onClick={() => { if (!liked) onLike(item); }}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /><path d="M7 10v12" /></svg>
            </button>
          </div>
          {photos.length > 1 && (
            <>
              <button className="catalog-carousel-arrow previous" type="button" aria-label="Previous photo" onClick={() => movePhoto(-1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <button className="catalog-carousel-arrow next" type="button" aria-label="Next photo" onClick={() => movePhoto(1)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            </>
          )}
        </div>
        <div className={`catalog-card-dots${photos.length > 1 ? "" : " empty"}`} aria-hidden={photos.length <= 1}>
          {photos.map((_, index) => (
            <button key={index} type="button" className={index === photoIndex ? "active" : ""} aria-label={`Show photo ${index + 1}`} onClick={() => setPhotoIndex(index)} />
          ))}
        </div>
      </div>
      <Link className="catalog-card-meta" to={detailPath}>
        <div className="catalog-card-title-row">
          <h3>{title}</h3>
          <svg className={`catalog-verified-icon ${verified ? "is-verified" : "is-unverified"}`} viewBox="0 0 24 24" aria-label={verified ? "Verified" : "Not verified"} role="img">
            <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <p className="catalog-card-location">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>
          <span>{location || copy.locationHidden}</span>
        </p>
        {lookingFor.length > 0 && (
          <div className="catalog-looking-row"><span>{copy.lookingFor}</span>{lookingFor.map((value) => <b key={value}>{catalogOptionLabel("lookingFor", value)}</b>)}</div>
        )}
      </Link>
    </article>
  );
}

function CatalogFilterModal({
  locale,
  value,
  onChange,
  onClose,
  onApply,
  countries,
  cities,
  premium,
  onPremium,
}: {
  locale: CookieLocale;
  value: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
  onClose: () => void;
  onApply: () => void;
  countries: CatalogOption[];
  cities: CatalogOption[];
  premium: boolean;
  onPremium: () => void;
}) {
  const copy = CATALOG_COPY[locale];
  const [openField, setOpenField] = useState("");
  const [query, setQuery] = useState("");
  const set = <K extends keyof CatalogFilters>(key: K, next: CatalogFilters[K]) => onChange({ ...value, [key]: next });
  useEffect(() => {
    document.body.classList.add("catalog-filter-open");
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openField) setOpenField("");
      else onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("catalog-filter-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, openField]);
  const fieldOptions = (field: string) => field === "country" ? countries : field === "city" ? cities : CATALOG_ENUM_OPTIONS[field] || [];
  const selectedValues = (field: string) => {
    if (["country", "profileTypes", "donorTypes", "lookingFor"].includes(field)) return value[field as keyof CatalogFilters] as string[];
    const selected = value[field as keyof CatalogFilters];
    return selected ? [String(selected)] : [];
  };
  const choose = (field: string, optionValue: string) => {
    if (["country", "profileTypes", "donorTypes", "lookingFor"].includes(field)) {
      const key = field as "country" | "profileTypes" | "donorTypes" | "lookingFor";
      const current = value[key];
      const next = current.includes(optionValue) ? current.filter((item) => item !== optionValue) : [...current, optionValue];
      onChange({ ...value, [key]: next, ...(key === "country" ? { city: "" } : {}) });
    } else {
      const key = field as "city" | "ethnicity" | "hairColor" | "eyeColor" | "education" | "religion";
      set(key, value[key] === optionValue ? "" : optionValue);
      setOpenField("");
    }
  };
  const filterField = (field: string, label: string, placeholder: string, options: { premium?: boolean; disabled?: boolean; description?: string } = {}) => {
    const locked = Boolean(options.premium && !premium);
    const selected = selectedValues(field);
    const allOptions = fieldOptions(field);
    const selectedLabels = selected.map((token) => allOptions.find((option) => option.value === token)?.label || catalogOptionLabel(field, token));
    const filtered = allOptions.filter((option) => option.label.toLowerCase().startsWith(query.trim().toLowerCase()) || option.value.toLowerCase().startsWith(query.trim().toLowerCase()));
    return (
      <div className={`catalog-filter-field${options.disabled ? " disabled" : ""}${field === "lookingFor" ? " looking-field" : ""}`} key={field}>
        <label>{label}</label>
        <div className="catalog-filter-select-wrap">
          <button
            className={`catalog-filter-select${locked ? " premium" : ""}`}
            type="button"
            disabled={options.disabled}
            aria-expanded={openField === field}
            onClick={() => {
              if (locked) { onPremium(); return; }
              setOpenField((current) => current === field ? "" : field);
              setQuery("");
            }}
          >
            {selectedLabels.length ? <span className="catalog-filter-chip-list">{selectedLabels.map((item) => <b key={item}>{item}</b>)}</span> : <span>{placeholder}</span>}
            {locked ? <em><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>{copy.premium}</em> : !options.disabled ? <svg className="catalog-filter-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg> : null}
          </button>
          {openField === field && !locked && !options.disabled && (
            <div className="catalog-filter-dropdown" role="listbox" aria-multiselectable={["country", "profileTypes", "donorTypes", "lookingFor"].includes(field)}>
              <div><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} aria-label={copy.search} /></div>
              <section>
                {filtered.length ? filtered.map((option) => {
                  const isSelected = selected.includes(option.value);
                  return <button type="button" role="option" aria-selected={isSelected} className={isSelected ? "selected" : ""} key={option.value} onClick={() => choose(field, option.value)}><i aria-hidden="true" />{option.icon ? <span>{option.icon}</span> : null}<span>{option.label}</span></button>;
                }) : <p>{copy.none}</p>}
              </section>
            </div>
          )}
        </div>
        {options.description ? <p>{options.description}</p> : null}
      </div>
    );
  };
  return (
    <div className="catalog-filter-overlay" data-open="true" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="catalog-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="catalog-filter-title">
        <div className="catalog-filter-drag" aria-hidden="true" />
        <header><h2 id="catalog-filter-title">{copy.allFilters}</h2><button type="button" aria-label={copy.closeFilters} onClick={onClose}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button></header>
        <div className="catalog-filter-scroll"><div className="catalog-filter-content">
          {filterField("country", copy.country, copy.anyCountry)}
          {filterField("city", copy.city, copy.cityFirst, { disabled: value.country.length !== 1 })}
          {filterField("profileTypes", copy.profileType, copy.allTypes)}
          {filterField("donorTypes", copy.donor, copy.allTypes)}
          {filterField("lookingFor", copy.lookingFor, copy.allTypes, { description: copy.matches })}
          <div className="catalog-filter-switch-row"><span>{copy.verified}</span><button type="button" role="switch" aria-checked={value.verifiedOnly} className={value.verifiedOnly ? "active" : ""} onClick={() => set("verifiedOnly", !value.verifiedOnly)}><span /></button></div>
          <div className="catalog-filter-field catalog-age-field"><label>{copy.age}</label><div className="catalog-age-range"><input type="number" min="18" max="100" value={value.ageMin} placeholder={copy.from} aria-label={copy.from} onChange={(event) => set("ageMin", event.target.value)} /><span>–</span><input type="number" min="18" max="100" value={value.ageMax} placeholder={copy.to} aria-label={copy.to} onChange={(event) => set("ageMax", event.target.value)} /></div></div>
          {filterField("ethnicity", copy.ethnicity, "—", { premium: true })}
          {filterField("hairColor", copy.hair, "—", { premium: true })}
          {filterField("eyeColor", copy.eye, "—", { premium: true })}
          {filterField("education", copy.education, "—", { premium: true })}
          {filterField("religion", copy.religion, "—", { premium: true })}
        </div></div>
        <footer>
          <button type="button" className="catalog-filter-clear" hidden={activeCatalogFilterCount(value) === 0} onClick={() => onChange(emptyCatalogFilters())}>{copy.clear}</button>
          <button type="button" className="catalog-filter-apply" onClick={onApply}>{copy.apply}</button>
        </footer>
      </section>
    </div>
  );
}

function Catalog({ session }: { session: Session }) {
  const locale = localeOf();
  const copy = CATALOG_COPY[locale];
  const navigate = useNavigate();
  const storageKey = `lbpCatalogFilters:${locale}`;
  const stored = (() => {
    try { return JSON.parse(sessionStorage.getItem(storageKey) || "null") as { period?: number; filters?: CatalogFilters } | null; }
    catch { return null; }
  })();
  const [filters, setFilters] = useState<CatalogFilters>(() => stored?.filters ? { ...emptyCatalogFilters(), ...stored.filters } : emptyCatalogFilters());
  const [draftFilters, setDraftFilters] = useState<CatalogFilters>(() => ({ ...filters }));
  const [period, setPeriod] = useState(() => [0, 1, 7, 30].includes(Number(stored?.period)) ? Number(stored?.period) : 0);
  const [items, setItems] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const loadMoreSentinel = useRef<HTMLDivElement | null>(null);
  const [catalogOptions, setCatalogOptions] = useState<{ countries: CatalogOption[]; cities: CatalogOption[]; premium: boolean }>({ countries: [], cities: [], premium: Boolean(session?.user.isPremium) });
  const querySignature = JSON.stringify([period, filters]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ limit: "20", offset: String(offset) });
    if (period) params.set("days", String(period));
    filters.country.forEach((value) => params.append("country", value));
    if (filters.city) params.set("city", filters.city);
    filters.profileTypes.forEach((value) => params.append("profileType", value));
    filters.donorTypes.forEach((value) => params.append("donorType", value));
    filters.lookingFor.forEach((value) => params.append("lookingFor", value));
    if (filters.verifiedOnly) params.set("verifiedOnly", "true");
    if (filters.ageMin) params.set("ageMin", filters.ageMin);
    if (filters.ageMax) params.set("ageMax", filters.ageMax);
    ["ethnicity", "hairColor", "eyeColor", "education", "religion"].forEach((key) => {
      const value = filters[key as keyof CatalogFilters];
      if (typeof value === "string" && value) params.set(key, value);
    });
    api.get<Page<Row>>(`/member/catalog?${params}`)
      .then((data) => {
        if (!alive) return;
        setItems((current) => offset === 0 ? data.items : [...current, ...data.items]);
        setTotal(Number(data.total || 0));
      })
      .catch(() => alive && setError(copy.failed))
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => { alive = false; };
  }, [copy.failed, offset, querySignature]);
  useEffect(() => {
    if (!filterOpen || catalogOptions.countries.length) return;
    let alive = true;
    api.get<{ countries?: Row[]; isPremium?: unknown }>("/member/catalog/filter-options?limit=200")
      .then((data) => {
        if (!alive) return;
        setCatalogOptions((current) => ({
          ...current,
          countries: (data.countries || []).map((item) => ({ value: catalogText(item.value), label: catalogText(item.label ?? item.value) })),
          premium: catalogBoolean(data.isPremium) || current.premium,
        }));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [catalogOptions.countries.length, filterOpen]);
  useEffect(() => {
    if (!filterOpen || draftFilters.country.length !== 1) {
      setCatalogOptions((current) => current.cities.length ? { ...current, cities: [] } : current);
      return;
    }
    let alive = true;
    api.get<{ cities?: Row[] }>(`/member/catalog/filter-options?country=${encodeURIComponent(draftFilters.country[0])}&limit=200`)
      .then((data) => alive && setCatalogOptions((current) => ({ ...current, cities: (data.cities || []).map((item) => ({ value: catalogText(item.value), label: catalogText(item.label ?? item.value) })) })))
      .catch(() => undefined);
    return () => { alive = false; };
  }, [draftFilters.country, filterOpen]);
  const persist = (nextFilters: CatalogFilters, nextPeriod = period) => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ period: nextPeriod, filters: nextFilters })); } catch { /* optional */ }
  };
  const requireVerified = () => {
    if (session?.user.profileVerified === true) return true;
    navigate(`/${locale}/verification`);
    return false;
  };
  const like = async (item: Row) => {
    if (!requireVerified()) return;
    const id = catalogText(item.id);
    if (catalogBoolean(item.likedByViewer ?? catalogData(item).likedByViewer)) return;
    setItems((current) => current.map((profile) => catalogText(profile.id) === id ? { ...profile, likedByViewer: true } : profile));
    try {
      await api.post(`/member/likes/${encodeURIComponent(id)}`);
    } catch {
      setItems((current) => current.map((profile) => catalogText(profile.id) === id ? { ...profile, likedByViewer: false } : profile));
      setError(copy.actionFailed);
    }
  };
  const message = async (item: Row) => {
    if (!requireVerified()) return;
    try {
      await api.post("/member/conversations", { targetProfileId: catalogText(item.id) });
      navigate(`/${locale}/messages`);
    } catch { setError(copy.actionFailed); }
  };
  const applyFilters = () => {
    const min = Number(draftFilters.ageMin || 0);
    const max = Number(draftFilters.ageMax || 0);
    if (min && max && min > max) { setError(copy.ageError); return; }
    const next = { ...draftFilters };
    setFilters(next);
    setOffset(0);
    persist(next);
    setFilterOpen(false);
  };
  const changePeriod = (next: number) => {
    setPeriod(next);
    setOffset(0);
    persist(filters, next);
  };
  useEffect(() => {
    const sentinel = loadMoreSentinel.current;
    if (!sentinel || loading || items.length >= total || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setOffset((current) => current + 20);
    }, { rootMargin: "0px 0px 360px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, loading, total]);
  const filterCount = activeCatalogFilterCount(filters);
  return (
    <section className="catalog-reference-page">
      <h1>{copy.browse}</h1>
      <div className="catalog-reference-controls">
        <span>{copy.collections}</span>
        <div className="catalog-reference-periods" role="tablist" aria-label={copy.collections}>
          <button type="button" role="tab" aria-selected={period === 0} className={period === 0 ? "active" : ""} onClick={() => changePeriod(0)}><span>{copy.all}</span></button>
          <button type="button" role="tab" aria-selected={period === 1} className={period === 1 ? "active" : ""} onClick={() => changePeriod(1)}><span>1</span><small>{copy.day}</small></button>
          <button type="button" role="tab" aria-selected={period === 7} className={period === 7 ? "active" : ""} onClick={() => changePeriod(7)}><span>7</span><small>{copy.days}</small></button>
          <button type="button" role="tab" aria-selected={period === 30} className={period === 30 ? "active" : ""} onClick={() => changePeriod(30)}><span>1</span><small>{copy.month}</small></button>
        </div>
        <button className="catalog-reference-filter-button" type="button" aria-label={copy.allFilters} onClick={() => { setDraftFilters({ ...filters }); setFilterOpen(true); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
          <span>{copy.filters}</span>{filterCount > 0 ? <b>{filterCount}</b> : null}
        </button>
      </div>
      {error ? <p className="error catalog-reference-error">{error}</p> : null}
      {loading && offset === 0 ? <div className="catalog-reference-loading" role="status" aria-label={copy.loading}><span /></div> : error && items.length === 0 ? null : items.length ? (
        <div className="catalog-reference-grid">{items.map((item) => <CatalogCard key={catalogText(item.id)} item={item} locale={locale} onLike={(profile) => void like(profile)} onMessage={(profile) => void message(profile)} />)}</div>
      ) : <div className="catalog-reference-empty"><strong>{copy.noProfiles}</strong><span>{copy.noProfilesHelp}</span></div>}
      {items.length < total ? <div className={`catalog-reference-sentinel${loading ? " loading" : ""}`} ref={loadMoreSentinel} role={loading ? "status" : undefined} aria-label={loading ? copy.loading : undefined}>{loading ? <span /> : null}</div> : null}
      {filterOpen ? <CatalogFilterModal locale={locale} value={draftFilters} onChange={setDraftFilters} onClose={() => setFilterOpen(false)} onApply={applyFilters} countries={catalogOptions.countries} cities={catalogOptions.cities} premium={catalogOptions.premium} onPremium={() => { setFilterOpen(false); navigate(`/${locale}/subscription`); }} /> : null}
    </section>
  );
}

function CatalogProfile({ session }: { session: Session }) {
  const { id = "" } = useParams();
  const locale = localeOf();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const endpoint = session ? "/member/catalog" : "/public/catalog";
    api
      .get<Row>(`${endpoint}/${encodeURIComponent(id)}`)
      .then(setProfile)
      .catch(() => setError("This profile is not available."));
  }, [id, session]);
  if (error)
    return (
      <section className="access-card">
        <p className="error">{error}</p>
        <Link to={`/${locale}/catalog`}>Back to catalog</Link>
      </section>
    );
  if (!profile) return <LoadingIndicator />;
  const action = async (kind: "like" | "message" | "block" | "report") => {
    if (!session) {
      navigate(`/${locale}/auth/login`);
      return;
    }
    try {
      if (kind === "like")
        await api.post(`/member/likes/${encodeURIComponent(id)}`);
      if (kind === "message")
        await api.post("/member/conversations", { targetProfileId: id });
      if (kind === "block")
        await api.post(`/member/blocks/${encodeURIComponent(id)}`, {
          reason: "Blocked from catalog",
        });
      if (kind === "report")
        await api.post(`/member/reports/${encodeURIComponent(id)}`, {
          reason: "Report from catalog",
        });
      setNotice(
        kind === "message"
          ? "Conversation is ready in Messages."
          : `${kind[0].toUpperCase()}${kind.slice(1)} request completed.`,
      );
    } catch {
      setNotice("This action is not currently available for your account.");
    }
  };
  const data = (profile.data ?? {}) as Row;
  const mayInteractWithMembers = session?.user.profileVerified === true;
  return (
    <article className="detail-card catalog-profile">
      <Link to={`/${locale}/catalog`}>← Back to catalog</Link>
      <div className="profile-summary">
        {profile.avatarUrl ? (
          <img src={asText(profile.avatarUrl)} alt="" />
        ) : (
          <div className="avatar-placeholder">
            {asText(profile.displayName).slice(0, 1)}
          </div>
        )}
        <div>
          <h1>{asText(profile.displayName)}</h1>
          <p>
            {[profile.city, profile.country]
              .filter(Boolean)
              .map(asText)
              .join(", ")}
          </p>
          <p>
            {asText(
              profile.profileType ??
                data.profileType ??
                profile.recipientType ??
                profile.donorType,
            )}
          </p>
        </div>
      </div>
      <p className="prose">{asText(data.about ?? data.bio)}</p>
      {mayInteractWithMembers ? (
        <div className="actions">
          <button className="primary" onClick={() => action("like")}>
            Like
          </button>
          <button className="secondary" onClick={() => action("message")}>
            Message
          </button>
          <button className="secondary" onClick={() => action("block")}>
            Block
          </button>
          <button className="secondary" onClick={() => action("report")}>
            Report
          </button>
        </div>
      ) : session ? (
        <div className="access-card">
          <p>Verify your profile before interacting with members.</p>
          <Link className="primary" to={`/${locale}/verification`}>
            Start verification
          </Link>
        </div>
      ) : (
        <Link className="primary" to={`/${locale}/auth/login`}>
          Sign in to interact
        </Link>
      )}
      {notice && <p className="notice">{notice}</p>}
    </article>
  );
}

function Likes({ session }: { session: Session }) {
  const locale = localeOf();
  const [data, setData] = useState<Row | null>(null);
  const [tab, setTab] = useState("likesYou");
  const [visitors, setVisitors] = useState<Row[]>([]);
  const [visitorsLocked, setVisitorsLocked] = useState(false);
  const [favourites, setFavourites] = useState<Row | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (session)
      api
        .get<Row>("/member/likes")
        .then(setData)
        .catch(() => setError("Could not load likes."));
  }, [session]);
  useEffect(() => {
    if (!session || tab !== "likesYou" || !data?.readThroughId) return;
    void api
      .post("/member/notifications/likes/read", {
        readThroughId: Number(data.readThroughId),
      })
      .catch(() => undefined);
  }, [data, session, tab]);
  useEffect(() => {
    if (!session || tab !== "visitors") return;
    api
      .get<{ items: Row[]; locked?: boolean }>("/member/profile-views")
      .then((response) => {
        setVisitors(response.items || []);
        setVisitorsLocked(Boolean(response.locked));
      })
      .catch(() => setError("Could not load profile visitors."));
  }, [session, tab]);
  useEffect(() => {
    if (!session || (tab !== "clinics" && tab !== "lawyers")) return;
    api
      .get<Row>("/member/favourites")
      .then(setFavourites)
      .catch(() => setError("Could not load liked clinics and lawyers."));
  }, [session, tab]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const removeFavourite = async (
    kind: "clinics" | "lawyers",
    identifier: unknown,
  ) => {
    try {
      await api.delete(
        `/member/favourites/${kind}/${encodeURIComponent(asText(identifier))}`,
      );
      const refreshed = await api.get<Row>("/member/favourites");
      setFavourites(refreshed);
    } catch {
      setError("Could not remove this item.");
    }
  };
  const tabs = [
    ["likesYou", "Likes you"],
    ["matches", "Matches"],
    ["myLikes", "My likes"],
    ["visitors", "Visitors"],
    ["clinics", "Clinics"],
    ["lawyers", "Lawyers"],
  ];
  const profileItems = Array.isArray(data?.[tab])
    ? (data?.[tab] as Row[])
    : tab === "visitors"
      ? visitors
      : [];
  const favouriteItems = (favourites?.[tab] as Row[] | undefined) || [];
  const isLocked =
    (tab === "likesYou" && Boolean(data?.likesYouLocked)) ||
    (tab === "visitors" && visitorsLocked);
  return (
    <section>
      <h1>Likes</h1>
      <nav className="member-tabs">
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
      {error && <p className="error">{error}</p>}
      {isLocked ? (
        <div className="access-card">
          <h2>Premium feature</h2>
          <p>
            Verify your profile and activate Premium to access this section.
          </p>
        </div>
      ) : tab === "clinics" || tab === "lawyers" ? (
        <div className="directory-grid">
          {favouriteItems.map((item, index) => (
            <article
              className="directory-card static"
              key={asText(item.id ?? index)}
            >
              {item.logoUrl || item.photoUrl ? (
                <img src={asText(item.logoUrl ?? item.photoUrl)} alt="" />
              ) : (
                <div className="avatar-placeholder">
                  {asText(item.name).slice(0, 1)}
                </div>
              )}
              <div>
                <h3>{asText(item.name)}</h3>
                <p>
                  {[item.city, item.country]
                    .filter(Boolean)
                    .map(asText)
                    .join(", ")}
                </p>
                <button
                  className="secondary"
                  onClick={() => void removeFavourite(tab, item.id)}
                >
                  Liked
                </button>
              </div>
            </article>
          ))}
          {!favouriteItems.length && (
            <p className="notice">There are no liked {tab}.</p>
          )}
        </div>
      ) : (
        <div className="profile-grid">
          {profileItems.map((item, index) => (
            <article
              className="profile-card"
              key={String(item.profileId ?? item.id ?? index)}
            >
              {item.avatarUrl ? (
                <img src={asText(item.avatarUrl)} alt="" />
              ) : (
                <div className="avatar-placeholder">
                  {asText(item.displayName).slice(0, 1)}
                </div>
              )}
              <h2>{asText(item.displayName)}</h2>
              <p>
                {[item.city, item.country]
                  .filter(Boolean)
                  .map(asText)
                  .join(", ")}
              </p>
            </article>
          ))}
          {!profileItems.length && (
            <p className="notice">There are no entries to display.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Profile({ session }: { session: Session }) {
  const locale = localeOf();
  const [data, setData] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Row>({});
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (session)
      api.get<Row>("/member/me").then((result) => {
        setData(result);
        setDraft((result.profile ?? {}) as Row);
      });
  }, [session]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  if (!data) return <LoadingIndicator />;
  const save = async () => {
    try {
      await api.patch("/member/profile", draft);
      setNotice("Profile saved.");
    } catch {
      setNotice(
        "Could not save profile changes. Check the required date of birth and profile values.",
      );
    }
  };
  const field = (key: string) =>
    draft[key] === undefined || draft[key] === null ? "" : String(draft[key]);
  const set = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const listField = (key: string) =>
    Array.isArray(draft[key])
      ? (draft[key] as unknown[]).map(String).join(", ")
      : field(key);
  const setList = (key: string, value: string) =>
    set(
      key,
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  return (
    <section className="member-form">
      <h1>My profile</h1>
      <MemberLinks locale={locale} />
      {notice && <p className="notice">{notice}</p>}
      <h2>Basic information</h2>
      <div className="form-grid">
        <label>
          Display name
          <input
            value={field("displayName")}
            onChange={(event) => set("displayName", event.target.value)}
          />
        </label>
        <label>
          Date of birth
          <input
            type="date"
            value={field("dateOfBirth")}
            onChange={(event) => set("dateOfBirth", event.target.value)}
            required
          />
        </label>
        <label>
          Profile type
          <select
            value={field("profileType")}
            onChange={(event) => set("profileType", event.target.value)}
          >
            <option value="">Select type</option>
            <option>Single Woman</option>
            <option>Single Man</option>
            <option>Hetero Couple</option>
            <option>Lesbian Couple</option>
            <option>Gay Couple</option>
          </select>
        </label>
        <label>
          Looking for
          <input
            value={listField("lookingFor")}
            onChange={(event) => setList("lookingFor", event.target.value)}
            placeholder="Separate choices with commas"
          />
        </label>
        <label>
          Country
          <input
            value={field("country")}
            onChange={(event) => set("country", event.target.value)}
          />
        </label>
        <label>
          State / region
          <input
            value={field("state")}
            onChange={(event) => set("state", event.target.value)}
          />
        </label>
        <label>
          City
          <input
            value={field("city")}
            onChange={(event) => set("city", event.target.value)}
          />
        </label>
        <label>
          Occupation
          <input
            value={field("occupation")}
            onChange={(event) => set("occupation", event.target.value)}
          />
        </label>
        <label>
          Education
          <input
            value={field("education")}
            onChange={(event) => set("education", event.target.value)}
          />
        </label>
        <label>
          Languages
          <input
            value={listField("languages")}
            onChange={(event) => setList("languages", event.target.value)}
            placeholder="Separate languages with commas"
          />
        </label>
        <label>
          Religion
          <input
            value={field("religion")}
            onChange={(event) => set("religion", event.target.value)}
          />
        </label>
        <label>
          Ethnicity
          <input
            value={field("ethnicity")}
            onChange={(event) => set("ethnicity", event.target.value)}
          />
        </label>
      </div>
      <h2>Appearance & lifestyle</h2>
      <div className="form-grid">
        <label>
          Height
          <input
            type="number"
            min="0"
            value={field("height")}
            onChange={(event) =>
              set(
                "height",
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        </label>
        <label>
          Weight
          <input
            type="number"
            min="0"
            value={field("weight")}
            onChange={(event) =>
              set(
                "weight",
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        </label>
        <label>
          Eye color
          <input
            value={field("eyeColor")}
            onChange={(event) => set("eyeColor", event.target.value)}
          />
        </label>
        <label>
          Hair color
          <input
            value={field("hairColor")}
            onChange={(event) => set("hairColor", event.target.value)}
          />
        </label>
        <label>
          Smoking
          <select
            value={field("smokingStatus")}
            onChange={(event) => set("smokingStatus", event.target.value)}
          >
            <option value="">Not specified</option>
            <option>Never</option>
            <option>Occasionally</option>
            <option>Regularly</option>
          </select>
        </label>
        <label>
          Drinking
          <select
            value={field("drinkingStatus")}
            onChange={(event) => set("drinkingStatus", event.target.value)}
          >
            <option value="">Not specified</option>
            <option>Never</option>
            <option>Occasionally</option>
            <option>Regularly</option>
          </select>
        </label>
        <label>
          Units
          <select
            value={field("unitPreference") || "METRIC"}
            onChange={(event) => set("unitPreference", event.target.value)}
          >
            <option value="METRIC">Metric</option>
            <option value="IMPERIAL">Imperial</option>
          </select>
        </label>
        <label>
          Visibility
          <select
            value={String(draft.visibleInCatalog ?? true)}
            onChange={(event) =>
              set("visibleInCatalog", event.target.value === "true")
            }
          >
            <option value="true">Visible in catalog</option>
            <option value="false">Hidden from catalog</option>
          </select>
        </label>
      </div>
      <h2>Family-building preferences</h2>
      <div className="form-grid">
        <label>
          Donor types
          <input
            value={listField("donorType")}
            onChange={(event) => setList("donorType", event.target.value)}
            placeholder="Separate choices with commas"
          />
        </label>
        <label>
          Desired donor contact
          <input
            value={field("desiredDonorContact")}
            onChange={(event) => set("desiredDonorContact", event.target.value)}
          />
        </label>
      </div>
      <label>
        About
        <textarea
          rows={6}
          value={field("about")}
          onChange={(event) => set("about", event.target.value)}
        />
      </label>
      <button className="primary" onClick={save}>
        Save changes
      </button>
    </section>
  );
}

function MemberLinks({ locale }: { locale: string }) {
  return (
    <nav className="member-links">
      <Link to={`/${locale}/profile`}>Profile</Link>
      <Link to={`/${locale}/photos`}>Photos</Link>
      <Link to={`/${locale}/verification`}>Verification</Link>
      <Link to={`/${locale}/messages`}>Messages</Link>
      <Link to={`/${locale}/visitors`}>Visitors</Link>
      <Link to={`/${locale}/favourites`}>Saved</Link>
      <Link to={`/${locale}/blocked`}>Blocked</Link>
      <Link to={`/${locale}/settings`}>Settings</Link>
    </nav>
  );
}

function MemberGate({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const locale = localeOf();
  return session ? (
    <>{children}</>
  ) : (
    <Navigate to={`/${locale}/auth/login`} replace />
  );
}

function Photos({ session }: { session: Session }) {
  const locale = localeOf();
  const [photos, setPhotos] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => {
    void api
      .get<{ items: Row[] }>("/member/photos")
      .then((data) => setPhotos(data.items || []))
      .catch(() => setNotice("Could not load photos."));
  };
  useEffect(load, []);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("position", String(photos.length));
      await api.upload("/member/photos", data);
      setNotice("Photo uploaded and sent to moderation.");
      load();
    } catch {
      setNotice(
        "Could not upload this photo. Use JPEG, PNG or WebP under the allowed size.",
      );
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: unknown) => {
    try {
      await api.delete(`/member/photos/${encodeURIComponent(asText(id))}`);
      setNotice("Photo removed.");
      load();
    } catch {
      setNotice("Could not remove this photo.");
    }
  };
  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setNotice("");
    try {
      const data = new FormData();
      data.append("file", file);
      await api.upload("/member/avatar", data);
      setNotice("Avatar submitted for moderation.");
      load();
    } catch {
      setNotice(
        "Upload an approved primary profile photo before changing the avatar.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <h1>My photos</h1>
      <MemberLinks locale={locale} />
      <div className="photo-actions">
        <label className="upload-control">
          Upload photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </label>
        <label className="upload-control">
          Set avatar crop
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={
              busy ||
              !photos.some(
                (photo) =>
                  Number(photo.position) === 0 &&
                  String(photo.moderationStatus).toUpperCase() === "APPROVED",
              )
            }
            onChange={(event) => void uploadAvatar(event.target.files?.[0])}
          />
        </label>
      </div>
      {notice && (
        <p
          className={
            notice.includes("Could not") ||
            notice.includes("Upload an approved")
              ? "error"
              : "notice"
          }
        >
          {notice}
        </p>
      )}
      <p className="hint">
        A primary profile photo must be approved before an avatar crop can be
        submitted.
      </p>
      <div className="photo-grid">
        {photos.map((photo) => (
          <article className="photo-card" key={asText(photo.id)}>
            {photo.publicUrl ? (
              <img src={asText(photo.publicUrl)} alt="Profile" />
            ) : (
              <div className="avatar-placeholder">Photo</div>
            )}
            {Boolean(photo.avatarUrl) && (
              <img
                className="avatar-preview"
                src={asText(photo.avatarUrl)}
                alt="Current avatar"
              />
            )}
            <p>
              {Number(photo.position) === 0 ? "Primary · " : ""}
              {asText(photo.moderationStatus ?? photo.status)}
            </p>
            <button className="secondary" onClick={() => remove(photo.id)}>
              Delete
            </button>
          </article>
        ))}
      </div>
      {!photos.length && (
        <p className="notice">No photos have been uploaded yet.</p>
      )}
    </section>
  );
}

function Settings({ session }: { session: Session }) {
  const locale = localeOf();
  const [settings, setSettings] = useState<Row>({});
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (session)
      api
        .get<Row>("/member/settings")
        .then(setSettings)
        .catch(() => setNotice("Could not load settings."));
  }, [session]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const notifications = Array.isArray(settings.notificationSettings)
    ? (settings.notificationSettings as Row[])
    : [];
  const toggleNotification = (type: string, checked: boolean) =>
    setSettings((current) => ({
      ...current,
      notificationSettings: (Array.isArray(current.notificationSettings)
        ? (current.notificationSettings as Row[])
        : []
      ).map((item) =>
        String(item.type) === type ? { ...item, emailEnabled: checked } : item,
      ),
    }));
  const save = async () => {
    try {
      await api.patch("/member/settings", settings);
      setNotice("Settings saved.");
    } catch {
      setNotice("Could not save settings.");
    }
  };
  return (
    <section className="member-form">
      <h1>Settings</h1>
      <MemberLinks locale={locale} />
      {notice && (
        <p className={notice.includes("Could not") ? "error" : "notice"}>
          {notice}
        </p>
      )}
      <label>
        Interface language
        <select
          value={asText(
            settings.interfaceLanguage === "—"
              ? "en"
              : settings.interfaceLanguage,
          )}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              interfaceLanguage: event.target.value,
            }))
          }
        >
          <option value="en">English</option>
          <option value="ru">Русский</option>
          <option value="de">Deutsch</option>
        </select>
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={Boolean(settings.visibleInCatalog)}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              visibleInCatalog: event.target.checked,
            }))
          }
        />
        Visible in catalog
      </label>
      <fieldset className="notification-settings">
        <legend>Email notifications</legend>
        {notifications.map((item) => (
          <label className="toggle-row" key={asText(item.type)}>
            <input
              type="checkbox"
              checked={item.emailEnabled !== false}
              onChange={(event) =>
                toggleNotification(asText(item.type), event.target.checked)
              }
            />
            {asText(item.type).replaceAll("_", " ")}
          </label>
        ))}
      </fieldset>
      <button className="primary" onClick={save}>
        Save settings
      </button>
    </section>
  );
}

function Verification({ session }: { session: Session }) {
  const locale = localeOf();
  const [data, setData] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      setData(await api.get<Row>("/member/verification"));
    } catch {
      setNotice("Could not load verification status.");
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (!verificationUrl) return;
    const timer = window.setInterval(() => {
      void api
        .get<Row>("/member/verification")
        .then((next) => {
          setData(next);
          const status = asText(next.status).toUpperCase();
          if (
            ["APPROVED", "DECLINED", "FAILED", "ABANDONED", "EXPIRED"].includes(
              status,
            )
          ) {
            setVerificationUrl("");
            setNotice(
              status === "APPROVED"
                ? "Identity verification approved."
                : `Verification ${status.toLowerCase()}.`,
            );
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [verificationUrl]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const start = async () => {
    setBusy(true);
    try {
      const response = await api.post<Row>("/member/verification", {
        verificationType: "profile",
        payload: {},
      });
      const url = asText(response.url);
      if (url && url !== "—") setVerificationUrl(url);
      else {
        setNotice(asText(response.status ?? "Verification request started."));
        await load();
      }
    } catch {
      setNotice(
        "Verification cannot be started until a primary photo is approved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const abandon = async () => {
    setBusy(true);
    try {
      await api.post("/member/verification/abandon");
      setVerificationUrl("");
      setNotice("Verification cancelled.");
      await load();
    } catch {
      setNotice("Could not cancel the verification.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="access-card">
        <h1>Identity verification</h1>
        <MemberLinks locale={locale} />
        <p>
          Status: <strong>{asText(data?.status)}</strong>
        </p>
        <p>
          Primary profile photo:{" "}
          {data?.primaryPhotoReady ? "approved" : "required"}
        </p>
        {notice && <p className="notice">{notice}</p>}
        <button
          className="primary"
          onClick={() => void start()}
          disabled={!data?.providerConfigured || busy}
        >
          {busy ? "Please wait…" : "Start verification"}
        </button>
        {!data?.providerConfigured && (
          <p className="error">
            Verification provider is not configured for this environment.
          </p>
        )}
      </section>
      {verificationUrl && (
        <div
          className="verification-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Identity verification"
        >
          <section>
            <button
              className="plain-button close-verification"
              type="button"
              aria-label="Close verification"
              onClick={() => setVerificationUrl("")}
            >
              ×
            </button>
            <iframe
              title="Identity verification"
              src={verificationUrl}
              allow="camera *; microphone *"
              referrerPolicy="strict-origin-when-cross-origin"
            />
            <button
              className="secondary"
              type="button"
              onClick={() => void abandon()}
              disabled={busy}
            >
              {busy ? "Cancelling…" : "Cancel verification"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}

function Conversations({ session }: { session: Session }) {
  const locale = localeOf();
  const [conversations, setConversations] = useState<Row[]>([]);
  const [active, setActive] = useState<Row | null>(null);
  const [messages, setMessages] = useState<Row[]>([]);
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const load = () => {
    void api
      .get<{ items: Row[] }>("/member/conversations")
      .then((data) => setConversations(data.items || []))
      .catch(() => setNotice("Could not load messages."));
  };
  const loadMessages = async (conversationId: unknown) => {
    const response = await api.get<{ items: Row[] }>(
      `/member/conversations/${encodeURIComponent(asText(conversationId))}/messages`,
    );
    setMessages(response.items || []);
  };
  useEffect(load, []);
  useEffect(() => {
    if (active?.id)
      void loadMessages(active.id).catch(() =>
        setNotice("Could not load this conversation."),
      );
  }, [active]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!active?.id || !body.trim()) return;
    try {
      await api.post(
        `/member/conversations/${encodeURIComponent(asText(active.id))}/messages`,
        { body },
      );
      setBody("");
      await loadMessages(active.id);
      load();
    } catch {
      setNotice(
        "Message could not be sent. Both members must be verified before chatting.",
      );
    }
  };
  const attach = async (file: File | undefined) => {
    if (!file || !active?.id) return;
    try {
      const data = new FormData();
      data.append("file", file);
      await api.upload(
        `/member/conversations/${encodeURIComponent(asText(active.id))}/attachments`,
        data,
      );
      await loadMessages(active.id);
      load();
    } catch {
      setNotice(
        "Attachment could not be sent. Images and PDF files are supported after verification.",
      );
    }
  };
  const startCall = async (callType: "AUDIO" | "VIDEO") => {
    if (!active?.id) return;
    try {
      const response = await api.post<Row>(
        `/member/conversations/${encodeURIComponent(asText(active.id))}/calls`,
        { callType },
      );
      const call = response.call as Row | undefined;
      if (!call) throw new Error("Call was not created");
      window.dispatchEvent(
        new CustomEvent<Row>("lbp-call-start", { detail: call }),
      );
      setNotice("Calling your match…");
    } catch {
      setNotice(
        "A Premium subscription and verification are required for calls.",
      );
    }
  };
  return (
    <section className="conversations">
      <div>
        <h1>Messages</h1>
        <MemberLinks locale={locale} />
        {notice && (
          <p className={notice.includes("started") ? "notice" : "error"}>
            {notice}
          </p>
        )}
        <div className="conversation-layout">
          <aside>
            {conversations.map((item) => (
              <button
                className={active?.id === item.id ? "active" : ""}
                key={asText(item.id)}
                onClick={() => setActive(item)}
              >
                <strong>
                  {asText(
                    item.peerDisplayName ?? item.displayName ?? item.title,
                  )}
                </strong>
                <small>{asText(item.lastMessageBody)}</small>
              </button>
            ))}
          </aside>
          <div className="message-pane">
            {active ? (
              <>
                <div className="message-title">
                  <h2>
                    {asText(
                      active.peerDisplayName ??
                        active.displayName ??
                        active.title,
                    )}
                  </h2>
                  <div className="call-actions">
                    <button
                      className="secondary"
                      onClick={() => void startCall("AUDIO")}
                    >
                      Audio call
                    </button>
                    <button
                      className="secondary"
                      onClick={() => void startCall("VIDEO")}
                    >
                      Video call
                    </button>
                  </div>
                </div>
                <div className="message-list">
                  {messages.map((message) => (
                    <div className="message-bubble" key={asText(message.id)}>
                      <span>{asText(message.body)}</span>
                      {Boolean(message.mediaUrl) && (
                        <a
                          href={asText(message.mediaUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open attachment
                        </a>
                      )}
                    </div>
                  ))}
                </div>
                <form onSubmit={send}>
                  <input
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Write a message…"
                  />
                  <label className="attachment-control">
                    Attach
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => void attach(event.target.files?.[0])}
                    />
                  </label>
                  <button className="primary">Send</button>
                </form>
              </>
            ) : (
              <p>Select a conversation.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SimpleMemberList({
  session,
  kind,
}: {
  session: Session;
  kind: "visitors" | "blocked";
}) {
  const locale = localeOf();
  const [items, setItems] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  const endpoint =
    kind === "visitors" ? "/member/profile-views" : "/member/blocks";
  useEffect(() => {
    if (session)
      api
        .get<{ items: Row[] }>(endpoint)
        .then((data) => setItems(data.items || []))
        .catch(() => setNotice("Could not load this list."));
  }, [endpoint, session]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const title = kind === "visitors" ? "Profile visitors" : "Blocked profiles";
  const unblock = async (profileId: unknown) => {
    try {
      await api.delete(
        `/member/blocks/${encodeURIComponent(asText(profileId))}`,
      );
      setItems((current) =>
        current.filter((item) => item.profileId !== profileId),
      );
    } catch {
      setNotice("Could not unblock this profile.");
    }
  };
  return (
    <section>
      <h1>{title}</h1>
      <MemberLinks locale={locale} />
      {notice && <p className="error">{notice}</p>}
      <div className="profile-grid">
        {items.map((item, index) => (
          <article
            className="profile-card"
            key={asText(item.profileId ?? item.id ?? index)}
          >
            {item.avatarUrl ? (
              <img src={asText(item.avatarUrl)} alt="" />
            ) : (
              <div className="avatar-placeholder">
                {asText(item.displayName).slice(0, 1)}
              </div>
            )}
            <h2>{asText(item.displayName ?? item.name)}</h2>
            <p>
              {[item.city, item.country].filter(Boolean).map(asText).join(", ")}
            </p>
            {kind === "blocked" && (
              <button
                className="secondary"
                onClick={() => unblock(item.profileId)}
              >
                Unblock
              </button>
            )}
          </article>
        ))}
      </div>
      {!items.length && (
        <p className="notice">There are no entries to display.</p>
      )}
    </section>
  );
}

function Favourites({ session }: { session: Session }) {
  const locale = localeOf();
  const [data, setData] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const load = () => {
    if (session)
      void api
        .get<Row>("/member/favourites")
        .then(setData)
        .catch(() => setNotice("Could not load saved clinics and lawyers."));
  };
  useEffect(load, [session]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const remove = async (kind: "clinics" | "lawyers", identifier: unknown) => {
    try {
      await api.delete(
        `/member/favourites/${kind}/${encodeURIComponent(asText(identifier))}`,
      );
      load();
    } catch {
      setNotice("Could not remove this saved item.");
    }
  };
  const block = (kind: "clinics" | "lawyers", title: string) => (
    <section>
      <h2>{title}</h2>
      <div className="directory-grid">
        {((data?.[kind] as Row[] | undefined) || []).map((item, index) => (
          <article
            className="directory-card static"
            key={asText(item.id ?? index)}
          >
            {item.logoUrl || item.photoUrl ? (
              <img src={asText(item.logoUrl ?? item.photoUrl)} alt="" />
            ) : (
              <div className="avatar-placeholder">
                {asText(item.name).slice(0, 1)}
              </div>
            )}
            <div>
              <h3>{asText(item.name)}</h3>
              <p>
                {[item.city, item.country]
                  .filter(Boolean)
                  .map(asText)
                  .join(", ")}
              </p>
              <button
                className="secondary"
                onClick={() => void remove(kind, item.id)}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      {!((data?.[kind] as Row[] | undefined) || []).length && (
        <p className="notice">There are no saved {kind}.</p>
      )}
    </section>
  );
  return (
    <section>
      <h1>Saved</h1>
      <MemberLinks locale={locale} />
      {notice && <p className="error">{notice}</p>}
      {block("clinics", "Clinics")}
      {block("lawyers", "Lawyers")}
    </section>
  );
}

function AccountDeletion({ session }: { session: Session }) {
  const locale = localeOf();
  const [reason, setReason] = useState("Prefer not to say");
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState("");
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await api.post<Row>("/member/account-deletion", {
        reason,
        details,
      });
      setNotice(asText(response.message ?? "Deletion request submitted."));
    } catch {
      setNotice("Could not submit the deletion request.");
    }
  };
  return (
    <section className="member-form danger-zone">
      <h1>Delete account</h1>
      <MemberLinks locale={locale} />
      <p>Your request is reviewed before the account is permanently removed.</p>
      {notice && <p className="notice">{notice}</p>}
      <form onSubmit={submit}>
        <label>
          Reason
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label>
          Details
          <textarea
            rows={5}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
        </label>
        <button className="primary">Request account deletion</button>
      </form>
    </section>
  );
}

function Subscription({ session }: { session: Session }) {
  const locale = localeOf();
  const [data, setData] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (session)
      api
        .get<Row>("/member/subscription")
        .then(setData)
        .catch(() => setNotice("Could not load your Premium access."));
  }, [session]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const request = async (plan: string) => {
    try {
      const response = await api.post<Row>("/member/subscription-intent", {
        plan,
        payload: {},
      });
      setNotice(asText(response.message ?? response.status));
    } catch {
      setNotice("Premium is available only after profile verification.");
    }
  };
  const verified = data?.isVerified === true;
  return (
    <section className="access-card">
      <h1>Premium</h1>
      {data && !verified ? (
        <>
          <p>Verify your profile to access Premium.</p>
          <Link className="primary" to={`/${locale}/verification`}>
            Start verification
          </Link>
        </>
      ) : (
        <>
          <p>Current status: {asText(data?.status)}</p>
          {data?.isPremium ? (
            <p>Your Premium subscription is active.</p>
          ) : (
            <div className="plan-actions">
              {["MONTHLY", "QUARTERLY", "ANNUAL"].map((plan) => (
                <button
                  className="primary"
                  key={plan}
                  onClick={() => request(plan)}
                >
                  {plan.toLowerCase()}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {notice && <p className="notice">{notice}</p>}
    </section>
  );
}

const PRICING_TEXT = {
  en: {
    eyebrow: "PRICING",
    title: "Find the right person to build a family with.",
    intro: "Better matches. Deeper compatibility. More confidence. Start free, upgrade when you're ready to go deeper.",
    plans: [
      {
        key: "explore", name: "Explore", price: "€0", priceNote: "Free forever", altNote: "",
        tagline: "Create your profile and start discovering.",
        features: ["Full profile & basic discovery", "3 likes per day", "Basic matching"],
        cta: "Get started free", badge: "",
      },
      {
        key: "familyBuilder", name: "Family Builder", price: "€24.99", priceNote: "per month, billed monthly",
        altNote: "or €49.99 for 3 months - €16.66/month, save 33%",
        tagline: "For members ready to match with intention.",
        features: ["Compatibility Score & Why you match", "Advanced family filters", "See who liked you", "Video & audio calls", "15 likes/day, 5 reach-outs/day", "Priority in discovery"],
        cta: "Start Family Builder", badge: "Best value",
      },
      {
        key: "familyBuilderPro", name: "Family Builder Pro", price: "€29.99", priceNote: "per month", altNote: "",
        tagline: "Everything in Family Builder, plus deeper guidance.",
        features: ["Everything in Family Builder", "AI Family Advisor", "Detailed Compatibility Report", "Family Plan & Shared Family Room", "Document & checklist tools", "Priority support"],
        cta: "Go Pro", badge: "",
      },
    ],
    footnote: "Prices shown in EUR and may vary by region. Cancel anytime. Premium requires profile verification.",
    faqLinkLabel: "See how we verify members",
    compareTitle: "Compare all features",
    compareSub: "See exactly what's included in each plan.",
    matrixGroups: [
      { name: "Match better", rows: [
        { label: "Daily likes", values: ["3", "15", "Unlimited"] },
        { label: "Reach out first", values: ["", "5/day", "Unlimited"] },
        { label: "Advanced family filters", values: ["", "check", "check"] },
        { label: "Priority in catalog", values: ["", "check", "check"] },
        { label: "See who liked you", values: ["", "check", "check"] },
        { label: "See profile visitors", values: ["", "check", "check"] },
      ] },
      { name: "Understand compatibility", rows: [
        { label: "Compatibility Score", values: ["", "check", "check"] },
        { label: "Why you match", values: ["", "check", "check"] },
        { label: "Expanded profile info", values: ["", "check", "check"] },
        { label: "Verification info", values: ["", "check", "check"] },
      ] },
      { name: "Connect & communicate", rows: [
        { label: "Video & audio calls", values: ["", "check", "check"] },
        { label: "Private photos", values: ["", "check", "check"] },
        { label: "Incognito mode", values: ["", "check", "check"] },
      ] },
      { name: "Build your family", rows: [
        { label: "Family Plan (shared)", values: ["", "Limited", "check"] },
        { label: "AI Family Advisor", values: ["", "", "check"] },
        { label: "Detailed Compatibility Report", values: ["", "", "check"] },
        { label: "Document & checklist tools", values: ["", "", "check"] },
        { label: "Priority support", values: ["", "", "check"] },
      ] },
    ],
  },
  ru: {
    eyebrow: "ЦЕНЫ",
    title: "Найдите того, с кем строить семью.",
    intro: "Более точные совпадения. Глубже совместимость. Больше уверенности. Начните бесплатно, обновитесь, когда будете готовы к большему.",
    plans: [
      {
        key: "explore", name: "Explore", price: "€0", priceNote: "Бесплатно навсегда", altNote: "",
        tagline: "Создайте профиль и начните знакомиться.",
        features: ["Полный профиль и базовый поиск", "3 лайка в день", "Базовый подбор пар"],
        cta: "Начать бесплатно", badge: "",
      },
      {
        key: "familyBuilder", name: "Family Builder", price: "€24.99", priceNote: "в месяц, ежемесячная оплата",
        altNote: "или €49.99 за 3 месяца - €16.66/мес, экономия 33%",
        tagline: "Для тех, кто готов искать пару осознанно.",
        features: ["Оценка совместимости и «почему вы подходите»", "Расширенные семейные фильтры", "Кто лайкнул вас", "Видео- и аудиозвонки", "15 лайков/день, 5 обращений/день", "Приоритет в поиске"],
        cta: "Начать Family Builder", badge: "Лучшая цена",
      },
      {
        key: "familyBuilderPro", name: "Family Builder Pro", price: "€29.99", priceNote: "в месяц", altNote: "",
        tagline: "Всё из Family Builder плюс более глубокое сопровождение.",
        features: ["Всё из Family Builder", "AI Family Advisor", "Подробный отчёт о совместимости", "Family Plan и общая комната семьи", "Документы и чек-листы", "Приоритетная поддержка"],
        cta: "Перейти на Pro", badge: "",
      },
    ],
    footnote: "Цены указаны в евро и могут отличаться в зависимости от региона. Отмена в любой момент. Premium доступен после верификации профиля.",
    faqLinkLabel: "Как мы проверяем участников",
    compareTitle: "Сравните все возможности",
    compareSub: "Точный список того, что включено в каждый тариф.",
    matrixGroups: [
      { name: "Больше совпадений", rows: [
        { label: "Лайки в день", values: ["3", "15", "Без ограничений"] },
        { label: "Первым написать", values: ["", "5 в день", "Без ограничений"] },
        { label: "Расширенные семейные фильтры", values: ["", "check", "check"] },
        { label: "Приоритет в каталоге", values: ["", "check", "check"] },
        { label: "Кто лайкнул вас", values: ["", "check", "check"] },
        { label: "Кто смотрел профиль", values: ["", "check", "check"] },
      ] },
      { name: "Понимание совместимости", rows: [
        { label: "Оценка совместимости", values: ["", "check", "check"] },
        { label: "Почему вы подходите", values: ["", "check", "check"] },
        { label: "Расширенная информация профиля", values: ["", "check", "check"] },
        { label: "Информация о верификации", values: ["", "check", "check"] },
      ] },
      { name: "Связь и общение", rows: [
        { label: "Видео- и аудиозвонки", values: ["", "check", "check"] },
        { label: "Приватные фото", values: ["", "check", "check"] },
        { label: "Режим инкогнито", values: ["", "check", "check"] },
      ] },
      { name: "Постройте свою семью", rows: [
        { label: "Семейный план (общий)", values: ["", "Ограниченно", "check"] },
        { label: "AI Family Advisor", values: ["", "", "check"] },
        { label: "Подробный отчёт о совместимости", values: ["", "", "check"] },
        { label: "Документы и чек-листы", values: ["", "", "check"] },
        { label: "Приоритетная поддержка", values: ["", "", "check"] },
      ] },
    ],
  },
  es: {
    eyebrow: "PRECIOS",
    title: "Encuentra a la persona adecuada para formar una familia.",
    intro: "Mejores matches. Mayor compatibilidad. Más confianza. Empieza gratis y mejora cuando quieras ir más allá.",
    plans: [
      {
        key: "explore", name: "Explore", price: "€0", priceNote: "Gratis para siempre", altNote: "",
        tagline: "Crea tu perfil y empieza a descubrir.",
        features: ["Perfil completo y descubrimiento básico", "3 likes al día", "Emparejamiento básico"],
        cta: "Empieza gratis", badge: "",
      },
      {
        key: "familyBuilder", name: "Family Builder", price: "€24.99", priceNote: "al mes, facturación mensual",
        altNote: "o €49.99 por 3 meses - €16.66/mes, ahorra 33%",
        tagline: "Para quienes buscan match con intención.",
        features: ["Puntuación de compatibilidad y «por qué haces match»", "Filtros familiares avanzados", "Ver quién te dio like", "Videollamadas y llamadas de audio", "15 likes/día, 5 contactos/día", "Prioridad en el descubrimiento"],
        cta: "Empezar Family Builder", badge: "Mejor precio",
      },
      {
        key: "familyBuilderPro", name: "Family Builder Pro", price: "€29.99", priceNote: "al mes", altNote: "",
        tagline: "Todo lo de Family Builder, con acompañamiento más profundo.",
        features: ["Todo lo de Family Builder", "AI Family Advisor", "Informe de compatibilidad detallado", "Family Plan y Sala Familiar Compartida", "Documentos y listas de verificación", "Soporte prioritario"],
        cta: "Pasar a Pro", badge: "",
      },
    ],
    footnote: "Los precios se muestran en EUR y pueden variar según la región. Cancela cuando quieras. Premium requiere verificación de perfil.",
    faqLinkLabel: "Cómo verificamos a los miembros",
    compareTitle: "Compara todas las funciones",
    compareSub: "Mira exactamente qué incluye cada plan.",
    matrixGroups: [
      { name: "Mejores coincidencias", rows: [
        { label: "Me gusta diarios", values: ["3", "15", "Ilimitado"] },
        { label: "Escribir primero", values: ["", "5/día", "Ilimitado"] },
        { label: "Filtros familiares avanzados", values: ["", "check", "check"] },
        { label: "Prioridad en el catálogo", values: ["", "check", "check"] },
        { label: "Ver quién te dio like", values: ["", "check", "check"] },
        { label: "Ver visitantes del perfil", values: ["", "check", "check"] },
      ] },
      { name: "Entender la compatibilidad", rows: [
        { label: "Puntuación de compatibilidad", values: ["", "check", "check"] },
        { label: "Por qué coincidís", values: ["", "check", "check"] },
        { label: "Información ampliada del perfil", values: ["", "check", "check"] },
        { label: "Información de verificación", values: ["", "check", "check"] },
      ] },
      { name: "Conectar y comunicarse", rows: [
        { label: "Videollamadas y llamadas de audio", values: ["", "check", "check"] },
        { label: "Fotos privadas", values: ["", "check", "check"] },
        { label: "Modo incógnito", values: ["", "check", "check"] },
      ] },
      { name: "Construye tu familia", rows: [
        { label: "Plan familiar (compartido)", values: ["", "Limitado", "check"] },
        { label: "AI Family Advisor", values: ["", "", "check"] },
        { label: "Informe de compatibilidad detallado", values: ["", "", "check"] },
        { label: "Documentos y listas de verificación", values: ["", "", "check"] },
        { label: "Soporte prioritario", values: ["", "", "check"] },
      ] },
    ],
  },
} satisfies Record<CookieLocale, Record<string, unknown>>;

function Pricing({ session }: { session: Session }) {
  const locale = localeOf();
  const text = PRICING_TEXT[locale];
  const primaryHref = session ? `/${locale}/subscription` : `/${locale}/auth/register`;
  const freeHref = session ? `/${locale}/catalog` : `/${locale}/auth/register`;
  return (
    <div className="pricing-page">
      <section className="pricing-hero">
        <span className="landing-pill pricing-pill"><i /><span>{text.eyebrow}</span></span>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
      </section>
      <div className="pricing-grid">
        {text.plans.map((plan) => (
          <article key={plan.key} className={`pricing-card${plan.badge ? " highlight" : ""}`}>
            {plan.badge ? <span className="pricing-card-badge">{plan.badge}</span> : null}
            <h3>{plan.name}</h3>
            <p className="pricing-tagline">{plan.tagline}</p>
            <div className="pricing-price">
              <strong>{plan.price}</strong>
              <span>{plan.priceNote}</span>
            </div>
            {plan.altNote ? <p className="pricing-alt-note">{plan.altNote}</p> : null}
            <ul className="pricing-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></i>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link className={plan.badge ? "landing-gradient-button pricing-cta" : "pricing-secondary-button"} to={plan.key === "explore" ? freeHref : primaryHref}>
              {plan.cta}
            </Link>
          </article>
        ))}
      </div>
      <section className="pricing-compare">
        <div className="landing-section-intro">
          <span>{text.eyebrow}</span>
          <h2>{text.compareTitle}</h2>
          <p className="resources-section-sub">{text.compareSub}</p>
        </div>
        <div className="pricing-matrix">
          <div className="pricing-matrix-head">
            <span />
            {text.plans.map((plan) => <span key={plan.key}>{plan.name}</span>)}
          </div>
          {text.matrixGroups.map((group) => (
            <div key={group.name} className="pricing-matrix-group">
              <div className="pricing-matrix-group-name">{group.name}</div>
              {group.rows.map((row) => (
                <div key={row.label} className="pricing-matrix-row">
                  <span className="pricing-matrix-label">{row.label}</span>
                  {row.values.map((value, i) => (
                    <span key={i} className="pricing-matrix-cell">
                      {value === "check" ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                      ) : value === "" ? (
                        <span className="pricing-matrix-dash">—</span>
                      ) : (
                        <span className="pricing-matrix-value">{value}</span>
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
      <section className="pricing-footnote">
        <p>{text.footnote} <Link to={`/${locale}/trust-safety`}>{text.faqLinkLabel}</Link></p>
      </section>
    </div>
  );
}

const knowledgeCategories = [
  { slug: "ivf-in-vitro-fertilization", name: "IVF - In Vitro Fertilization" },
  { slug: "Co-parenting", name: "Co-parenting" },
  { slug: "sperm-donor", name: "Sperm donor" },
  { slug: "fertility", name: "Fertility" },
  { slug: "lgbtq", name: "LGBTQ+" },
];

const knowledgeCategoryCopy: Record<CookieLocale, Record<string, string>> = {
  en: {
    "ivf-in-vitro-fertilization": "IVF - In Vitro Fertilization",
    "co-parenting": "Co-parenting",
    "sperm-donor": "Sperm donor",
    fertility: "Fertility",
    lgbtq: "LGBTQ+",
  },
  ru: {
    "ivf-in-vitro-fertilization": "ЭКО - Экстракорпоральное оплодотворение",
    "co-parenting": "Копереннтинг",
    "sperm-donor": "Донор спермы",
    fertility: "Fertility",
    lgbtq: "ЛГБТК+",
  },
  es: {
    "ivf-in-vitro-fertilization": "FIV - Fertilización in vitro",
    "co-parenting": "Coparentalidad",
    "sperm-donor": "Donante de esperma",
    fertility: "Fertilidad",
    lgbtq: "LGBTQ+",
  },
};

const knowledgeHubCopy: Record<CookieLocale, {
  title: string;
  intro: string;
  all: string;
  categoriesLabel: string;
  views: string;
  unavailable: string;
  back: string;
  published: string;
  previous: string;
  next: string;
  navigationLabel: string;
}> = {
  en: {
    title: "Knowledge Hub",
    intro: "Expert articles on donation, co-parenting, and reproductive health",
    all: "All",
    categoriesLabel: "Article categories",
    views: "views",
    unavailable: "This article is not available.",
    back: "Back to Knowledge Hub",
    published: "Published on",
    previous: "Previous article",
    next: "Next article",
    navigationLabel: "Article navigation",
  },
  ru: {
    title: "База знаний",
    intro: "Экспертные статьи о донорстве, со-родительстве и репродуктивном здоровье",
    all: "Все",
    categoriesLabel: "Категории статей",
    views: "просмотров",
    unavailable: "Эта статья недоступна.",
    back: "Назад к базе знаний",
    published: "Опубликовано",
    previous: "Предыдущая статья",
    next: "Следующая статья",
    navigationLabel: "Навигация по статьям",
  },
  es: {
    title: "Centro de conocimiento",
    intro: "Artículos de expertos sobre donación, co-paternidad y salud reproductiva",
    all: "Todos",
    categoriesLabel: "Categorías de artículos",
    views: "vistas",
    unavailable: "Este artículo no está disponible.",
    back: "Volver al centro de conocimiento",
    published: "Publicado el",
    previous: "Artículo anterior",
    next: "Artículo siguiente",
    navigationLabel: "Navegación de artículos",
  },
};

const latestKnowledgeArticles: Row[] = [
  { id: "d21f57ef", slug: "co-parenting-red-flags-when-you-should-walk-away", title: "Co-Parenting Red Flags: When You Should Walk Away", excerpt: "Thinking about co-parenting? Learn which warning signs may signal an unhealthy or unsafe arrangement, from pressure and dishonesty to control and poor boundaries.", coverUrl: "/web-static/articles/1786801192887-d7333d16.jpg", categorySlug: "Co-parenting", categoryName: "Co-parenting", publishedAt: "2026-08-15T13:39:19.430Z", views: 2 },
  { id: "d69db046", slug: "can-co-parenting-work-without-a-romantic-relationship", title: "Can Co-Parenting Work Without a Romantic Relationship?", excerpt: "Can two people successfully co-parent without being a couple? Explore trust, boundaries, new partners, conflict and what makes co-parenting work.", coverUrl: "/web-static/articles/1786800884924-51087667.jpg", categorySlug: "Co-parenting", categoryName: "Co-parenting", publishedAt: "2026-08-15T13:34:49.459Z", views: 1 },
  { id: "316117d7", slug: "co-parenting-agreement-what-to-discuss-before-having-a-child", title: "Co-Parenting Agreement: What to Discuss Before Having a Child", excerpt: "Considering co-parenting? Learn what to discuss before pregnancy, from living arrangements and finances to decision-making, boundaries and future changes.", coverUrl: "/web-static/articles/1786800288283-2bb1dadc.jpg", categorySlug: "Co-parenting", categoryName: "Co-parenting", publishedAt: "2026-08-15T13:25:06.599Z", views: 1 },
  { id: "79c8f4b8", slug: "questions-to-ask-a-potential-co-parent-before-you-move-forward", title: "Questions to Ask a Potential Co-Parent Before You Move Forward", excerpt: "Thinking about co-parenting with someone? These practical questions can help you talk about parenting, money, living arrangements, boundaries and the future.", coverUrl: "/web-static/articles/1786799902679-855ba763.jpg", categorySlug: "Co-parenting", categoryName: "Co-parenting", publishedAt: "2026-08-15T13:18:28.090Z", views: 2 },
  { id: "0b9d1fac", slug: "how-to-find-a-co-parent-where-to-start-and-what-to-look-for", title: "How to Find a Co-Parent: Where to Start and What to Look For", excerpt: "Looking for a co-parent? Learn where to start, what to discuss early, how to spot compatibility and which red flags you shouldn't ignore.", coverUrl: "/web-static/articles/1786799585487-49cb88e4.jpg", categorySlug: "Co-parenting", categoryName: "Co-parenting", publishedAt: "2026-08-15T13:13:10.321Z", views: 0 },
  { id: "50a19e23", slug: "what-is-co-parenting-how-to-know-if-it-could-be-right-for-you", title: "What Is Co-Parenting? How to Know If It Could Be Right for You", excerpt: "What is co-parenting, and could it work for you? Explore relationships, boundaries, parenting decisions, finances and legal questions before you take the next step.", coverUrl: "/web-static/articles/1786799400356-2c5b1877.jpg", categorySlug: "Co-parenting", categoryName: "Co-parenting", publishedAt: "2026-08-15T13:10:04.894Z", views: 3 },
  { id: "316bf71e", slug: "how-to-choose-your-path-to-parenthood-questions-to-consider", title: "How to Choose Your Path to Parenthood: Questions to Consider", excerpt: "Not sure which path to parenthood is right for you? Explore the questions that matter around family, health, finances, support and your priorities.", coverUrl: "/web-static/articles/1786799040979-03f84347.jpg", categorySlug: "Parenthood", categoryName: "Parenthood", publishedAt: "2026-08-15T13:04:04.950Z", views: 3 },
  { id: "e585cffa", slug: "different-ways-to-become-a-parent-your-options-explained", title: "Different Ways to Become a Parent: Your Options Explained", excerpt: "Explore different paths to parenthood, from parenting with a partner and co-parenting to donor conception, fertility treatment, adoption and surrogacy.", coverUrl: "/web-static/articles/1786715854481-9e2ad679.jpg", categorySlug: "Parenthood", categoryName: "Parenthood", publishedAt: "2026-08-14T13:57:51.783Z", views: 2 },
  { id: "3e9f35f8", slug: "am-i-ready-to-become-a-parent-how-to-know-when-to-start", title: "Am I Ready to Become a Parent? How to Know When to Start", excerpt: "Thinking about becoming a parent but not sure you're ready? Explore the questions that matter most — from your reasons and lifestyle to finances, health and support — and find a clearer way forward.", coverUrl: "/web-static/articles/1786715655186-9f49a617.jpg", categorySlug: "Parenthood", categoryName: "Parenthood", publishedAt: "2026-08-14T13:54:17.992Z", views: 2 },
];

const knowledgeCategoryName = (slug: string, locale: CookieLocale = "en") =>
  knowledgeCategoryCopy[locale][slug.toLowerCase()]
  || knowledgeCategories.find((category) => category.slug.toLowerCase() === slug.toLowerCase())?.name
  || slug;

const knowledgeLoadMoreCopy: Record<
  CookieLocale,
  { idle: string; loading: string }
> = {
  en: { idle: "Load more", loading: "Loading ..." },
  ru: { idle: "Показать ещё", loading: "Загрузка ..." },
  es: { idle: "Cargar más", loading: "Cargando ..." },
};

const knowledgeDate = (value: unknown) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return [date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear()]
    .map((part, index) => (index < 2 ? String(part).padStart(2, "0") : String(part)))
    .join(".");
};

function KnowledgeHub() {
  const locale = localeOf();
  const copy = knowledgeHubCopy[locale];
  const [data, setData] = useState<Page<Row> | null>(null);
  const [category, setCategory] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    api
      .get<Page<Row>>(
        `/public/articles?locale=${encodeURIComponent(locale)}&limit=60&offset=0`,
      )
      .then(setData)
      .catch(() => setData({ items: [], total: 0, limit: 60, offset: 0 }));
  }, [locale]);
  const backendArticles: Row[] = (data?.items ?? []).map((item) => {
    const meta = (item.meta ?? {}) as Row;
    const metaCategory = (meta.category ?? {}) as Row;
    const selectedTranslation = (meta.selectedTranslation ?? {}) as Row;
    const categorySlug = String(item.category ?? metaCategory.slug ?? "");
    const referenceMeta = referenceArticleMeta[String(item.slug)];
    return {
      ...item,
      coverUrl: referenceMeta?.coverUrl ?? item.coverUrl ?? item.cover_url ?? selectedTranslation.coverImageUrl,
      categorySlug,
      categoryName: knowledgeCategoryName(categorySlug, locale),
      publishedAt: item.publishedAt ?? item.published_at ?? meta.publishedAt,
      views: referenceMeta?.views ?? item.views ?? meta.viewCount ?? 0,
    } as Row;
  });
  const latestSlugs = new Set(latestKnowledgeArticles.map((item) => String(item.slug)));
  const allArticles: Row[] = referenceKnowledgeArticles.map((item) => ({
    ...item,
    categoryName: knowledgeCategoryName(item.categorySlug, locale),
  }));
  const filteredArticles = category
    ? allArticles.filter((item) => String(item.categorySlug).toLowerCase() === category.toLowerCase())
    : allArticles;
  const visibleArticles = filteredArticles.slice(0, visibleCount);
  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 300));
    setVisibleCount((count) => count + 12);
    setLoadingMore(false);
  };
  return (
    <section className="knowledge-page">
      <header className="knowledge-heading">
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>
      <div className="knowledge-filters" aria-label={copy.categoriesLabel}>
        <button className={category === "" ? "active" : ""} onClick={() => { setCategory(""); setVisibleCount(12); }}>{copy.all}</button>
        {knowledgeCategories.map((item) => (
          <button key={item.slug} className={category === item.slug ? "active" : ""} onClick={() => { setCategory(item.slug); setVisibleCount(12); }}>{locale === "es" ? item.name : knowledgeCategoryName(item.slug, locale)}</button>
        ))}
      </div>
      <div className="knowledge-grid">
        {visibleArticles.map((item) => (
          <Link
            className="knowledge-card"
            key={String(item.id)}
            to={`/${locale}/knowledge-hub/${encodeURIComponent(asText(item.slug))}`}
          >
            <div className="knowledge-card-image"><img src={asText(item.coverUrl)} alt={asText(item.title)} /></div>
            <div className="knowledge-card-body">
              <span className="knowledge-badge">{asText(item.categoryName)}</span>
              <h3>{asText(item.title)}</h3>
              <p>{asText(item.excerpt)}</p>
              <div className="knowledge-meta">
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>{knowledgeDate(item.publishedAt)}</span>
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>{String(item.views ?? 0)} {copy.views}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {visibleCount < filteredArticles.length && (
        <button
          className="knowledge-load-more"
          type="button"
          disabled={loadingMore}
          aria-busy={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore
            ? knowledgeLoadMoreCopy[locale].loading
            : knowledgeLoadMoreCopy[locale].idle}
        </button>
      )}
    </section>
  );
}

function Article() {
  const { locale = "en", slug = "" } = useParams();
  const activeLocale = locale as CookieLocale;
  const copy = knowledgeHubCopy[activeLocale];
  const [article, setArticle] = useState<Row | null>(null);
  const [navigationArticles, setNavigationArticles] = useState<Row[]>([]);
  const [error, setError] = useState("");
  useLayoutEffect(() => {
    setArticle(null);
    setError("");
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [locale, slug]);
  useEffect(() => {
    let alive = true;
    api
      .get<Page<Row>>(
        `/public/articles?locale=${encodeURIComponent(locale)}&limit=60&offset=0`,
      )
      .then((page) => {
        if (!alive) return;
        setNavigationArticles(referenceKnowledgeArticles);
      })
      .catch(() => {
        if (alive) setNavigationArticles([]);
      });
    return () => { alive = false; };
  }, [locale]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const result = await api.get<Row>(
          `/public/articles/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}`,
        );
        if (alive) setArticle(result);
      } catch {
        const latestIndex = latestKnowledgeArticles.findIndex((item) => item.slug === slug);
        if (locale !== "en" || latestIndex < 0 || latestIndex > 8) {
          if (alive) setError(copy.unavailable);
          return;
        }
        try {
          const response = await fetch(`/web-static/articles/details/${encodeURIComponent(slug)}-20260821.json`);
          if (!response.ok) throw new Error("Article snapshot unavailable");
          const payload = await response.json() as { result?: { data?: { json?: Row } } };
          const result = payload.result?.data?.json;
          if (!result) throw new Error("Article snapshot is invalid");
          if (alive) setArticle(result);
        } catch {
          if (alive) setError(copy.unavailable);
        }
      }
    };
    void load();
    return () => { alive = false; };
  }, [copy.unavailable, locale, slug]);
  if (error)
    return (
      <section className="access-card">
        <p className="error">{error}</p>
        <Link to={`/${locale}/knowledge-hub`}>{copy.back}</Link>
      </section>
    );
  if (!article) return <LoadingIndicator />;
  const staticArticle = latestKnowledgeArticles.find((item) => item.slug === slug);
  const categoryValue = article.category;
  const categoryName = typeof categoryValue === "object" && categoryValue
    ? asText((categoryValue as Row).name)
    : knowledgeCategoryName(asText(categoryValue), "en");
  const referenceMeta = referenceArticleMeta[slug];
  const coverUrl = referenceMeta?.coverUrl ?? staticArticle?.coverUrl ?? article.coverUrl ?? article.cover_url ?? article.coverImageUrl;
  const publishedAt = staticArticle?.publishedAt ?? article.publishedAt ?? article.published_at;
  const views = referenceMeta?.views ?? staticArticle?.views ?? article.views ?? article.viewCount ?? 0;
  const bodyHtml = article.bodyHtml ?? article.body_html ?? article.content;
  const referenceBodyHtml = asText(bodyHtml).replaceAll("https://letsbeparents.com/", "/");
  const navigationIndex = navigationArticles.findIndex((item) => asText(item.slug) === slug);
  const referenceNavigation = referenceArticleNavigation[slug];
  const previous = referenceNavigation
    ? referenceNavigation.previous
    : (article.previous as Row | null | undefined)
      ?? (navigationIndex > 0 ? navigationArticles[navigationIndex - 1] : null);
  const next = referenceNavigation
    ? referenceNavigation.next
    : (article.next as Row | null | undefined)
      ?? (navigationIndex >= 0 && navigationIndex < navigationArticles.length - 1
        ? navigationArticles[navigationIndex + 1]
        : null);
  const longDate = new Date(String(publishedAt)).toLocaleDateString(
    activeLocale === "ru" ? "ru-RU" : activeLocale === "es" ? "es-ES" : "en-US",
    {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    },
  );
  return (
    <article className="article-page">
      <Link className="article-back" to={`/${locale}/knowledge-hub`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/><path d="M9 12h12"/></svg><span>{copy.back}</span></Link>
      <header className="article-heading">
        <span className="knowledge-badge">{categoryName}</span>
        <h1>{asText(article.title)}</h1>
        <p>{asText(article.excerpt)}</p>
        <div className="article-meta">
          <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v4M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/></svg>{copy.published} {longDate}</span>
          <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>{String(views)} {copy.views}</span>
        </div>
      </header>
      {Boolean(coverUrl) && <img className="article-page-cover" src={asText(coverUrl)} alt={asText(article.title)} />}
      <div
        className="article-body"
        dangerouslySetInnerHTML={{ __html: referenceBodyHtml }}
      />
      {(previous || next) && (
        <nav className="article-navigation" aria-label={copy.navigationLabel}>
          {previous ? (
            <Link to={`/${locale}/knowledge-hub/${encodeURIComponent(asText(previous.slug))}`}>
              <span className="article-navigation-label"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/><path d="M9 12h12"/></svg>{copy.previous}</span>
              <span className="article-navigation-title">{asText(previous.title)}</span>
            </Link>
          ) : <span className="article-navigation-placeholder" />}
          {next ? (
            <Link className="next" to={`/${locale}/knowledge-hub/${encodeURIComponent(asText(next.slug))}`}>
              <span className="article-navigation-label">{copy.next}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/><path d="M15 12H3"/></svg></span>
              <span className="article-navigation-title">{asText(next.title)}</span>
            </Link>
          ) : <span className="article-navigation-placeholder" />}
        </nav>
      )}
    </article>
  );
}

const contactPageCopy: Record<CookieLocale, {
  address: string; registration: string; phone: string; email: string; title: string; intro: string;
  name: string; emailField: string; reason: string; message: string; options: string[]; send: string;
  success: string; error: string;
}> = {
  en: {
    address: "Address:", registration: "Registration No.:", phone: "Phone:", email: "Email:",
    title: "Contact us", intro: "Send us a message and we'll get back to you.", name: "Your name",
    emailField: "Your email", reason: "Reason", message: "Message",
    options: ["General question", "Support", "Partnership", "Bug report", "Other"], send: "Send message",
    success: "Thank you. Your message has been sent.", error: "We could not send your message. Please try again.",
  },
  ru: {
    address: "Адрес:", registration: "Регистрационный номер:", phone: "Телефон:", email: "Email:",
    title: "Связаться с нами", intro: "Напишите нам — мы ответим как можно скорее.", name: "Ваше имя",
    emailField: "Email", reason: "Тема", message: "Сообщение",
    options: ["Общий вопрос", "Поддержка", "Партнёрство", "Сообщить о баге", "Другое"], send: "Отправить",
    success: "Спасибо. Ваше сообщение отправлено.", error: "Не удалось отправить сообщение. Попробуйте ещё раз.",
  },
  es: {
    address: "Dirección:", registration: "Número de registro:", phone: "Teléfono:", email: "Correo electrónico:",
    title: "Contáctanos", intro: "Envíanos un mensaje y te responderemos lo antes posible.", name: "Tu nombre",
    emailField: "Tu correo", reason: "Motivo", message: "Mensaje",
    options: ["Pregunta general", "Soporte", "Colaboración", "Reportar un error", "Otro"], send: "Enviar mensaje",
    success: "Gracias. Tu mensaje ha sido enviado.", error: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
  },
};

function Contact() {
  const locale = localeOf();
  const copy = contactPageCopy[locale];
  const [draft, setDraft] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [notice, setNotice] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post("/public/contact", { ...draft, locale });
      setNotice(copy.success);
      setDraft({ name: "", email: "", subject: "", message: "" });
    } catch {
      setNotice(copy.error);
    }
  };
  return (
    <section className="contact-page">
      <aside className="contact-details">
        <p>BYITSMART DOO</p>
        <dl>
          <dt>{copy.address}</dt>
          <dd>Rista Lekića bb, 85000 Bar, Montenegro</dd>
          <dt>{copy.registration}</dt>
          <dd>03365891</dd>
          <dt>{copy.phone}</dt>
          <dd><a href="tel:+38268530700">+382 68 530 700</a></dd>
          <dt>{copy.email}</dt>
          <dd><a href="mailto:contact@letsbeparents.com">contact@letsbeparents.com</a></dd>
        </dl>
      </aside>
      <div className="contact-form-panel">
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
        <form onSubmit={submit}>
          <label className="sr-only">Do not fill<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <label>
            <span>{copy.name}</span>
            <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label>
            <span>{copy.emailField}</span>
            <input type="email" value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} required />
          </label>
          <label className="contact-full">
            <span>{copy.reason}</span>
            <span className="contact-select">
              <select aria-label={copy.reason} value={draft.subject} onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}>
                {copy.options.map((option, index) => <option key={option} value={index === 0 ? "" : option}>{option}</option>)}
              </select>
            </span>
          </label>
          <label className="contact-full">
            <span>{copy.message}</span>
            <textarea value={draft.message} onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))} required />
          </label>
          {notice && <p className="notice contact-full">{notice}</p>}
          <button className="contact-submit">{copy.send}</button>
        </form>
      </div>
    </section>
  );
}

function ContentPage() {
  const { locale = "en", slug = "" } = useParams();
  const [page, setPage] = useState<Row | null>(null);
  useEffect(() => {
    api
      .get<Row>(
        `/public/content-pages/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}`,
      )
      .then(setPage)
      .catch(() =>
        setPage({
          title: "Page not found",
          content: "This page is not currently available.",
        }),
      );
  }, [locale, slug]);
  if (!page) return <LoadingIndicator />;
  const html = asText(page.bodyHtml ?? page.body_html ?? page.content ?? page.body ?? page.html);
  return (
    <article className="static-page">
      <h1>{asText(page.title)}</h1>
      <div
        className="article-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}

type ResourceTool = {
  slug: string;
  title: string;
  description: string;
  tag?: string;
  format?: string;
  downloadUrl?: string;
  downloadName?: string;
  sections?: string[];
  sampleQuestions?: string[];
  disclaimer?: string;
};

type ResourceCategoryData = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  disclaimer?: string;
  tools: ResourceTool[];
};

const RESOURCES_CATEGORIES: ResourceCategoryData[] = [
  {
    slug: "co-parenting",
    eyebrow: "Co-parenting",
    title: "Tools for building a family with a co-parent",
    description: "Questions, checklists and templates for finding and getting to know a co-parent.",
    icon: "coparenting",
    tools: [
      {
        slug: "planning-template",
        title: "Co-Parenting Planning Template",
        description: "Talk through parenting, finances, living arrangements and boundaries before you move forward.",
        tag: "Available now",
        format: ".docx · 10 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Co-Parenting-Planning-Template.docx",
        downloadName: "LetsBeParents-Co-Parenting-Planning-Template.docx",
        sections: [
          "Our intentions",
          "The child's home and everyday life",
          "Parenting values and decisions",
          "Pregnancy, conception and medical care",
          "Finances",
          "Communication and boundaries",
          "New partners and changing families",
          "The child's relationship with both parents",
          "Conflict and outside support",
          "If circumstances change",
        ],
        sampleQuestions: [
          "Why are we considering co-parenting?",
          "What would make us decide not to move forward?",
          "What do we each expect from the other person as a parent?",
        ],
        disclaimer: "This template is a conversation tool, not a legal document. Completing it does not create or guarantee legal parenthood, parental responsibility, custody or financial rights. Check the law that applies to your family before you rely on anything you agree here.",
      },
      {
        slug: "questions-to-ask", title: "Questions to Ask a Potential Co-Parent",
        description: "A practical list of questions covering parenting, money, communication and everyday life.",
        tag: "Available now", format: ".docx · 7 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Questions-to-Ask-a-Potential-Co-Parent.docx",
        downloadName: "LetsBeParents-Questions-to-Ask-a-Potential-Co-Parent.docx",
        sections: ["Why parenthood?", "Everyday life", "Parenting values", "Money", "Relationships and boundaries", "Difficult situations", "Before moving forward"],
        sampleQuestions: ["Why do you want to become a parent?", "Why are you considering co-parenting?", "What does being an involved parent mean to you?"],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "first-meeting", title: "First Meeting With a Potential Co-Parent",
        description: "What to cover and look out for the first time you meet in person.",
        tag: "Available now", format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-First-Meeting-With-a-Potential-Co-Parent.docx",
        downloadName: "LetsBeParents-First-Meeting-With-a-Potential-Co-Parent.docx",
        sections: ["Before you meet", "Start with the big picture", "Notice how it feels", "You do not need to decide everything", "After the meeting"],
        sampleQuestions: ["Why are you both considering co-parenting?", "What does parenthood mean to each of you?", "What kind of family are you hoping to build?"],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "red-flags-checklist", title: "Co-Parenting Red Flags Checklist",
        description: "Signs worth paying attention to before you commit to co-parenting with someone.",
        tag: "Available now", format: ".docx · 7 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Co-Parenting-Red-Flags-Checklist.docx",
        downloadName: "LetsBeParents-Co-Parenting-Red-Flags-Checklist.docx",
        sections: ["Pressure", "Boundaries", "Communication", "Money", "Responsibility", "Safety", "If something feels wrong"],
        sampleQuestions: ["They push you to make major decisions quickly.", "They use age, fertility timing or fear of missing out to pressure you.", "They ignore a clear no."],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "compatibility-scorecard", title: "Co-Parent Compatibility Scorecard",
        description: "A simple way to note where you align and where you don't, after your first meeting.",
        tag: "Available now", format: ".docx · 3 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Co-Parent-Compatibility-Scorecard.docx",
        downloadName: "LetsBeParents-Co-Parent-Compatibility-Scorecard.docx",
        sections: ["Rate 1-5", "Questions to ask yourself", "Before another step"],
        sampleQuestions: ["Communication", "Respect for boundaries", "Parenting values"],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "parenting-values-worksheet", title: "Parenting Values Worksheet",
        description: "Clarify your own parenting values before comparing them with someone else's.",
        tag: "Available now", format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Parenting-Values-Worksheet.docx",
        downloadName: "LetsBeParents-Parenting-Values-Worksheet.docx",
        sections: ["What matters most", "Everyday parenting", "Education and identity", "Money and family", "When we disagree"],
        sampleQuestions: ["The three things I most want my child to experience are:", "The values I want to model are:", "The kind of parent I hope to be is:"],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
    ],
  },
  {
    slug: "fertility-donor",
    eyebrow: "Fertility & donor conception",
    title: "Prepare for clinic and donor conversations",
    description: "Practical questions and checklists for talking to clinics and professionals.",
    icon: "fertility",
    disclaimer: "These resources are designed to help you prepare for conversations with qualified professionals. They are not medical or legal advice.",
    tools: [
      {
        slug: "fertility-consultation-questions", title: "Fertility Consultation Questions",
        description: "Questions worth bringing to your first consultation with a fertility clinic.",
        tag: "Available now", format: ".docx · 7 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Fertility-Consultation-Questions.docx",
        downloadName: "LetsBeParents-Fertility-Consultation-Questions.docx",
        sections: ["Understanding your options", "Success and expectations", "Risks and medication", "Cost", "If treatment does not work", "Support", "Donor conception"],
        sampleQuestions: ["Why are you recommending this treatment?", "What alternatives are available?", "What factors in my history affect the recommendation?"],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "donor-conception-questions", title: "Donor Conception Questions Checklist",
        description: "What to ask and think through before choosing donor conception.",
        tag: "Available now", format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Donor-Conception-Questions-Checklist.docx",
        downloadName: "LetsBeParents-Donor-Conception-Questions-Checklist.docx",
        sections: ["About the donor", "Clinic and treatment", "Known donor", "Talking to your child", "Legal and future questions"],
        sampleQuestions: ["What information is available?", "What medical and genetic screening has been completed?", "What information can the future child access?"],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "fertility-clinic-checklist", title: "Choosing a Fertility Clinic Checklist",
        description: "What to compare when you're deciding between fertility clinics.",
        tag: "Available now", format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Choosing-a-Fertility-Clinic-Checklist.docx",
        downloadName: "LetsBeParents-Choosing-a-Fertility-Clinic-Checklist.docx",
        sections: ["Regulation and safety", "Treatment and evidence", "Costs", "Support", "Treatment abroad"],
        sampleQuestions: ["Is the clinic properly regulated?", "What quality and safety standards apply?", "How are laboratories and storage managed?"],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
    ],
  },
  {
    slug: "parenthood-planning",
    eyebrow: "Parenthood planning",
    title: "Get ready for the practical side",
    description: "For the practical side of preparing for a child.",
    icon: "planning",
    tools: [
      {
        slug: "financial-planning", title: "Financial Planning for Future Parents",
        description: "A worksheet for thinking through the cost of building and raising a family.",
        tag: "Available now", format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Financial-Planning-for-Future-Parents.docx",
        downloadName: "LetsBeParents-Financial-Planning-for-Future-Parents.docx",
        sections: ["Before pregnancy or treatment", "Pregnancy and birth", "First year", "Shared expenses", "Financial changes"],
        sampleQuestions: ["Which costs should be shared equally?", "Which costs should be divided by income?", "What happens if income changes?"],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
      {
        slug: "parenting-values-worksheet", title: "Parenting Values Worksheet",
        description: "Clarify your own parenting values before comparing them with someone else's.",
        tag: "Available now", format: ".docx · 5 sections · free",
        downloadUrl: "/web-static/resources/LetsBeParents-Parenting-Values-Worksheet.docx",
        downloadName: "LetsBeParents-Parenting-Values-Worksheet.docx",
        sections: ["What matters most", "Everyday parenting", "Education and identity", "Money and family", "When we disagree"],
        sampleQuestions: ["The three things I most want my child to experience are:", "The values I want to model are:", "The kind of parent I hope to be is:"],
        disclaimer: "This resource is for planning and discussion purposes. It is not legal, medical, psychological or financial advice. Rules and professional recommendations vary by country and individual circumstances.",
      },
    ],
  },
];

function resourceArrow() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>;
}

function resourceCategoryIcon(icon: string) {
  if (icon === "fertility") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>;
  if (icon === "planning") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>;
}

function resourceDocIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" /></svg>;
}

function resourceQuizIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>;
}

function resourceChatIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>;
}

function ResourcesIndex() {
  const locale = localeOf();
  return (
    <div className="resources-page">
      <section className="resources-hero">
        <span className="landing-pill resources-pill"><i /><span>Resources & tools</span></span>
        <h1>Parenthood resources and tools</h1>
        <p>Practical checklists, worksheets and planning tools to help you explore co-parenting, fertility, donor conception and the practical side of becoming a parent.</p>
      </section>

      <section className="resources-start">
        <div className="landing-section-intro">
          <span>Start here</span>
          <h2>Three good places to begin</h2>
          <p className="resources-section-sub">Whichever stage you're at.</p>
        </div>
        <div className="resources-start-grid">
          <Link className="resources-start-card" to={`/${locale}/resources/co-parenting/planning-template`}>
            <span className="resources-start-icon">{resourceDocIcon()}</span>
            <h3>Co-Parenting Planning Template</h3>
            <p>Thinking about becoming co-parents? Talk through parenting, finances, living arrangements and boundaries before you move forward.</p>
            <span className="resources-start-link">Download the template {resourceArrow()}</span>
          </Link>
          <Link className="resources-start-card" to={`/${locale}/resources/co-parenting/questions-to-ask`}>
            <span className="resources-start-icon">{resourceDocIcon()}</span>
            <h3>Questions to Ask a Potential Co-Parent</h3>
            <p>Not sure what to ask before taking the next step? A practical list covering parenting, money, communication and everyday life.</p>
            <span className="resources-start-link">View the questions {resourceArrow()}</span>
          </Link>
          <Link className="resources-start-card featured" to={`/${locale}/resources/co-parenting/compatibility-quiz`}>
            <span className="resources-start-icon">{resourceQuizIcon()}</span>
            <h3>Co-Parenting Compatibility Quiz</h3>
            <p>See where your expectations line up, and what's worth discussing further. It won't tell you whether you're a "match."</p>
            <span className="resources-start-link">Take the quiz {resourceArrow()}</span>
          </Link>
        </div>
      </section>

      <section className="resources-categories">
        <div className="landing-section-intro">
          <span>Explore all</span>
          <h2>Explore all resources</h2>
          <p className="resources-section-sub">The full set of checklists, worksheets and templates, grouped by what you're working through.</p>
        </div>
        <div className="resources-category-grid">
          {RESOURCES_CATEGORIES.map((cat) => (
            <article key={cat.slug} className="resources-category-card">
              <span className="resources-category-icon">{resourceCategoryIcon(cat.icon)}</span>
              <span className="resources-category-eyebrow">{cat.eyebrow}</span>
              <h3>{cat.title}</h3>
              <p>{cat.description}</p>
              <ul>
                {cat.tools.map((tool) => (
                  <li key={tool.slug}><Link to={`/${locale}/resources/${cat.slug}/${tool.slug}`}>{tool.title}</Link></li>
                ))}
              </ul>
              {cat.disclaimer && <p className="resources-category-note">{cat.disclaimer}</p>}
              <Link className="resources-category-cta" to={`/${locale}/resources/${cat.slug}`}>
                Explore {cat.eyebrow.toLowerCase()} {resourceArrow()}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="resources-routes">
        <span className="resources-routes-icon">{resourceArrow()}</span>
        <div className="resources-routes-copy">
          <h2>Not sure where to start?</h2>
          <p>You don't have to have everything figured out. Start with the question that's most relevant to you right now.</p>
        </div>
        <div className="resources-routes-grid">
          <Link to={`/${locale}/resources/co-parenting`}>I'm exploring co-parenting {resourceArrow()}</Link>
          <Link to={`/${locale}/resources/fertility-donor`}>I'm thinking about fertility {resourceArrow()}</Link>
          <Link to={`/${locale}/resources/fertility-donor`}>I'm considering donor conception {resourceArrow()}</Link>
          <Link to={`/${locale}/resources/parenthood-planning`}>I want to plan ahead {resourceArrow()}</Link>
        </div>
      </section>

      <section className="resources-pro">
        <span className="resources-pro-icon">{resourceChatIcon()}</span>
        <div className="resources-pro-copy">
          <h2>Looking for professional guidance?</h2>
          <p>Some questions are better discussed with a qualified professional. LetsBeParents is building a trusted space to connect people with psychological, medical and other professional support when they need it.</p>
        </div>
        <Link className="resources-pro-button" to={`/${locale}/contact`}>Learn about professional support {resourceArrow()}</Link>
      </section>

      <section className="landing-cta">
        <h2>Explore LetsBeParents</h2>
        <p>These tools work well on their own - or as part of your journey on the platform.</p>
        <Link to={`/${locale}/auth/register`}>Create free account <span>→</span></Link>
      </section>
    </div>
  );
}

function ResourceCategory() {
  const locale = localeOf();
  const { category = "" } = useParams();
  const cat = RESOURCES_CATEGORIES.find((item) => item.slug === category);
  if (!cat) {
    return (
      <div className="resources-page">
        <section className="resources-hero">
          <h1>Resource category not found</h1>
          <Link className="landing-gradient-button" to={`/${locale}/resources`}>Back to Resources & Tools {resourceArrow()}</Link>
        </section>
      </div>
    );
  }
  return (
    <div className="resources-page">
      <section className="resources-hero resource-detail-hero">
        <span className="resources-category-icon large">{resourceCategoryIcon(cat.icon)}</span>
        <h1>{cat.title}</h1>
        <p>{cat.description}</p>
      </section>
      <div className="resources-tool-grid">
        {cat.tools.map((tool) => (
          <Link key={tool.slug} className="resources-tool-card" to={`/${locale}/resources/${cat.slug}/${tool.slug}`}>
            <span className="resources-tool-icon">{resourceDocIcon()}</span>
            {tool.tag && <span className="resources-tool-tag">{tool.tag}</span>}
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            <span className="resources-tool-link">{tool.downloadUrl ? "Download the template" : "View resource"} {resourceArrow()}</span>
          </Link>
        ))}
      </div>
      {cat.slug === "co-parenting" && (
        <section className="resources-quiz-strip">
          <h2>Not sure you're on the same page yet?</h2>
          <p>The Co-Parenting Compatibility Quiz helps you and a potential co-parent see where your expectations align - and what's worth discussing further.</p>
          <Link className="landing-gradient-button" to={`/${locale}/resources/co-parenting/compatibility-quiz`}>Take the quiz {resourceArrow()}</Link>
        </section>
      )}
    </div>
  );
}

// Co-Parenting Compatibility Quiz - built from LetsBeParents_Quiz_UIUX_Spec_Board.pdf.
// MVP scope per that spec: 26 questions / 8 sections / ~5 min, a reflection tool (not a compatibility
// test) - explicitly no score, percentage or pass/fail. Results reflect one person's own answer
// patterns (which sections they answered decisively vs. uncertainly), not a two-person comparison -
// the spec labels person-to-person comparison "Phase 2", out of scope here.
const QUIZ_SECTIONS = ["Why parent?", "Parenting", "Everyday life", "Money", "Communication", "Boundaries", "Future", "Important questions"];

type QuizQuestion = { section: number; type: "select" | "text"; prompt: string; options?: string[] };

// For "select" questions, the LAST option is always the "still deciding" one - used only to gauge
// how settled someone's thinking is in that area for the reflection results, never shown as "wrong".
const QUIZ_QUESTIONS: QuizQuestion[] = [
  { section: 1, type: "select", prompt: "Why do you want to become a parent?", options: ["I've always wanted to raise a child", "I want to build a family before it's too late for me", "I want to give a child a loving home, however that looks", "I'm honestly still exploring why"] },
  { section: 1, type: "select", prompt: "How would you describe the kind of parent you hope to be?", options: ["Hands-on and involved in the daily details", "Present, but giving my child independence", "Guided by structure and routine", "Still figuring this out"] },
  { section: 1, type: "select", prompt: "What matters most to you about becoming a parent right now?", options: ["Timing - I don't want to wait much longer", "Finding the right situation, whenever that happens", "Doing it in a way that feels stable and prepared", "I'm not sure yet, I'm exploring my options"] },
  { section: 2, type: "select", prompt: "How would you ideally share parenting responsibilities?", options: ["As equally as possible", "Based on schedules", "Based on income", "Decide together", "I'm not sure yet"] },
  { section: 2, type: "select", prompt: "What's your view on discipline?", options: ["Clear rules and consistent consequences", "Gentle guidance, talking things through", "Depends on the situation", "Something we'd need to agree on together"] },
  { section: 2, type: "select", prompt: "How involved do you want the other parent to be in day-to-day decisions?", options: ["Involved in everything, always", "Involved in the big decisions, independent on the small ones", "Mostly independent, checking in occasionally", "I'm still working this out"] },
  { section: 2, type: "select", prompt: "How do you feel about extended family being involved in parenting?", options: ["Very involved - grandparents and family close by", "Involved sometimes, but we set the boundaries", "Minimal involvement, we'd raise the child mostly ourselves", "Depends entirely on the family, I'd need to think it through"] },
  { section: 3, type: "select", prompt: "Where would you ideally want your child to grow up?", options: ["Close to where I live now", "Open to moving somewhere new", "Close to family, wherever they are", "Haven't thought about it yet"] },
  { section: 3, type: "select", prompt: "How would you divide everyday routines like school runs, meals and bedtime?", options: ["Split evenly by default", "Whoever's schedule allows it that day", "One of us takes the lead, the other supports", "We'd figure it out as we go"] },
  { section: 3, type: "select", prompt: "How much flexibility do you want in your day-to-day parenting schedule?", options: ["A clear, consistent routine works best for me", "I like flexibility and adapting as needed", "A mix of both", "Not sure yet"] },
  { section: 4, type: "select", prompt: "How do you feel about splitting child-related costs?", options: ["Equally, no matter what we each earn", "Proportional to what we each earn", "One of us takes on more financially", "We'd need to talk this through"] },
  { section: 4, type: "select", prompt: "How would you handle a large, unexpected expense for your child?", options: ["Split it immediately, no discussion needed", "Talk it through and decide together first", "Whoever has the means covers it, for now", "Honestly not sure yet"] },
  { section: 4, type: "select", prompt: "How comfortable are you discussing money with a co-parent before you commit to anything?", options: ["Very comfortable - I'd want this settled early", "Comfortable, but I'd ease into it", "A bit uneasy, but I know it's necessary", "I tend to avoid money conversations"] },
  { section: 5, type: "select", prompt: "How often do you expect to communicate with a co-parent about your child?", options: ["Daily updates, even for small things", "Regularly, for anything that matters", "Only when a decision needs to be made", "I'm not sure what's realistic yet"] },
  { section: 5, type: "select", prompt: "What's your preferred way to handle a disagreement?", options: ["Talk it out immediately, in person if possible", "Take some time to think, then talk", "Write it out first so I can be clear", "I tend to avoid conflict when I can"] },
  { section: 5, type: "select", prompt: "How do you feel about being asked hard questions early on?", options: ["I'd rather know everything upfront", "I'm fine with it once there's some trust", "I'd prefer to ease into deeper topics", "It makes me a little uncomfortable"] },
  { section: 6, type: "select", prompt: "How do you feel about a co-parent dating other people?", options: ["Completely fine, as long as it's respectful", "Fine, but I'd want some boundaries in place", "I'd want to discuss this before it happens", "I haven't thought this through yet"] },
  { section: 6, type: "select", prompt: "What personal information are you comfortable sharing early in a co-parenting conversation?", options: ["Pretty much everything relevant", "The basics, more as trust builds", "Only what's directly related to parenting", "I'm naturally private about most things"] },
  { section: 6, type: "select", prompt: "How do you feel about a co-parent setting limits on how involved you are?", options: ["Completely fair, we should each be able to set limits", "Depends on what the limit is", "I'd want to be as involved as possible, always", "Haven't considered this yet"] },
  { section: 7, type: "select", prompt: "How do you picture your family five years from now?", options: ["A clear, stable routine we've settled into", "Still adapting as things change", "Depends a lot on where life takes us", "Honestly, I haven't pictured it yet"] },
  { section: 7, type: "select", prompt: "What happens if one of you wants to relocate someday?", options: ["We'd need to agree on this before starting", "We'd figure it out together when it comes up", "I'd want the flexibility to move if needed", "Not sure how I'd handle this"] },
  { section: 7, type: "select", prompt: "How do you feel about the arrangement changing as your child gets older?", options: ["I expect it to evolve, and I'm comfortable with that", "I'd want to keep things as consistent as possible", "A bit of both, depending on what's needed", "Haven't thought that far ahead"] },
  { section: 8, type: "select", prompt: "What would make you decide not to move forward with a potential co-parent?", options: ["A mismatch in core values around parenting", "Feeling pressured or rushed into decisions", "Concerns about reliability or follow-through", "I'd know it when I felt it"] },
  { section: 8, type: "text", prompt: "What do you most want a potential co-parent to understand about you before you move forward together?" },
  { section: 8, type: "text", prompt: "What's one question you're afraid to ask, but know you should?" },
  { section: 8, type: "text", prompt: "Is there anything else about your situation or expectations you'd want to share?" },
];

const QUIZ_STRENGTH_COPY: Record<number, { title: string; copy: string }> = {
  1: { title: "Why parent?", copy: "You seem clear on why you want to become a parent - that clarity is worth naming out loud early in a conversation." },
  2: { title: "Parenting", copy: "You appear to have a settled sense of how you'd want to co-parent day to day." },
  3: { title: "Everyday life", copy: "You have a fairly clear picture of what daily life and routines could look like." },
  4: { title: "Money", copy: "You seem comfortable and decisive about how money and costs would be handled." },
  5: { title: "Communication", copy: "You appear comfortable discussing difficult subjects and looking for solutions together." },
  6: { title: "Boundaries", copy: "You have a clear sense of the boundaries that matter to you." },
  7: { title: "Future", copy: "You seem to have thought through how things might change as your family grows." },
  8: { title: "Important questions", copy: "You have a clear sense of what would - and wouldn't - work for you." },
};

const QUIZ_DISCUSS_COPY: Record<number, { title: string; copy: string }> = {
  1: { title: "Why parent?", copy: "Your answers suggest your reasons for parenthood are still taking shape - worth putting into words before you go much further." },
  2: { title: "Parenting", copy: "How day-to-day parenting responsibilities would actually be split looks like an area worth a deeper conversation." },
  3: { title: "Everyday life", copy: "Living arrangements and daily routines - your answers show an area where you may want a deeper conversation." },
  4: { title: "Money", copy: "How costs would be shared seems less settled for you - a good one to raise early, not after the fact." },
  5: { title: "Communication", copy: "How you'd communicate day to day, especially during disagreements, is worth talking through explicitly." },
  6: { title: "Boundaries", copy: "Where your boundaries sit isn't fully settled yet - worth clarifying for yourself, then with a potential co-parent." },
  7: { title: "Future", copy: "How things might change over the years is still uncertain for you - worth revisiting as the relationship develops." },
  8: { title: "Important questions", copy: "Some of the harder questions are still open for you - they're worth sitting with before you commit to anything." },
};

const QUIZ_PROMPTS: Record<number, string[]> = {
  1: ["Why are you both considering this now, specifically?", "What would make this feel like the wrong decision in hindsight?"],
  2: ["How would you split decisions on schooling, healthcare and discipline?", "What happens if you disagree on a parenting decision?"],
  3: ["Where would you each ideally want to live, and how close to each other?", "How would a typical week actually be divided?"],
  4: ["How would you divide costs if one of you earns significantly more?", "Who would cover an unplanned, larger expense?"],
  5: ["How often do you expect to check in with each other?", "What does a fair way to disagree look like to each of you?"],
  6: ["What would you want to know about each other's other relationships?", "What information do you each consider private?"],
  7: ["What would you do if one of you wanted to move away?", "How do you imagine this arrangement evolving over 10+ years?"],
  8: ["What would be a dealbreaker for each of you?", "Is there anything you're hesitant to bring up right now?"],
};

function computeQuizResults(answers: (string | null)[]) {
  const bySection = new Map<number, { decisive: number; total: number }>();
  QUIZ_QUESTIONS.forEach((q, i) => {
    if (q.type !== "select" || !q.options) return;
    const entry = bySection.get(q.section) ?? { decisive: 0, total: 0 };
    entry.total += 1;
    const answer = answers[i];
    if (answer && answer !== q.options[q.options.length - 1]) entry.decisive += 1;
    bySection.set(q.section, entry);
  });
  const ranked = [...bySection.entries()].map(([section, { decisive, total }]) => ({ section, ratio: total ? decisive / total : 0 }));
  const byStrength = [...ranked].sort((a, b) => b.ratio - a.ratio);
  const strongest = byStrength.filter((r) => r.ratio >= 0.66).slice(0, 2).map((r) => r.section);
  const discuss = [...ranked].sort((a, b) => a.ratio - b.ratio).filter((r) => r.ratio < 0.66 && !strongest.includes(r.section)).slice(0, 2).map((r) => r.section);
  const prompts = discuss.flatMap((section) => QUIZ_PROMPTS[section] ?? []).slice(0, 3);
  return { strongest, discuss, prompts };
}

function CompatibilityQuiz() {
  const locale = localeOf();
  const [step, setStep] = useState<"intro" | number | "results">("intro");
  const [answers, setAnswers] = useState<(string | null)[]>(() => QUIZ_QUESTIONS.map(() => null));
  const totalQuestions = QUIZ_QUESTIONS.length;

  const setAnswer = (index: number, value: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  const downloadResults = (results: ReturnType<typeof computeQuizResults>) => {
    const lines: string[] = ["LetsBeParents - Co-Parenting Compatibility Quiz", "A reflection of your priorities, not a verdict.", ""];
    QUIZ_QUESTIONS.forEach((q, i) => {
      lines.push(`${QUIZ_SECTIONS[q.section - 1]} - ${q.prompt}`);
      lines.push(`> ${answers[i] || "(not answered)"}`);
      lines.push("");
    });
    lines.push("Your strongest areas:");
    results.strongest.forEach((s) => lines.push(`- ${QUIZ_STRENGTH_COPY[s].title}: ${QUIZ_STRENGTH_COPY[s].copy}`));
    lines.push("");
    lines.push("Worth discussing:");
    results.discuss.forEach((s) => lines.push(`- ${QUIZ_DISCUSS_COPY[s].title}: ${QUIZ_DISCUSS_COPY[s].copy}`));
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "LetsBeParents-Compatibility-Quiz-Results.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (step === "intro") {
    return (
      <div className="quiz-intro">
        <h2>Could you see yourself parenting well with this person?</h2>
        <p>This quiz won't tell you whether you should co-parent. It helps you see where expectations align - and what's worth discussing further.</p>
        <div className="quiz-intro-grid">
          <div>
            <h3>Before you start</h3>
            <ul>
              <li>{totalQuestions} questions</li>
              <li>About 5 minutes</li>
              <li>You can go back and edit answers</li>
              <li>Free-text answers are optional</li>
            </ul>
          </div>
          <div>
            <h3>Privacy</h3>
            <p>Your answers stay in this browser session and are never shared automatically. Create a free account if you'd like to save or share your results.</p>
          </div>
        </div>
        <button type="button" className="landing-gradient-button" onClick={() => setStep(0)}>Start the quiz {resourceArrow()}</button>
      </div>
    );
  }

  if (step === "results") {
    const results = computeQuizResults(answers);
    return (
      <div className="quiz-results">
        <div className="quiz-results-head">
          <h2>What your answers suggest</h2>
          <p>A reflection of your priorities - not a verdict.</p>
        </div>
        {results.strongest.length > 0 && (
          <div className="quiz-result-group strong">
            <h3>Your strongest areas</h3>
            {results.strongest.map((s) => (
              <div key={s} className="quiz-result-card">
                <strong>{QUIZ_STRENGTH_COPY[s].title}</strong>
                <p>{QUIZ_STRENGTH_COPY[s].copy}</p>
              </div>
            ))}
          </div>
        )}
        {results.discuss.length > 0 ? (
          <div className="quiz-result-group discuss">
            <h3>Worth discussing</h3>
            {results.discuss.map((s) => (
              <div key={s} className="quiz-result-card">
                <strong>{QUIZ_DISCUSS_COPY[s].title}</strong>
                <p>{QUIZ_DISCUSS_COPY[s].copy}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="quiz-result-group discuss">
            <h3>Worth discussing</h3>
            <div className="quiz-result-card">
              <p>You answered fairly decisively across the board - that's a good sign, but it's still worth having these conversations out loud with a potential co-parent, not just with yourself.</p>
            </div>
          </div>
        )}
        {results.prompts.length > 0 && (
          <div className="quiz-result-prompts">
            <h3>Questions to explore together</h3>
            {results.prompts.map((prompt) => (
              <span key={prompt}>{resourceArrow()} {prompt}</span>
            ))}
          </div>
        )}
        <div className="quiz-result-actions quiz-no-print">
          <button type="button" className="landing-gradient-button" onClick={() => downloadResults(results)}>Download results</button>
          <button type="button" className="resources-pro-button" onClick={() => window.print()}>Print</button>
          <span className="quiz-no-score">No compatibility %</span>
        </div>
        <div className="quiz-next-steps quiz-no-print">
          <Link to={`/${locale}/resources/co-parenting/questions-to-ask`}>Questions to Ask a Potential Co-Parent {resourceArrow()}</Link>
          <Link to={`/${locale}/resources/co-parenting/planning-template`}>Create a Co-Parenting Plan {resourceArrow()}</Link>
          <Link to={`/${locale}/auth/register`}>Invite your potential co-parent {resourceArrow()}</Link>
        </div>
      </div>
    );
  }

  const index = step;
  const question = QUIZ_QUESTIONS[index];
  const answer = answers[index];
  const canAdvance = question.type === "text" || Boolean(answer);
  const isLast = index === totalQuestions - 1;
  const goNext = () => {
    if (isLast) setStep("results");
    else setStep(index + 1);
  };
  const goBack = () => {
    if (index === 0) setStep("intro");
    else setStep(index - 1);
  };
  return (
    <div className="quiz-question">
      <div className="quiz-progress">
        <div className="quiz-progress-fill" style={{ width: `${((index + 1) / totalQuestions) * 100}%` }} />
      </div>
      <span className="quiz-progress-label">Section {question.section} of 8 - {QUIZ_SECTIONS[question.section - 1]}</span>
      <h2>{question.prompt}</h2>
      {question.type === "select" ? (
        <>
          <p className="quiz-question-hint">Choose the answer that feels closest to you.</p>
          <div className="quiz-options">
            {question.options?.map((option) => (
              <button
                key={option}
                type="button"
                className={`quiz-option${answer === option ? " selected" : ""}`}
                onClick={() => setAnswer(index, option)}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="quiz-question-hint">Optional - write as much or as little as you like.</p>
          <textarea
            className="quiz-textarea"
            value={answer ?? ""}
            onChange={(e) => setAnswer(index, e.target.value)}
            rows={4}
          />
        </>
      )}
      <div className="quiz-nav">
        <button type="button" className="quiz-back" onClick={goBack}>Back</button>
        <button type="button" className="landing-gradient-button" disabled={!canAdvance} onClick={goNext}>
          {isLast ? "See results" : "Next"} {resourceArrow()}
        </button>
      </div>
      <p className="quiz-nav-note">Answers can be changed before you reach your results.</p>
    </div>
  );
}

function ResourceTool() {
  const locale = localeOf();
  const { category = "", tool: toolSlug = "" } = useParams();
  const cat = RESOURCES_CATEGORIES.find((item) => item.slug === category);
  if (!cat) {
    return (
      <div className="resources-page">
        <section className="resources-hero">
          <h1>Resource not found</h1>
          <Link className="landing-gradient-button" to={`/${locale}/resources`}>Back to Resources & Tools {resourceArrow()}</Link>
        </section>
      </div>
    );
  }
  if (toolSlug === "compatibility-quiz" && cat.slug === "co-parenting") {
    return (
      <div className="resources-page quiz-page">
        <section className="resources-hero resource-detail-hero quiz-hero">
          <span className="resources-category-icon large">{resourceQuizIcon()}</span>
          <h1>Co-Parenting Compatibility Quiz</h1>
          <p>See where your expectations line up, and what's worth discussing further. It won't tell you whether you're a "match."</p>
        </section>
        <CompatibilityQuiz />
      </div>
    );
  }
  const tool = cat.tools.find((item) => item.slug === toolSlug);
  if (!tool) {
    return (
      <div className="resources-page">
        <section className="resources-hero">
          <h1>Resource not found</h1>
          <Link className="landing-gradient-button" to={`/${locale}/resources/${cat.slug}`}>Back to {cat.eyebrow} {resourceArrow()}</Link>
        </section>
      </div>
    );
  }
  return (
    <div className="resources-page">
      <section className="resources-hero resource-detail-hero">
        <span className="resources-category-icon large">{resourceDocIcon()}</span>
        <h1>{tool.title}</h1>
        <p>{tool.description}</p>
        {tool.downloadUrl ? (
          <div className="resources-tool-actions">
            <a className="landing-gradient-button" href={tool.downloadUrl} download={tool.downloadName}>
              Download the template {resourceArrow()}
            </a>
            {tool.format && <span className="resources-tool-format">{tool.format}</span>}
          </div>
        ) : (
          <span className="resources-tool-tag soon">Coming soon</span>
        )}
      </section>
      {tool.sections ? (
        <div className="resources-tool-layout">
          <div className="resources-tool-main">
            <div className="resources-tool-preview">
              <h2>What's inside</h2>
              <p>{tool.sections.length} sections, each with open questions for both of you to answer - independently first, then together.</p>
              <ol className="resources-tool-sections">
                {tool.sections.map((section, index) => (
                  <li key={section}><span>{String(index + 1).padStart(2, "0")}</span>{section}</li>
                ))}
              </ol>
              {tool.sampleQuestions && (
                <div className="resources-tool-samples">
                  <span>A few sample questions from section 1</span>
                  <div className="resources-tool-sample-list">
                    {tool.sampleQuestions.map((question) => <span key={question}>{question}</span>)}
                  </div>
                </div>
              )}
            </div>
            {tool.disclaimer && <div className="resources-tool-disclaimer">{tool.disclaimer}</div>}
          </div>
          <aside className="resources-tool-sidebar">
            <div className="resources-tool-related">
              <h3>Related resources</h3>
              {cat.tools.filter((item) => item.slug !== tool.slug).slice(0, 3).map((item) => (
                <Link key={item.slug} to={`/${locale}/resources/${cat.slug}/${item.slug}`}>{item.title} {resourceArrow()}</Link>
              ))}
            </div>
            <div className="resources-tool-cta">
              <h3>Ready to take the next step?</h3>
              <p>Create a free account to save your answers and build a shared Family Plan on LetsBeParents.</p>
              <Link className="landing-gradient-button" to={`/${locale}/auth/register`}>Create free account {resourceArrow()}</Link>
            </div>
          </aside>
        </div>
      ) : (
        <div className="resources-coming-soon">
          <p>We're finishing this resource - check back soon, or explore what's already available in {cat.eyebrow}.</p>
          <Link className="landing-gradient-button" to={`/${locale}/resources/${cat.slug}`}>Back to {cat.eyebrow} {resourceArrow()}</Link>
        </div>
      )}
    </div>
  );
}

// Find Your Path landing pages, per LBP_findyourpath_TZ.md (Sept 2026).
// registerKey matches the Path Selector's internal key (also the ?path= value on registration);
// slug is the URL segment under /find-your-path/, per the TZ's §1 URL structure (only "coparent" -> "co-parenting" differs).
type FypResourceRef = { category: string; tool: string };
type FypPath = {
  slug: string;
  registerKey: string;
  h1: string;
  subtitle: string;
  paragraphs: string[];
  resources: FypResourceRef[] | "all";
  ctaLabel: string;
  ctaType: "register" | "quiz";
};

const FIND_YOUR_PATH_TEXT: Record<CookieLocale, {
  eyebrow: string;
  whatThisLooksLike: string;
  resourcesTitle: string;
  resourcesAllTitle: string;
  resourcesAllCopy: string;
  resourcesAllCta: string;
  paths: FypPath[];
}> = {
  en: {
    eyebrow: "Find your path",
    whatThisLooksLike: "What this path looks like",
    resourcesTitle: "Resources for this path",
    resourcesAllTitle: "Not sure yet? Browse everything",
    resourcesAllCopy: "Explore the full set of checklists, worksheets and templates across every path - co-parenting, fertility, donor conception and planning ahead.",
    resourcesAllCta: "Browse all resources & tools",
    paths: [
      {
        slug: "co-parenting", registerKey: "coparent",
        h1: "Finding the right co-parent starts with knowing what you want",
        subtitle: "Co-parenting means raising a child together without a romantic relationship. It works when both people are clear on expectations from day one.",
        paragraphs: [
          "Co-parenting on LetsBeParents means building a family with someone you're not romantically involved with - two separate households, shared decisions about your child's life. It works best when both people are honest about what they want before they start looking, not after they've already found someone they like.",
          "Instead of a swipe-based feed, matching here starts with a values-based quiz and a Compatibility Score that shows where you and a potential co-parent actually align - on parenting style, involvement, timeline and boundaries - so you're comparing what matters, not just a photo.",
          "Once you've had a first conversation, the next steps are the same ones any thoughtful co-parenting decision needs: more conversations, a written plan, and, when you're ready, independent legal advice.",
        ],
        resources: [
          { category: "co-parenting", tool: "questions-to-ask" },
          { category: "co-parenting", tool: "red-flags-checklist" },
          { category: "co-parenting", tool: "planning-template" },
        ],
        ctaLabel: "Create your profile", ctaType: "register",
      },
      {
        slug: "donor", registerKey: "donor",
        h1: "Find the right donor for your family",
        subtitle: "Whether you're looking for a known or anonymous donor, LetsBeParents helps you filter by what matters most to you.",
        paragraphs: [
          "Choosing a donor is one of the most personal decisions in building a family, with real medical, legal and long-term implications. Some people want a known donor with an ongoing relationship to the child; others prefer anonymity through a clinic. Both are valid paths, and they lead to different questions.",
          "On LetsBeParents, donor profiles include the information that actually matters for this decision, and every donor goes through identity verification before you can connect. You set the filters that matter to you - medical history, openness to contact, location - instead of scrolling blind.",
          "Before you move forward with any donor, working through the practical questions with a fertility clinic and, where relevant, a lawyer is worth doing early, rather than after you've already made an emotional decision.",
        ],
        resources: [
          { category: "fertility-donor", tool: "fertility-consultation-questions" },
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "fertility-donor", tool: "fertility-clinic-checklist" },
        ],
        ctaLabel: "Browse donor profiles", ctaType: "register",
      },
      {
        slug: "partner", registerKey: "partner",
        h1: "Build a family with a partner who shares your vision",
        subtitle: "A family-building partner isn't a donor or a co-parent from a distance - it's someone you build a shared family life with.",
        paragraphs: [
          "A family-building partner is different from both a co-parent and a donor: this is someone you'd build a shared household and daily life with, the way a couple would - just with parenthood as the explicit, shared goal from the start, rather than something you hope comes up.",
          "Because this is closer to a life partnership than a transaction, LetsBeParents doesn't treat it like dating. There's no swiping here - it starts with a short compatibility quiz that surfaces how you each think about parenting, commitment and day-to-day life, so early conversations start from real alignment instead of a profile photo.",
        ],
        resources: [
          { category: "co-parenting", tool: "parenting-values-worksheet" },
        ],
        ctaLabel: "Take the compatibility quiz", ctaType: "quiz",
      },
      {
        slug: "couple-donor", registerKey: "couple-donor",
        h1: "Find a donor together, as a couple",
        subtitle: "Looking for a donor as a couple has its own questions - from legal parentage to how involved you want the donor to be.",
        paragraphs: [
          "Searching for a donor as a couple raises questions a solo search doesn't: how involved (or not) you want the donor to be, how legal parentage works for both of you, and how you'll make decisions together as you go. Getting aligned with your partner before you start looking saves a lot of friction later.",
          "LetsBeParents lets both of you browse and filter donor profiles together, with the same identity-verified donor pool and the same filters - medical history, openness to contact, and more - available whether you're searching alone or as a pair.",
        ],
        resources: [
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "parenthood-planning", tool: "financial-planning" },
        ],
        ctaLabel: "Create your profile", ctaType: "register",
      },
      {
        slug: "exploring", registerKey: "exploring",
        h1: "Still figuring out your path? Start here.",
        subtitle: "You don't need to have it all figured out. Most people start by exploring their options before deciding on a path.",
        paragraphs: [
          "Most people who end up building a family with LetsBeParents didn't start out sure exactly what that would look like. If you're still weighing co-parenting against donor conception, or a partner against going it alone, that's a completely normal place to be - and not something you need to resolve before you start.",
          "The best next step isn't a decision, it's information: read through what each path actually involves, and take the Compatibility Quiz to get a clearer sense of what you're looking for. There's no pressure to register or commit to anything while you're still exploring.",
        ],
        resources: "all",
        ctaLabel: "Take the Co-Parenting Compatibility Quiz", ctaType: "quiz",
      },
    ],
  },
  ru: {
    eyebrow: "Найдите свой путь",
    whatThisLooksLike: "Как это выглядит на практике",
    resourcesTitle: "Ресурсы для этого пути",
    resourcesAllTitle: "Ещё не уверены? Посмотрите всё",
    resourcesAllCopy: "Изучите полный набор чек-листов, воркшитов и шаблонов по всем путям - co-parenting, донорское зачатие, фертильность и планирование будущего.",
    resourcesAllCta: "Все ресурсы и инструменты",
    paths: [
      {
        slug: "co-parenting", registerKey: "coparent",
        h1: "Найти подходящего со-родителя начинается с понимания того, чего вы хотите",
        subtitle: "Co-parenting - это совместное воспитание ребёнка без романтических отношений. Это работает, когда оба человека с самого начала чётко понимают ожидания друг друга.",
        paragraphs: [
          "Co-parenting на LetsBeParents означает построение семьи с человеком, с которым у вас нет романтических отношений - два отдельных дома, общие решения по ребёнку. Это работает лучше всего, когда оба честны в том, чего хотят, ещё до начала поиска, а не после того, как уже понравился конкретный человек.",
          "Вместо ленты со свайпами подбор здесь начинается с квиза на основе ценностей и Compatibility Score, который показывает, в чём вы и потенциальный со-родитель действительно совпадаете - в стиле воспитания, вовлечённости, сроках и границах - так вы сравниваете то, что важно, а не только фото.",
          "После первого разговора дальнейшие шаги такие же, как в любом взвешенном решении о co-parenting: больше разговоров, письменный план и, когда будете готовы, независимая юридическая консультация.",
        ],
        resources: [
          { category: "co-parenting", tool: "questions-to-ask" },
          { category: "co-parenting", tool: "red-flags-checklist" },
          { category: "co-parenting", tool: "planning-template" },
        ],
        ctaLabel: "Создать профиль", ctaType: "register",
      },
      {
        slug: "donor", registerKey: "donor",
        h1: "Найдите подходящего донора для своей семьи",
        subtitle: "Ищете ли вы известного или анонимного донора, LetsBeParents помогает фильтровать по тому, что важно именно вам.",
        paragraphs: [
          "Выбор донора - одно из самых личных решений при построении семьи, и оно имеет реальные медицинские, юридические и долгосрочные последствия. Одни хотят известного донора с продолжающимися отношениями с ребёнком, другие предпочитают анонимность через клинику. Оба пути законны и ведут к разным вопросам.",
          "На LetsBeParents профили доноров содержат информацию, которая действительно важна для этого решения, и каждый донор проходит проверку личности прежде чем вы сможете с ним связаться. Вы сами задаёте фильтры, которые важны вам - медицинскую историю, открытость к контакту, местоположение - вместо того чтобы листать вслепую.",
          "Прежде чем двигаться дальше с любым донором, стоит проработать практические вопросы с клиникой репродукции и, где это уместно, с юристом - лучше сделать это заранее, а не после того, как решение уже принято эмоционально.",
        ],
        resources: [
          { category: "fertility-donor", tool: "fertility-consultation-questions" },
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "fertility-donor", tool: "fertility-clinic-checklist" },
        ],
        ctaLabel: "Смотреть профили доноров", ctaType: "register",
      },
      {
        slug: "partner", registerKey: "partner",
        h1: "Постройте семью с партнёром, который разделяет ваше видение",
        subtitle: "Партнёр для создания семьи - это не донор и не со-родитель на расстоянии, это человек, с которым вы строите общую семейную жизнь.",
        paragraphs: [
          "Партнёр для создания семьи отличается и от со-родителя, и от донора: это человек, с которым вы будете строить общий дом и повседневную жизнь, как пара - но с родительством как явной, общей целью с самого начала, а не тем, что вы надеетесь получится само собой.",
          "Поскольку это ближе к жизненному партнёрству, чем к транзакции, LetsBeParents не относится к этому как к дейтингу. Здесь нет свайпов - всё начинается с короткого квиза на совместимость, который показывает, как каждый из вас думает о родительстве, обязательствах и повседневной жизни, чтобы первые разговоры начинались с реального совпадения, а не с фото профиля.",
        ],
        resources: [
          { category: "co-parenting", tool: "parenting-values-worksheet" },
        ],
        ctaLabel: "Пройти квиз на совместимость", ctaType: "quiz",
      },
      {
        slug: "couple-donor", registerKey: "couple-donor",
        h1: "Найдите донора вместе, как пара",
        subtitle: "Поиск донора парой поднимает свои вопросы - от юридического родительства до того, насколько вовлечён должен быть донор.",
        paragraphs: [
          "Поиск донора парой поднимает вопросы, которых нет при поиске в одиночку: насколько вовлечён (или нет) должен быть донор, как будет работать юридическое родительство для вас обоих, и как вы будете принимать решения вместе по ходу дела. Договориться с партнёром до начала поиска экономит много сил в будущем.",
          "LetsBeParents позволяет вам обоим просматривать и фильтровать профили доноров вместе, с тем же пулом проверенных доноров и теми же фильтрами - медицинская история, открытость к контакту и другое - независимо от того, ищете вы в одиночку или вдвоём.",
        ],
        resources: [
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "parenthood-planning", tool: "financial-planning" },
        ],
        ctaLabel: "Создать профиль", ctaType: "register",
      },
      {
        slug: "exploring", registerKey: "exploring",
        h1: "Всё ещё определяетесь с путём? Начните здесь.",
        subtitle: "Не обязательно иметь готовый план. Большинство людей начинают с изучения вариантов, прежде чем выбрать путь.",
        paragraphs: [
          "Большинство людей, которые в итоге строят семью на LetsBeParents, изначально не были уверены, как именно это будет выглядеть. Если вы всё ещё взвешиваете co-parenting против донорского зачатия или партнёра против самостоятельного пути - это абсолютно нормально, и вам не нужно решать это прямо сейчас.",
          "Лучший следующий шаг - не решение, а информация: изучите, что на самом деле означает каждый путь, и пройдите Compatibility Quiz, чтобы лучше понять, чего вы ищете. Пока вы всё ещё изучаете варианты, регистрироваться или брать на себя обязательства не нужно.",
        ],
        resources: "all",
        ctaLabel: "Пройти Co-Parenting Compatibility Quiz", ctaType: "quiz",
      },
    ],
  },
  es: {
    eyebrow: "Encuentra tu camino",
    whatThisLooksLike: "Cómo es este camino en la práctica",
    resourcesTitle: "Recursos para este camino",
    resourcesAllTitle: "¿Aún no lo tienes claro? Explóralo todo",
    resourcesAllCopy: "Explora el conjunto completo de listas de verificación, plantillas y guías para cada camino - coparentalidad, fertilidad, donación y planificación.",
    resourcesAllCta: "Ver todos los recursos y herramientas",
    paths: [
      {
        slug: "co-parenting", registerKey: "coparent",
        h1: "Encontrar al co-padre o co-madre adecuado empieza por saber qué quieres",
        subtitle: "La coparentalidad significa criar a un hijo juntos sin una relación romántica. Funciona cuando ambas personas tienen claras sus expectativas desde el principio.",
        paragraphs: [
          "La coparentalidad en LetsBeParents significa construir una familia con alguien con quien no tienes una relación romántica - dos hogares separados, decisiones compartidas sobre tu hijo. Funciona mejor cuando ambas personas son honestas sobre lo que quieren antes de empezar a buscar, no después de haber encontrado a alguien que les gusta.",
          "En lugar de un feed de swipe, el emparejamiento aquí empieza con un cuestionario basado en valores y una Puntuación de Compatibilidad que muestra en qué coinciden realmente tú y un posible co-padre - en estilo de crianza, implicación, plazos y límites - así comparas lo que importa, no solo una foto.",
          "Después de una primera conversación, los siguientes pasos son los mismos que requiere cualquier decisión de coparentalidad bien pensada: más conversaciones, un plan por escrito y, cuando estés listo, asesoría legal independiente.",
        ],
        resources: [
          { category: "co-parenting", tool: "questions-to-ask" },
          { category: "co-parenting", tool: "red-flags-checklist" },
          { category: "co-parenting", tool: "planning-template" },
        ],
        ctaLabel: "Crear tu perfil", ctaType: "register",
      },
      {
        slug: "donor", registerKey: "donor",
        h1: "Encuentra al donante adecuado para tu familia",
        subtitle: "Ya busques un donante conocido o anónimo, LetsBeParents te ayuda a filtrar por lo que más te importa.",
        paragraphs: [
          "Elegir un donante es una de las decisiones más personales al formar una familia, y tiene implicaciones médicas, legales y a largo plazo reales. Algunas personas quieren un donante conocido con una relación continua con el niño; otras prefieren el anonimato a través de una clínica. Ambos caminos son válidos y llevan a preguntas distintas.",
          "En LetsBeParents, los perfiles de donantes incluyen la información que realmente importa para esta decisión, y cada donante pasa por una verificación de identidad antes de que puedas contactarlo. Tú defines los filtros que te importan - historial médico, apertura al contacto, ubicación - en lugar de buscar a ciegas.",
          "Antes de avanzar con cualquier donante, vale la pena resolver las preguntas prácticas con una clínica de fertilidad y, cuando corresponda, con un abogado, y hacerlo pronto en lugar de después de haber tomado ya una decisión emocional.",
        ],
        resources: [
          { category: "fertility-donor", tool: "fertility-consultation-questions" },
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "fertility-donor", tool: "fertility-clinic-checklist" },
        ],
        ctaLabel: "Ver perfiles de donantes", ctaType: "register",
      },
      {
        slug: "partner", registerKey: "partner",
        h1: "Construye una familia con una pareja que comparta tu visión",
        subtitle: "Una pareja para formar una familia no es un donante ni un co-padre a distancia - es alguien con quien construyes una vida familiar compartida.",
        paragraphs: [
          "Una pareja para formar una familia es diferente tanto de un co-padre como de un donante: es alguien con quien construirías un hogar y una vida diaria compartidos, como lo haría una pareja - solo que con la paternidad como objetivo explícito y compartido desde el principio, en lugar de algo que esperas que surja.",
          "Como esto se parece más a una asociación de vida que a una transacción, LetsBeParents no lo trata como una app de citas. Aquí no hay swipe - empieza con un breve cuestionario de compatibilidad que revela cómo piensa cada uno sobre la crianza, el compromiso y la vida diaria, para que las primeras conversaciones partan de una alineación real y no de una foto de perfil.",
        ],
        resources: [
          { category: "co-parenting", tool: "parenting-values-worksheet" },
        ],
        ctaLabel: "Hacer el cuestionario de compatibilidad", ctaType: "quiz",
      },
      {
        slug: "couple-donor", registerKey: "couple-donor",
        h1: "Encuentra un donante juntos, en pareja",
        subtitle: "Buscar un donante en pareja tiene sus propias preguntas - desde la filiación legal hasta cuánto quieres que participe el donante.",
        paragraphs: [
          "Buscar un donante en pareja plantea preguntas que una búsqueda en solitario no tiene: cuánto (o cuán poco) quieres que participe el donante, cómo funcionará la filiación legal para ambos, y cómo tomarán decisiones juntos en el camino. Poneros de acuerdo con tu pareja antes de empezar a buscar ahorra mucha fricción después.",
          "LetsBeParents permite que ambos exploren y filtren perfiles de donantes juntos, con el mismo grupo de donantes verificados y los mismos filtros - historial médico, apertura al contacto y más - ya sea que busquen en solitario o en pareja.",
        ],
        resources: [
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "parenthood-planning", tool: "financial-planning" },
        ],
        ctaLabel: "Crear tu perfil", ctaType: "register",
      },
      {
        slug: "exploring", registerKey: "exploring",
        h1: "¿Aún estás definiendo tu camino? Empieza aquí.",
        subtitle: "No necesitas tenerlo todo resuelto. La mayoría de las personas empiezan explorando sus opciones antes de decidir un camino.",
        paragraphs: [
          "La mayoría de las personas que terminan formando una familia en LetsBeParents no empezaron con la certeza de cómo sería exactamente. Si todavía estás sopesando la coparentalidad frente a la donación, o una pareja frente a hacerlo en solitario, es un lugar completamente normal en el que estar - y no algo que debas resolver antes de empezar.",
          "El mejor siguiente paso no es una decisión, es información: lee lo que implica cada camino y haz el Cuestionario de Compatibilidad para tener una idea más clara de lo que buscas. No hay presión para registrarte ni comprometerte a nada mientras sigues explorando.",
        ],
        resources: "all",
        ctaLabel: "Hacer el Cuestionario de Compatibilidad de Coparentalidad", ctaType: "quiz",
      },
    ],
  },
};

function FindYourPath() {
  const locale = localeOf();
  const { slug = "" } = useParams();
  const text = FIND_YOUR_PATH_TEXT[locale];
  const path = text.paths.find((p) => p.slug === slug);
  const quizHref = `/${locale}/resources/co-parenting/compatibility-quiz`;
  if (!path) {
    return (
      <div className="fyp-page">
        <section className="fyp-hero">
          <h1>Path not found</h1>
          <Link className="landing-gradient-button" to={`/${locale}/`}>Back to home {resourceArrow()}</Link>
        </section>
      </div>
    );
  }
  const ctaHref = path.ctaType === "quiz" ? quizHref : `/${locale}/auth/register?path=${path.registerKey}`;
  const resolvedResources = path.resources === "all" ? [] : path.resources
    .map((ref) => {
      const cat = RESOURCES_CATEGORIES.find((c) => c.slug === ref.category);
      const tool = cat?.tools.find((t) => t.slug === ref.tool);
      return tool && cat ? { cat, tool } : null;
    })
    .filter((item): item is { cat: ResourceCategoryData; tool: ResourceTool } => item !== null);
  return (
    <div className="fyp-page">
      <section className="fyp-hero">
        <span className="landing-pill fyp-pill"><i /><span>{text.eyebrow}</span></span>
        <span className="fyp-hero-icon">{pathIcon(path.registerKey)}</span>
        <h1>{path.h1}</h1>
        <p>{path.subtitle}</p>
      </section>
      <section className="fyp-body">
        <h2>{text.whatThisLooksLike}</h2>
        {path.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>
      {path.resources === "all" ? (
        <section className="fyp-resources-all">
          <h2>{text.resourcesAllTitle}</h2>
          <p>{text.resourcesAllCopy}</p>
          <Link className="landing-gradient-button" to={`/${locale}/resources`}>{text.resourcesAllCta} {resourceArrow()}</Link>
        </section>
      ) : (
        <section className="fyp-resources">
          <div className="landing-section-intro">
            <span>{text.eyebrow}</span>
            <h2>{text.resourcesTitle}</h2>
          </div>
          <div className="resources-tool-grid fyp-resources-grid">
            {resolvedResources.map(({ cat, tool }) => (
              <Link key={tool.slug} className="resources-tool-card" to={`/${locale}/resources/${cat.slug}/${tool.slug}`}>
                <span className="resources-tool-icon">{resourceDocIcon()}</span>
                {tool.tag && <span className="resources-tool-tag">{tool.tag}</span>}
                <h3>{tool.title}</h3>
                <p>{tool.description}</p>
                <span className="resources-tool-link">{tool.downloadUrl ? "Download the template" : "View resource"} {resourceArrow()}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section className="fyp-next-action">
        <Link className="landing-gradient-button" to={ctaHref}>{path.ctaLabel} {resourceArrow()}</Link>
      </section>
      <section className="resources-pro">
        <span className="resources-pro-icon">{resourceChatIcon()}</span>
        <div className="resources-pro-copy">
          <h2>Looking for professional guidance?</h2>
          <p>Some questions are better discussed with a qualified professional. LetsBeParents is building a trusted space to connect people with psychological, medical and other professional support when they need it.</p>
        </div>
        <Link className="resources-pro-button" to={`/${locale}/contact`}>Learn about professional support {resourceArrow()}</Link>
      </section>
    </div>
  );
}

const TRUST_TEXT = {
  en: {
    pill: "Trust & Safety",
    title: "Every profile is identity-verified - see exactly what we check.",
    intro: "Building a family means trusting the people you meet along the way. Here's what LetsBeParents verifies before you connect, and what's still on you to check for yourself.",
    checks: [
      ["Identity verification", "Before unlocking full access to matches, members confirm their identity through a secure document check, handled by our verification partner, Didit. We don't store your ID document or selfie on LetsBeParents' own servers - that data is processed and retained by Didit under their own privacy terms, and can be deleted on request."],
      ["Photo review", "Every profile photo is automatically screened for policy violations, and any photo you report is reviewed by our team."],
      ["Private messaging & video", "Chat and video calls happen inside LetsBeParents. Your phone number and email stay private until you choose to share them."],
      ["Vetted clinics & lawyers", "Every clinic and lawyer in our directory is reviewed before it's listed, so you're never guessing who you're contacting."],
      ["Report & block, anytime", "You can report or block any member in one tap. Every report is reviewed by our team, not a bot."],
      ["Data protection", "Your data is encrypted in transit and at rest. We never sell your information, and you control what's visible on your profile."],
    ],
    diditLinks: { privacy: "Didit Privacy Policy", terms: "Didit Identity Verification Terms" },
    noteTitle: "What verification means - and what it doesn't",
    noteCopy: "Identity and photo checks reduce fake and duplicate profiles, but they aren't a medical, legal, or background-check guarantee. We strongly recommend independent legal advice before any donor or co-parenting agreement, and meeting new connections for the first time in a public place.",
    ctaTitle: "Questions about safety on LetsBeParents?",
    ctaButton: "Contact our team",
  },
  ru: {
    pill: "Доверие и безопасность",
    title: "Каждый профиль проходит проверку личности - вот что именно мы проверяем.",
    intro: "Создание семьи - это доверие к людям, которых вы встречаете на этом пути. Вот что LetsBeParents проверяет перед тем, как вы начнёте общаться, и что вам всё же стоит проверить самостоятельно.",
    checks: [
      ["Проверка личности", "Прежде чем получить полный доступ к подбору пар, участники подтверждают личность через безопасную проверку документов - её проводит наш партнёр по верификации, сервис Didit. Мы не храним ваш документ или селфи на своих серверах - эти данные обрабатывает и хранит Didit по своим собственным условиям конфиденциальности, и их можно удалить по запросу."],
      ["Проверка фотографий", "Каждое фото профиля автоматически проверяется на нарушения правил, а фото, на которое поступила жалоба, проверяет наша команда."],
      ["Приватные сообщения и видеозвонки", "Переписка и видеозвонки происходят внутри LetsBeParents. Ваш номер телефона и email остаются приватными, пока вы сами не решите ими поделиться."],
      ["Проверенные клиники и юристы", "Каждая клиника и юрист в нашем каталоге проходят проверку перед публикацией - вам не нужно гадать, с кем вы связываетесь."],
      ["Жалоба и блокировка в любой момент", "Вы можете пожаловаться на участника или заблокировать его одним нажатием. Каждую жалобу рассматривает наша команда, а не бот."],
      ["Защита данных", "Ваши данные шифруются при передаче и хранении. Мы никогда не продаём вашу информацию, и вы сами решаете, что видно в вашем профиле."],
    ],
    diditLinks: { privacy: "Политика конфиденциальности Didit", terms: "Условия проверки личности Didit" },
    noteTitle: "Что означает проверка - а что нет",
    noteCopy: "Проверка личности и фотографий снижает число фейковых и дублирующихся профилей, но не является медицинской, юридической гарантией или полной проверкой биографии. Мы настоятельно рекомендуем получить независимую юридическую консультацию перед любым донорским или со-родительским соглашением и встречаться с новыми знакомыми впервые в общественном месте.",
    ctaTitle: "Остались вопросы о безопасности на LetsBeParents?",
    ctaButton: "Написать нашей команде",
  },
  es: {
    pill: "Confianza y seguridad",
    title: "Cada perfil verifica su identidad - mira exactamente qué comprobamos.",
    intro: "Formar una familia significa confiar en las personas que conoces en el camino. Esto es lo que LetsBeParents verifica antes de que conectes, y lo que sigue dependiendo de ti comprobar.",
    checks: [
      ["Verificación de identidad", "Antes de desbloquear el acceso completo a los matches, los miembros confirman su identidad mediante una comprobación segura de documentos, a cargo de nuestro socio de verificación, Didit. No almacenamos tu documento de identidad ni tu selfie en los servidores de LetsBeParents - esos datos los procesa y conserva Didit según sus propias condiciones de privacidad, y pueden eliminarse a petición."],
      ["Revisión de fotos", "Cada foto de perfil se analiza automáticamente en busca de infracciones, y cualquier foto reportada es revisada por nuestro equipo."],
      ["Mensajería y videollamadas privadas", "Los chats y videollamadas ocurren dentro de LetsBeParents. Tu teléfono y email permanecen privados hasta que decidas compartirlos."],
      ["Clínicas y abogados verificados", "Cada clínica y abogado de nuestro directorio se revisa antes de publicarse, así nunca tienes que adivinar con quién estás hablando."],
      ["Reporta o bloquea en cualquier momento", "Puedes reportar o bloquear a cualquier miembro con un toque. Cada reporte es revisado por nuestro equipo, no por un bot."],
      ["Protección de datos", "Tus datos se cifran en tránsito y en reposo. Nunca vendemos tu información, y tú controlas qué es visible en tu perfil."],
    ],
    diditLinks: { privacy: "Política de privacidad de Didit", terms: "Términos de verificación de identidad de Didit" },
    noteTitle: "Qué significa la verificación - y qué no",
    noteCopy: "Las verificaciones de identidad y fotos reducen los perfiles falsos y duplicados, pero no son una garantía médica, legal ni de antecedentes. Recomendamos encarecidamente obtener asesoría legal independiente antes de cualquier acuerdo de donación o co-parentalidad, y conocer en persona por primera vez en un lugar público.",
    ctaTitle: "¿Tienes dudas sobre la seguridad en LetsBeParents?",
    ctaButton: "Contactar con nuestro equipo",
  },
} satisfies Record<CookieLocale, Record<string, unknown>>;

function TrustSafety() {
  const locale = localeOf();
  const text = TRUST_TEXT[locale];
  const checkIcon = (index: number) => {
    if (index === 1) return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>;
    if (index === 2) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>;
    if (index === 3) return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
    if (index === 4) return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></svg>;
    if (index === 5) return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.35 8.95a1 1 0 0 1-1.3 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.79 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>;
  };
  return (
    <div className="trust-page">
      <section className="trust-hero">
        <span className="landing-pill trust-pill"><i /><span>{text.pill}</span></span>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
      </section>
      <div className="trust-check-grid">
        {text.checks.map(([title, copy], index) => (
          <article key={title}>
            <div className="trust-check-icon">{checkIcon(index)}</div>
            <h3>{title}</h3>
            <p>{copy}</p>
            {index === 0 ? (
              <div className="trust-check-links">
                <a href="https://didit.me/terms/privacy-policy/" target="_blank" rel="noopener noreferrer">{text.diditLinks.privacy}</a>
                <a href="https://didit.me/terms/identity-verification/" target="_blank" rel="noopener noreferrer">{text.diditLinks.terms}</a>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <section className="trust-note">
        <h2>{text.noteTitle}</h2>
        <p>{text.noteCopy}</p>
      </section>
      <section className="trust-cta">
        <h2>{text.ctaTitle}</h2>
        <Link className="landing-gradient-button" to={`/${locale}/contact`}>
          {text.ctaButton}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
        </Link>
      </section>
    </div>
  );
}

function PartnerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await api.post<{ token: string }>("/partner/login", {
        email,
        password,
      });
      window.localStorage.setItem("lbp_partner_token", response.token);
      navigate("/partner");
    } catch {
      setError("Could not sign in as a partner.");
    }
  };
  return (
    <section className="auth-page">
      <form onSubmit={submit}>
        <h1>Partner sign in</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary">Sign in</button>
      </form>
    </section>
  );
}

function PartnerDashboard() {
  const [me, setMe] = useState<Row | null>(null);
  const [clinics, setClinics] = useState<Row[]>([]);
  const [chats, setChats] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api
      .get<{ user: Row }>("/partner/me")
      .then((data) => setMe(data.user))
      .catch(() => setNotice("Partner authentication is required."));
    api
      .get<{ items: Row[] }>("/partner/clinics")
      .then((data) => setClinics(data.items || []))
      .catch(() => undefined);
    api
      .get<{ items: Row[] }>("/partner/chats")
      .then((data) => setChats(data.items || []))
      .catch(() => undefined);
  }, []);
  if (notice)
    return (
      <section className="access-card">
        <h1>Partner portal</h1>
        <p className="error">{notice}</p>
        <Link className="primary" to="/partner/login">
          Sign in
        </Link>
      </section>
    );
  return (
    <section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Partner portal</p>
          <h1>{asText(me?.displayName ?? me?.email ?? "Partner dashboard")}</h1>
        </div>
        <Link className="primary" to="/partner/clinics/new">
          Add clinic
        </Link>
      </div>
      <h2>Clinics</h2>
      <div className="directory-grid">
        {clinics.map((clinic) => (
          <Link
            className="directory-card"
            key={asText(clinic.id)}
            to={`/partner/clinics/${encodeURIComponent(asText(clinic.id))}`}
          >
            <div className="avatar-placeholder">
              {asText(clinic.name).slice(0, 1)}
            </div>
            <div>
              <h2>{asText(clinic.name)}</h2>
              <p>
                {[clinic.city, clinic.country]
                  .filter(Boolean)
                  .map(asText)
                  .join(", ")}
              </p>
              <small>{asText(clinic.status)}</small>
            </div>
          </Link>
        ))}
      </div>
      <h2>Chats</h2>
      <div className="list-card">
        {chats.map((chat) => (
          <p key={asText(chat.id)}>
            <strong>
              {asText(chat.subject ?? chat.profileName ?? chat.title)}
            </strong>{" "}
            — {asText(chat.lastMessageBody ?? chat.status)}
          </p>
        ))}
        {!chats.length && <p>No partner chats yet.</p>}
      </div>
    </section>
  );
}

function PartnerChats() {
  const [status, setStatus] = useState("all");
  const [items, setItems] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    api
      .get<{ items: Row[] }>(
        `/partner/chats?status=${encodeURIComponent(status)}`,
      )
      .then((data) => setItems(data.items || []))
      .catch(() => setNotice("Could not load partner chats."));
  }, [status]);
  return (
    <section>
      <div className="section-heading">
        <h1>Chats</h1>
        <Link className="secondary" to="/partner">
          Clinics
        </Link>
      </div>
      <nav className="member-tabs">
        {[
          ["all", "All"],
          ["unanswered", "Unanswered"],
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
      {notice && <p className="error">{notice}</p>}
      <div className="list-card">
        {items.map((chat, index) => (
          <article key={asText(chat.id ?? index)}>
            <strong>
              {asText(chat.subject ?? chat.profileName ?? chat.title)}
            </strong>
            <p>{asText(chat.lastMessageBody ?? chat.status)}</p>
          </article>
        ))}
        {!items.length && <p>No chats in this section.</p>}
      </div>
    </section>
  );
}

function PartnerClinic() {
  const { id = "new" } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [draft, setDraft] = useState<Row>({ languages: ["en"], services: [] });
  const [serviceGroups, setServiceGroups] = useState<Row[]>([]);
  const [visitors, setVisitors] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  const tab = search.get("tab") || "info";
  const editing = id !== "new";
  const field = (key: string) => String(draft[key] ?? "");
  const setField = (key: string, value: unknown) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const load = () => {
    if (editing)
      api
        .get<Row>(`/partner/clinics/${encodeURIComponent(id)}`)
        .then(setDraft)
        .catch(() => setNotice("Could not load clinic."));
    api
      .get<{ items: Row[] }>("/partner/services")
      .then((data) => setServiceGroups(data.items || []))
      .catch(() => setServiceGroups([]));
  };
  useEffect(load, [id]);
  useEffect(() => {
    if (editing && tab === "visitors")
      api
        .get<{ items: Row[] }>(
          `/partner/clinics/${encodeURIComponent(id)}/visitors`,
        )
        .then((data) => setVisitors(data.items || []))
        .catch(() => setVisitors([]));
  }, [editing, id, tab]);
  const save = async (values: Row = draft) => {
    try {
      const response = editing
        ? await api.patch<{ clinic: Row }>(
            `/partner/clinics/${encodeURIComponent(id)}`,
            { values },
          )
        : await api.post<{ clinic: Row }>("/partner/clinics", { values });
      setNotice("Clinic saved.");
      const clinic = response.clinic;
      if (!editing && clinic?.id)
        navigate(`/partner/clinics/${encodeURIComponent(asText(clinic.id))}`);
      else if (clinic) setDraft(clinic);
    } catch {
      setNotice("Could not save the clinic.");
    }
  };
  const selectedServices = new Set(
    (Array.isArray(draft.services) ? draft.services : []).map((item) =>
      asText(
        typeof item === "object" && item
          ? ((item as Row).slug ?? (item as Row).id)
          : item,
      ),
    ),
  );
  const toggleService = (slug: string, checked: boolean) =>
    setField(
      "services",
      checked
        ? [...selectedServices, slug]
        : [...selectedServices].filter((value) => value !== slug),
    );
  const selectedLanguages = new Set(
    (Array.isArray(draft.languages) ? draft.languages : []).map(asText),
  );
  const toggleLanguage = (language: string, checked: boolean) =>
    setField(
      "languages",
      checked
        ? [...selectedLanguages, language]
        : [...selectedLanguages].filter((value) => value !== language),
    );
  const uploadLogo = async (file?: File) => {
    if (!file || !editing) return;
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await api.upload<{ clinic: Row }>(
        `/partner/clinics/${encodeURIComponent(id)}/logo`,
        body,
      );
      if (result.clinic) setDraft(result.clinic);
      setNotice("Logo uploaded.");
    } catch {
      setNotice("Could not upload this logo.");
    }
  };
  const tabs = [
    ["info", "Info"],
    ["services", `Services (${selectedServices.size})`],
    ["languages", `Languages (${selectedLanguages.size})`],
    ["about", "About"],
    [
      "visitors",
      `Visitors (${asText(draft.visitorsCount === "—" ? 0 : draft.visitorsCount)})`,
    ],
  ];
  const details = (
    <>
      <label>
        Name
        <input
          value={field("name")}
          onChange={(event) => setField("name", event.target.value)}
        />
      </label>
      <label>
        Website
        <input
          value={field("website")}
          onChange={(event) => setField("website", event.target.value)}
        />
      </label>
      <label>
        Email
        <input
          value={field("email")}
          onChange={(event) => setField("email", event.target.value)}
        />
      </label>
      <label>
        Phone
        <input
          value={field("phone")}
          onChange={(event) => setField("phone", event.target.value)}
        />
      </label>
      <label>
        Address
        <input
          value={field("location")}
          onChange={(event) => setField("location", event.target.value)}
        />
      </label>
      <label>
        City
        <input
          value={field("city")}
          onChange={(event) => setField("city", event.target.value)}
        />
      </label>
      <label>
        Country
        <input
          value={field("country")}
          onChange={(event) => setField("country", event.target.value)}
        />
      </label>
      <label>
        Region
        <input
          value={field("region")}
          onChange={(event) => setField("region", event.target.value)}
        />
      </label>
      <label>
        Working hours
        <input
          value={field("workingHours")}
          onChange={(event) => setField("workingHours", event.target.value)}
        />
      </label>
    </>
  );
  const form = !editing ? (
    <>
      <p>
        Create a clinic with all required information, services and languages.
      </p>
      {details}
      <label>
        About
        <textarea
          rows={7}
          value={field("aboutHtml")}
          onChange={(event) => setField("aboutHtml", event.target.value)}
        />
      </label>
      <button className="primary" onClick={() => void save()}>
        Create clinic
      </button>
    </>
  ) : (
    <>
      <nav className="member-tabs">
        {tabs.map(([key, title]) => (
          <button
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setSearch({ tab: key })}
          >
            {title}
          </button>
        ))}
      </nav>
      {tab === "info" && (
        <>
          <section className="detail-card">
            <h2>Logo</h2>
            {draft.logoUrl ? (
              <img
                className="partner-clinic-logo"
                src={asText(draft.logoUrl)}
                alt=""
              />
            ) : (
              <div className="avatar-placeholder">
                {field("name").slice(0, 1)}
              </div>
            )}
            <label>
              Upload logo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void uploadLogo(event.target.files?.[0])}
              />
            </label>
          </section>
          <section className="member-form detail-card">
            <h2>General information</h2>
            {details}
            <button className="primary" onClick={() => void save()}>
              Save changes
            </button>
          </section>
          <section className="detail-card action-row">
            <div>
              <h2>
                {draft.isActive
                  ? "Clinic status: active"
                  : "Clinic status: inactive"}
              </h2>
              <p>
                Control whether this clinic is visible in the public catalogue.
              </p>
            </div>
            <button
              className={draft.isActive ? "danger" : "primary"}
              onClick={() => void save({ isActive: !draft.isActive })}
            >
              {draft.isActive ? "Deactivate" : "Activate"}
            </button>
          </section>
        </>
      )}
      {tab === "services" && (
        <section className="detail-card">
          <h2>Services</h2>
          {serviceGroups.map((group) => {
            const entries = (
              Array.isArray(group.services)
                ? group.services
                : Array.isArray(group.items)
                  ? group.items
                  : []
            ) as Row[];
            return (
              <fieldset key={asText(group.slug ?? group.name)}>
                <legend>{asText(group.name ?? group.title)}</legend>
                <div className="check-grid">
                  {entries.map((entry) => {
                    const slug = asText(entry.slug ?? entry.id);
                    return (
                      <label className="toggle-row" key={slug}>
                        <input
                          type="checkbox"
                          checked={selectedServices.has(slug)}
                          onChange={(event) =>
                            toggleService(slug, event.target.checked)
                          }
                        />
                        {asText(entry.name ?? entry.title ?? slug)}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          <button
            className="primary"
            onClick={() => void save({ services: [...selectedServices] })}
          >
            Save services
          </button>
        </section>
      )}
      {tab === "languages" && (
        <section className="detail-card">
          <h2>Languages</h2>
          <div className="check-grid">
            {["en", "de", "fr", "es", "it", "ru", "nl", "pt", "pl", "uk"].map(
              (language) => (
                <label className="toggle-row" key={language}>
                  <input
                    type="checkbox"
                    checked={selectedLanguages.has(language)}
                    onChange={(event) =>
                      toggleLanguage(language, event.target.checked)
                    }
                  />
                  {language.toUpperCase()}
                </label>
              ),
            )}
          </div>
          <button
            className="primary"
            onClick={() => void save({ languages: [...selectedLanguages] })}
          >
            Save languages
          </button>
        </section>
      )}
      {tab === "about" && (
        <section className="member-form detail-card">
          <h2>About</h2>
          <label>
            About
            <textarea
              rows={12}
              value={field("aboutHtml")}
              onChange={(event) => setField("aboutHtml", event.target.value)}
            />
          </label>
          <button
            className="primary"
            onClick={() => void save({ aboutHtml: draft.aboutHtml })}
          >
            Save about
          </button>
        </section>
      )}
      {tab === "visitors" && (
        <section className="detail-card">
          <h2>Visitors</h2>
          <div className="list-card">
            {visitors.map((visitor, index) => (
              <p key={asText(visitor.id ?? index)}>
                <strong>
                  {asText(visitor.profileName ?? visitor.displayName)}
                </strong>{" "}
                —{" "}
                {[visitor.city, visitor.country]
                  .filter(Boolean)
                  .map(asText)
                  .join(", ") || "—"}
              </p>
            ))}
            {!visitors.length && <p>No clinic visitors yet.</p>}
          </div>
        </section>
      )}
    </>
  );
  return (
    <section className="partner-clinic member-form">
      <Link to="/partner">← Back to partner portal</Link>
      <div className="section-heading">
        <div>
          <h1>{editing ? field("name") : "Add clinic"}</h1>
          {editing && (
            <p>
              {[draft.city, draft.country]
                .filter(Boolean)
                .map(asText)
                .join(", ")}
            </p>
          )}
        </div>
        {editing && (
          <span className={draft.isActive ? "status active" : "status"}>
            {draft.isActive ? "Active" : "Inactive"}
          </span>
        )}
      </div>
      {notice && <p className="notice">{notice}</p>}
      {form}
    </section>
  );
}

export function WebApp() {
  const locale = localeOf();
  const [session, setSession] = useState<Session | undefined>(undefined);
  useEffect(() => {
    api
      .get<{ user: Row }>("/auth/me")
      .then((response) => setSession({ user: response.user }))
      .catch(() => setSession(null));
  }, []);
  const logout = async () => {
    await api.post("/auth/logout");
    setSession(null);
  };
  if (session === undefined) return <LoadingIndicator fullPage />;
  const content = (element: React.ReactNode) => (
    <Shell session={session} onLogout={logout}>
      {element}
    </Shell>
  );
  return (
    <>
      <ScrollToTopOnNavigation />
      <Routes>
      <Route path="/" element={<Navigate to="/en" replace />} />
      <Route path="/contact" element={<Navigate to="/en/contact" replace />} />
      <Route
        path="/auth/login"
        element={<Navigate to="/en/auth/login" replace />}
      />
      <Route
        path="/auth/register"
        element={<Navigate to="/en/auth/register" replace />}
      />
      <Route
        path="/auth/forgot-password"
        element={<Navigate to="/en/auth/forgot-password" replace />}
      />
      <Route path="/catalog" element={<Navigate to="/en/catalog" replace />} />
      <Route path="/clinics" element={<Navigate to="/en/clinics" replace />} />
      <Route path="/lawyers" element={<Navigate to="/en/lawyers" replace />} />
      <Route
        path="/knowledge-hub"
        element={<Navigate to="/en/knowledge-hub" replace />}
      />
      <Route path="/likes" element={<Navigate to="/en/likes" replace />} />
      <Route path="/chat" element={<Navigate to="/en/messages" replace />} />
      <Route
        path="/messages"
        element={<Navigate to="/en/messages" replace />}
      />
      <Route path="/profile" element={<Navigate to="/en/profile" replace />} />
      <Route
        path="/profile.php"
        element={<Navigate to="/en/profile" replace />}
      />
      <Route path="/partner/login" element={<PartnerLogin />} />
      <Route path="/partner" element={<PartnerDashboard />} />
      <Route path="/partner/chats" element={<PartnerChats />} />
      <Route path="/partner/clinics/:id" element={<PartnerClinic />} />
      <Route path="/partner/:locale/login" element={<PartnerLogin />} />
      <Route path="/partner/:locale" element={<PartnerDashboard />} />
      <Route path="/partner/:locale/chats" element={<PartnerChats />} />
      <Route path="/partner/:locale/clinics" element={<PartnerDashboard />} />
      <Route path="/partner/:locale/clinics/:id" element={<PartnerClinic />} />
      <Route path="/:locale" element={content(<Home />)} />
      <Route
        path="/:locale/auth/login"
        element={content(<Login onLogin={setSession} />)}
      />
      <Route
        path="/:locale/auth/signup"
        element={<Navigate to={`/${locale}/auth/register`} replace />}
      />
      <Route
        path="/:locale/auth/register"
        element={content(<Signup onLogin={setSession} />)}
      />
      <Route
        path="/:locale/auth/forgot-password"
        element={content(<ForgotPassword />)}
      />
      <Route
        path="/:locale/auth/reset-password"
        element={content(<ResetPassword />)}
      />
      <Route
        path="/:locale/auth/verify-email"
        element={content(<VerifyEmail />)}
      />
      <Route
        path="/:locale/catalog"
        element={session ? content(<Catalog session={session} />) : <Navigate to={`/${locale}/auth/login`} replace />}
      />
      <Route
        path="/:locale/catalog/:id"
        element={session ? content(<CatalogProfile session={session} />) : <Navigate to={`/${locale}/auth/login`} replace />}
      />
      <Route
        path="/:locale/clinics"
        element={session ? content(<Directory key="clinics" kind="clinics" />) : <Navigate to={`/${locale}/auth/login`} replace />}
      />
      <Route
        path="/:locale/clinics/:slug"
        element={session ? content(<DirectoryDetail kind="clinics" />) : <Navigate to={`/${locale}/auth/login`} replace />}
      />
      <Route
        path="/:locale/lawyers"
        element={session ? content(<Directory key="lawyers" kind="lawyers" />) : <Navigate to={`/${locale}/auth/login`} replace />}
      />
      <Route
        path="/:locale/lawyers/:slug"
        element={session ? content(<DirectoryDetail kind="lawyers" />) : <Navigate to={`/${locale}/auth/login`} replace />}
      />
      <Route
        path="/:locale/knowledge-hub"
        element={content(<KnowledgeHub />)}
      />
      <Route
        path="/:locale/knowledge-hub/:slug"
        element={content(<Article />)}
      />
      <Route path="/:locale/contact" element={content(<Contact />)} />
      <Route path="/:locale/trust-safety" element={content(<TrustSafety />)} />
      <Route path="/:locale/pricing" element={content(<Pricing session={session} />)} />
      <Route path="/:locale/resources" element={content(<ResourcesIndex />)} />
      <Route path="/:locale/resources/:category" element={content(<ResourceCategory />)} />
      <Route path="/:locale/resources/:category/:tool" element={content(<ResourceTool />)} />
      <Route path="/:locale/find-your-path/:slug" element={content(<FindYourPath />)} />
      <Route path="/:locale/pages/:slug" element={content(<ContentPage />)} />
      <Route
        path="/:locale/likes"
        element={content(<Likes session={session} />)}
      />
      <Route
        path="/:locale/profile"
        element={content(<Profile session={session} />)}
      />
      <Route
        path="/:locale/photos"
        element={content(<Photos session={session} />)}
      />
      <Route
        path="/:locale/settings"
        element={content(<Settings session={session} />)}
      />
      <Route
        path="/:locale/verification"
        element={content(<Verification session={session} />)}
      />
      <Route
        path="/:locale/messages"
        element={content(<Conversations session={session} />)}
      />
      <Route
        path="/:locale/chat"
        element={<Navigate to={`/${locale}/messages`} replace />}
      />
      <Route
        path="/:locale/visitors"
        element={content(
          <SimpleMemberList session={session} kind="visitors" />,
        )}
      />
      <Route
        path="/:locale/favourites"
        element={content(<Favourites session={session} />)}
      />
      <Route
        path="/:locale/blocked"
        element={content(<SimpleMemberList session={session} kind="blocked" />)}
      />
      <Route
        path="/:locale/delete-account"
        element={content(<AccountDeletion session={session} />)}
      />
      <Route
        path="/:locale/subscription"
        element={content(<Subscription session={session} />)}
      />
      <Route path="*" element={<Navigate to="/en" replace />} />
      </Routes>
    </>
  );
}
