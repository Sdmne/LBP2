import {
  FormEvent,
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { MemberChatCalls } from "./member-chat-calls";
import type { ChatLocale } from "./member-chat-model";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ApiError, createApiClient } from "./api";
import { loadKnowledgeArticles, normalizeArticle } from "./articles";
import { firstAvatarText, userInitials, UserAvatar } from "./user-avatar";
import { MemberProfile, profileAge, profileCountry } from "./member-profile";
import { AccountPremium, MemberAccount, ownProfileData } from "./member-account";
import { MemberLikes } from "./member-likes";
import { SlidingTabs } from "./sliding-tabs";
import { MemberChat, ChatLegacyRedirect } from "./member-chat";
import { MemberProfileEdit } from "./member-profile-edit";
import { MemberProfilePhotos, MemberProfileVerification } from "./member-profile-tools";
import {
  signInWithSocial,
  socialErrorMessage,
  type SocialProvider,
} from "./firebase-auth";
import { NotFoundPage } from "./not-found";

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
type CookieLocale = "en" | "ru" | "es" | "pt" | "fr" | "de" | "it" | "pl";
const legacyLocaleOf = (locale: CookieLocale): ChatLocale => (locale === "ru" || locale === "es" ? locale : "en");
// 2026-09-15: extended from en/ru/es to add pt/fr/de/it/pl (machine-translated,
// same batch as mobile/src/i18n/translations.ts) - kept as one shared array so
// localeOf()/switchLocale() below can't silently drift out of sync with
// CookieLocale again the way the original 3-locale version did.
const SUPPORTED_SITE_LOCALES: CookieLocale[] = ["en", "ru", "es", "pt", "fr", "de", "it", "pl"];

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
  return (SUPPORTED_SITE_LOCALES as string[]).includes(locale) ? (locale as CookieLocale) : "en";
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
  writeCookie("NEXT_LOCALE", locale, COOKIE_LOCALE_MAX_AGE);
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
        { name: "NEXT_LOCALE", duration: "1 year", description: "Remembers the interface language for the localized site." },
      ],
      preferences: [],
      statistics: [
        { name: "AMP_*", duration: "Up to 1 year", description: "Product analytics — measures usage to improve the product." },
        { name: "AMP_MKTG_*", duration: "Up to 1 year", description: "Product analytics — measures how visitors first reached the app." },
      ],
    },
    about: [
      "Cookies are small text files that websites use to make a user's experience more efficient.",
      "The law lets us store cookies that are strictly necessary for this site to work; for everything else we need your permission. Necessary cookies are used on the basis of GDPR Art. 6(1)(f); all other categories are used only with your consent (GDPR Art. 6(1)(a)).",
      "This site uses different types of cookies; some are set by third-party services that appear on our pages.",
      "You can change or withdraw your consent at any time using the \"Cookie settings\" link in the footer of the page.",
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
        { name: "NEXT_LOCALE", duration: "1 год", description: "Запоминает язык интерфейса для локализованного сайта." },
      ],
      preferences: [],
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
        { name: "NEXT_LOCALE", duration: "1 año", description: "Recuerda el idioma de interfaz para el sitio localizado." },
      ],
      preferences: [],
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
  pt: {
    heading: "Este site utiliza cookies",
    tabs: { consent: "Consentimento", details: "Detalhes", about: "Sobre" },
    consent: "Utilizamos cookies para manter a aplicação a funcionar, personalizar a sua experiência e analisar o nosso tráfego. Também partilhamos informações sobre a sua utilização do site com os nossos parceiros de análise, que podem combiná-las com outras informações que lhes tenha fornecido ou que tenham recolhido através da sua utilização dos respetivos serviços.",
    privacyPolicy: "Política de Privacidade",
    categories: { necessary: "Necessários", preferences: "Preferências", statistics: "Estatísticas" },
    descriptions: {
      necessary: "Os cookies necessários ajudam a tornar o site utilizável, permitindo funções básicas como a gestão de sessão e início de sessão, segurança e a memorização da escolha de consentimento que faz aqui. O site não pode funcionar corretamente sem estes cookies.",
      preferences: "Os cookies de preferências permitem ao site memorizar informações que alteram o seu comportamento ou aspeto, como o seu idioma preferido.",
      statistics: "Os cookies estatísticos ajudam-nos a compreender como os visitantes interagem com a aplicação, recolhendo e comunicando informações.",
    },
    cookies: {
      necessary: [
        { name: "lbp_consent", duration: "180 dias", description: "Guarda a sua escolha de consentimento de cookies." },
        { name: "authjs.session-token", duration: "Sessão / 7 dias", description: "Mantém a sua sessão iniciada (sessão e proteção CSRF). Com o prefixo __Secure- em HTTPS." },
        { name: "lbp_attr_first", duration: "90 dias", description: "Recorda como nos encontrou pela primeira vez (primeiro contacto), usado para perceber de onde vêm os novos membros." },
        { name: "lbp_attr_last", duration: "90 dias", description: "Recorda como nos encontrou mais recentemente (último contacto), usado para perceber de onde vêm os novos membros." },
        { name: "lbp_consent_id", duration: "180 dias", description: "Identificador de consentimento anónimo, guardado como prova da escolha de consentimento que fez aqui (RGPD art. 7.º(1))." },
        { name: "NEXT_LOCALE", duration: "1 ano", description: "Recorda o idioma da interface do site localizado." },
      ],
      preferences: [],
      statistics: [
        { name: "AMP_*", duration: "Até 1 ano", description: "Análise de produto — mede a utilização para melhorar o produto." },
        { name: "AMP_MKTG_*", duration: "Até 1 ano", description: "Análise de produto — mede como os visitantes chegaram pela primeira vez à aplicação." },
      ],
    },
    about: [
      "Os cookies são pequenos ficheiros de texto que os sites utilizam para tornar a experiência do utilizador mais eficiente.",
      "A lei permite-nos guardar cookies estritamente necessários para o funcionamento deste site; para tudo o resto precisamos da sua autorização. Os cookies necessários são utilizados com base no art. 6.º(1)(f) do RGPD; todas as outras categorias são utilizadas apenas com o seu consentimento (art. 6.º(1)(a) do RGPD).",
      "Este site utiliza diferentes tipos de cookies; alguns são definidos por serviços de terceiros presentes nas nossas páginas.",
      "Pode alterar ou retirar o seu consentimento a qualquer momento através da ligação «Definições de cookies» no rodapé da página.",
    ],
    learnMore: "Saiba mais sobre como tratamos os dados pessoais na nossa Política de Privacidade.",
    rejectAll: "Rejeitar tudo",
    customize: "Personalizar",
    allowSelection: "Permitir seleção",
    acceptAll: "Aceitar tudo",
  },
  fr: {
    heading: "Ce site utilise des cookies",
    tabs: { consent: "Consentement", details: "Détails", about: "À propos" },
    consent: "Nous utilisons des cookies pour faire fonctionner l'application, personnaliser votre expérience et analyser notre trafic. Nous partageons également des informations sur votre utilisation du site avec nos partenaires d'analyse, qui peuvent les combiner avec d'autres informations que vous leur avez fournies ou qu'ils ont collectées lors de votre utilisation de leurs services.",
    privacyPolicy: "Politique de confidentialité",
    categories: { necessary: "Nécessaires", preferences: "Préférences", statistics: "Statistiques" },
    descriptions: {
      necessary: "Les cookies nécessaires contribuent à rendre le site utilisable en activant des fonctions de base telles que la gestion de session et de connexion, la sécurité et la mémorisation du choix de consentement que vous faites ici. Le site ne peut pas fonctionner correctement sans ces cookies.",
      preferences: "Les cookies de préférences permettent au site de mémoriser des informations qui modifient son comportement ou son apparence, comme votre langue préférée.",
      statistics: "Les cookies statistiques nous aident à comprendre comment les visiteurs interagissent avec l'application, en collectant et en communiquant des informations.",
    },
    cookies: {
      necessary: [
        { name: "lbp_consent", duration: "180 jours", description: "Enregistre votre choix de consentement aux cookies." },
        { name: "authjs.session-token", duration: "Session / 7 jours", description: "Vous maintient connecté (session et protection CSRF). Préfixé par __Secure- en HTTPS." },
        { name: "lbp_attr_first", duration: "90 jours", description: "Mémorise comment vous nous avez trouvés pour la première fois (premier contact), utilisé pour comprendre d'où viennent les nouveaux membres." },
        { name: "lbp_attr_last", duration: "90 jours", description: "Mémorise comment vous nous avez trouvés le plus récemment (dernier contact), utilisé pour comprendre d'où viennent les nouveaux membres." },
        { name: "lbp_consent_id", duration: "180 jours", description: "Identifiant de consentement anonyme, conservé comme preuve du choix de consentement que vous avez fait ici (RGPD art. 7(1))." },
        { name: "NEXT_LOCALE", duration: "1 an", description: "Mémorise la langue de l'interface pour le site localisé." },
      ],
      preferences: [],
      statistics: [
        { name: "AMP_*", duration: "Jusqu'à 1 an", description: "Analyse produit — mesure l'utilisation pour améliorer le produit." },
        { name: "AMP_MKTG_*", duration: "Jusqu'à 1 an", description: "Analyse produit — mesure comment les visiteurs ont découvert l'application pour la première fois." },
      ],
    },
    about: [
      "Les cookies sont de petits fichiers texte que les sites web utilisent pour rendre l'expérience utilisateur plus efficace.",
      "La loi nous permet de stocker les cookies strictement nécessaires au fonctionnement de ce site ; pour tout le reste, nous avons besoin de votre autorisation. Les cookies nécessaires sont utilisés sur la base de l'art. 6(1)(f) du RGPD ; toutes les autres catégories ne sont utilisées qu'avec votre consentement (art. 6(1)(a) du RGPD).",
      "Ce site utilise différents types de cookies ; certains sont définis par des services tiers présents sur nos pages.",
      "Vous pouvez modifier ou retirer votre consentement à tout moment via le lien « Paramètres des cookies » dans le pied de page.",
    ],
    learnMore: "En savoir plus sur la façon dont nous traitons les données personnelles dans notre Politique de confidentialité.",
    rejectAll: "Tout refuser",
    customize: "Personnaliser",
    allowSelection: "Autoriser la sélection",
    acceptAll: "Tout accepter",
  },
  de: {
    heading: "Diese Website verwendet Cookies",
    tabs: { consent: "Zustimmung", details: "Details", about: "Über Cookies" },
    consent: "Wir verwenden Cookies, damit die App funktioniert, um Ihr Erlebnis zu personalisieren und unseren Traffic zu analysieren. Wir teilen außerdem Informationen über Ihre Nutzung der Website mit unseren Analysepartnern, die diese mit anderen Informationen kombinieren können, die Sie ihnen zur Verfügung gestellt haben oder die sie durch Ihre Nutzung ihrer Dienste gesammelt haben.",
    privacyPolicy: "Datenschutzrichtlinie",
    categories: { necessary: "Notwendig", preferences: "Präferenzen", statistics: "Statistik" },
    descriptions: {
      necessary: "Notwendige Cookies tragen dazu bei, die Website nutzbar zu machen, indem sie grundlegende Funktionen wie Sitzungs- und Anmeldeverwaltung, Sicherheit und das Speichern Ihrer hier getroffenen Zustimmungsentscheidung ermöglichen. Ohne diese Cookies kann die Website nicht ordnungsgemäß funktionieren.",
      preferences: "Präferenz-Cookies ermöglichen es der Website, Informationen zu speichern, die ihr Verhalten oder Erscheinungsbild verändern, wie z. B. Ihre bevorzugte Sprache.",
      statistics: "Statistik-Cookies helfen uns zu verstehen, wie Besucher mit der App interagieren, indem sie Informationen sammeln und melden.",
    },
    cookies: {
      necessary: [
        { name: "lbp_consent", duration: "180 Tage", description: "Speichert Ihre Cookie-Zustimmungsentscheidung." },
        { name: "authjs.session-token", duration: "Sitzung / 7 Tage", description: "Hält Sie angemeldet (Sitzung und CSRF-Schutz). Bei HTTPS mit dem Präfix __Secure- versehen." },
        { name: "lbp_attr_first", duration: "90 Tage", description: "Merkt sich, wie Sie uns zum ersten Mal gefunden haben (First Touch), um zu verstehen, woher neue Mitglieder kommen." },
        { name: "lbp_attr_last", duration: "90 Tage", description: "Merkt sich, wie Sie uns zuletzt gefunden haben (Last Touch), um zu verstehen, woher neue Mitglieder kommen." },
        { name: "lbp_consent_id", duration: "180 Tage", description: "Anonyme Zustimmungs-Kennung, aufbewahrt als Nachweis Ihrer hier getroffenen Zustimmungsentscheidung (DSGVO Art. 7(1))." },
        { name: "NEXT_LOCALE", duration: "1 Jahr", description: "Merkt sich die Interfacesprache für die lokalisierte Website." },
      ],
      preferences: [],
      statistics: [
        { name: "AMP_*", duration: "Bis zu 1 Jahr", description: "Produktanalyse — misst die Nutzung zur Verbesserung des Produkts." },
        { name: "AMP_MKTG_*", duration: "Bis zu 1 Jahr", description: "Produktanalyse — misst, wie Besucher die App zum ersten Mal gefunden haben." },
      ],
    },
    about: [
      "Cookies sind kleine Textdateien, die Websites verwenden, um die Nutzererfahrung effizienter zu gestalten.",
      "Das Gesetz erlaubt uns, Cookies zu speichern, die für den Betrieb dieser Website unbedingt erforderlich sind; für alles andere benötigen wir Ihre Erlaubnis. Notwendige Cookies werden auf Grundlage von Art. 6(1)(f) DSGVO verwendet; alle anderen Kategorien nur mit Ihrer Zustimmung (Art. 6(1)(a) DSGVO).",
      "Diese Website verwendet verschiedene Arten von Cookies; einige werden von Drittanbieter-Diensten gesetzt, die auf unseren Seiten erscheinen.",
      "Sie können Ihre Zustimmung jederzeit über den Link „Cookie-Einstellungen“ in der Fußzeile der Seite ändern oder widerrufen.",
    ],
    learnMore: "Erfahren Sie mehr darüber, wie wir personenbezogene Daten verarbeiten, in unserer Datenschutzrichtlinie.",
    rejectAll: "Alle ablehnen",
    customize: "Anpassen",
    allowSelection: "Auswahl erlauben",
    acceptAll: "Alle akzeptieren",
  },
  it: {
    heading: "Questo sito utilizza i cookie",
    tabs: { consent: "Consenso", details: "Dettagli", about: "Informazioni" },
    consent: "Utilizziamo i cookie per far funzionare l'app, personalizzare la tua esperienza e analizzare il nostro traffico. Condividiamo inoltre informazioni sul tuo utilizzo del sito con i nostri partner di analisi, che potrebbero combinarle con altre informazioni che hai fornito loro o che hanno raccolto attraverso il tuo utilizzo dei loro servizi.",
    privacyPolicy: "Informativa sulla privacy",
    categories: { necessary: "Necessari", preferences: "Preferenze", statistics: "Statistiche" },
    descriptions: {
      necessary: "I cookie necessari contribuiscono a rendere il sito utilizzabile abilitando funzioni di base come la gestione della sessione e dell'accesso, la sicurezza e la memorizzazione della scelta di consenso effettuata qui. Il sito non può funzionare correttamente senza questi cookie.",
      preferences: "I cookie di preferenza consentono al sito di ricordare informazioni che ne modificano il comportamento o l'aspetto, come la lingua preferita.",
      statistics: "I cookie statistici ci aiutano a capire come i visitatori interagiscono con l'app, raccogliendo e segnalando informazioni.",
    },
    cookies: {
      necessary: [
        { name: "lbp_consent", duration: "180 giorni", description: "Memorizza la tua scelta di consenso ai cookie." },
        { name: "authjs.session-token", duration: "Sessione / 7 giorni", description: "Mantiene l'accesso effettuato (sessione e protezione CSRF). Con prefisso __Secure- su HTTPS." },
        { name: "lbp_attr_first", duration: "90 giorni", description: "Ricorda come ci hai trovato per la prima volta (primo contatto), usato per capire da dove arrivano i nuovi membri." },
        { name: "lbp_attr_last", duration: "90 giorni", description: "Ricorda come ci hai trovato più di recente (ultimo contatto), usato per capire da dove arrivano i nuovi membri." },
        { name: "lbp_consent_id", duration: "180 giorni", description: "Identificativo di consenso anonimo, conservato come prova della scelta di consenso effettuata qui (GDPR art. 7(1))." },
        { name: "NEXT_LOCALE", duration: "1 anno", description: "Ricorda la lingua dell'interfaccia per il sito localizzato." },
      ],
      preferences: [],
      statistics: [
        { name: "AMP_*", duration: "Fino a 1 anno", description: "Analisi di prodotto — misura l'utilizzo per migliorare il prodotto." },
        { name: "AMP_MKTG_*", duration: "Fino a 1 anno", description: "Analisi di prodotto — misura come i visitatori hanno raggiunto l'app per la prima volta." },
      ],
    },
    about: [
      "I cookie sono piccoli file di testo che i siti web utilizzano per rendere l'esperienza dell'utente più efficiente.",
      "La legge ci consente di memorizzare i cookie strettamente necessari al funzionamento di questo sito; per tutto il resto abbiamo bisogno del tuo permesso. I cookie necessari sono utilizzati sulla base dell'art. 6(1)(f) del GDPR; tutte le altre categorie sono utilizzate solo con il tuo consenso (art. 6(1)(a) del GDPR).",
      "Questo sito utilizza diversi tipi di cookie; alcuni sono impostati da servizi di terze parti presenti nelle nostre pagine.",
      "Puoi modificare o revocare il tuo consenso in qualsiasi momento tramite il link «Impostazioni cookie» nel piè di pagina.",
    ],
    learnMore: "Scopri di più su come trattiamo i dati personali nella nostra Informativa sulla privacy.",
    rejectAll: "Rifiuta tutto",
    customize: "Personalizza",
    allowSelection: "Consenti selezione",
    acceptAll: "Accetta tutto",
  },
  pl: {
    heading: "Ta strona korzysta z plików cookie",
    tabs: { consent: "Zgoda", details: "Szczegóły", about: "O plikach cookie" },
    consent: "Używamy plików cookie, aby aplikacja działała, personalizować Twoje doświadczenia i analizować nasz ruch. Udostępniamy również informacje o korzystaniu przez Ciebie z witryny naszym partnerom analitycznym, którzy mogą łączyć je z innymi informacjami, które im przekazałeś/aś lub które zebrali podczas korzystania z ich usług.",
    privacyPolicy: "Polityka prywatności",
    categories: { necessary: "Niezbędne", preferences: "Preferencje", statistics: "Statystyczne" },
    descriptions: {
      necessary: "Niezbędne pliki cookie pomagają uczynić stronę użyteczną, umożliwiając podstawowe funkcje, takie jak obsługa sesji i logowania, bezpieczeństwo oraz zapamiętywanie dokonanego tutaj wyboru zgody. Bez tych plików cookie strona nie może działać prawidłowo.",
      preferences: "Pliki cookie preferencji umożliwiają stronie zapamiętywanie informacji zmieniających jej działanie lub wygląd, np. preferowanego języka.",
      statistics: "Statystyczne pliki cookie pomagają nam zrozumieć, w jaki sposób odwiedzający korzystają z aplikacji, zbierając i raportując informacje.",
    },
    cookies: {
      necessary: [
        { name: "lbp_consent", duration: "180 dni", description: "Przechowuje Twój wybór dotyczący zgody na pliki cookie." },
        { name: "authjs.session-token", duration: "Sesja / 7 dni", description: "Utrzymuje Twoje zalogowanie (sesja i ochrona CSRF). Z prefiksem __Secure- w HTTPS." },
        { name: "lbp_attr_first", duration: "90 dni", description: "Zapamiętuje, w jaki sposób trafiłeś/aś do nas po raz pierwszy (pierwsze odwiedziny), używane do zrozumienia, skąd pochodzą nowi członkowie." },
        { name: "lbp_attr_last", duration: "90 dni", description: "Zapamiętuje, w jaki sposób trafiłeś/aś do nas ostatnio (ostatnie odwiedziny), używane do zrozumienia, skąd pochodzą nowi członkowie." },
        { name: "lbp_consent_id", duration: "180 dni", description: "Anonimowy identyfikator zgody, przechowywany jako dowód dokonanego tutaj wyboru zgody (RODO art. 7 ust. 1)." },
        { name: "NEXT_LOCALE", duration: "1 rok", description: "Zapamiętuje język interfejsu dla zlokalizowanej wersji strony." },
      ],
      preferences: [],
      statistics: [
        { name: "AMP_*", duration: "Do 1 roku", description: "Analiza produktu — mierzy sposób użytkowania w celu ulepszenia produktu." },
        { name: "AMP_MKTG_*", duration: "Do 1 roku", description: "Analiza produktu — mierzy, w jaki sposób odwiedzający po raz pierwszy trafili do aplikacji." },
      ],
    },
    about: [
      "Pliki cookie to małe pliki tekstowe, których strony internetowe używają, aby zwiększyć efektywność korzystania z nich przez użytkownika.",
      "Prawo pozwala nam przechowywać pliki cookie ściśle niezbędne do działania tej strony; na wszystko inne potrzebujemy Twojej zgody. Niezbędne pliki cookie są wykorzystywane na podstawie art. 6 ust. 1 lit. f) RODO; wszystkie pozostałe kategorie są wykorzystywane wyłącznie za Twoją zgodą (art. 6 ust. 1 lit. a) RODO).",
      "Ta strona wykorzystuje różne rodzaje plików cookie; niektóre z nich są ustawiane przez usługi stron trzecich obecne na naszych stronach.",
      "Możesz w każdej chwili zmienić lub wycofać swoją zgodę za pomocą linku „Ustawienia plików cookie” w stopce strony.",
    ],
    learnMore: "Dowiedz się więcej o tym, jak przetwarzamy dane osobowe, w naszej Polityce prywatności.",
    rejectAll: "Odrzuć wszystkie",
    customize: "Dostosuj",
    allowSelection: "Zezwól na wybrane",
    acceptAll: "Zaakceptuj wszystkie",
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
    writeCookie("NEXT_LOCALE", locale, COOKIE_LOCALE_MAX_AGE);
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
    { key: "necessary", count: text.cookies.necessary.length, disabled: true, checked: true, cookies: text.cookies.necessary },
    { key: "preferences", count: text.cookies.preferences.length, checked: preferences, cookies: text.cookies.preferences },
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

function CallManager({session}:{session:Session}) { return <MemberChatCalls session={session} locale={legacyLocaleOf(localeOf())} />; }

const SITE_TEXT = {
  en: {
    knowledge: "Knowledge Hub", match: "Find a match", clinics: "Clinics", lawyers: "Lawyers", resources: "Resources", professionals: "Professionals", safety: "Safety", pricing: "Pricing",
    profile: "Profile", signOut: "Sign out", signIn: "Sign in", signUp: "Sign up",
    likes: "Likes", messages: "Messages", notifications: "Member notifications",
    tagline: "Helping every family find their way.", platform: "Platform", company: "Company",
    contact: "Contact us", terms: "Terms of Use", privacy: "Privacy Policy",
    rights: "© 2026 LetsBeParents. All rights reserved.", cookies: "Cookie settings", language: "Language",
    aiAdvisorFabLabel: "AI Family Advisor",
  },
  ru: {
    knowledge: "База знаний", match: "Найти пару", clinics: "Клиники", lawyers: "Юристы", resources: "Ресурсы", professionals: "Специалисты", safety: "Безопасность", pricing: "Цены",
    profile: "Мой профиль", signOut: "Выйти", signIn: "Войти", signUp: "Регистрация",
    likes: "Лайки", messages: "Сообщения", notifications: "Уведомления участника",
    tagline: "Помогаем каждой семье найти свой путь.", platform: "Платформа", company: "Компания",
    contact: "Связаться с нами", terms: "Условия использования", privacy: "Политика конфиденциальности",
    rights: "© 2026 LetsBeParents. Все права защищены.", cookies: "Настройки cookies", language: "Язык",
    aiAdvisorFabLabel: "AI-советник по семье",
  },
  es: {
    knowledge: "Centro de conocimiento", match: "Buscar match", clinics: "Clínicas", lawyers: "Abogados", resources: "Recursos", professionals: "Profesionales", safety: "Seguridad", pricing: "Precios",
    profile: "Mi perfil", signOut: "Cerrar sesión", signIn: "Iniciar sesión", signUp: "Registrarse",
    likes: "Me gusta", messages: "Mensajes", notifications: "Notificaciones de miembro",
    tagline: "Ayudamos a cada familia a encontrar su camino.", platform: "Plataforma", company: "Empresa",
    contact: "Contáctanos", terms: "Términos de uso", privacy: "Política de privacidad",
    rights: "© 2026 LetsBeParents. Todos los derechos reservados.", cookies: "Preferencias de cookies", language: "Idioma",
    aiAdvisorFabLabel: "Asesor familiar con IA",
  },
  pt: {
    knowledge: "Centro de Conhecimento", match: "Encontrar um match", clinics: "Clínicas", lawyers: "Advogados", resources: "Recursos", professionals: "Profissionais", safety: "Segurança", pricing: "Preços",
    profile: "Perfil", signOut: "Sair", signIn: "Entrar", signUp: "Registar",
    likes: "Gostos", messages: "Mensagens", notifications: "Notificações de membro",
    tagline: "Ajudamos cada família a encontrar o seu caminho.", platform: "Plataforma", company: "Empresa",
    contact: "Contacte-nos", terms: "Termos de Utilização", privacy: "Política de Privacidade",
    rights: "© 2026 LetsBeParents. Todos os direitos reservados.", cookies: "Definições de cookies", language: "Idioma",
    aiAdvisorFabLabel: "Consultor familiar com IA",
  },
  fr: {
    knowledge: "Centre de connaissances", match: "Trouver un match", clinics: "Cliniques", lawyers: "Avocats", resources: "Ressources", professionals: "Professionnels", safety: "Sécurité", pricing: "Tarifs",
    profile: "Profil", signOut: "Se déconnecter", signIn: "Se connecter", signUp: "S'inscrire",
    likes: "J'aime", messages: "Messages", notifications: "Notifications des membres",
    tagline: "Nous aidons chaque famille à trouver sa voie.", platform: "Plateforme", company: "Entreprise",
    contact: "Nous contacter", terms: "Conditions d'utilisation", privacy: "Politique de confidentialité",
    rights: "© 2026 LetsBeParents. Tous droits réservés.", cookies: "Paramètres des cookies", language: "Langue",
    aiAdvisorFabLabel: "Conseiller familial IA",
  },
  de: {
    knowledge: "Wissenszentrum", match: "Match finden", clinics: "Kliniken", lawyers: "Anwälte", resources: "Ressourcen", professionals: "Fachleute", safety: "Sicherheit", pricing: "Preise",
    profile: "Profil", signOut: "Abmelden", signIn: "Anmelden", signUp: "Registrieren",
    likes: "Likes", messages: "Nachrichten", notifications: "Mitgliederbenachrichtigungen",
    tagline: "Wir helfen jeder Familie, ihren Weg zu finden.", platform: "Plattform", company: "Unternehmen",
    contact: "Kontaktieren Sie uns", terms: "Nutzungsbedingungen", privacy: "Datenschutzrichtlinie",
    rights: "© 2026 LetsBeParents. Alle Rechte vorbehalten.", cookies: "Cookie-Einstellungen", language: "Sprache",
    aiAdvisorFabLabel: "KI-Familienberater",
  },
  it: {
    knowledge: "Centro di conoscenza", match: "Trova un match", clinics: "Cliniche", lawyers: "Avvocati", resources: "Risorse", professionals: "Professionisti", safety: "Sicurezza", pricing: "Prezzi",
    profile: "Profilo", signOut: "Esci", signIn: "Accedi", signUp: "Registrati",
    likes: "Mi piace", messages: "Messaggi", notifications: "Notifiche membro",
    tagline: "Aiutiamo ogni famiglia a trovare la propria strada.", platform: "Piattaforma", company: "Azienda",
    contact: "Contattaci", terms: "Termini di utilizzo", privacy: "Informativa sulla privacy",
    rights: "© 2026 LetsBeParents. Tutti i diritti riservati.", cookies: "Impostazioni cookie", language: "Lingua",
    aiAdvisorFabLabel: "Consulente familiare IA",
  },
  pl: {
    knowledge: "Centrum wiedzy", match: "Znajdź dopasowanie", clinics: "Kliniki", lawyers: "Prawnicy", resources: "Zasoby", professionals: "Specjaliści", safety: "Bezpieczeństwo", pricing: "Cennik",
    profile: "Profil", signOut: "Wyloguj się", signIn: "Zaloguj się", signUp: "Zarejestruj się",
    likes: "Polubienia", messages: "Wiadomości", notifications: "Powiadomienia dla członków",
    tagline: "Pomagamy każdej rodzinie znaleźć swoją drogę.", platform: "Platforma", company: "Firma",
    contact: "Skontaktuj się z nami", terms: "Warunki korzystania", privacy: "Polityka prywatności",
    rights: "© 2026 LetsBeParents. Wszelkie prawa zastrzeżone.", cookies: "Ustawienia plików cookie", language: "Język",
    aiAdvisorFabLabel: "Doradca rodzinny AI",
  },
} satisfies Record<CookieLocale, Record<string, string>>;

function MemberCounters({
  session,
  menu = false,
  onNavigate,
}: {
  session: Session;
  menu?: boolean;
  onNavigate?: () => void;
}) {
  const locale = localeOf();
  const text = SITE_TEXT[locale];
  const [counts, setCounts] = useState<Row>({});
  const [memberState, setMemberState] = useState<{ userId: unknown; value: Row } | null>(null);
  const member = memberState?.userId === session?.user.id ? memberState?.value || {} : {};
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
    window.addEventListener("lbp-member-changed", load);
    const timer = window.setInterval(load, 30_000);
    return () => {
      alive = false;
      window.removeEventListener("lbp-member-changed", load);
      window.clearInterval(timer);
    };
  }, [session]);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const load = () => { void api
      .get<Row>("/member/me")
      .then((result) => alive && setMemberState({ userId: session.user.id, value: result || {} }))
      .catch(() => alive && setMemberState(null)); };
    load();
    window.addEventListener("lbp-member-changed", load);
    return () => { alive = false; window.removeEventListener("lbp-member-changed", load); };
  }, [session]);
  if (!session) return null;
  const likes = Number(counts.likesYou ?? counts.likesyou ?? member.likesYou ?? member.likesyou ?? 0);
  const messages = Number(counts.unreadMessages ?? counts.unreadmessages ?? member.unreadMessages ?? member.unreadmessages ?? 0);
  const profile = member.profile && typeof member.profile === "object" ? member.profile as Row : {};
  const data = profile.data && typeof profile.data === "object" ? profile.data as Row : {};
  const photos = Array.isArray(member.photos) ? member.photos : [];
  const firstPhoto = photos[0] && typeof photos[0] === "object" ? photos[0] as Row : {};
  const avatar = firstAvatarText(profile.avatarUrl, profile.avatar_url, data.avatarUrl, data.avatar_url, firstPhoto.publicUrl, firstPhoto.url);
  const displayName = firstAvatarText(profile.displayName, profile.display_name, data.displayName, data.display_name, session.user.displayName, session.user.display_name, "Member");
  return (
    <div className={menu ? "member-menu-counters" : "member-header-actions"} aria-label={text.notifications}>
      <Link className={menu ? "member-menu-action" : "member-icon-link"} role={menu ? "menuitem" : undefined} onClick={onNavigate} to={`/${locale}/likes`} aria-label={text.likes} aria-current={window.location.pathname === `/${locale}/likes` ? "page" : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /><path d="M7 10v12" /></svg>
        {menu && <span>{text.likes}</span>}
        {likes > 0 ? <b>{likes > 99 ? "99+" : likes}</b> : null}
      </Link>
      <Link className={menu ? "member-menu-action" : "member-icon-link"} role={menu ? "menuitem" : undefined} onClick={onNavigate} to={`/${locale}/chat`} aria-label={text.messages} aria-current={new RegExp(`^/${locale}/(?:messages|chat)(?:/|$)`).test(window.location.pathname) ? "page" : undefined}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /></svg>
        {menu && <span>{text.messages}</span>}
        {messages > 0 ? <b>{messages > 99 ? "99+" : messages}</b> : null}
      </Link>
      {!menu && <Link className="member-avatar-button" aria-label={text.profile} to={`/${locale}/profile`}>
          <UserAvatar src={avatar} name={displayName} fallbackClassName="member-avatar-initials" />
      </Link>}
    </div>
  );
}

function Shell({
  session,
  onLogout,
  children,
  pendingSession = false,
}: {
  session: Session;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
  pendingSession?: boolean;
}) {
  const { pathname } = useLocation();
  const locale = localeOf();
  const text = SITE_TEXT[locale];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const focusMenuOnOpen = useRef<"first" | "last" | null>(null);
  const [headerScrolled, setHeaderScrolled] = useState(() => window.scrollY > 24);
  const isLanding = new RegExp(`^/${locale}/?$`).test(pathname);
  const isAuth = new RegExp(`^/${locale}/auth/`).test(pathname);
  const isStandaloneAuth = new RegExp(`^/${locale}/auth/(?:reset-password|verify-email)/?$`).test(pathname);
  const isChat = new RegExp(`^/${locale}/(?:chat|messages)(?:/|$)`).test(pathname);
  const isProfileTool = new RegExp(`^/${locale}/(?:profile/(?:edit|photos|verification)|photos|verification)/?$`).test(pathname);
  const hasMemberMenu = Boolean(session);
  const isAccount = new RegExp(`^/${locale}/(?:profile(?:/(?:notifications|blocked))?|likes)/?$`).test(pathname);
  const isKnowledge = new RegExp(`^/${locale}/knowledge-hub(?:/|$)`).test(pathname);
  const isCatalog = !isProfileTool && new RegExp(`^/${locale}/(?:catalog(?:/|$)|profile/[^/]+/?$)`).test(pathname);
  const isMemberDetail = !isProfileTool && new RegExp(`^/${locale}/(?:catalog|profile)/[^/]+/?$`).test(pathname);
  const isClinics = new RegExp(`^/${locale}/clinics(?:/|$)`).test(pathname);
  const isLawyers = new RegExp(`^/${locale}/lawyers(?:/|$)`).test(pathname);
  const isDirectory = isClinics || isLawyers;
  const isDirectoryDetail = new RegExp(`^/${locale}/(?:clinics|lawyers)/[^/]+/?$`).test(pathname);
  const isArticle = new RegExp(`^/${locale}/knowledge-hub/[^/]+/?$`).test(pathname);
  const isContact = new RegExp(`^/${locale}/contact/?$`).test(pathname);
  const isTrustSafety = new RegExp(`^/${locale}/trust-safety/?$`).test(pathname);
  const isPricing = new RegExp(`^/${locale}/pricing/?$`).test(pathname);
  const isResources = new RegExp(`^/${locale}/resources(?:/|$)`).test(pathname);
  const isProfessionals = new RegExp(`^/${locale}/professionals(?:/|$)`).test(pathname);
  const isAiAdvisor = new RegExp(`^/${locale}/ai-advisor(?:/|$)`).test(pathname);
  const isFindYourPath = new RegExp(`^/${locale}/find-your-path(?:/|$)`).test(pathname);
  const isStaticPage = new RegExp(`^/${locale}/pages/[^/]+/?$`).test(pathname);
  const menuItems = () => Array.from(navigationRef.current?.querySelectorAll<HTMLElement>("a, button") || [])
    .filter((item) => item.getClientRects().length > 0 && !item.hasAttribute("disabled"));
  const focusMenuEdge = (edge: "first" | "last") => {
    const items = menuItems();
    (edge === "last" ? items[items.length - 1] : items[0])?.focus();
  };
  useEffect(() => {
    if (!menuOpen) return;
    if (focusMenuOnOpen.current) {
      focusMenuEdge(focusMenuOnOpen.current);
      focusMenuOnOpen.current = null;
    }
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest(".mobile-menu, .web-header nav")) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuTriggerRef.current?.focus();
    };
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1280) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnDesktop);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnDesktop);
    };
  }, [hasMemberMenu, menuOpen]);
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
    if ((SUPPORTED_SITE_LOCALES as string[]).includes(parts[0] || "")) parts[0] = nextLocale;
    else parts.unshift(nextLocale);
    window.location.assign(`/${parts.join("/")}${window.location.search}${window.location.hash}`);
  };
  const navigation = (
    <nav ref={navigationRef} id="public-site-navigation" className={menuOpen ? "open" : ""} role={menuOpen ? "menu" : undefined} aria-label={locale === "ru" ? "Основная навигация" : locale === "es" ? "Navegación principal" : "Primary navigation"}
      onKeyDown={(event) => {
        if (!menuOpen || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const items = menuItems();
        const current = items.findIndex((item) => item === document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
          : event.key === "ArrowDown" ? (current + 1) % items.length
          : current <= 0 ? items.length - 1 : current - 1;
        items[next]?.focus();
      }}>
      <Link role={menuOpen ? "menuitem" : undefined} className={isKnowledge ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/knowledge-hub`}>
        {text.knowledge}
      </Link>
      <Link role={menuOpen ? "menuitem" : undefined} className={isCatalog ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/catalog`}>
        {text.match}
      </Link>
      <Link role={menuOpen ? "menuitem" : undefined} className={isClinics ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/clinics`}>
        {text.clinics}
      </Link>
      <Link role={menuOpen ? "menuitem" : undefined} className={isLawyers ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/lawyers`}>
        {text.lawyers}
      </Link>
      <Link role={menuOpen ? "menuitem" : undefined} className={isResources || isFindYourPath ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/resources`}>
        {text.resources}
      </Link>
      <Link role={menuOpen ? "menuitem" : undefined} className={isProfessionals ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/professionals`}>
        {text.professionals}
      </Link>
      <Link role={menuOpen ? "menuitem" : undefined} className={isTrustSafety ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/trust-safety`}>
        {text.safety}
      </Link>
      <Link role={menuOpen ? "menuitem" : undefined} className={isPricing ? "active" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/pricing`}>
        {text.pricing}
      </Link>
      <div className="mobile-nav-actions">
        {pendingSession ? null : session && hasMemberMenu ? (menuOpen && <MemberCounters session={session} menu onNavigate={() => setMenuOpen(false)} />) : session ? (
          <>
            <Link role={menuOpen ? "menuitem" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/profile`}>{text.profile}</Link>
            <button role={menuOpen ? "menuitem" : undefined} className="plain-button" onClick={() => void onLogout()}>{text.signOut}</button>
          </>
        ) : (
          <>
            <Link role={menuOpen ? "menuitem" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/auth/login`}>{text.signIn}</Link>
            <Link role={menuOpen ? "menuitem" : undefined} onClick={() => setMenuOpen(false)} to={`/${locale}/auth/register`}>{text.signUp}</Link>
          </>
        )}
      </div>
    </nav>
  );
  return (
    <div className={`web-app${isChat ? " chat-app" : ""}${isProfileTool ? " profile-tools-app" : ""}`}>
      <header className={`web-header${headerScrolled ? " is-scrolled" : ""}`}>
        <div className="web-header-inner">
          <Link className="logo" to={`/${locale}`} aria-label="LetsBeParents">
            <img src="/web-static/logo-db535d28.svg" alt="LetsBeParents" />
          </Link>
          {navigation}
          <button
            ref={menuTriggerRef}
            className={`mobile-menu${session || pendingSession ? " has-member-actions" : ""}`}
            type="button"
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            aria-controls="public-site-navigation"
            aria-haspopup="menu"
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              const edge = event.key === "ArrowUp" ? "last" : "first";
              if (menuOpen) focusMenuEdge(edge);
              else {
                focusMenuOnOpen.current = edge;
                setMenuOpen(true);
              }
            }}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {hasMemberMenu ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16" /><path d="M4 12h16" /><path d="M4 19h16" /></svg> : <><span /><span /><span /></>}
          </button>
          {pendingSession ? <div className="header-actions pending-header-actions" aria-hidden="true" /> : session ? (
            <div className="header-actions member-header-actions-wrap">
              <MemberCounters session={session} />
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
      </header>
      <main className={`web-main${isLanding ? " landing-main" : ""}${isAuth ? " auth-main" : ""}${isStandaloneAuth ? " standalone-auth-main" : ""}${isKnowledge ? " knowledge-main" : ""}${isCatalog ? " catalog-main" : ""}${isMemberDetail ? " member-profile-main" : ""}${isDirectory && !isDirectoryDetail ? " directory-main" : ""}${isDirectoryDetail ? " directory-detail-main" : ""}${isArticle ? " article-main" : ""}${isContact ? " contact-main" : ""}${isTrustSafety ? " trust-main" : ""}${isPricing ? " pricing-main" : ""}${isResources ? " resources-main" : ""}${isFindYourPath ? " resources-main" : ""}${isProfessionals ? " professionals-main" : ""}${isStaticPage ? " static-main" : ""}${isAccount ? " account-main" : ""}`}>{children}</main>
      <footer className="web-footer">
        <div className="web-footer-inner">
          <div className="footer-brand">
            <Link to={`/${locale}`} aria-label="LetsBeParents">
              <img src="/web-static/logo-db535d28.svg" alt="LetsBeParents" />
            </Link>
            <p>{text.tagline}</p>
            <div className="footer-store-links">
              <a href="https://letsbeparents.onelink.me/wg1x?pid=website&c=footer" aria-label="Download on the App Store">
                <img src="/web-static/images/badges/appstore-white-b32c87ae.png" alt="Download on the App Store" />
              </a>
              <a href="https://letsbeparents.onelink.me/wg1x?pid=website&c=footer" aria-label="Get it on Google Play">
                <img src="/web-static/images/badges/googleplay-white-7aebf78f.png" alt="Get it on Google Play" />
              </a>
            </div>
          </div>
          <div className="footer-column">
            <h3>{text.platform}</h3>
            <nav>
              <Link to={`/${locale}/knowledge-hub`}>{text.knowledge}</Link>
              <Link to={`/${locale}/clinics`}>{text.clinics}</Link>
              <Link to={`/${locale}/lawyers`}>{text.lawyers}</Link>
              <Link to={`/${locale}/resources`}>{text.resources}</Link>
              <Link to={`/${locale}/professionals`}>{text.professionals}</Link>
              <Link to={`/${locale}/trust-safety`}>{text.safety}</Link>
              <Link to={`/${locale}/pricing`}>{text.pricing}</Link>
            </nav>
          </div>
          <div className="footer-column">
            <h3>{text.company}</h3>
            <nav>
              <Link to={`/${locale}/contact`}>{text.contact}</Link>
              <Link to={`/${locale}/trust-safety`}>{text.safety}</Link>
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
                  <option value="pt">Português</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="it">Italiano</option>
                  <option value="pl">Polski</option>
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
      {session && !isAiAdvisor ? (
        <Link
          to={`/${locale}/ai-advisor`}
          className="ai-advisor-fab"
          aria-label={text.aiAdvisorFabLabel}
          title={text.aiAdvisorFabLabel}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </Link>
      ) : null}
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
    whatsNew: {
      label: "NEW ON LETSBEPARENTS", title: "More ways to match, connect and stay safe",
      intro: "We keep shipping - here's what's new since you last looked.",
      tiers: { free: "Free", builder: "Family Builder+", pro: "Family Builder Pro" },
      items: [
        { icon: "boost", tier: "free", title: "Profile Boost", copy: "Get more visibility in the catalog for a limited time.", href: "/boost" },
        { icon: "referral", tier: "free", title: "Invite & earn a Boost", copy: "Invite a friend - when they join and verify, you both get a free Boost.", href: "/referral" },
        { icon: "safety", tier: "free", title: "Safety Check-In", copy: "Share your meeting plan with someone you trust before meeting a match in person.", href: "/safety-checkin" },
        { icon: "video", tier: "free", title: "Video Verification badge", copy: "Add an extra layer of trust with a video-verified badge on your profile.", href: "/video-verification" },
        { icon: "message", tier: "builder", title: "AI-drafted message starters", copy: "Get 3 tailored opening messages for any match, powered by AI.", href: "/messages" },
        { icon: "insight", tier: "builder", title: "Weekly AI Advisor insight", copy: "A fresh, personalized tip from your AI Family Advisor every week.", href: "/ai-advisor" },
        { icon: "agreement", tier: "pro", title: "Co-Parenting Agreement sign-off", copy: "Turn your shared Family Plan into a mutual record you both sign.", href: "/pricing" },
        { icon: "community", tier: "pro", title: "Community groups & discussions", copy: "Join topic groups and discussions with others on the same path.", href: "/community" },
      ],
    },
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
    whatsNew: {
      label: "НОВОЕ НА LETSBEPARENTS", title: "Больше возможностей находить пару, общаться и оставаться в безопасности",
      intro: "Мы продолжаем развивать платформу - вот что появилось нового.",
      tiers: { free: "Бесплатно", builder: "Family Builder+", pro: "Family Builder Pro" },
      items: [
        { icon: "boost", tier: "free", title: "Boost профиля", copy: "Больше видимости в каталоге на ограниченное время.", href: "/boost" },
        { icon: "referral", tier: "free", title: "Приглашай и получай Boost", copy: "Пригласите друга - когда он присоединится и пройдёт верификацию, вы оба получите бесплатный Boost.", href: "/referral" },
        { icon: "safety", tier: "free", title: "Safety Check-In", copy: "Поделитесь планом встречи с тем, кому доверяете, прежде чем увидеться с совпадением лично.", href: "/safety-checkin" },
        { icon: "video", tier: "free", title: "Значок Video Verification", copy: "Добавьте профилю дополнительный уровень доверия с помощью видео-верификации.", href: "/video-verification" },
        { icon: "message", tier: "builder", title: "AI-подсказки для первого сообщения", copy: "Получите 3 персональных варианта первого сообщения для любого совпадения - их предлагает AI.", href: "/messages" },
        { icon: "insight", tier: "builder", title: "Еженедельный совет от AI Advisor", copy: "Новый персональный совет от вашего AI Family Advisor каждую неделю.", href: "/ai-advisor" },
        { icon: "agreement", tier: "pro", title: "Подписание Co-Parenting Agreement", copy: "Превратите общий Family Plan в совместную договорённость, которую подписываете вы оба.", href: "/pricing" },
        { icon: "community", tier: "pro", title: "Группы и обсуждения Community", copy: "Присоединяйтесь к тематическим группам и обсуждениям с теми, кто на похожем пути.", href: "/community" },
      ],
    },
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
    whatsNew: {
      label: "NUEVO EN LETSBEPARENTS", title: "Más formas de encontrar match, conectar y mantenerte seguro",
      intro: "Seguimos mejorando la plataforma - esto es lo nuevo.",
      tiers: { free: "Gratis", builder: "Family Builder+", pro: "Family Builder Pro" },
      items: [
        { icon: "boost", tier: "free", title: "Boost de perfil", copy: "Más visibilidad en el catálogo durante un tiempo limitado.", href: "/boost" },
        { icon: "referral", tier: "free", title: "Invita y gana un Boost", copy: "Invita a alguien - cuando se una y se verifique, ambos recibiréis un Boost gratis.", href: "/referral" },
        { icon: "safety", tier: "free", title: "Safety Check-In", copy: "Comparte tu plan de encuentro con alguien de confianza antes de ver a un match en persona.", href: "/safety-checkin" },
        { icon: "video", tier: "free", title: "Insignia Video Verification", copy: "Añade una capa extra de confianza con una insignia de verificación por vídeo.", href: "/video-verification" },
        { icon: "message", tier: "builder", title: "Mensajes iniciales sugeridos por IA", copy: "Recibe 3 mensajes de apertura personalizados para cualquier match, generados por IA.", href: "/messages" },
        { icon: "insight", tier: "builder", title: "Consejo semanal del AI Advisor", copy: "Un consejo nuevo y personalizado de tu AI Family Advisor cada semana.", href: "/ai-advisor" },
        { icon: "agreement", tier: "pro", title: "Firma del Co-Parenting Agreement", copy: "Convierte vuestro Family Plan compartido en un acuerdo mutuo que firmáis los dos.", href: "/pricing" },
        { icon: "community", tier: "pro", title: "Grupos y debates de Community", copy: "Únete a grupos temáticos y debates con quienes están en un camino parecido.", href: "/community" },
      ],
    },
    ctaTitle: "¿Listo para formar tu familia?", ctaCopy: "Únete a miles de futuros padres y madres. Crea tu cuenta gratis hoy.",
    ctaButton: "Crear cuenta gratis", appLabel: "También disponible como app móvil gratuita",
  },
  pt: {
    pill: "Plataforma de formação de família",
    title: "Seu caminho para a parentalidade começa aqui",
    intro: "Encontre um doador, co-pai/co-mãe ou parceiro para formar uma família - depois dê os próximos passos com clínicas de confiança, especialistas jurídicos e orientação prática.",
    start: "Encontre seu caminho", how: "COMO FUNCIONA", stepsTitle: "Cinco passos para sua família",
    trustLine: "Cada perfil tem a identidade verificada - veja o que verificamos.",
    steps: [
      ["01", "Crie seu perfil", "Conte-nos sobre você, suas preferências e que tipo de família você sonha em construir.", "profile"],
      ["02", "Encontre seu match", "Veja perfis de doadores, co-pais e parceiros para formar uma família. Filtre por valores e conecte-se.", "match"],
      ["03", "Entenda sua compatibilidade", "Veja sua pontuação de compatibilidade e o que vale a pena conversar antes de decidir.", "compatibility"],
      ["04", "Planeje sua família juntos", "Crie um Family Plan compartilhado - criação dos filhos, finanças, etapas legais - tudo em um só lugar.", "plan"],
      ["05", "Conte com apoio especializado", "Conecte-se com clínicas de fertilidade e especialistas em direito reprodutivo verificados sempre que precisar.", "support"],
    ],
    pathSelector: {
      label: "ENCONTRE SEU CAMINHO", title: "O que te trouxe até aqui?",
      intro: "Cada família começa de um jeito diferente. Escolha o caminho que mais combina com você - você sempre pode explorar outras opções depois.",
      options: [
        ["coparent", "Estou procurando um co-pai ou co-mãe"],
        ["donor", "Estou procurando um doador"],
        ["partner", "Estou procurando um parceiro para formar uma família"],
        ["couple-donor", "Somos um casal procurando um doador"],
        ["exploring", "Estou explorando minhas opções"],
      ],
    },
    features: [
      { label: "MATCHMAKING", title: "Encontre seu doador, co-pai ou parceiro", copy: "Nosso sistema de compatibilização cuidadoso ajuda você a se conectar com a pessoa certa. Filtre por localização, valores e preferências. Curta perfis, faça matches e depois converse por chat e videochamada - tudo em um espaço seguro e privado.", points: ["Filtros avançados por localização, tipo e preferências", "Mensagens integradas e videochamadas em HD", "Privacidade em primeiro lugar: controle quem vê seu perfil"] },
      { label: "CLÍNICAS", title: "Clínicas de fertilidade de padrão mundial, a um clique de distância", copy: "Veja clínicas verificadas em mais de 20 países. Leia perfis detalhados, compare serviços e inicie uma videoconsulta - tudo sem sair de casa. Cada clínica é avaliada quanto à qualidade e à inclusão.", points: ["Videoconsultas com os melhores especialistas", "Clínicas verificadas quanto à inclusão de casais LGBTQ+ e pais solo", "Preços transparentes e avaliações reais de pacientes"] },
      { label: "ADVOGADOS", title: "Orientação jurídica em quem você pode confiar", copy: "Acordos com doadores, direitos parentais - o direito reprodutivo é complexo. Nosso diretório com mais de 350 advogados verificados em mais de 20 países garante o suporte jurídico especializado que se adapta à sua estrutura familiar.", points: ["Especialistas em direito de doadores e direito de família", "Filtre por país, idioma e área de atuação", "Salve favoritos e compare profissionais jurídicos"] },
      { label: "PLANEJAMENTO FAMILIAR", title: "Planeje sua família, juntos", copy: "Depois de dar match, continuem construindo juntos. Veja seu Relatório de Compatibilidade, conversem sobre o que importa e criem um Family Plan compartilhado cobrindo criação dos filhos, finanças e etapas legais - tudo em um só lugar.", points: ["Relatório de Compatibilidade com pontos reais para conversar, não apenas uma nota de aprovado/reprovado", "Family Plan compartilhado para criação dos filhos, finanças e etapas legais", "Um só lugar para continuar planejando depois do match, não apenas um chat"] },
      { label: "TORNE-SE DOADOR", title: "Dê o presente da parentalidade", copy: "Você tem o poder de mudar a vida de alguém para sempre. Se você está pensando em doar óvulos ou esperma - nossa plataforma conecta você com pessoas que sonham em formar uma família. Crie seu perfil, defina suas condições e ajude a tornar a parentalidade possível.", points: ["Compatibilização segura e verificada com pais pretendidos", "Controle total sobre seu perfil, condições e privacidade", "Chat e videochamadas integrados para se conhecerem"] },
      { label: "PARA CLÍNICAS E ADVOGADOS", title: "Faça sua prática crescer, alcance mais famílias", copy: "Junte-se ao nosso diretório profissional e conecte-se com milhares de clientes em potencial. Tenha seu próprio painel de parceiro para gerenciar consultas, se comunicar com pacientes por chat seguro e videochamadas, realizar campanhas promocionais e construir sua reputação na comunidade de saúde reprodutiva.", points: ["Painel de parceiro pessoal com análises", "Chat seguro e videoconsultas com clientes", "Ferramentas promocionais e campanhas de e-mail segmentadas"] },
    ],
    stats: [["15.1K", "Membros no mundo todo"], ["7.3K", "Doadores"], ["4.5K", "Clínicas parceiras"], ["369", "Advogados"]],
    whatsNew: {
      label: "NOVIDADES NO LETSBEPARENTS", title: "Mais formas de encontrar matches, se conectar e ficar seguro",
      intro: "Continuamos evoluindo a plataforma - veja o que há de novo desde sua última visita.",
      tiers: { free: "Grátis", builder: "Family Builder+", pro: "Family Builder Pro" },
      items: [
        { icon: "boost", tier: "free", title: "Boost de perfil", copy: "Ganhe mais visibilidade no catálogo por tempo limitado.", href: "/boost" },
        { icon: "referral", tier: "free", title: "Indique e ganhe um Boost", copy: "Convide um amigo - quando ele entrar e verificar a conta, vocês dois ganham um Boost gratuito.", href: "/referral" },
        { icon: "safety", tier: "free", title: "Safety Check-In", copy: "Compartilhe seu plano de encontro com alguém de confiança antes de conhecer um match pessoalmente.", href: "/safety-checkin" },
        { icon: "video", tier: "free", title: "Selo de Verificação em Vídeo", copy: "Adicione uma camada extra de confiança com um selo de verificação em vídeo no seu perfil.", href: "/video-verification" },
        { icon: "message", tier: "builder", title: "Mensagens iniciais geradas por IA", copy: "Receba 3 mensagens de abertura personalizadas para qualquer match, geradas por IA.", href: "/messages" },
        { icon: "insight", tier: "builder", title: "Dica semanal do AI Advisor", copy: "Uma dica nova e personalizada do seu AI Family Advisor toda semana.", href: "/ai-advisor" },
        { icon: "agreement", tier: "pro", title: "Assinatura do Co-Parenting Agreement", copy: "Transforme seu Family Plan compartilhado em um registro mútuo que vocês dois assinam.", href: "/pricing" },
        { icon: "community", tier: "pro", title: "Grupos e discussões da Community", copy: "Participe de grupos temáticos e discussões com outras pessoas no mesmo caminho.", href: "/community" },
      ],
    },
    ctaTitle: "Pronto para começar sua família?", ctaCopy: "Junte-se a milhares de futuros pais. Crie sua conta gratuita hoje.",
    ctaButton: "Criar conta gratuita", appLabel: "Também disponível como aplicativo móvel gratuito",
  },
  fr: {
    pill: "Plateforme de fondation familiale",
    title: "Votre chemin vers la parentalité commence ici",
    intro: "Trouvez un donneur, un co-parent ou un partenaire de fondation familiale - puis passez à l'étape suivante avec des cliniques de confiance, des experts juridiques et des conseils pratiques.",
    start: "Trouvez votre voie", how: "COMMENT ÇA MARCHE", stepsTitle: "Cinq étapes vers votre famille",
    trustLine: "Chaque profil fait l'objet d'une vérification d'identité - découvrez ce que nous vérifions.",
    steps: [
      ["01", "Créez votre profil", "Parlez-nous de vous, de vos préférences et du type de famille que vous rêvez de fonder.", "profile"],
      ["02", "Trouvez votre match", "Parcourez les profils de donneurs, co-parents et partenaires de fondation familiale. Filtrez selon vos valeurs et entrez en contact.", "match"],
      ["03", "Comprenez votre compatibilité", "Découvrez votre score de compatibilité et les sujets à aborder avant de vous décider.", "compatibility"],
      ["04", "Planifiez votre famille ensemble", "Construisez un Family Plan partagé - éducation, finances, démarches juridiques - en un seul endroit.", "plan"],
      ["05", "Bénéficiez d'un accompagnement expert", "Contactez des cliniques de fertilité et des spécialistes du droit de la reproduction vérifiés, dès que vous en avez besoin.", "support"],
    ],
    pathSelector: {
      label: "TROUVEZ VOTRE VOIE", title: "Qu'est-ce qui vous amène ici ?",
      intro: "Chaque famille commence différemment. Choisissez le chemin qui vous correspond le mieux - vous pourrez toujours explorer d'autres options plus tard.",
      options: [
        ["coparent", "Je cherche un co-parent"],
        ["donor", "Je cherche un donneur"],
        ["partner", "Je cherche un partenaire de fondation familiale"],
        ["couple-donor", "Nous sommes un couple à la recherche d'un donneur"],
        ["exploring", "J'explore mes options"],
      ],
    },
    features: [
      { label: "MATCHMAKING", title: "Trouvez votre donneur, co-parent ou partenaire", copy: "Notre système de mise en relation attentif vous aide à trouver la bonne personne. Filtrez par lieu, valeurs et préférences. Aimez des profils, obtenez un match, puis discutez par chat et appel vidéo - le tout dans un espace sûr et privé.", points: ["Filtres avancés par lieu, type et préférences", "Messagerie intégrée et appels vidéo HD", "La confidentialité avant tout : contrôlez qui voit votre profil"] },
      { label: "CLINIQUES", title: "Des cliniques de fertilité de renommée mondiale, à portée de clic", copy: "Parcourez des cliniques vérifiées dans plus de 20 pays. Consultez des profils détaillés, comparez les services et démarrez une consultation vidéo - le tout depuis votre salon. Chaque clinique est contrôlée pour sa qualité et son inclusivité.", points: ["Consultations vidéo avec des spécialistes de premier plan", "Cliniques vérifiées pour leur inclusivité envers les personnes LGBTQ+ et les parents solos", "Tarifs transparents et avis de patients authentiques"] },
      { label: "AVOCATS", title: "Un accompagnement juridique en qui vous pouvez avoir confiance", copy: "Accords avec les donneurs, droits parentaux - le droit de la reproduction est complexe. Notre annuaire de plus de 350 avocats vérifiés dans plus de 20 pays vous garantit un accompagnement juridique expert adapté à votre structure familiale.", points: ["Spécialistes du droit des donneurs et du droit de la famille", "Filtrez par pays, langue et domaine de pratique", "Enregistrez vos favoris et comparez les professionnels du droit"] },
      { label: "PLANIFICATION FAMILIALE", title: "Planifiez votre famille, ensemble", copy: "Une fois le match établi, continuez à construire ensemble. Consultez votre Rapport de compatibilité, discutez de ce qui compte vraiment et créez un Family Plan partagé couvrant l'éducation, les finances et les démarches juridiques - le tout en un seul endroit.", points: ["Un Rapport de compatibilité avec de vrais sujets de discussion, pas seulement un score réussite/échec", "Un Family Plan partagé pour l'éducation, les finances et les démarches juridiques", "Un seul endroit pour continuer à planifier après le match, pas seulement un chat"] },
      { label: "DEVENIR DONNEUR", title: "Offrez le cadeau de la parentalité", copy: "Vous avez le pouvoir de changer la vie de quelqu'un pour toujours. Que vous envisagiez un don d'ovocytes ou de sperme - notre plateforme vous met en relation avec des personnes qui rêvent de fonder une famille. Créez votre profil, fixez vos conditions et aidez à rendre la parentalité possible.", points: ["Mise en relation sûre et vérifiée avec des parents d'intention", "Contrôle total sur votre profil, vos conditions et votre confidentialité", "Chat et appels vidéo intégrés pour apprendre à vous connaître"] },
      { label: "POUR LES CLINIQUES ET LES AVOCATS", title: "Développez votre activité, touchez plus de familles", copy: "Rejoignez notre annuaire professionnel et entrez en contact avec des milliers de clients potentiels. Bénéficiez de votre propre tableau de bord partenaire pour gérer les rendez-vous, communiquer avec les patients par chat sécurisé et appels vidéo, lancer des campagnes promotionnelles et bâtir votre réputation dans la communauté de la santé reproductive.", points: ["Tableau de bord partenaire personnel avec statistiques", "Chat sécurisé et consultations vidéo avec les clients", "Outils promotionnels et campagnes email ciblées"] },
    ],
    stats: [["15.1K", "Membres dans le monde"], ["7.3K", "Donneurs"], ["4.5K", "Cliniques partenaires"], ["369", "Avocats"]],
    whatsNew: {
      label: "NOUVEAU SUR LETSBEPARENTS", title: "Encore plus de façons de matcher, échanger et rester en sécurité",
      intro: "Nous continuons à faire évoluer la plateforme - voici les nouveautés depuis votre dernière visite.",
      tiers: { free: "Gratuit", builder: "Family Builder+", pro: "Family Builder Pro" },
      items: [
        { icon: "boost", tier: "free", title: "Boost de profil", copy: "Gagnez en visibilité dans le catalogue pendant une durée limitée.", href: "/boost" },
        { icon: "referral", tier: "free", title: "Parrainez et gagnez un Boost", copy: "Invitez un ami - quand il rejoint la plateforme et se vérifie, vous obtenez tous les deux un Boost gratuit.", href: "/referral" },
        { icon: "safety", tier: "free", title: "Safety Check-In", copy: "Partagez votre plan de rencontre avec une personne de confiance avant de rencontrer un match en personne.", href: "/safety-checkin" },
        { icon: "video", tier: "free", title: "Badge de vérification vidéo", copy: "Ajoutez une couche de confiance supplémentaire grâce à un badge de vérification vidéo sur votre profil.", href: "/video-verification" },
        { icon: "message", tier: "builder", title: "Messages d'accroche rédigés par l'IA", copy: "Recevez 3 messages d'ouverture personnalisés pour chaque match, générés par l'IA.", href: "/messages" },
        { icon: "insight", tier: "builder", title: "Conseil hebdomadaire de l'AI Advisor", copy: "Un conseil personnalisé de votre AI Family Advisor chaque semaine.", href: "/ai-advisor" },
        { icon: "agreement", tier: "pro", title: "Signature du Co-Parenting Agreement", copy: "Transformez votre Family Plan partagé en un accord mutuel que vous signez tous les deux.", href: "/pricing" },
        { icon: "community", tier: "pro", title: "Groupes et discussions de la Community", copy: "Rejoignez des groupes thématiques et des discussions avec d'autres personnes sur un chemin similaire.", href: "/community" },
      ],
    },
    ctaTitle: "Prêt à fonder votre famille ?", ctaCopy: "Rejoignez des milliers de futurs parents. Créez votre compte gratuit dès aujourd'hui.",
    ctaButton: "Créer un compte gratuit", appLabel: "Également disponible sous forme d'application mobile gratuite",
  },
  de: {
    pill: "Plattform für Familiengründung",
    title: "Ihr Weg zur Elternschaft beginnt hier",
    intro: "Finden Sie eine Spenderin oder einen Spender, eine Co-Elternschaft oder einen Partner für die Familiengründung - und gehen Sie dann die nächsten Schritte mit vertrauenswürdigen Kliniken, Rechtsexperten und praktischer Beratung.",
    start: "Finden Sie Ihren Weg", how: "SO FUNKTIONIERT ES", stepsTitle: "Fünf Schritte zu Ihrer Familie",
    trustLine: "Jedes Profil ist identitätsgeprüft - erfahren Sie, was wir prüfen.",
    steps: [
      ["01", "Erstellen Sie Ihr Profil", "Erzählen Sie uns von sich, Ihren Vorlieben und von der Familie, die Sie sich erträumen.", "profile"],
      ["02", "Finden Sie Ihr Match", "Durchsuchen Sie Profile von Spendern, Co-Eltern und Partnern für die Familiengründung. Filtern Sie nach Werten und nehmen Sie Kontakt auf.", "match"],
      ["03", "Verstehen Sie Ihre Kompatibilität", "Sehen Sie Ihren Kompatibilitäts-Score und worüber Sie vor einer Entscheidung sprechen sollten.", "compatibility"],
      ["04", "Planen Sie Ihre Familie gemeinsam", "Erstellen Sie einen gemeinsamen Family Plan - Erziehung, Finanzen, rechtliche Schritte - alles an einem Ort.", "plan"],
      ["05", "Holen Sie sich fachkundige Unterstützung", "Nehmen Sie jederzeit Kontakt zu geprüften Kinderwunschkliniken und Spezialisten für Fortpflanzungsrecht auf.", "support"],
    ],
    pathSelector: {
      label: "FINDEN SIE IHREN WEG", title: "Was führt Sie hierher?",
      intro: "Jede Familie beginnt anders. Wählen Sie den Weg, der am besten zu Ihnen passt - Sie können später jederzeit weitere Optionen erkunden.",
      options: [
        ["coparent", "Ich suche eine Co-Elternschaft"],
        ["donor", "Ich suche eine Spenderin oder einen Spender"],
        ["partner", "Ich suche einen Partner für die Familiengründung"],
        ["couple-donor", "Wir sind ein Paar und suchen eine Spenderin oder einen Spender"],
        ["exploring", "Ich informiere mich über meine Möglichkeiten"],
      ],
    },
    features: [
      { label: "MATCHMAKING", title: "Finden Sie Ihre Spenderin, Ihren Spender, Ihre Co-Elternschaft oder Ihren Partner", copy: "Unser durchdachtes Matching-System hilft Ihnen, die richtige Person zu finden. Filtern Sie nach Standort, Werten und Vorlieben. Liken Sie Profile, erhalten Sie Matches und chatten oder telefonieren Sie dann per Video - alles in einem sicheren, privaten Raum.", points: ["Erweiterte Filter nach Standort, Typ und Vorlieben", "Integrierte Nachrichten und HD-Videoanrufe", "Datenschutz an erster Stelle: Bestimmen Sie, wer Ihr Profil sieht"] },
      { label: "KLINIKEN", title: "Erstklassige Kinderwunschkliniken, nur einen Klick entfernt", copy: "Durchsuchen Sie geprüfte Kliniken in über 20 Ländern. Lesen Sie ausführliche Profile, vergleichen Sie Leistungen und starten Sie eine Videoberatung - ganz bequem von zu Hause aus. Jede Klinik wird auf Qualität und Inklusivität geprüft.", points: ["Videoberatungen mit Top-Spezialisten", "Kliniken geprüft auf Inklusivität für LGBTQ+ und Alleinerziehende", "Transparente Preise und echte Patientenbewertungen"] },
      { label: "ANWÄLTE", title: "Rechtsberatung, der Sie vertrauen können", copy: "Spendervereinbarungen, Elternrechte - das Fortpflanzungsrecht ist komplex. Unser Verzeichnis mit über 350 geprüften Anwälten in über 20 Ländern sichert Ihnen fachkundige rechtliche Unterstützung, zugeschnitten auf Ihre Familienstruktur.", points: ["Spezialisten für Spender- und Familienrecht", "Filtern Sie nach Land, Sprache und Praxisgebiet", "Favoriten speichern und Rechtsexperten vergleichen"] },
      { label: "FAMILIENPLANUNG", title: "Planen Sie Ihre Familie gemeinsam", copy: "Sobald Sie ein Match gefunden haben, bauen Sie gemeinsam weiter auf. Sehen Sie sich Ihren Kompatibilitätsbericht an, sprechen Sie über das Wesentliche und erstellen Sie einen gemeinsamen Family Plan für Erziehung, Finanzen und rechtliche Schritte - alles an einem Ort.", points: ["Kompatibilitätsbericht mit echten Gesprächspunkten statt einer Bestehen/Nicht-bestehen-Bewertung", "Gemeinsamer Family Plan für Erziehung, Finanzen und rechtliche Schritte", "Ein zentraler Ort zum Weiterplanen nach dem Match - nicht nur ein Chat"] },
      { label: "SPENDER WERDEN", title: "Schenken Sie das Geschenk der Elternschaft", copy: "Sie haben die Möglichkeit, das Leben eines anderen Menschen für immer zu verändern. Ob Sie eine Eizell- oder Samenspende in Betracht ziehen - unsere Plattform verbindet Sie mit Menschen, die von einer eigenen Familie träumen. Erstellen Sie Ihr Profil, legen Sie Ihre Bedingungen fest und helfen Sie, Elternschaft möglich zu machen.", points: ["Sichere, geprüfte Vermittlung mit Wunscheltern", "Volle Kontrolle über Ihr Profil, Ihre Bedingungen und Ihre Privatsphäre", "Integrierter Chat und Videoanrufe zum Kennenlernen"] },
      { label: "FÜR KLINIKEN & ANWÄLTE", title: "Erweitern Sie Ihre Praxis, erreichen Sie mehr Familien", copy: "Treten Sie unserem Fachverzeichnis bei und vernetzen Sie sich mit Tausenden potenziellen Klienten. Nutzen Sie Ihr eigenes Partner-Dashboard, um Termine zu verwalten, mit Patienten per sicherem Chat und Videoanruf zu kommunizieren, Werbekampagnen durchzuführen und Ihren Ruf in der Reproduktionsmedizin-Community aufzubauen.", points: ["Persönliches Partner-Dashboard mit Analysen", "Sicherer Chat und Videoberatungen mit Klienten", "Werbetools und gezielte E-Mail-Kampagnen"] },
    ],
    stats: [["15.1K", "Mitglieder weltweit"], ["7.3K", "Spender"], ["4.5K", "Partnerkliniken"], ["369", "Anwälte"]],
    whatsNew: {
      label: "NEU BEI LETSBEPARENTS", title: "Mehr Möglichkeiten zum Matchen, Vernetzen und Sicherbleiben",
      intro: "Wir entwickeln die Plattform stetig weiter - das ist neu seit Ihrem letzten Besuch.",
      tiers: { free: "Kostenlos", builder: "Family Builder+", pro: "Family Builder Pro" },
      items: [
        { icon: "boost", tier: "free", title: "Profil-Boost", copy: "Erhalten Sie für begrenzte Zeit mehr Sichtbarkeit im Katalog.", href: "/boost" },
        { icon: "referral", tier: "free", title: "Einladen & einen Boost verdienen", copy: "Laden Sie einen Freund ein - sobald er beitritt und sich verifiziert, erhalten Sie beide einen kostenlosen Boost.", href: "/referral" },
        { icon: "safety", tier: "free", title: "Safety Check-In", copy: "Teilen Sie Ihren Treffplan mit jemandem, dem Sie vertrauen, bevor Sie ein Match persönlich treffen.", href: "/safety-checkin" },
        { icon: "video", tier: "free", title: "Video-Verifizierungs-Abzeichen", copy: "Verleihen Sie Ihrem Profil mit einem videoverifizierten Abzeichen zusätzliche Vertrauenswürdigkeit.", href: "/video-verification" },
        { icon: "message", tier: "builder", title: "KI-generierte Gesprächseinstiege", copy: "Erhalten Sie 3 passende Eröffnungsnachrichten für jedes Match, erstellt von KI.", href: "/messages" },
        { icon: "insight", tier: "builder", title: "Wöchentlicher Tipp vom AI Advisor", copy: "Jede Woche ein frischer, persönlicher Tipp von Ihrem AI Family Advisor.", href: "/ai-advisor" },
        { icon: "agreement", tier: "pro", title: "Unterzeichnung der Co-Parenting Agreement", copy: "Verwandeln Sie Ihren gemeinsamen Family Plan in eine verbindliche Vereinbarung, die Sie beide unterschreiben.", href: "/pricing" },
        { icon: "community", tier: "pro", title: "Community-Gruppen & Diskussionen", copy: "Treten Sie Themengruppen und Diskussionen mit anderen auf demselben Weg bei.", href: "/community" },
      ],
    },
    ctaTitle: "Bereit, Ihre Familie zu gründen?", ctaCopy: "Schließen Sie sich Tausenden zukünftiger Eltern an. Erstellen Sie noch heute Ihr kostenloses Konto.",
    ctaButton: "Kostenloses Konto erstellen", appLabel: "Auch als kostenlose mobile App verfügbar",
  },
  it: {
    pill: "Piattaforma per la formazione della famiglia",
    title: "Il tuo percorso verso la genitorialità inizia qui",
    intro: "Trova un donatore, un co-genitore o un partner per formare una famiglia - poi compi i prossimi passi con cliniche di fiducia, esperti legali e indicazioni pratiche.",
    start: "Trova il tuo percorso", how: "COME FUNZIONA", stepsTitle: "Cinque passi verso la tua famiglia",
    trustLine: "Ogni profilo ha l'identità verificata - scopri cosa controlliamo.",
    steps: [
      ["01", "Crea il tuo profilo", "Raccontaci di te, delle tue preferenze e del tipo di famiglia che sogni di costruire.", "profile"],
      ["02", "Trova il tuo match", "Sfoglia i profili di donatori, co-genitori e partner per formare una famiglia. Filtra per valori e mettiti in contatto.", "match"],
      ["03", "Scopri la tua compatibilità", "Guarda il tuo punteggio di compatibilità e ciò di cui vale la pena parlare prima di decidere.", "compatibility"],
      ["04", "Pianifica la tua famiglia insieme", "Crea un Family Plan condiviso - crescita dei figli, finanze, passaggi legali - tutto in un unico posto.", "plan"],
      ["05", "Ricevi supporto da esperti", "Mettiti in contatto con cliniche della fertilità e specialisti di diritto riproduttivo verificati ogni volta che ne hai bisogno.", "support"],
    ],
    pathSelector: {
      label: "TROVA IL TUO PERCORSO", title: "Cosa ti porta qui?",
      intro: "Ogni famiglia nasce in modo diverso. Scegli il percorso più adatto a te - potrai sempre esplorare altre opzioni più avanti.",
      options: [
        ["coparent", "Sto cercando un co-genitore"],
        ["donor", "Sto cercando un donatore"],
        ["partner", "Sto cercando un partner per formare una famiglia"],
        ["couple-donor", "Siamo una coppia in cerca di un donatore"],
        ["exploring", "Sto esplorando le mie opzioni"],
      ],
    },
    features: [
      { label: "MATCHMAKING", title: "Trova il tuo donatore, co-genitore o partner", copy: "Il nostro attento sistema di abbinamento ti aiuta a entrare in contatto con la persona giusta. Filtra per posizione, valori e preferenze. Metti mi piace ai profili, ottieni match, poi chatta e fai videochiamate - tutto in uno spazio sicuro e privato.", points: ["Filtri avanzati per posizione, tipo e preferenze", "Messaggistica integrata e videochiamate HD", "Privacy al primo posto: controlla chi vede il tuo profilo"] },
      { label: "CLINICHE", title: "Cliniche della fertilità di livello mondiale, a un clic di distanza", copy: "Sfoglia cliniche verificate in oltre 20 paesi. Leggi profili dettagliati, confronta i servizi e avvia una videoconsulenza - tutto dal tuo salotto. Ogni clinica è verificata per qualità e inclusività.", points: ["Videoconsulenze con i migliori specialisti", "Cliniche verificate per l'inclusività verso persone LGBTQ+ e genitori single", "Prezzi trasparenti e recensioni reali dei pazienti"] },
      { label: "AVVOCATI", title: "Assistenza legale di cui puoi fidarti", copy: "Accordi con i donatori, diritti genitoriali - il diritto riproduttivo è complesso. Il nostro elenco di oltre 350 avvocati verificati in oltre 20 paesi ti garantisce un supporto legale esperto su misura per la tua struttura familiare.", points: ["Specialisti in diritto dei donatori e diritto di famiglia", "Filtra per paese, lingua e area di pratica", "Salva i preferiti e confronta i professionisti legali"] },
      { label: "PIANIFICAZIONE FAMILIARE", title: "Pianifica la tua famiglia, insieme", copy: "Una volta trovato il match, continuate a costruire insieme. Consulta il tuo Report di Compatibilità, parlate di ciò che conta davvero e create un Family Plan condiviso che copra crescita dei figli, finanze e passaggi legali - tutto in un unico posto.", points: ["Report di Compatibilità con veri spunti di conversazione, non un punteggio promosso/bocciato", "Family Plan condiviso per crescita dei figli, finanze e passaggi legali", "Un unico posto per continuare a pianificare dopo il match, non solo una chat"] },
      { label: "DIVENTA DONATORE", title: "Fai il dono della genitorialità", copy: "Hai il potere di cambiare per sempre la vita di qualcuno. Che tu stia considerando la donazione di ovociti o di seme - la nostra piattaforma ti mette in contatto con persone che sognano di formare una famiglia. Crea il tuo profilo, stabilisci le tue condizioni e aiuta a rendere possibile la genitorialità.", points: ["Abbinamento sicuro e verificato con genitori intenzionali", "Pieno controllo sul tuo profilo, sulle tue condizioni e sulla tua privacy", "Chat e videochiamate integrate per conoscervi"] },
      { label: "PER CLINICHE E AVVOCATI", title: "Fai crescere la tua attività, raggiungi più famiglie", copy: "Unisciti al nostro elenco professionale e mettiti in contatto con migliaia di potenziali clienti. Ottieni la tua dashboard partner personale per gestire gli appuntamenti, comunicare con i pazienti tramite chat sicura e videochiamate, lanciare campagne promozionali e costruire la tua reputazione nella comunità della salute riproduttiva.", points: ["Dashboard partner personale con analisi", "Chat sicura e videoconsulenze con i clienti", "Strumenti promozionali e campagne email mirate"] },
    ],
    stats: [["15.1K", "Membri nel mondo"], ["7.3K", "Donatori"], ["4.5K", "Cliniche partner"], ["369", "Avvocati"]],
    whatsNew: {
      label: "NOVITÀ SU LETSBEPARENTS", title: "Più modi per trovare match, connettersi e restare al sicuro",
      intro: "Continuiamo a migliorare la piattaforma - ecco le novità dall'ultima volta che sei stato/a qui.",
      tiers: { free: "Gratis", builder: "Family Builder+", pro: "Family Builder Pro" },
      items: [
        { icon: "boost", tier: "free", title: "Boost del profilo", copy: "Ottieni più visibilità nel catalogo per un periodo di tempo limitato.", href: "/boost" },
        { icon: "referral", tier: "free", title: "Invita e guadagna un Boost", copy: "Invita un amico - quando si iscrive e verifica il profilo, ricevete entrambi un Boost gratuito.", href: "/referral" },
        { icon: "safety", tier: "free", title: "Safety Check-In", copy: "Condividi il tuo piano d'incontro con qualcuno di fiducia prima di vedere un match di persona.", href: "/safety-checkin" },
        { icon: "video", tier: "free", title: "Badge di Verifica Video", copy: "Aggiungi un ulteriore livello di fiducia con un badge di verifica video sul tuo profilo.", href: "/video-verification" },
        { icon: "message", tier: "builder", title: "Messaggi d'apertura generati dall'IA", copy: "Ricevi 3 messaggi d'apertura su misura per ogni match, generati dall'IA.", href: "/messages" },
        { icon: "insight", tier: "builder", title: "Consiglio settimanale dell'AI Advisor", copy: "Un consiglio nuovo e personalizzato dal tuo AI Family Advisor ogni settimana.", href: "/ai-advisor" },
        { icon: "agreement", tier: "pro", title: "Firma del Co-Parenting Agreement", copy: "Trasforma il tuo Family Plan condiviso in un accordo reciproco che firmate entrambi.", href: "/pricing" },
        { icon: "community", tier: "pro", title: "Gruppi e discussioni della Community", copy: "Unisciti a gruppi tematici e discussioni con altre persone sul tuo stesso percorso.", href: "/community" },
      ],
    },
    ctaTitle: "Pronto/a a formare la tua famiglia?", ctaCopy: "Unisciti a migliaia di futuri genitori. Crea oggi il tuo account gratuito.",
    ctaButton: "Crea account gratuito", appLabel: "Disponibile anche come app mobile gratuita",
  },
  pl: {
    pill: "Platforma budowania rodziny",
    title: "Twoja droga do rodzicielstwa zaczyna się tutaj",
    intro: "Znajdź dawcę, współrodzica lub partnera do budowania rodziny - a potem zrób kolejne kroki z zaufanymi klinikami, ekspertami prawnymi i praktycznymi wskazówkami.",
    start: "Znajdź swoją drogę", how: "JAK TO DZIAŁA", stepsTitle: "Pięć kroków do twojej rodziny",
    trustLine: "Każdy profil ma zweryfikowaną tożsamość - sprawdź, co weryfikujemy.",
    steps: [
      ["01", "Stwórz swój profil", "Opowiedz nam o sobie, swoich preferencjach i o tym, o jakiej rodzinie marzysz.", "profile"],
      ["02", "Znajdź swoje dopasowanie", "Przeglądaj profile dawców, współrodziców i partnerów do budowania rodziny. Filtruj według wartości i nawiązuj kontakt.", "match"],
      ["03", "Poznaj swoją kompatybilność", "Zobacz swój wynik kompatybilności i to, o czym warto porozmawiać, zanim podejmiesz decyzję.", "compatibility"],
      ["04", "Zaplanujcie rodzinę razem", "Stwórzcie wspólny Family Plan - wychowanie, finanse, kroki prawne - wszystko w jednym miejscu.", "plan"],
      ["05", "Skorzystaj ze wsparcia ekspertów", "Skontaktuj się ze zweryfikowanymi klinikami leczenia niepłodności i specjalistami prawa reprodukcyjnego, kiedy tylko będziesz tego potrzebować.", "support"],
    ],
    pathSelector: {
      label: "ZNAJDŹ SWOJĄ DROGĘ", title: "Co cię tu sprowadza?",
      intro: "Każda rodzina zaczyna się inaczej. Wybierz drogę, która pasuje do ciebie najbardziej - później zawsze możesz poznać inne opcje.",
      options: [
        ["coparent", "Szukam współrodzica"],
        ["donor", "Szukam dawcy"],
        ["partner", "Szukam partnera do budowania rodziny"],
        ["couple-donor", "Jesteśmy parą szukającą dawcy"],
        ["exploring", "Poznaję swoje możliwości"],
      ],
    },
    features: [
      { label: "DOPASOWANIE", title: "Znajdź swojego dawcę, współrodzica lub partnera", copy: "Nasz przemyślany system dopasowywania pomaga ci połączyć się z odpowiednią osobą. Filtruj według lokalizacji, wartości i preferencji. Polub profile, uzyskaj dopasowanie, a potem rozmawiaj na czacie i przez wideorozmowę - wszystko w bezpiecznej, prywatnej przestrzeni.", points: ["Zaawansowane filtry według lokalizacji, typu i preferencji", "Wbudowane wiadomości i wideorozmowy HD", "Prywatność przede wszystkim: sam decydujesz, kto widzi twój profil"] },
      { label: "KLINIKI", title: "Światowej klasy kliniki leczenia niepłodności, o jedno kliknięcie", copy: "Przeglądaj zweryfikowane kliniki w ponad 20 krajach. Czytaj szczegółowe profile, porównuj usługi i rozpocznij konsultację wideo - wszystko z domu. Każda klinika jest weryfikowana pod kątem jakości i otwartości na różnorodność.", points: ["Konsultacje wideo z czołowymi specjalistami", "Kliniki zweryfikowane pod kątem otwartości na osoby LGBTQ+ i samotnych rodziców", "Przejrzyste ceny i prawdziwe opinie pacjentów"] },
      { label: "PRAWNICY", title: "Pomoc prawna, której możesz zaufać", copy: "Umowy z dawcami, prawa rodzicielskie - prawo reprodukcyjne jest złożone. Nasz katalog ponad 350 zweryfikowanych prawników w ponad 20 krajach zapewnia ci fachowe wsparcie prawne dopasowane do struktury twojej rodziny.", points: ["Specjaliści od prawa dawców i prawa rodzinnego", "Filtruj według kraju, języka i obszaru praktyki", "Zapisuj ulubionych i porównuj prawników"] },
      { label: "PLANOWANIE RODZINY", title: "Zaplanujcie rodzinę razem", copy: "Gdy już się dopasujecie, budujcie dalej razem. Zobacz swój Raport Kompatybilności, porozmawiajcie o tym, co ważne, i stwórzcie wspólny Family Plan obejmujący wychowanie, finanse i kroki prawne - wszystko w jednym miejscu.", points: ["Raport Kompatybilności z prawdziwymi tematami do rozmowy, a nie oceną zdał/nie zdał", "Wspólny Family Plan na wychowanie, finanse i kroki prawne", "Jedno miejsce do dalszego planowania po dopasowaniu, a nie tylko czat"] },
      { label: "ZOSTAŃ DAWCĄ", title: "Podaruj dar rodzicielstwa", copy: "Masz moc, by na zawsze zmienić czyjeś życie. Niezależnie od tego, czy rozważasz oddanie komórek jajowych czy nasienia - nasza platforma łączy cię z osobami, które marzą o założeniu rodziny. Stwórz profil, ustal swoje warunki i pomóż uczynić rodzicielstwo możliwym.", points: ["Bezpieczne, zweryfikowane dopasowanie z przyszłymi rodzicami", "Pełna kontrola nad profilem, warunkami i prywatnością", "Wbudowany czat i wideorozmowy, by się poznać"] },
      { label: "DLA KLINIK I PRAWNIKÓW", title: "Rozwijaj swoją praktykę, docieraj do większej liczby rodzin", copy: "Dołącz do naszego katalogu profesjonalistów i połącz się z tysiącami potencjalnych klientów. Otrzymaj własny panel partnera do zarządzania wizytami, komunikacji z pacjentami przez bezpieczny czat i wideorozmowy, prowadzenia kampanii promocyjnych i budowania reputacji w społeczności zdrowia reprodukcyjnego.", points: ["Osobisty panel partnera z analizami", "Bezpieczny czat i konsultacje wideo z klientami", "Narzędzia promocyjne i ukierunkowane kampanie e-mail"] },
    ],
    stats: [["15.1K", "Członków na całym świecie"], ["7.3K", "Dawców"], ["4.5K", "Klinik partnerskich"], ["369", "Prawników"]],
    whatsNew: {
      label: "NOWOŚCI NA LETSBEPARENTS", title: "Więcej sposobów na dopasowanie, kontakt i bezpieczeństwo",
      intro: "Wciąż rozwijamy platformę - oto co nowego od twojej ostatniej wizyty.",
      tiers: { free: "Za darmo", builder: "Family Builder+", pro: "Family Builder Pro" },
      items: [
        { icon: "boost", tier: "free", title: "Boost profilu", copy: "Zyskaj większą widoczność w katalogu przez ograniczony czas.", href: "/boost" },
        { icon: "referral", tier: "free", title: "Zaproś i zdobądź Boost", copy: "Zaproś znajomego - gdy dołączy i zweryfikuje konto, oboje otrzymacie darmowy Boost.", href: "/referral" },
        { icon: "safety", tier: "free", title: "Safety Check-In", copy: "Podziel się planem spotkania z kimś, komu ufasz, zanim spotkasz się z dopasowaną osobą osobiście.", href: "/safety-checkin" },
        { icon: "video", tier: "free", title: "Odznaka weryfikacji wideo", copy: "Dodaj dodatkową warstwę zaufania dzięki odznace weryfikacji wideo na swoim profilu.", href: "/video-verification" },
        { icon: "message", tier: "builder", title: "Wiadomości na początek rozmowy tworzone przez AI", copy: "Otrzymuj 3 dopasowane wiadomości powitalne dla każdego dopasowania, tworzone przez AI.", href: "/messages" },
        { icon: "insight", tier: "builder", title: "Cotygodniowa wskazówka od AI Advisor", copy: "Świeża, spersonalizowana wskazówka od twojego AI Family Advisor co tydzień.", href: "/ai-advisor" },
        { icon: "agreement", tier: "pro", title: "Podpisanie Co-Parenting Agreement", copy: "Zamień wspólny Family Plan we wzajemne porozumienie, które oboje podpisujecie.", href: "/pricing" },
        { icon: "community", tier: "pro", title: "Grupy i dyskusje Community", copy: "Dołącz do grup tematycznych i dyskusji z innymi osobami na podobnej drodze.", href: "/community" },
      ],
    },
    ctaTitle: "Gotowy, by założyć rodzinę?", ctaCopy: "Dołącz do tysięcy przyszłych rodziców. Załóż darmowe konto już dziś.",
    ctaButton: "Załóż darmowe konto", appLabel: "Dostępne również jako darmowa aplikacja mobilna",
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
    if (key === "donor") return "/web-static/images/landing/path-donor-0dd2f3af.jpg";
    if (key === "partner") return "/web-static/images/landing/path-partner-1df6d179.jpg";
    if (key === "couple-donor") return "/web-static/images/landing/path-couple-donor-bb85903a.jpg";
    if (key === "exploring") return "/web-static/images/landing/path-exploring-607ba1f7.jpg";
    return "/web-static/images/landing/path-coparent-b940550d.jpg";
  };
  const whatsNewIcon = (key: string) => {
    if (key === "boost") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>;
    if (key === "referral") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="4" x="3" y="8" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>;
    if (key === "safety") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>;
    if (key === "video") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>;
    if (key === "message") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    if (key === "insight") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.05V18h6v-1.25c0-.86.38-1.55 1-2.05A7 7 0 0 0 12 2Z"/></svg>;
    if (key === "agreement") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m3 15 2 2 4-4"/></svg>;
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
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

      <section className="landing-whatsnew">
        <div className="landing-section-intro">
          <span>{text.whatsNew.label}</span>
          <h2>{text.whatsNew.title}</h2>
          <p className="landing-whatsnew-intro">{text.whatsNew.intro}</p>
        </div>
        <div className="landing-whatsnew-grid">
          {text.whatsNew.items.map((item) => (
            <Link key={item.title} className="landing-whatsnew-card" to={`/${locale}${item.href}`}>
              <span className="landing-whatsnew-icon">{whatsNewIcon(item.icon)}</span>
              <span className={`landing-whatsnew-tier landing-whatsnew-tier-${item.tier}`}>{text.whatsNew.tiers[item.tier as keyof typeof text.whatsNew.tiers]}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </Link>
          ))}
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
  pt: {
    loginTitle: "Bem-vindo de volta", loginLead: "Sentimos sua falta! Faça login na sua conta.",
    email: "Email", password: "Senha", emailPlaceholder: "Digite seu email", passwordPlaceholder: "Digite sua senha",
    showPassword: "Mostrar senha", hidePassword: "Ocultar senha", forgot: "Esqueceu a senha?", signIn: "Entrar",
    signingIn: "Entrando…", signInError: "Falha ao entrar. Verifique seu email e senha.", loginDivider: "Ou continue com",
    noAccount: "Não tem uma conta?", createAccountLink: "Criar conta", registerTitle: "Criar conta",
    registerLead: "Junte-se à nossa comunidade e comece sua jornada", confirmPassword: "Confirmar senha",
    confirmPlaceholder: "Confirme sua senha", acceptPrefix: "Eu aceito os", terms: "Termos de Uso", and: "e a",
    privacy: "Política de Privacidade", createAccount: "Criar conta", creatingAccount: "Criando conta…",
    registerDivider: "Ou continue com", alreadyAccount: "Já tem uma conta?", signInLink: "Entrar",
    mismatch: "As senhas não coincidem.", createError: "Não foi possível criar a conta. Use um email exclusivo e uma senha com pelo menos 8 caracteres.",
    forgotTitle: "Esqueceu a senha", forgotLead: "Digite seu email e enviaremos um link para redefinir sua senha.",
    forgotPlaceholder: "Digite seu email", sendLink: "Enviar link", sending: "Enviando…", backToSignIn: "Voltar ao login",
    resetSent: "Se existir uma conta ativa para este email, enviamos um link de redefinição de senha.",
    resetError: "Não foi possível enviar a solicitação. Tente novamente.",
  },
  fr: {
    loginTitle: "Bon retour", loginLead: "Vous nous avez manqué ! Connectez-vous à votre compte.",
    email: "Email", password: "Mot de passe", emailPlaceholder: "Entrez votre email", passwordPlaceholder: "Entrez votre mot de passe",
    showPassword: "Afficher le mot de passe", hidePassword: "Masquer le mot de passe", forgot: "Mot de passe oublié ?", signIn: "Se connecter",
    signingIn: "Connexion…", signInError: "Échec de la connexion. Vérifiez votre email et votre mot de passe.", loginDivider: "Ou continuer avec",
    noAccount: "Vous n'avez pas de compte ?", createAccountLink: "Créer un compte", registerTitle: "Créer un compte",
    registerLead: "Rejoignez notre communauté et commencez votre parcours", confirmPassword: "Confirmer le mot de passe",
    confirmPlaceholder: "Confirmez votre mot de passe", acceptPrefix: "J'accepte les", terms: "Conditions d'utilisation", and: "et la",
    privacy: "Politique de confidentialité", createAccount: "Créer un compte", creatingAccount: "Création du compte…",
    registerDivider: "Ou continuer avec", alreadyAccount: "Vous avez déjà un compte ?", signInLink: "Se connecter",
    mismatch: "Les mots de passe ne correspondent pas.", createError: "Impossible de créer le compte. Utilisez un email unique et un mot de passe d'au moins 8 caractères.",
    forgotTitle: "Mot de passe oublié", forgotLead: "Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.",
    forgotPlaceholder: "Entrez votre email", sendLink: "Envoyer le lien", sending: "Envoi…", backToSignIn: "Retour à la connexion",
    resetSent: "Si un compte actif existe pour cet email, nous avons envoyé un lien de réinitialisation du mot de passe.",
    resetError: "Impossible d'envoyer la demande. Veuillez réessayer.",
  },
  de: {
    loginTitle: "Willkommen zurück", loginLead: "Wir haben Sie vermisst! Bitte melden Sie sich bei Ihrem Konto an.",
    email: "E-Mail", password: "Passwort", emailPlaceholder: "Geben Sie Ihre E-Mail ein", passwordPlaceholder: "Geben Sie Ihr Passwort ein",
    showPassword: "Passwort anzeigen", hidePassword: "Passwort verbergen", forgot: "Passwort vergessen?", signIn: "Anmelden",
    signingIn: "Anmeldung läuft…", signInError: "Anmeldung fehlgeschlagen. Überprüfen Sie Ihre E-Mail und Ihr Passwort.", loginDivider: "Oder fortfahren mit",
    noAccount: "Noch kein Konto?", createAccountLink: "Konto erstellen", registerTitle: "Konto erstellen",
    registerLead: "Treten Sie unserer Community bei und beginnen Sie Ihre Reise", confirmPassword: "Passwort bestätigen",
    confirmPlaceholder: "Bestätigen Sie Ihr Passwort", acceptPrefix: "Ich akzeptiere die", terms: "Nutzungsbedingungen", and: "und die",
    privacy: "Datenschutzrichtlinie", createAccount: "Konto erstellen", creatingAccount: "Konto wird erstellt…",
    registerDivider: "Oder fortfahren mit", alreadyAccount: "Sie haben bereits ein Konto?", signInLink: "Anmelden",
    mismatch: "Die Passwörter stimmen nicht überein.", createError: "Das Konto konnte nicht erstellt werden. Verwenden Sie eine eindeutige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen.",
    forgotTitle: "Passwort vergessen", forgotLead: "Geben Sie Ihre E-Mail ein und wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.",
    forgotPlaceholder: "Geben Sie Ihre E-Mail ein", sendLink: "Link senden", sending: "Senden…", backToSignIn: "Zurück zur Anmeldung",
    resetSent: "Falls ein aktives Konto für diese E-Mail existiert, haben wir einen Link zum Zurücksetzen des Passworts gesendet.",
    resetError: "Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
  },
  it: {
    loginTitle: "Bentornato", loginLead: "Ci sei mancato! Accedi al tuo account.",
    email: "Email", password: "Password", emailPlaceholder: "Inserisci la tua email", passwordPlaceholder: "Inserisci la tua password",
    showPassword: "Mostra password", hidePassword: "Nascondi password", forgot: "Password dimenticata?", signIn: "Accedi",
    signingIn: "Accesso in corso…", signInError: "Accesso non riuscito. Controlla email e password.", loginDivider: "Oppure continua con",
    noAccount: "Non hai un account?", createAccountLink: "Crea account", registerTitle: "Crea account",
    registerLead: "Unisciti alla nostra community e inizia il tuo percorso", confirmPassword: "Conferma password",
    confirmPlaceholder: "Conferma la tua password", acceptPrefix: "Accetto i", terms: "Termini di utilizzo", and: "e la",
    privacy: "Informativa sulla privacy", createAccount: "Crea account", creatingAccount: "Creazione account…",
    registerDivider: "Oppure continua con", alreadyAccount: "Hai già un account?", signInLink: "Accedi",
    mismatch: "Le password non coincidono.", createError: "Impossibile creare l'account. Usa un'email univoca e una password di almeno 8 caratteri.",
    forgotTitle: "Password dimenticata", forgotLead: "Inserisci la tua email e ti invieremo un link per reimpostare la password.",
    forgotPlaceholder: "Inserisci la tua email", sendLink: "Invia link", sending: "Invio…", backToSignIn: "Torna all'accesso",
    resetSent: "Se esiste un account attivo per questa email, abbiamo inviato un link per reimpostare la password.",
    resetError: "Non è stato possibile inviare la richiesta. Riprova.",
  },
  pl: {
    loginTitle: "Witaj ponownie", loginLead: "Tęskniliśmy za Tobą! Zaloguj się do swojego konta.",
    email: "Email", password: "Hasło", emailPlaceholder: "Wpisz swój email", passwordPlaceholder: "Wpisz swoje hasło",
    showPassword: "Pokaż hasło", hidePassword: "Ukryj hasło", forgot: "Nie pamiętasz hasła?", signIn: "Zaloguj się",
    signingIn: "Logowanie…", signInError: "Logowanie nie powiodło się. Sprawdź email i hasło.", loginDivider: "Lub kontynuuj z",
    noAccount: "Nie masz konta?", createAccountLink: "Utwórz konto", registerTitle: "Utwórz konto",
    registerLead: "Dołącz do naszej społeczności i rozpocznij swoją podróż", confirmPassword: "Potwierdź hasło",
    confirmPlaceholder: "Potwierdź swoje hasło", acceptPrefix: "Akceptuję", terms: "Warunki korzystania", and: "oraz",
    privacy: "Politykę prywatności", createAccount: "Utwórz konto", creatingAccount: "Tworzenie konta…",
    registerDivider: "Lub kontynuuj z", alreadyAccount: "Masz już konto?", signInLink: "Zaloguj się",
    mismatch: "Hasła nie są zgodne.", createError: "Nie udało się utworzyć konta. Użyj unikalnego adresu email i hasła zawierającego co najmniej 8 znaków.",
    forgotTitle: "Nie pamiętasz hasła", forgotLead: "Wpisz swój email, a wyślemy Ci link do zresetowania hasła.",
    forgotPlaceholder: "Wpisz swój email", sendLink: "Wyślij link", sending: "Wysyłanie…", backToSignIn: "Powrót do logowania",
    resetSent: "Jeśli dla tego adresu email istnieje aktywne konto, wysłaliśmy link do zresetowania hasła.",
    resetError: "Nie udało się wysłać żądania. Spróbuj ponownie.",
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
      const nextSession = await refreshSession({ user: response.user });
      onLogin(nextSession);
      navigate(`/${locale}/${nextSession?.user.emailVerified === false ? "auth/verify-email" : "catalog"}`);
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
  const [searchParams] = useSearchParams();
  // Referral link support (Alena: "а почему нельзя прислать ссылку просто
  // для регистрации") - Referral's "Copy link" button builds a
  // /auth/register?invite=CODE link. Redeeming still requires an
  // authenticated member (see /member/referral/redeem in main.py), so this
  // can only happen right after signup, not at signup time itself - kept
  // best-effort/silent (same pattern as AiAdvisor's clear()) so a redeem
  // hiccup never blocks the new member from reaching their account; worst
  // case they paste the code by hand on the Referral page afterwards.
  const inviteCode = (searchParams.get("invite") || "").trim();
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
      if (inviteCode) {
        try {
          await api.post("/member/referral/redeem", { code: inviteCode });
        } catch {
          // Silent - worst case they enter the code by hand later.
        }
      }
      navigate(`/${locale}/auth/verify-email`);
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
    verifyLead: "Enter the 6-digit code from your email. The confirmation link in the same message also works.",
    resend: "Resend email",
    verifySent: "We sent a confirmation link to your email.",
    verifyDone: "Email confirmed. You can continue to LetsBeParents.",
    verifyCode: "6-digit code",
    verifyCodePlaceholder: "000000",
    verifyCodeButton: "Verify email",
    invalidCode: "The code is invalid or has expired.",
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
    verifyLead: "Введите 6-значный код из письма. Ссылка для подтверждения в том же письме тоже работает.",
    resend: "Отправить повторно",
    verifySent: "Мы отправили ссылку для подтверждения на вашу почту.",
    verifyDone: "Email подтверждён. Можно продолжить работу с LetsBeParents.",
    verifyCode: "6-значный код",
    verifyCodePlaceholder: "000000",
    verifyCodeButton: "Подтвердить email",
    invalidCode: "Код неверен или срок его действия истёк.",
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
    verifyLead: "Introduce el código de 6 dígitos del correo. El enlace del mismo mensaje también funciona.",
    resend: "Reenviar correo",
    verifySent: "Hemos enviado un enlace de confirmación a tu correo.",
    verifyDone: "Correo confirmado. Ya puedes continuar en LetsBeParents.",
    verifyCode: "Código de 6 dígitos",
    verifyCodePlaceholder: "000000",
    verifyCodeButton: "Verificar correo",
    invalidCode: "El código no es válido o ha caducado.",
    alreadyVerified: "Tu correo ya está confirmado.",
    recentlySent: "El correo de confirmación se envió hace poco. Revisa tu bandeja de entrada.",
    deliveryFailed: "No se pudo enviar el correo. Inténtalo de nuevo más tarde.",
    generic: "No se pudo completar la solicitud. Inténtalo de nuevo.",
    continue: "Continuar",
  },
  pt: {
    resetTitle: "Escolha uma nova senha",
    resetLead: "O link de uso único só pode ser usado uma vez.",
    password: "Nova senha",
    confirmPassword: "Confirmar senha",
    savePassword: "Salvar nova senha",
    back: "Voltar ao login",
    mismatch: "As senhas não coincidem.",
    invalid: "Este link é inválido, expirou ou já foi usado.",
    resetDone: "Senha atualizada. Agora você pode entrar.",
    wait: "Aguarde...",
    verifyTitle: "Confirme seu email",
    verifyLead: "Digite o código de 6 dígitos do seu email. O link de confirmação na mesma mensagem também funciona.",
    resend: "Reenviar email",
    verifySent: "Enviamos um link de confirmação para o seu email.",
    verifyDone: "Email confirmado. Você já pode continuar no LetsBeParents.",
    verifyCode: "Código de 6 dígitos",
    verifyCodePlaceholder: "000000",
    verifyCodeButton: "Verificar email",
    invalidCode: "O código é inválido ou expirou.",
    alreadyVerified: "Seu email já está confirmado.",
    recentlySent: "Um email de confirmação foi enviado recentemente. Verifique sua caixa de entrada.",
    deliveryFailed: "Não foi possível entregar o email. Tente novamente mais tarde.",
    generic: "Algo deu errado. Tente novamente.",
    continue: "Continuar",
  },
  fr: {
    resetTitle: "Choisissez un nouveau mot de passe",
    resetLead: "Le lien à usage unique ne peut être utilisé qu'une seule fois.",
    password: "Nouveau mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    savePassword: "Enregistrer le nouveau mot de passe",
    back: "Retour à la connexion",
    mismatch: "Les mots de passe ne correspondent pas.",
    invalid: "Ce lien est invalide, expiré ou a déjà été utilisé.",
    resetDone: "Mot de passe mis à jour. Vous pouvez maintenant vous connecter.",
    wait: "Veuillez patienter...",
    verifyTitle: "Confirmez votre email",
    verifyLead: "Entrez le code à 6 chiffres reçu par email. Le lien de confirmation dans le même message fonctionne aussi.",
    resend: "Renvoyer l'email",
    verifySent: "Nous avons envoyé un lien de confirmation à votre email.",
    verifyDone: "Email confirmé. Vous pouvez maintenant continuer sur LetsBeParents.",
    verifyCode: "Code à 6 chiffres",
    verifyCodePlaceholder: "000000",
    verifyCodeButton: "Vérifier l'email",
    invalidCode: "Le code est invalide ou a expiré.",
    alreadyVerified: "Votre email est déjà confirmé.",
    recentlySent: "Un email de confirmation a été envoyé récemment. Vérifiez votre boîte de réception.",
    deliveryFailed: "L'email n'a pas pu être livré. Veuillez réessayer plus tard.",
    generic: "Une erreur s'est produite. Veuillez réessayer.",
    continue: "Continuer",
  },
  de: {
    resetTitle: "Wählen Sie ein neues Passwort",
    resetLead: "Der einmalige Link kann nur einmal verwendet werden.",
    password: "Neues Passwort",
    confirmPassword: "Passwort bestätigen",
    savePassword: "Neues Passwort speichern",
    back: "Zurück zur Anmeldung",
    mismatch: "Die Passwörter stimmen nicht überein.",
    invalid: "Dieser Link ist ungültig, abgelaufen oder wurde bereits verwendet.",
    resetDone: "Passwort aktualisiert. Sie können sich jetzt anmelden.",
    wait: "Bitte warten...",
    verifyTitle: "Bestätigen Sie Ihre E-Mail",
    verifyLead: "Geben Sie den 6-stelligen Code aus Ihrer E-Mail ein. Der Bestätigungslink in derselben Nachricht funktioniert ebenfalls.",
    resend: "E-Mail erneut senden",
    verifySent: "Wir haben einen Bestätigungslink an Ihre E-Mail gesendet.",
    verifyDone: "E-Mail bestätigt. Sie können nun mit LetsBeParents fortfahren.",
    verifyCode: "6-stelliger Code",
    verifyCodePlaceholder: "000000",
    verifyCodeButton: "E-Mail verifizieren",
    invalidCode: "Der Code ist ungültig oder abgelaufen.",
    alreadyVerified: "Ihre E-Mail ist bereits bestätigt.",
    recentlySent: "Kürzlich wurde bereits eine Bestätigungs-E-Mail gesendet. Überprüfen Sie Ihren Posteingang.",
    deliveryFailed: "Die E-Mail konnte nicht zugestellt werden. Bitte versuchen Sie es später erneut.",
    generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    continue: "Weiter",
  },
  it: {
    resetTitle: "Scegli una nuova password",
    resetLead: "Il link monouso può essere utilizzato una sola volta.",
    password: "Nuova password",
    confirmPassword: "Conferma password",
    savePassword: "Salva nuova password",
    back: "Torna all'accesso",
    mismatch: "Le password non coincidono.",
    invalid: "Questo link non è valido, è scaduto o è già stato utilizzato.",
    resetDone: "Password aggiornata. Ora puoi accedere.",
    wait: "Attendere prego...",
    verifyTitle: "Conferma la tua email",
    verifyLead: "Inserisci il codice a 6 cifre ricevuto via email. Funziona anche il link di conferma nello stesso messaggio.",
    resend: "Invia di nuovo l'email",
    verifySent: "Abbiamo inviato un link di conferma alla tua email.",
    verifyDone: "Email confermata. Ora puoi continuare su LetsBeParents.",
    verifyCode: "Codice a 6 cifre",
    verifyCodePlaceholder: "000000",
    verifyCodeButton: "Verifica email",
    invalidCode: "Il codice non è valido o è scaduto.",
    alreadyVerified: "La tua email è già confermata.",
    recentlySent: "Un'email di conferma è stata inviata di recente. Controlla la tua casella di posta.",
    deliveryFailed: "Non è stato possibile consegnare l'email. Riprova più tardi.",
    generic: "Qualcosa è andato storto. Riprova.",
    continue: "Continua",
  },
  pl: {
    resetTitle: "Wybierz nowe hasło",
    resetLead: "Jednorazowy link można wykorzystać tylko raz.",
    password: "Nowe hasło",
    confirmPassword: "Potwierdź hasło",
    savePassword: "Zapisz nowe hasło",
    back: "Powrót do logowania",
    mismatch: "Hasła nie są zgodne.",
    invalid: "Ten link jest nieprawidłowy, wygasł lub został już użyty.",
    resetDone: "Hasło zaktualizowane. Możesz teraz się zalogować.",
    wait: "Proszę czekać...",
    verifyTitle: "Potwierdź swój email",
    verifyLead: "Wpisz 6-cyfrowy kod z wiadomości email. Link potwierdzający w tej samej wiadomości również działa.",
    resend: "Wyślij ponownie email",
    verifySent: "Wysłaliśmy link potwierdzający na Twój email.",
    verifyDone: "Email potwierdzony. Możesz teraz kontynuować w LetsBeParents.",
    verifyCode: "6-cyfrowy kod",
    verifyCodePlaceholder: "000000",
    verifyCodeButton: "Zweryfikuj email",
    invalidCode: "Kod jest nieprawidłowy lub wygasł.",
    alreadyVerified: "Twój email jest już potwierdzony.",
    recentlySent: "Wiadomość potwierdzająca została niedawno wysłana. Sprawdź swoją skrzynkę odbiorczą.",
    deliveryFailed: "Nie udało się dostarczyć wiadomości email. Spróbuj ponownie później.",
    generic: "Coś poszło nie tak. Spróbuj ponownie.",
    continue: "Kontynuuj",
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
  const [code, setCode] = useState("");
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
  const confirmCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setStatus(copy.invalidCode);
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/email-verification/code/confirm", { code });
      setConfirmed(true);
      setStatus(copy.verifyDone);
    } catch {
      setStatus(copy.invalidCode);
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
          {confirmed ? (
            <form onSubmit={(event) => { event.preventDefault(); navigate(`/${locale}/catalog`); }}>
              <button className="standalone-auth-primary">{copy.continue}</button>
            </form>
          ) : (
            <form onSubmit={confirmCode}>
              <label htmlFor="verify-email-code">{copy.verifyCode}</label>
              <input
                id="verify-email-code"
                className="standalone-auth-code"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={copy.verifyCodePlaceholder}
                maxLength={6}
                autoFocus={!token}
              />
              <button className="standalone-auth-primary" disabled={busy || code.length !== 6}>{busy ? copy.wait : copy.verifyCodeButton}</button>
            </form>
          )}
          {!confirmed && <button className="standalone-auth-resend" type="button" disabled={busy} onClick={() => void resend()}>{copy.resend}</button>}
          <p className="standalone-auth-message" data-kind={status === copy.invalid || status === copy.invalidCode || status === copy.deliveryFailed || status === copy.generic ? "error" : "info"}>{status}</p>
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
 const directoryCopyLocale = legacyLocaleOf(locale);
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
 }[directoryCopyLocale];

  const referenceLanguageCodes = ["en", "ar", "af", "be", "bn", "bg", "hu", "vi", "el", "ka", "da", "he", "id", "es", "it", "ca", "zh", "ko", "lv", "lt", "ms", "de", "nl", "no", "fa", "pl", "pt", "ro", "ru", "sr", "sk", "sl", "th", "tr", "uk", "fi", "fr", "hi", "hr", "cs", "sv", "et", "ja"];
  const clinicCardServicePriority = new Map(["hiv_positive_male", "hiv_positive_female", "icsi_ivf", "hepatitis_bc_male", "hepatitis_bc_female"].map((value, index) => [value, index]));

  const tagTranslations: Record<string, Record<CookieLocale, string>> = {
    assisted_reproduction: { en: "Assisted Reproduction", ru: "Вспомогательная репродукция", es: "Reproducción asistida", pt: "Reprodução Assistida", fr: "Procréation médicalement assistée", de: "Assistierte Reproduktion", it: "Riproduzione assistita", pl: "Wspomagana prokreacja" },
    contested_adoption: { en: "Contested Adoption", ru: "Оспариваемое усыновление", es: "Adopción impugnada", pt: "Adoção contestada", fr: "Adoption contestée", de: "Angefochtene Adoption", it: "Adozione contestata", pl: "Sporna adopcja" },
    domestic_adoption: { en: "Domestic Adoption", ru: "Внутреннее усыновление", es: "Adopción nacional", pt: "Adoção nacional", fr: "Adoption nationale", de: "Inländische Adoption", it: "Adozione nazionale", pl: "Adopcja krajowa" },
    icpc_adoption: { en: "Interstate (ICPC) Adoption", ru: "Межштатное (ICPC) усыновление", es: "Adopción interestatal (ICPC)", pt: "Adoção interestadual (ICPC)", fr: "Adoption interétatique (ICPC)", de: "Zwischenstaatliche Adoption (ICPC)", it: "Adozione interstatale (ICPC)", pl: "Adopcja międzystanowa (ICPC)" },
    intercountry_adoption: { en: "Intercountry Adoption", ru: "Международное усыновление", es: "Adopción internacional", pt: "Adoção internacional", fr: "Adoption internationale", de: "Internationale Adoption", it: "Adozione internazionale", pl: "Adopcja międzynarodowa" },
    lgbtq_family_formation: { en: "LGBTQ Family Formation", ru: "Создание ЛГБТК+ семей", es: "Formación de familias LGBTQ", pt: "Formação de família LGBTQ", fr: "Formation de famille LGBTQ", de: "LGBTQ-Familiengründung", it: "Formazione familiare LGBTQ", pl: "Zakładanie rodziny LGBTQ" },
    private_networking: { en: "Private Networking", ru: "Частный нетворкинг", es: "Red privada", pt: "Networking privado", fr: "Réseau privé", de: "Privates Netzwerken", it: "Rete privata", pl: "Prywatny networking" },
    egg_donation: { en: "Egg Donation", ru: "Донорство яйцеклеток", es: "Donación de óvulos", pt: "Doação de óvulos", fr: "Don d'ovocytes", de: "Eizellspende", it: "Donazione di ovociti", pl: "Dawstwo komórek jajowych" },
    embryo_donation: { en: "Embryo Donation", ru: "Донорство эмбрионов", es: "Donación de embriones", pt: "Doação de embriões", fr: "Don d'embryons", de: "Embryonenspende", it: "Donazione di embrioni", pl: "Dawstwo zarodków" },
    sperm_donation: { en: "Sperm Donation", ru: "Донорство спермы", es: "Donación de esperma", pt: "Doação de esperma", fr: "Don de sperme", de: "Samenspende", it: "Donazione di sperma", pl: "Dawstwo nasienia" },
    surrogacy: { en: "Surrogacy", ru: "Суррогатное материнство", es: "Gestación subrogada", pt: "Gestação de substituição", fr: "Gestation pour autrui (GPA)", de: "Leihmutterschaft", it: "Maternità surrogata", pl: "Surogacja" },
    grandparent_representation: { en: "Grandparent Representation", ru: "Представительство бабушек и дедушек", es: "Representación de abuelos", pt: "Representação de avós", fr: "Représentation des grands-parents", de: "Vertretung von Großeltern", it: "Rappresentanza dei nonni", pl: "Reprezentacja dziadków" },
    special_needs_children: { en: "Special Needs Children", ru: "Дети с особыми потребностями", es: "Niños con necesidades especiales", pt: "Crianças com necessidades especiais", fr: "Enfants à besoins particuliers", de: "Kinder mit besonderen Bedürfnissen", it: "Bambini con bisogni speciali", pl: "Dzieci ze specjalnymi potrzebami" },
    mediation: { en: "Mediation", ru: "Медиация", es: "Mediación", pt: "Mediação", fr: "Médiation", de: "Mediation", it: "Mediazione", pl: "Mediacja" },
    ivf: { en: "IVF", ru: "ЭКО", es: "FIV", pt: "FIV", fr: "FIV", de: "IVF", it: "FIVET", pl: "In vitro" },
    icsi_ivf: { en: "ICSI IVF", ru: "ИКСИ ЭКО", es: "FIV ICSI", pt: "FIV com ICSI", fr: "FIV avec ICSI", de: "IVF mit ICSI", it: "FIVET con ICSI", pl: "In vitro z ICSI" },
    own_egg_sperm_ivf: { en: "Own Egg & Sperm IVF", ru: "ЭКО с собственными клетками", es: "FIV con óvulos y esperma propios", pt: "FIV com óvulos e esperma próprios", fr: "FIV avec ovocytes et sperme propres", de: "IVF mit eigenen Eizellen und eigenem Sperma", it: "FIVET con ovociti e sperma propri", pl: "In vitro z własnymi komórkami jajowymi i nasieniem" },
    egg_donation_ivf: { en: "Egg Donation IVF", ru: "ЭКО с донорской яйцеклеткой", es: "FIV con óvulos donados", pt: "FIV com doação de óvulos", fr: "FIV avec don d'ovocytes", de: "IVF mit Eizellspende", it: "FIVET con donazione di ovociti", pl: "In vitro z dawstwem komórek jajowych" },
    sperm_donations_ivf: { en: "Sperm Donation IVF", ru: "ЭКО с донорской спермой", es: "FIV con esperma donado", pt: "FIV com doação de esperma", fr: "FIV avec don de sperme", de: "IVF mit Samenspende", it: "FIVET con donazione di sperma", pl: "In vitro z dawstwem nasienia" },
    embryo_donations_ivf: { en: "Embryo Donation IVF", ru: "ЭКО с донорским эмбрионом", es: "FIV con embriones donados", pt: "FIV com doação de embriões", fr: "FIV avec don d'embryons", de: "IVF mit Embryonenspende", it: "FIVET con donazione di embrioni", pl: "In vitro z dawstwem zarodków" },
    genetic_testing_ivf: { en: "Genetic Testing IVF", ru: "Генетическое тестирование ЭКО", es: "Pruebas genéticas FIV", pt: "FIV com teste genético", fr: "FIV avec test génétique", de: "IVF mit Gentest", it: "FIVET con test genetico", pl: "In vitro z badaniem genetycznym" },
    freezing: { en: "Freezing", ru: "Криоконсервация", es: "Criopreservación", pt: "Congelamento", fr: "Congélation", de: "Einfrieren", it: "Congelamento", pl: "Mrożenie" },
    egg_freezing: { en: "Egg Freezing", ru: "Заморозка яйцеклеток", es: "Congelación de óvulos", pt: "Congelamento de óvulos", fr: "Congélation d'ovocytes", de: "Einfrieren von Eizellen", it: "Congelamento degli ovociti", pl: "Mrożenie komórek jajowych" },
    sperm_freezing: { en: "Sperm Freezing", ru: "Заморозка спермы", es: "Congelación de esperma", pt: "Congelamento de esperma", fr: "Congélation de sperme", de: "Einfrieren von Spermien", it: "Congelamento dello sperma", pl: "Mrożenie nasienia" },
    embryo_freezing: { en: "Embryo Freezing", ru: "Заморозка эмбрионов", es: "Congelación de embriones", pt: "Congelamento de embriões", fr: "Congélation d'embryons", de: "Einfrieren von Embryonen", it: "Congelamento degli embrioni", pl: "Mrożenie zarodków" },
    iui_intrauterine: { en: "IUI - Intrauterine", ru: "ВМИ — внутриматочная", es: "Inseminación intrauterina", pt: "IIU - Intrauterina", fr: "IIU - Intra-utérine", de: "IUI - Intrauterin", it: "IUI - Intrauterina", pl: "IUI - Domaciczna" },
    ici_intracervical: { en: "ICI - Intracervical", ru: "ИЦИ — интрацервикальная", es: "Inseminación intracervical", pt: "ICI - Intracervical", fr: "ICI - Intracervicale", de: "ICI - Intrazervikal", it: "ICI - Intracervicale", pl: "ICI - Doszyjkowa" },
    iutpi_tuboperitoneal: { en: "IUTPI - Tuboperitoneal", ru: "ИУТПИ — тубоперитонеальная", es: "Inseminación tuboperitoneal", pt: "IUTPI - Tuboperitoneal", fr: "IUTPI - Tubopéritonéale", de: "IUTPI - Tuboperitoneal", it: "IUTPI - Tuboperitoneale", pl: "IUTPI - Jajowodowo-otrzewnowa" },
    iti_intratubal: { en: "ITI - Intratubal", ru: "ИТИ — интратубарная", es: "Inseminación intratubárica", pt: "ITI - Intratubária", fr: "ITI - Intratubaire", de: "ITI - Intratubar", it: "ITI - Intratubarica", pl: "ITI - Dojajowodowa" },
    women_over_46: { en: "Women over 46", ru: "Женщины старше 46 лет", es: "Mujeres mayores de 46 años", pt: "Mulheres acima de 46 anos", fr: "Femmes de plus de 46 ans", de: "Frauen über 46", it: "Donne oltre i 46 anni", pl: "Kobiety powyżej 46 roku życia" },
    hiv_positive_female: { en: "HIV+ Female", ru: "ВИЧ+ женщина", es: "Mujer VIH+", pt: "Mulher HIV+", fr: "Femme VIH+", de: "HIV-positive Frau", it: "Donna HIV+", pl: "Kobieta HIV+" },
    hiv_positive_male: { en: "HIV+ Male", ru: "ВИЧ+ мужчина", es: "Hombre VIH+", pt: "Homem HIV+", fr: "Homme VIH+", de: "HIV-positiver Mann", it: "Uomo HIV+", pl: "Mężczyzna HIV+" },
    hepatitis_bc_female: { en: "Hepatitis B/C Female", ru: "Гепатит B/C женщина", es: "Mujer con hepatitis B/C", pt: "Mulher com hepatite B/C", fr: "Femme avec hépatite B/C", de: "Frau mit Hepatitis B/C", it: "Donna con epatite B/C", pl: "Kobieta z WZW B/C" },
    hepatitis_bc_male: { en: "Hepatitis B/C Male", ru: "Гепатит B/C мужчина", es: "Hombre con hepatitis B/C", pt: "Homem com hepatite B/C", fr: "Homme avec hépatite B/C", de: "Mann mit Hepatitis B/C", it: "Uomo con epatite B/C", pl: "Mężczyzna z WZW B/C" },
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
 const directoryCopyLocale = legacyLocaleOf(locale);
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
 }[directoryCopyLocale];
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
 }[directoryCopyLocale];
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
    country: "Country", city: "City", anyCountry: "Any country", cityFirst: "Select a single country to filter by city", cityPlaceholder: "Start typing a city name...",
    profileType: "Profile type", donor: "Donor", lookingFor: "Looking for", allTypes: "All types",
    matches: "Matches profiles that fit any of these options", verified: "Verified only", age: "Age", from: "From", to: "To",
    ethnicity: "Ethnicity", hair: "Hair color", eye: "Eye color", education: "Education", religion: "Religion",
    premium: "Premium only", premiumTitle: "Premium filters", premiumText: "Choose Premium to unlock advanced filters and find more compatible profiles.", premiumMonthly: "Premium Monthly", premiumQuarterly: "Premium Quarterly", premiumClose: "Close Premium offer", search: "Search...", none: "No options found", noProfiles: "No profiles found", noProfilesHelp: "Try changing or clearing the filters.",
    loadMore: "Load more", loading: "Loading ...", locationHidden: "Location hidden", message: "Message", like: "Like", liked: "Liked",
    ageError: "Minimum age cannot be greater than maximum age.", failed: "Could not load the catalog.", actionFailed: "This action could not be completed.",
    dailyLikeLimit: "You have reached today's like limit. You can like more profiles tomorrow.", dailyChatLimit: "You have reached today's new chat limit. You can start more chats tomorrow.",
    profileUnavailable: "This profile is no longer available.", chatUnavailable: "This conversation cannot be opened right now.",
  },
  ru: {
    browse: "Каталог профилей", collections: "Коллекции", all: "Все", day: "день", days: "дней", month: "месяц",
    filters: "Фильтры", allFilters: "Все фильтры", closeFilters: "Закрыть фильтры", clear: "Очистить всё", apply: "Применить фильтры",
    country: "Страна", city: "Город", anyCountry: "Любая страна", cityFirst: "Сначала выберите одну страну", cityPlaceholder: "Начните вводить город...",
    profileType: "Тип профиля", donor: "Донор", lookingFor: "Ищет", allTypes: "Все типы",
    matches: "Показываем анкеты, соответствующие любому из выбранных вариантов", verified: "Только подтверждённые", age: "Возраст", from: "От", to: "До",
    ethnicity: "Этническая принадлежность", hair: "Цвет волос", eye: "Цвет глаз", education: "Образование", religion: "Религия",
    premium: "Только Premium", premiumTitle: "Premium-фильтры", premiumText: "Оформите Premium, чтобы открыть расширенные фильтры и точнее искать подходящие анкеты.", premiumMonthly: "Premium Monthly", premiumQuarterly: "Premium Quarterly", premiumClose: "Закрыть предложение Premium", search: "Поиск...", none: "Варианты не найдены", noProfiles: "Анкеты не найдены", noProfilesHelp: "Измените или очистите фильтры.",
    loadMore: "Показать ещё", loading: "Загрузка ...", locationHidden: "Местоположение скрыто", message: "Написать", like: "Нравится", liked: "Liked",
    ageError: "Минимальный возраст не может быть больше максимального.", failed: "Не удалось загрузить каталог.", actionFailed: "Не удалось выполнить действие.",
    dailyLikeLimit: "Дневной лимит лайков исчерпан. Новые лайки будут доступны завтра.", dailyChatLimit: "Дневной лимит новых чатов исчерпан. Новые диалоги будут доступны завтра.",
    profileUnavailable: "Этот профиль больше недоступен.", chatUnavailable: "Сейчас не удалось открыть этот диалог.",
  },
  es: {
    browse: "Explorar perfiles", collections: "Colecciones", all: "Todos", day: "día", days: "días", month: "mes",
    filters: "Filtros", allFilters: "Todos los filtros", closeFilters: "Cerrar filtros", clear: "Borrar todo", apply: "Aplicar filtros",
    country: "País", city: "Ciudad", anyCountry: "Cualquier país", cityFirst: "Selecciona primero un país", cityPlaceholder: "Empieza a escribir una ciudad...",
    profileType: "Tipo de perfil", donor: "Donante", lookingFor: "Busca", allTypes: "Todos los tipos",
    matches: "Muestra perfiles que coincidan con cualquiera de estas opciones", verified: "Solo verificados", age: "Edad", from: "Desde", to: "Hasta",
    ethnicity: "Origen étnico", hair: "Color de pelo", eye: "Color de ojos", education: "Educación", religion: "Religión",
    premium: "Solo Premium", premiumTitle: "Filtros Premium", premiumText: "Elige Premium para desbloquear filtros avanzados y encontrar perfiles más compatibles.", premiumMonthly: "Premium Monthly", premiumQuarterly: "Premium Quarterly", premiumClose: "Cerrar oferta Premium", search: "Buscar...", none: "No se encontraron opciones", noProfiles: "No se encontraron perfiles", noProfilesHelp: "Cambia o borra los filtros.",
    loadMore: "Mostrar más", loading: "Cargando ...", locationHidden: "Ubicación oculta", message: "Escribir", like: "Me gusta", liked: "Liked",
    ageError: "La edad mínima no puede superar la máxima.", failed: "No se pudo cargar el catálogo.", actionFailed: "No se pudo completar la acción.",
    dailyLikeLimit: "Has alcanzado el límite diario de Me gusta. Podrás indicar más perfiles mañana.", dailyChatLimit: "Has alcanzado el límite diario de chats nuevos. Podrás iniciar más chats mañana.",
    profileUnavailable: "Este perfil ya no está disponible.", chatUnavailable: "No se puede abrir esta conversación ahora mismo.",
  },
  pt: {
    browse: "Explorar perfis", collections: "Coleções", all: "Todos", day: "dia", days: "dias", month: "mês",
    filters: "Filtros", allFilters: "Todos os filtros", closeFilters: "Fechar filtros", clear: "Limpar tudo", apply: "Aplicar filtros",
    country: "País", city: "Cidade", anyCountry: "Qualquer país", cityFirst: "Selecione um único país para filtrar por cidade", cityPlaceholder: "Comece a digitar o nome de uma cidade...",
    profileType: "Tipo de perfil", donor: "Doador", lookingFor: "Procurando", allTypes: "Todos os tipos",
    matches: "Mostra perfis que correspondem a qualquer uma dessas opções", verified: "Somente verificados", age: "Idade", from: "De", to: "Até",
    ethnicity: "Etnia", hair: "Cor do cabelo", eye: "Cor dos olhos", education: "Educação", religion: "Religião",
    premium: "Somente Premium", premiumTitle: "Filtros Premium", premiumText: "Escolha o Premium para desbloquear filtros avançados e encontrar perfis mais compatíveis.", premiumMonthly: "Premium Monthly", premiumQuarterly: "Premium Quarterly", premiumClose: "Fechar oferta Premium", search: "Buscar...", none: "Nenhuma opção encontrada", noProfiles: "Nenhum perfil encontrado", noProfilesHelp: "Tente alterar ou limpar os filtros.",
    loadMore: "Carregar mais", loading: "Carregando ...", locationHidden: "Localização oculta", message: "Mensagem", like: "Curtir", liked: "Liked",
    ageError: "A idade mínima não pode ser maior que a idade máxima.", failed: "Não foi possível carregar o catálogo.", actionFailed: "Não foi possível concluir esta ação.",
    dailyLikeLimit: "Você atingiu o limite diário de curtidas. Você pode curtir mais perfis amanhã.", dailyChatLimit: "Você atingiu o limite diário de novos chats. Você pode iniciar mais chats amanhã.",
    profileUnavailable: "Este perfil não está mais disponível.", chatUnavailable: "Esta conversa não pode ser aberta no momento.",
  },
  fr: {
    browse: "Parcourir les profils", collections: "Collections", all: "Tous", day: "jour", days: "jours", month: "mois",
    filters: "Filtres", allFilters: "Tous les filtres", closeFilters: "Fermer les filtres", clear: "Tout effacer", apply: "Appliquer les filtres",
    country: "Pays", city: "Ville", anyCountry: "Tout pays", cityFirst: "Sélectionnez un seul pays pour filtrer par ville", cityPlaceholder: "Commencez à taper le nom d'une ville...",
    profileType: "Type de profil", donor: "Donneur", lookingFor: "Recherche", allTypes: "Tous les types",
    matches: "Affiche les profils correspondant à l'une de ces options", verified: "Vérifiés uniquement", age: "Âge", from: "De", to: "À",
    ethnicity: "Origine ethnique", hair: "Couleur de cheveux", eye: "Couleur des yeux", education: "Éducation", religion: "Religion",
    premium: "Premium uniquement", premiumTitle: "Filtres Premium", premiumText: "Choisissez Premium pour débloquer des filtres avancés et trouver des profils plus compatibles.", premiumMonthly: "Premium Monthly", premiumQuarterly: "Premium Quarterly", premiumClose: "Fermer l'offre Premium", search: "Rechercher...", none: "Aucune option trouvée", noProfiles: "Aucun profil trouvé", noProfilesHelp: "Essayez de modifier ou d'effacer les filtres.",
    loadMore: "Charger plus", loading: "Chargement ...", locationHidden: "Localisation masquée", message: "Message", like: "J'aime", liked: "Liked",
    ageError: "L'âge minimum ne peut pas être supérieur à l'âge maximum.", failed: "Impossible de charger le catalogue.", actionFailed: "Cette action n'a pas pu être effectuée.",
    dailyLikeLimit: "Vous avez atteint la limite quotidienne de « J'aime ». Vous pourrez aimer d'autres profils demain.", dailyChatLimit: "Vous avez atteint la limite quotidienne de nouveaux chats. Vous pourrez démarrer d'autres chats demain.",
    profileUnavailable: "Ce profil n'est plus disponible.", chatUnavailable: "Cette conversation ne peut pas être ouverte pour le moment.",
  },
  de: {
    browse: "Profile durchsuchen", collections: "Sammlungen", all: "Alle", day: "Tag", days: "Tage", month: "Monat",
    filters: "Filter", allFilters: "Alle Filter", closeFilters: "Filter schließen", clear: "Alles löschen", apply: "Filter anwenden",
    country: "Land", city: "Stadt", anyCountry: "Beliebiges Land", cityFirst: "Wählen Sie ein einzelnes Land, um nach Stadt zu filtern", cityPlaceholder: "Beginnen Sie, einen Stadtnamen einzugeben...",
    profileType: "Profiltyp", donor: "Spender", lookingFor: "Sucht", allTypes: "Alle Typen",
    matches: "Zeigt Profile, die einer dieser Optionen entsprechen", verified: "Nur verifizierte", age: "Alter", from: "Von", to: "Bis",
    ethnicity: "Ethnizität", hair: "Haarfarbe", eye: "Augenfarbe", education: "Bildung", religion: "Religion",
    premium: "Nur Premium", premiumTitle: "Premium-Filter", premiumText: "Wählen Sie Premium, um erweiterte Filter freizuschalten und besser passende Profile zu finden.", premiumMonthly: "Premium Monthly", premiumQuarterly: "Premium Quarterly", premiumClose: "Premium-Angebot schließen", search: "Suchen...", none: "Keine Optionen gefunden", noProfiles: "Keine Profile gefunden", noProfilesHelp: "Versuchen Sie, die Filter zu ändern oder zu löschen.",
    loadMore: "Mehr laden", loading: "Wird geladen ...", locationHidden: "Standort verborgen", message: "Nachricht", like: "Gefällt mir", liked: "Liked",
    ageError: "Das Mindestalter darf nicht höher sein als das Höchstalter.", failed: "Der Katalog konnte nicht geladen werden.", actionFailed: "Diese Aktion konnte nicht abgeschlossen werden.",
    dailyLikeLimit: "Sie haben das heutige Like-Limit erreicht. Sie können morgen weitere Profile liken.", dailyChatLimit: "Sie haben das heutige Limit für neue Chats erreicht. Sie können morgen weitere Chats starten.",
    profileUnavailable: "Dieses Profil ist nicht mehr verfügbar.", chatUnavailable: "Diese Unterhaltung kann derzeit nicht geöffnet werden.",
  },
  it: {
    browse: "Sfoglia profili", collections: "Raccolte", all: "Tutti", day: "giorno", days: "giorni", month: "mese",
    filters: "Filtri", allFilters: "Tutti i filtri", closeFilters: "Chiudi filtri", clear: "Cancella tutto", apply: "Applica filtri",
    country: "Paese", city: "Città", anyCountry: "Qualsiasi paese", cityFirst: "Seleziona un solo paese per filtrare per città", cityPlaceholder: "Inizia a digitare il nome di una città...",
    profileType: "Tipo di profilo", donor: "Donatore", lookingFor: "Cerca", allTypes: "Tutti i tipi",
    matches: "Mostra i profili che corrispondono a una qualsiasi di queste opzioni", verified: "Solo verificati", age: "Età", from: "Da", to: "A",
    ethnicity: "Etnia", hair: "Colore dei capelli", eye: "Colore degli occhi", education: "Istruzione", religion: "Religione",
    premium: "Solo Premium", premiumTitle: "Filtri Premium", premiumText: "Scegli Premium per sbloccare filtri avanzati e trovare profili più compatibili.", premiumMonthly: "Premium Monthly", premiumQuarterly: "Premium Quarterly", premiumClose: "Chiudi offerta Premium", search: "Cerca...", none: "Nessuna opzione trovata", noProfiles: "Nessun profilo trovato", noProfilesHelp: "Prova a modificare o cancellare i filtri.",
    loadMore: "Carica altro", loading: "Caricamento ...", locationHidden: "Posizione nascosta", message: "Messaggio", like: "Mi piace", liked: "Liked",
    ageError: "L'età minima non può essere maggiore dell'età massima.", failed: "Impossibile caricare il catalogo.", actionFailed: "Non è stato possibile completare questa azione.",
    dailyLikeLimit: "Hai raggiunto il limite giornaliero di Mi piace. Potrai mettere Mi piace ad altri profili domani.", dailyChatLimit: "Hai raggiunto il limite giornaliero di nuove chat. Potrai avviare altre chat domani.",
    profileUnavailable: "Questo profilo non è più disponibile.", chatUnavailable: "Questa conversazione non può essere aperta al momento.",
  },
  pl: {
    browse: "Przeglądaj profile", collections: "Kolekcje", all: "Wszystkie", day: "dzień", days: "dni", month: "miesiąc",
    filters: "Filtry", allFilters: "Wszystkie filtry", closeFilters: "Zamknij filtry", clear: "Wyczyść wszystko", apply: "Zastosuj filtry",
    country: "Kraj", city: "Miasto", anyCountry: "Dowolny kraj", cityFirst: "Wybierz jeden kraj, aby filtrować według miasta", cityPlaceholder: "Zacznij wpisywać nazwę miasta...",
    profileType: "Typ profilu", donor: "Dawca", lookingFor: "Szuka", allTypes: "Wszystkie typy",
    matches: "Pokazuje profile pasujące do dowolnej z tych opcji", verified: "Tylko zweryfikowani", age: "Wiek", from: "Od", to: "Do",
    ethnicity: "Pochodzenie etniczne", hair: "Kolor włosów", eye: "Kolor oczu", education: "Wykształcenie", religion: "Religia",
    premium: "Tylko Premium", premiumTitle: "Filtry Premium", premiumText: "Wybierz Premium, aby odblokować zaawansowane filtry i znaleźć bardziej dopasowane profile.", premiumMonthly: "Premium Monthly", premiumQuarterly: "Premium Quarterly", premiumClose: "Zamknij ofertę Premium", search: "Szukaj...", none: "Nie znaleziono opcji", noProfiles: "Nie znaleziono profili", noProfilesHelp: "Spróbuj zmienić lub wyczyścić filtry.",
    loadMore: "Załaduj więcej", loading: "Ładowanie ...", locationHidden: "Lokalizacja ukryta", message: "Wiadomość", like: "Polub", liked: "Liked",
    ageError: "Minimalny wiek nie może być większy niż maksymalny.", failed: "Nie udało się załadować katalogu.", actionFailed: "Nie udało się wykonać tej czynności.",
    dailyLikeLimit: "Osiągnięto dzisiejszy limit polubień. Możesz polubić więcej profili jutro.", dailyChatLimit: "Osiągnięto dzisiejszy limit nowych czatów. Możesz rozpocząć więcej czatów jutro.",
    profileUnavailable: "Ten profil nie jest już dostępny.", chatUnavailable: "Tej rozmowy nie można teraz otworzyć.",
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
      ? firstAvatarText(value)
      : value && typeof value === "object"
        ? firstAvatarText((value as Row).publicUrl, (value as Row).url)
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
  const age = profileAge(item);
 const location = [item.city ?? data.city, profileCountry(item.countryName ?? data.countryName ?? item.country ?? data.country, legacyLocaleOf(locale))]
    .filter(Boolean).map(String).join(", ");
  const donorTypes = catalogList(item.donorType ?? data.donorType);
  const lookingFor = catalogList(item.lookingFor ?? data.lookingFor ?? item.recipientType ?? data.recipientType);
  const verified = catalogBoolean(item.isVerified ?? data.isVerified);
  const videoVerified = catalogBoolean(item.isVideoVerified ?? data.isVideoVerified);
  const liked = catalogBoolean(item.likedByViewer ?? data.likedByViewer);
  const id = catalogText(item.id ?? data.id);
  const detailPath = `/${locale}/profile/${encodeURIComponent(id)}`;
  const title = age ? `${name}, ${age}` : name;
  const initials = userInitials(name);
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
          {videoVerified && (
            <span className="catalog-video-verified-badge" title="Video verified" style={{ marginLeft: 4 }}>
              🎥
            </span>
          )}
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
  premiumPromptOpen,
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
  premiumPromptOpen: boolean;
}) {
  const copy = CATALOG_COPY[locale];
  const [openField, setOpenField] = useState("");
  const [query, setQuery] = useState("");
  const [cityQuery, setCityQuery] = useState(catalogText(value.city));
  const [cityActiveIndex, setCityActiveIndex] = useState(-1);
  const [dropdownActiveIndex, setDropdownActiveIndex] = useState(-1);
  const set = <K extends keyof CatalogFilters>(key: K, next: CatalogFilters[K]) => onChange({ ...value, [key]: next });
  useEffect(() => {
    document.body.classList.add("catalog-filter-open");
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || premiumPromptOpen) return;
      if (openField) setOpenField("");
      else onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("catalog-filter-open");
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, openField, premiumPromptOpen]);
  useEffect(() => {
    if (!openField) return;
    const closeOutside = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const activeWrap = document.querySelector(`[data-catalog-filter-field="${openField}"]`);
      if (activeWrap?.contains(target)) return;
      setOpenField("");
      setQuery("");
      setDropdownActiveIndex(-1);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [openField]);
  useEffect(() => {
    setCityQuery(catalogText(value.city));
    setCityActiveIndex(-1);
  }, [value.city, value.country.join(",")]);
  useEffect(() => {
    if (!openField) return;
    const index = openField === "city" ? cityActiveIndex : dropdownActiveIndex;
    document.getElementById(`catalog-filter-${openField}-option-${index}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [openField, cityActiveIndex, dropdownActiveIndex, query, cityQuery]);
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
      if (key === "country") { setCityQuery(""); setCityActiveIndex(-1); }
    } else {
      const key = field as "city" | "ethnicity" | "hairColor" | "eyeColor" | "education" | "religion";
      set(key, value[key] === optionValue ? "" : optionValue);
      setOpenField("");
      setDropdownActiveIndex(-1);
    }
  };
  const cityField = () => {
    const disabled = value.country.length !== 1;
    const controlId = "catalog-filter-city";
    const labelId = `${controlId}-label`;
    const selectedCountry = value.country[0] || "";
 const countryLabel = countries.find((option) => option.value === selectedCountry)?.label || profileCountry(selectedCountry, legacyLocaleOf(locale));
    const term = cityQuery.trim().toLowerCase();
    const filtered = term ? cities.filter((option) => option.label.toLowerCase().includes(term) || option.value.toLowerCase().includes(term)).slice(0, 24) : [];
    const dropdownOpen = openField === "city" && !disabled && filtered.length > 0;
    const activeIndex = filtered.length ? Math.min(cityActiveIndex, filtered.length - 1) : -1;
    const chooseCity = (option: CatalogOption) => {
      set("city", option.value);
      setCityQuery(option.label);
      setCityActiveIndex(-1);
      setOpenField("");
    };
    return (
      <div className={`catalog-filter-field catalog-city-field${disabled ? " disabled" : ""}`} key="city">
        <label id={labelId} htmlFor={controlId}>{copy.city}</label>
        <div className="catalog-filter-select-wrap" data-catalog-filter-field="city">
          <input
            id={controlId}
            className="catalog-city-autocomplete"
            type="text"
            role="combobox"
            value={disabled ? "" : cityQuery}
            disabled={disabled}
            placeholder={disabled ? copy.cityFirst : copy.cityPlaceholder}
            aria-labelledby={labelId}
            aria-autocomplete="list"
            aria-expanded={dropdownOpen}
            aria-controls={dropdownOpen ? `${controlId}-options` : undefined}
            aria-activedescendant={dropdownOpen && activeIndex >= 0 ? `${controlId}-option-${activeIndex}` : undefined}

            autoComplete="off"
            onFocus={() => { if (!disabled) setOpenField("city"); }}
            onKeyDown={(event) => {
              if (disabled) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpenField("city");
                setCityActiveIndex((current) => filtered.length ? Math.min(current + 1, filtered.length - 1) : -1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setCityActiveIndex((current) => current < 0 ? filtered.length - 1 : Math.max(current - 1, 0));
              } else if (event.key === "Enter" && dropdownOpen && filtered[activeIndex]) {
                event.preventDefault();
                chooseCity(filtered[activeIndex]);
              } else if (event.key === "Escape" && openField === "city") {
                event.preventDefault();
                event.stopPropagation();
                setOpenField("");
              }
            }}
            onChange={(event) => {
              const next = event.target.value;
              setCityQuery(next);
              set("city", next);
              setCityActiveIndex(-1);
              setOpenField("city");
            }}
          />
          {dropdownOpen && (
            <div id={`${controlId}-options`} className="catalog-filter-dropdown catalog-city-dropdown" role="listbox" aria-labelledby={labelId}>
              <section>
                {filtered.map((option, index) => {
                  const [name, rest] = option.label.split(/,\s*/, 2);
                  const active = index === activeIndex;
                  return <button id={`${controlId}-option-${index}`} type="button" role="option" aria-selected={option.value === value.city} className={`${option.value === value.city ? "selected" : ""}${active ? " active" : ""}`.trim()} key={option.value} onMouseEnter={() => setCityActiveIndex(index)} onClick={() => chooseCity(option)}><span className="catalog-city-option-name">{name}</span>{countryLabel || rest ? <span className="catalog-city-option-country">, {countryLabel || rest}</span> : null}</button>;
                })}
              </section>
            </div>
          )}
        </div>
      </div>
    );
  };
  const filterField = (field: string, label: string, placeholder: string, options: { premium?: boolean; disabled?: boolean; description?: string } = {}) => {
    const locked = Boolean(options.premium && !premium);
    const selected = selectedValues(field);
    const allOptions = fieldOptions(field);
    const selectedLabels = selected.map((token) => allOptions.find((option) => option.value === token)?.label || catalogOptionLabel(field, token));
    const filtered = allOptions.filter((option) => option.label.toLowerCase().startsWith(query.trim().toLowerCase()) || option.value.toLowerCase().startsWith(query.trim().toLowerCase()));
    const controlId = `catalog-filter-${field}`;
    const labelId = `${controlId}-label`;
    const valueId = `${controlId}-value`;
    const premiumId = `${controlId}-premium`;
    const dropdownOpen = openField === field && !locked && !options.disabled;
    const activeIndex = filtered.length ? Math.min(dropdownActiveIndex, filtered.length - 1) : -1;
    return (
      <div className={`catalog-filter-field${options.disabled ? " disabled" : ""}${field === "lookingFor" ? " looking-field" : ""}`} key={field}>
        <label id={labelId} htmlFor={controlId}>{label}</label>
        <div className="catalog-filter-select-wrap" data-catalog-filter-field={field}>
          <button
            id={controlId}
            className={`catalog-filter-select${locked ? " premium" : ""}`}
            type="button"
            disabled={options.disabled}
            aria-labelledby={`${labelId} ${valueId}${locked ? ` ${premiumId}` : ""}`}
            aria-haspopup={locked || options.disabled ? undefined : "listbox"}
            aria-expanded={locked || options.disabled ? undefined : dropdownOpen}
            aria-controls={dropdownOpen ? `${controlId}-options` : undefined}
            aria-activedescendant={dropdownOpen && activeIndex >= 0 ? `${controlId}-option-${activeIndex}` : undefined}
            onClick={() => {
              if (locked) { onPremium(); return; }
              setOpenField((current) => current === field ? "" : field);
              setQuery("");
              setDropdownActiveIndex(-1);
            }}
            onKeyDown={(event) => {
              if (locked || options.disabled) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpenField(field);
                setDropdownActiveIndex((current) => filtered.length ? Math.min(current + 1, filtered.length - 1) : -1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setOpenField(field);
                setDropdownActiveIndex((current) => current < 0 ? filtered.length - 1 : Math.max(current - 1, 0));
              } else if (event.key === "Enter" && dropdownOpen && filtered[activeIndex]) {
                event.preventDefault();
                choose(field, filtered[activeIndex].value);
              } else if (event.key === "Escape" && dropdownOpen) {
                event.preventDefault();
                event.stopPropagation();
                setOpenField("");
                setQuery("");
                setDropdownActiveIndex(-1);
              }
            }}
          >
            <span id={valueId} className={`catalog-filter-value${selectedLabels.length ? "" : " placeholder"}`}>{selectedLabels.length ? <span className="catalog-filter-chip-list">{selectedLabels.map((item) => <b key={item}>{item}</b>)}</span> : placeholder}</span>
            {locked ? <span id={premiumId} className="catalog-filter-premium-badge"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg><span>{copy.premium}</span></span> : null}
            {!options.disabled ? <svg className="catalog-filter-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg> : null}
          </button>
          {dropdownOpen && (
            <div id={`${controlId}-options`} className="catalog-filter-dropdown" role="listbox" aria-labelledby={labelId} aria-multiselectable={["country", "profileTypes", "donorTypes", "lookingFor"].includes(field)}>
              <div><input autoFocus value={query} role="combobox" aria-expanded={dropdownOpen} aria-controls={`${controlId}-options`} aria-activedescendant={filtered.length && activeIndex >= 0 ? `${controlId}-option-${activeIndex}` : undefined} aria-autocomplete="list" onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setDropdownActiveIndex((current) => filtered.length ? Math.min(current + 1, filtered.length - 1) : -1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setDropdownActiveIndex((current) => current < 0 ? filtered.length - 1 : Math.max(current - 1, 0));
                } else if (event.key === "Enter" && filtered[activeIndex]) {
                  event.preventDefault();
                  choose(field, filtered[activeIndex].value);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setOpenField("");
                  setQuery("");
                  setDropdownActiveIndex(-1);
                }
              }} onChange={(event) => { setQuery(event.target.value); setDropdownActiveIndex(-1); }} placeholder={`${copy.search.replace(/\.\.\.$/, "")} ${label.toLowerCase()}`} aria-label={`${copy.search.replace(/\.\.\.$/, "")} ${label.toLowerCase()}`} /></div>
              <section>
                {filtered.length ? filtered.map((option, index) => {
                  const isSelected = selected.includes(option.value);
                  const active = index === activeIndex;
                  return <button id={`${controlId}-option-${index}`} type="button" role="option" aria-selected={isSelected} className={`${isSelected ? "selected" : ""}${active ? " active" : ""}`.trim()} key={option.value} onMouseEnter={() => setDropdownActiveIndex(index)} onClick={() => choose(field, option.value)}><i aria-hidden="true" />{option.icon ? <span>{option.icon}</span> : null}<span>{option.label}</span></button>;
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
          {cityField()}
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
          <button type="button" className="catalog-filter-clear" onClick={() => { onChange(emptyCatalogFilters()); setOpenField(""); setQuery(""); setDropdownActiveIndex(-1); setCityActiveIndex(-1); }}>{copy.clear}</button>
          <button type="button" className="catalog-filter-apply" onClick={onApply}>{copy.apply}</button>
        </footer>
      </section>
    </div>
  );
}

function useCatalogCities(country: string, query: string, enabled: boolean): CatalogOption[] {
  const [result, setResult] = useState<{ key: string; cities: CatalogOption[] }>({ key: "", cities: [] });
  const term = query.trim();
  const key = enabled && country && term ? JSON.stringify([country, term]) : "";
  useEffect(() => {
    if (!key) return;
    let alive = true;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ country, q: term, limit: "200" });
      api.get<{ cities?: Row[] }>(`/member/catalog/filter-options?${params}`)
        .then((data) => {
          if (alive) setResult({ key, cities: (data.cities || []).map((item) => ({ value: catalogText(item.value), label: catalogText(item.label ?? item.value) })) });
        })
        .catch(() => { if (alive) setResult({ key, cities: [] }); });
    }, 200);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [country, key, term]);
  return key && result.key === key ? result.cities : [];
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
  const [premiumPromptOpen, setPremiumPromptOpen] = useState(false);
  const loadMoreSentinel = useRef<HTMLDivElement | null>(null);
  const [catalogOptions, setCatalogOptions] = useState<{ countries: CatalogOption[]; premium: boolean }>({ countries: [], premium: catalogBoolean(session?.user.isPremium) });
  const cities = useCatalogCities(draftFilters.country.length === 1 ? draftFilters.country[0] : "", draftFilters.city, filterOpen);
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
    if (!filterOpen) return;
    let alive = true;
    api.get<{ countries?: Row[]; isPremium?: unknown }>("/member/catalog/filter-options?limit=200")
      .then((data) => {
        if (!alive) return;
        setCatalogOptions((current) => ({
          ...current,
          countries: (data.countries || []).map((item) => ({ value: catalogText(item.value), label: catalogText(item.label ?? item.value) })),
          premium: data.isPremium === undefined ? current.premium : catalogBoolean(data.isPremium),
        }));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [filterOpen]);
  const persist = (nextFilters: CatalogFilters, nextPeriod = period) => {
    try { sessionStorage.setItem(storageKey, JSON.stringify({ period: nextPeriod, filters: nextFilters })); } catch { /* optional */ }
  };
  const like = async (item: Row) => {
    const id = catalogText(item.id);
    if (catalogBoolean(item.likedByViewer ?? catalogData(item).likedByViewer)) return;
    setError("");
    setItems((current) => current.map((profile) => catalogText(profile.id) === id ? { ...profile, likedByViewer: true } : profile));
    try {
      const result = await api.post<Row>(`/member/likes/${encodeURIComponent(id)}`);
      if (catalogBoolean(result.matched) && result.conversationId)
        navigate(`/${locale}/chat/${encodeURIComponent(String(result.conversationId))}`);
    } catch (failure) {
      setItems((current) => current.map((profile) => catalogText(profile.id) === id ? { ...profile, likedByViewer: false } : profile));
      if (failure instanceof ApiError && failure.status === 401) navigate(`/${locale}/auth/login`);
      else if (failure instanceof ApiError && failure.status === 402) setPremiumPromptOpen(true);
      else if (failure instanceof ApiError && failure.status === 403 && /verif/i.test(failure.message)) navigate(`/${locale}/verification`);
      else if (failure instanceof ApiError && failure.status === 429) setError(copy.dailyLikeLimit);
      else if (failure instanceof ApiError && [403, 404, 409, 422].includes(failure.status)) setError(copy.profileUnavailable);
      else setError(copy.actionFailed);
    }
  };
  const message = async (item: Row) => {
    setError("");
    try {
      const conversation = await api.post<Row>("/member/conversations", { targetProfileId: catalogText(item.id) });
      if (!conversation.conversationId) throw new Error("Conversation was not created");
      navigate(`/${locale}/chat/${encodeURIComponent(String(conversation.conversationId))}`);
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 401) navigate(`/${locale}/auth/login`);
      else if (failure instanceof ApiError && failure.status === 402) setPremiumPromptOpen(true);
      else if (failure instanceof ApiError && failure.status === 403 && /verif/i.test(failure.message)) navigate(`/${locale}/verification`);
      else if (failure instanceof ApiError && failure.status === 429) setError(copy.dailyChatLimit);
      else if (failure instanceof ApiError && [403, 404, 409, 422].includes(failure.status)) setError(copy.chatUnavailable);
      else setError(copy.actionFailed);
    }
  };
  const openPremiumPrompt = () => {
    setPremiumPromptOpen(true);
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
    setPremiumPromptOpen(false);
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
        <SlidingTabs
          className="catalog-reference-periods sliding-tabs--catalog"
          label={copy.collections}
          value={period}
          onChange={changePeriod}
          options={[
            { value: 0, label: copy.all },
            { value: 1, label: `1 ${copy.day}` },
            { value: 7, label: `7 ${copy.days}` },
            { value: 30, label: `1 ${copy.month}` },
          ]}
        />
        <button className="catalog-reference-filter-button" type="button" aria-label={copy.allFilters} onClick={() => { setDraftFilters({ ...filters }); setFilterOpen(true); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 4h-7" />
            <path d="M10 4H3" />
            <path d="M21 12h-9" />
            <path d="M8 12H3" />
            <path d="M21 20h-5" />
            <path d="M12 20H3" />
            <path d="M14 2v4" />
            <path d="M8 10v4" />
            <path d="M16 18v4" />
          </svg>
          <span>{copy.filters}</span>{filterCount > 0 ? <b>{filterCount}</b> : null}
        </button>
      </div>
      {error ? <p className="error catalog-reference-error">{error}</p> : null}
      {loading && offset === 0 ? <div className="catalog-reference-loading" role="status" aria-label={copy.loading}><span /></div> : error && items.length === 0 ? null : items.length ? (
        <div className="catalog-reference-grid">{items.map((item) => <CatalogCard key={catalogText(item.id)} item={item} locale={locale} onLike={(profile) => void like(profile)} onMessage={(profile) => void message(profile)} />)}</div>
      ) : <div className="catalog-reference-empty"><strong>{copy.noProfiles}</strong><span>{copy.noProfilesHelp}</span></div>}
      {!(loading && offset === 0) && items.length < total ? <div className={`catalog-reference-sentinel${loading ? " loading" : ""}`} ref={loadMoreSentinel} role={loading ? "status" : undefined} aria-label={loading ? copy.loading : undefined}>{loading ? <span /> : null}</div> : null}
      {filterOpen ? <CatalogFilterModal locale={locale} value={draftFilters} onChange={setDraftFilters} onClose={() => { setFilterOpen(false); setPremiumPromptOpen(false); }} onApply={applyFilters} countries={catalogOptions.countries} cities={cities} premium={catalogOptions.premium} onPremium={openPremiumPrompt} premiumPromptOpen={premiumPromptOpen} /> : null}
{premiumPromptOpen ? <AccountPremium locale={legacyLocaleOf(locale)} close={() => setPremiumPromptOpen(false)} /> : null}
    </section>
  );
}

// Same reason list mobile's ReportProfileScreen.tsx uses (matches the
// production reference screenshots) - backend takes free-text `reason`,
// this fixed list is a product choice. Previously the website's "Report"
// button skipped straight to a hardcoded generic reason with no picker;
// audit 2026-09-13 (site-vs-app-audit-2026-09-13.docx, item 3) originally
// missed that a report flow existed here at all - corrected: it existed,
// just without the reason list mobile has. This closes that gap.
const REPORT_REASONS = ["Spam", "Harassment", "Inappropriate Content", "Fake Profile", "Scam", "Other"];

function CatalogProfile({ session }: { session: Session }) {
 return <MemberProfile session={session} locale={legacyLocaleOf(localeOf())} />;
}

function Likes({ session }: { session: Session }) {
 return <MemberLikes session={session} locale={legacyLocaleOf(localeOf())} renderProfileCard={props => <CatalogCard {...props} />} />;
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
        setDraft(ownProfileData(result.profile));
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
  // NavLink (not Link) so the current section gets the "active" pink pill
  // (styles.css .member-links a.active) - previously plain <Link>s had no
  // way to show which tab you were on at all.
  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : undefined);
  return (
    <nav className="member-links">
      <NavLink to={`/${locale}/profile`} className={navClass}>Profile</NavLink>
      <NavLink to={`/${locale}/compatibility`} className={navClass}>Compatibility</NavLink>
      <NavLink to={`/${locale}/ai-advisor`} className={navClass}>AI Advisor</NavLink>
      <NavLink to={`/${locale}/photos`} className={navClass}>Photos</NavLink>
      <NavLink to={`/${locale}/verification`} className={navClass}>Verification</NavLink>
      <NavLink to={`/${locale}/chat`} className={navClass}>Messages</NavLink>
      <NavLink to={`/${locale}/visitors`} className={navClass}>Visitors</NavLink>
      <NavLink to={`/${locale}/favourites`} className={navClass}>Saved</NavLink>
      <NavLink to={`/${locale}/blocked`} className={navClass}>Blocked</NavLink>
      <NavLink to={`/${locale}/boost`} className={navClass}>Boost</NavLink>
      <NavLink to={`/${locale}/referral`} className={navClass}>Referral</NavLink>
      <NavLink to={`/${locale}/safety-checkin`} className={navClass}>Safety Check-In</NavLink>
      <NavLink to={`/${locale}/cost-calculator`} className={navClass}>Cost Calculator</NavLink>
      <NavLink to={`/${locale}/video-verification`} className={navClass}>Video Verification</NavLink>
      <NavLink to={`/${locale}/community`} className={navClass}>Community</NavLink>
      <NavLink to={`/${locale}/settings`} className={navClass}>Settings</NavLink>
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
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={Boolean(settings.incognitoAvailable && settings.incognitoEnabled)}
          disabled={!settings.incognitoAvailable}
          onChange={(event) =>
            setSettings((current) => ({
              ...current,
              incognitoEnabled: event.target.checked,
            }))
          }
        />
        Incognito browsing{settings.incognitoAvailable ? "" : " (Pro feature)"}
      </label>
      {!settings.incognitoAvailable && (
        <p className="notice">
          Browse profiles without appearing in their Visitors list - available with a Pro subscription.
        </p>
      )}
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

function Conversations({ session }: { session: Session }) { return <MemberChat session={session} locale={legacyLocaleOf(localeOf())} />; }

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
            <UserAvatar src={item.avatarUrl} name={firstAvatarText(item.displayName, item.display_name, item.name)} />
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
  const [confirmation, setConfirmation] = useState("");
  const [notice, setNotice] = useState("");
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const response = await api.post<Row>("/member/account-deletion", {
        reason,
        details,
        confirmation,
      });
      setNotice(asText(response.message ?? "Deletion request submitted."));
      window.setTimeout(() => window.location.assign(`/${locale}/auth/login`), 1200);
    } catch {
      setNotice("Could not submit the deletion request.");
    }
  };
  return (
    <section className="member-form danger-zone">
      <h1>Delete account</h1>
      <MemberLinks locale={locale} />
      <p>Access ends immediately. Your account, matches, and conversations are permanently deleted after 30 days.</p>
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
        <label>
          Type DELETE to confirm
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value.toUpperCase().slice(0, 6))}
            autoComplete="off"
            required
          />
        </label>
        <button className="primary" disabled={confirmation !== "DELETE"}>Delete my account</button>
      </form>
    </section>
  );
}

// Tier display names + rank, mirrors backend SUBSCRIPTION_TIER_RANK
// (main.py). Used both to label the member's current tier and to decide
// whether an "Upgrade to Pro" offer makes sense (nothing to upgrade to
// once you're already on Pro).
const SUBSCRIPTION_TIER_LABELS: Record<string, string> = {
  EXPLORE: "Explore (free)",
  BUILDER: "Family Builder",
  PRO: "Family Builder Pro",
};
const SUBSCRIPTION_TIER_RANK: Record<string, number> = { EXPLORE: 0, BUILDER: 1, PRO: 2 };

function Subscription({ session }: { session: Session }) {
  const locale = localeOf();
  const [data, setData] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [requesting, setRequesting] = useState(false);
  const load = () => {
    if (session)
      api
        .get<Row>("/member/subscription")
        .then(setData)
        .catch(() => setNotice("Could not load your Premium access."));
  };
  useEffect(load, [session]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const request = async (plan: string, tier: string) => {
    setRequesting(true);
    try {
      const response = await api.post<Row>("/member/subscription-intent", {
        plan,
        tier,
        payload: {},
      });
      setNotice(asText(response.message ?? response.status));
      load();
    } catch {
      setNotice("Premium is available only after profile verification.");
    } finally {
      setRequesting(false);
    }
  };
  const verified = data?.isVerified === true;
  const currentTier = asText(data?.tier || "EXPLORE").toUpperCase();
  const canUpgradeToPro = data?.isPremium && SUBSCRIPTION_TIER_RANK[currentTier] < SUBSCRIPTION_TIER_RANK.PRO;
  return (
    <section className="access-card premium-card">
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
            <>
              <p className="premium-current-tier">
                Current plan: <strong>{SUBSCRIPTION_TIER_LABELS[currentTier] || currentTier}</strong>
              </p>
              <p>Your Premium subscription is active.</p>
              {canUpgradeToPro && (
                <div className="premium-upgrade">
                  <p>
                    Want the Family Builder Pro extras - Detailed Compatibility
                    Report, Co-Parenting Agreement sign-off, Family Plan &amp;
                    Shared Family Room?
                  </p>
                  <div className="plan-actions">
                    {["MONTHLY", "QUARTERLY"].map((plan) => (
                      <button
                        className="primary"
                        key={plan}
                        disabled={requesting}
                        onClick={() => void request(plan, "PRO")}
                      >
                        Upgrade to Pro ({plan.toLowerCase()})
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Link className="secondary" to={`/${locale}/pricing`}>
                Compare all plans
              </Link>
            </>
          ) : (
            <div className="plan-actions">
              {["MONTHLY", "QUARTERLY"].map((plan) => (
                <button
                  className="primary"
                  key={plan}
                  disabled={requesting}
                  onClick={() => void request(plan, "BUILDER")}
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

// "Family Plan & Shared Family Room" + "Document & checklist tools" -
// Family Builder Pro pricing-page features (see PRICING_TEXT below).
// Mirrors mobile/src/screens/FamilyRoomScreen.tsx: same endpoints
// (backend/main.py's "FAMILY ROOM" section), same 402 (needs Premium) /
// 404 (no active match with this profile) gating rendered as dedicated
// states rather than guessed at client-side. Reached from the Messages
// page (a "Family Room" link next to the call buttons, using the active
// conversation's other_profile_id - see conversation_scope_sql()) since
// this site doesn't have a general "view this member's profile" page the
// way the mobile app's ProfileDetailScreen does.
const FAMILY_ROOM_SECTIONS: Array<"parenting" | "finances" | "legal" | "general"> = [
  "parenting",
  "finances",
  "legal",
  "general",
];

const FAMILY_ROOM_SECTION_LABELS: Record<string, string> = {
  parenting: "Parenting",
  finances: "Finances",
  legal: "Legal",
  general: "General",
};

const PREGNANCY_CATEGORY_LABELS: Record<string, string> = {
  lab_test: "Lab result",
  ultrasound: "Ultrasound",
  prescription: "Prescription",
};

function formatFamilyRoomBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FamilyRoom({ session }: { session: Session }) {
  const locale = localeOf();
  const { profileId = "" } = useParams();
  const [status, setStatus] = useState<
    "loading" | "ok" | "needsPremium" | "noMatch" | "error"
  >("loading");
  const [room, setRoom] = useState<Row | null>(null);
  const [parenting, setParenting] = useState("");
  const [finances, setFinances] = useState("");
  const [legal, setLegal] = useState("");
  const [planDirty, setPlanDirty] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [notice, setNotice] = useState("");
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pregnancyEntries, setPregnancyEntries] = useState<Row[]>([]);
  const [pregnancyCategory, setPregnancyCategory] = useState<"lab_test" | "ultrasound" | "prescription">("lab_test");
  const [pregnancyNote, setPregnancyNote] = useState("");
  const [pregnancyUploading, setPregnancyUploading] = useState(false);
  const [agreement, setAgreement] = useState<Row | null>(null);
  const [agreementStatus, setAgreementStatus] = useState<"idle" | "ok" | "needsPremium" | "error">("idle");
  const [agreementFullName, setAgreementFullName] = useState("");
  const [agreementSigning, setAgreementSigning] = useState(false);
  const [agreementNotice, setAgreementNotice] = useState("");

  const loadAgreement = () => {
    if (!session || !profileId) return;
    api
      .get<{ ok: true; agreement: Row }>(`/member/family-room/${encodeURIComponent(profileId)}/agreement`)
      .then((data) => {
        setAgreement(data.agreement);
        setAgreementStatus("ok");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) setAgreementStatus("needsPremium");
        else setAgreementStatus("error");
      });
  };

  const loadPregnancy = () => {
    if (!session || !profileId) return;
    api
      .get<{ ok: true; entries: Row[] }>(`/member/family-room/${encodeURIComponent(profileId)}/pregnancy`)
      .then((data) => setPregnancyEntries(data.entries || []))
      .catch(() => {
        // Silent - Pregnancy Room is a free add-on to Family Room (no
        // Premium gate, see backend/main.py's member_pregnancy_room()); if
        // this fails it's almost always the same "no active match" 404
        // already surfaced by the main Family Room load above, so no need
        // to show a second error for it.
      });
  };

  const load = () => {
    if (!session || !profileId) return;
    setStatus("loading");
    api
      .get<Row>(`/member/family-room/${encodeURIComponent(profileId)}`)
      .then((data) => {
        setRoom(data);
        const plan = (data.plan as Row) || {};
        setParenting(asText(plan.parentingNotes));
        setFinances(asText(plan.financesNotes));
        setLegal(asText(plan.legalNotes));
        setPlanDirty(false);
        setStatus("ok");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) setStatus("needsPremium");
        else if (err instanceof ApiError && err.status === 404) setStatus("noMatch");
        else setStatus("error");
      });
  };
  useEffect(load, [session, profileId]);
  useEffect(loadPregnancy, [session, profileId]);
  useEffect(loadAgreement, [session, profileId]);

  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;

  const savePlan = async () => {
    setSavingPlan(true);
    setNotice("");
    try {
      const response = await api.patch<Row>(
        `/member/family-room/${encodeURIComponent(profileId)}/plan`,
        { parentingNotes: parenting, financesNotes: finances, legalNotes: legal },
      );
      setRoom((prev) => (prev ? { ...prev, plan: response.plan } : prev));
      setPlanDirty(false);
    } catch {
      setNotice("Could not save the Family Plan. Please try again.");
    } finally {
      setSavingPlan(false);
    }
  };

  const checklist = ((room?.checklist as Row[] | undefined) || []).slice();
  const checklistBySection: Record<string, Row[]> = {
    parenting: [],
    finances: [],
    legal: [],
    general: [],
  };
  for (const item of checklist) {
    const section = asText(item.section) || "general";
    (checklistBySection[section] || checklistBySection.general).push(item);
  }

  const addChecklistItem = async (section: string) => {
    const label = (newItemText[section] || "").trim();
    if (!label) return;
    setAddingSection(section);
    try {
      const response = await api.post<Row>(
        `/member/family-room/${encodeURIComponent(profileId)}/checklist`,
        { section, label },
      );
      setRoom((prev) =>
        prev
          ? { ...prev, checklist: [...((prev.checklist as Row[]) || []), response.item] }
          : prev,
      );
      setNewItemText((prev) => ({ ...prev, [section]: "" }));
    } catch {
      setNotice("Could not add that checklist item.");
    } finally {
      setAddingSection(null);
    }
  };

  const toggleChecklistItem = async (item: Row) => {
    const itemId = item.id;
    const wasDone = Boolean(item.isDone);
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            checklist: ((prev.checklist as Row[]) || []).map((i) =>
              i.id === itemId ? { ...i, isDone: !wasDone } : i,
            ),
          }
        : prev,
    );
    try {
      await api.patch(
        `/member/family-room/checklist/${encodeURIComponent(asText(itemId))}`,
        { isDone: !wasDone },
      );
    } catch {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              checklist: ((prev.checklist as Row[]) || []).map((i) =>
                i.id === itemId ? { ...i, isDone: wasDone } : i,
              ),
            }
          : prev,
      );
      setNotice("Could not update that checklist item.");
    }
  };

  const deleteChecklistItem = async (item: Row) => {
    const itemId = item.id;
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            checklist: ((prev.checklist as Row[]) || []).filter((i) => i.id !== itemId),
          }
        : prev,
    );
    try {
      await api.delete(`/member/family-room/checklist/${encodeURIComponent(asText(itemId))}`);
    } catch {
      load();
    }
  };

  const signAgreement = async () => {
    if (!agreementFullName.trim()) return;
    setAgreementSigning(true);
    setAgreementNotice("");
    try {
      const data = await api.post<{ ok: true; agreement: Row }>(
        `/member/family-room/${encodeURIComponent(profileId)}/agreement/sign`,
        { fullName: agreementFullName.trim() },
      );
      setAgreement(data.agreement);
      setAgreementFullName("");
      setAgreementNotice("Signed.");
    } catch (err) {
      setAgreementNotice(
        err instanceof ApiError && err.status === 409
          ? "Complete every Family Plan section together before signing."
          : "Could not sign the agreement.",
      );
    } finally {
      setAgreementSigning(false);
    }
  };

  const uploadDocument = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setNotice("");
    try {
      const data = new FormData();
      data.append("file", file);
      const response = await api.upload<Row>(
        `/member/family-room/${encodeURIComponent(profileId)}/documents`,
        data,
      );
      setRoom((prev) =>
        prev
          ? { ...prev, documents: [response.document, ...((prev.documents as Row[]) || [])] }
          : prev,
      );
    } catch {
      setNotice("Could not upload that document.");
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (doc: Row) => {
    const docId = doc.id;
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            documents: ((prev.documents as Row[]) || []).filter((d) => d.id !== docId),
          }
        : prev,
    );
    try {
      await api.delete(`/member/family-room/documents/${encodeURIComponent(asText(docId))}`);
    } catch {
      setNotice("Could not remove that document.");
      load();
    }
  };

  const uploadPregnancyEntry = async (file: File | undefined) => {
    if (!file || !profileId) return;
    setPregnancyUploading(true);
    setNotice("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("category", pregnancyCategory);
      if (pregnancyNote.trim()) data.append("note", pregnancyNote.trim());
      const response = await api.upload<{ ok: true; entry: Row }>(
        `/member/family-room/${encodeURIComponent(profileId)}/pregnancy`,
        data,
      );
      setPregnancyEntries((prev) => [response.entry, ...prev]);
      setPregnancyNote("");
    } catch {
      setNotice("Could not upload that file to the Pregnancy Room.");
    } finally {
      setPregnancyUploading(false);
    }
  };

  const deletePregnancyEntry = async (entry: Row) => {
    const entryId = entry.id;
    setPregnancyEntries((prev) => prev.filter((e) => e.id !== entryId));
    try {
      await api.delete(`/member/family-room/pregnancy/${encodeURIComponent(asText(entryId))}`);
    } catch {
      setNotice("Could not remove that entry.");
      loadPregnancy();
    }
  };

  if (status === "loading") {
    return (
      <section className="access-card">
        <h1>Family Room</h1>
        <p>Loading…</p>
      </section>
    );
  }

  if (status === "needsPremium") {
    return (
      <section className="access-card">
        <h1>Family Room</h1>
        <p>
          The Family Plan, Shared Family Room and document tools are part of
          Family Builder Pro. Upgrade to plan your family together with your
          match.
        </p>
        <Link className="primary" to={`/${locale}/subscription`}>
          View Premium
        </Link>
      </section>
    );
  }

  if (status === "noMatch") {
    return (
      <section className="access-card">
        <h1>Family Room</h1>
        <p>
          You don't have an active match with this profile, so there's no
          shared Family Room here yet.
        </p>
        <Link className="secondary" to={`/${locale}/messages`}>
          Back to Messages
        </Link>
      </section>
    );
  }

  if (status === "error" || !room) {
    return (
      <section className="access-card">
        <h1>Family Room</h1>
        <p className="error">Could not load your Family Room. Please try again.</p>
      </section>
    );
  }

  const documents = (room.documents as Row[] | undefined) || [];

  return (
    <section className="family-room">
      <h1>Family Room</h1>
      {notice && <p className="error">{notice}</p>}

      <div className="list-card family-room-card">
        <h2>Family Plan</h2>
        <p>
          Keep parenting, finances and legal notes in one shared place - only
          you and your match can see this.
        </p>
        <label>
          Parenting
          <textarea
            rows={4}
            value={parenting}
            placeholder="How do you both picture day-to-day parenting?"
            onChange={(event) => {
              setParenting(event.target.value);
              setPlanDirty(true);
            }}
          />
        </label>
        <label>
          Finances
          <textarea
            rows={4}
            value={finances}
            placeholder="How will costs be shared and planned for?"
            onChange={(event) => {
              setFinances(event.target.value);
              setPlanDirty(true);
            }}
          />
        </label>
        <label>
          Legal
          <textarea
            rows={4}
            value={legal}
            placeholder="What legal steps or agreements do you need to look into?"
            onChange={(event) => {
              setLegal(event.target.value);
              setPlanDirty(true);
            }}
          />
        </label>
        <div className="plan-actions">
          <button
            className="primary"
            onClick={() => void savePlan()}
            disabled={!planDirty || savingPlan}
          >
            {savingPlan ? "Saving…" : "Save Family Plan"}
          </button>
        </div>
      </div>

      <div className="list-card family-room-card">
        <h2>Checklist</h2>
        {FAMILY_ROOM_SECTIONS.map((section) => (
          <div className="family-room-section" key={section}>
            <h3>{FAMILY_ROOM_SECTION_LABELS[section]}</h3>
            {checklistBySection[section].length === 0 ? (
              <p className="notice">No items yet.</p>
            ) : (
              <ul className="family-room-checklist">
                {checklistBySection[section].map((item) => (
                  <li key={asText(item.id)}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(item.isDone)}
                        onChange={() => void toggleChecklistItem(item)}
                      />
                      <span className={item.isDone ? "done" : ""}>{asText(item.label)}</span>
                    </label>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => void deleteChecklistItem(item)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="family-room-add-row"
              onSubmit={(event) => {
                event.preventDefault();
                void addChecklistItem(section);
              }}
            >
              <input
                value={newItemText[section] || ""}
                placeholder="Add an item…"
                onChange={(event) =>
                  setNewItemText((prev) => ({ ...prev, [section]: event.target.value }))
                }
              />
              <button className="secondary" disabled={addingSection === section}>
                Add
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="list-card family-room-card">
        <h2>Documents</h2>
        {documents.length === 0 ? (
          <p className="notice">No documents shared yet.</p>
        ) : (
          <ul className="family-room-documents">
            {documents.map((doc) => (
              <li key={asText(doc.id)}>
                <a href={asText(doc.contentUrl)} target="_blank" rel="noreferrer">
                  {asText(doc.displayName)}
                </a>
                <span>{formatFamilyRoomBytes(Number(doc.bytes) || 0)}</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => void deleteDocument(doc)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="attachment-control">
          {uploading ? "Uploading…" : "Upload a document"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={uploading}
            onChange={(event) => void uploadDocument(event.target.files?.[0])}
          />
        </label>
      </div>

      <div className="list-card family-room-card">
        <h2>Pregnancy Room</h2>
        <p>
          Keep lab results, ultrasounds and prescriptions in one shared,
          private place - free for any active match, no Premium needed.
        </p>
        {pregnancyEntries.length === 0 ? (
          <p className="notice">No entries yet.</p>
        ) : (
          <ul className="family-room-documents">
            {pregnancyEntries.map((entry) => (
              <li key={asText(entry.id)}>
                <a href={asText(entry.contentUrl)} target="_blank" rel="noreferrer">
                  {PREGNANCY_CATEGORY_LABELS[asText(entry.category)] || asText(entry.category)}
                  {entry.note ? ` - ${asText(entry.note)}` : ""}
                </a>
                <span>{formatFamilyRoomBytes(Number(entry.bytes) || 0)}</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => void deletePregnancyEntry(entry)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="pregnancy-upload-row">
          <select
            aria-label="Category"
            value={pregnancyCategory}
            onChange={(event) => setPregnancyCategory(event.target.value as typeof pregnancyCategory)}
          >
            <option value="lab_test">Lab result</option>
            <option value="ultrasound">Ultrasound</option>
            <option value="prescription">Prescription</option>
          </select>
          <input
            value={pregnancyNote}
            placeholder="Note (optional)"
            onChange={(event) => setPregnancyNote(event.target.value)}
          />
          <label className="attachment-control">
            {pregnancyUploading ? "Uploading…" : "Upload"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={pregnancyUploading}
              onChange={(event) => void uploadPregnancyEntry(event.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      <div className="list-card family-room-card">
        <h2>Co-Parenting Agreement</h2>
        <p>
          Once you've completed every Family Plan section together, either
          of you can sign - a good-faith mutual record of what you agreed
          on, not a legally binding e-signature.
        </p>
        {agreementStatus === "needsPremium" && (
          <p className="notice">
            The Co-Parenting Agreement is part of Family Builder Pro.{" "}
            <Link to={`/${locale}/subscription`}>View Premium</Link>
          </p>
        )}
        {agreementStatus === "error" && (
          <p className="error">Could not load your agreement.</p>
        )}
        {agreementStatus === "ok" && agreement && (
          <>
            {agreement.status === "SIGNED" ? (
              <div className="notice">
                <p>Signed by both of you on {asText(agreement.signedAt)}.</p>
                <p>
                  You: {asText(agreement.myFullName)} - Partner:{" "}
                  {asText(agreement.partnerFullName)}
                </p>
              </div>
            ) : (
              <>
                <p>
                  {asText(agreement.sectionsCompleteCount)} of{" "}
                  {asText(agreement.sectionsTotalCount)} sections complete by
                  both of you.
                </p>
                {agreement.mySigned ? (
                  <p className="notice">
                    You signed this agreement. Waiting for your partner to
                    sign their copy.
                  </p>
                ) : agreement.readyToSign ? (
                  <div className="member-form">
                    <label>
                      Type your full legal name to sign
                      <input
                        value={agreementFullName}
                        onChange={(event) => setAgreementFullName(event.target.value)}
                        placeholder="Full legal name"
                      />
                    </label>
                    <button
                      className="primary"
                      disabled={!agreementFullName.trim() || agreementSigning}
                      onClick={() => void signAgreement()}
                    >
                      {agreementSigning ? "Signing…" : "Sign agreement"}
                    </button>
                  </div>
                ) : (
                  <p className="notice">
                    Complete every Family Plan section together before you
                    can sign.
                  </p>
                )}
                {agreement.partnerSigned && (
                  <p className="notice">Your partner has already signed their copy.</p>
                )}
              </>
            )}
            {agreementNotice && (
              <p className={agreementNotice === "Signed." ? "notice" : "error"}>
                {agreementNotice}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

type AiAdvisorMessage = { role: "user" | "assistant"; text: string; at: string };

// AI Family Advisor ("ИИ консультант", backlog item 12) - mirrors
// mobile/src/screens/AiAdvisorScreen.tsx exactly: same endpoints
// (backend/main.py's member_ai_advisor_*()), same 402 ("needs Premium") /
// configured:false (ANTHROPIC_API_KEY not set on the server yet) states.
// The pricing page already lists "AI Family Advisor" as a Pro-tier
// feature (see PRICING_TEXT below) - this is the actual feature behind
// that checkmark, which did not exist on the website before (audit
// 2026-09-13: site-vs-app-audit-2026-09-13.docx, item 1).
function AiAdvisor({ session }: { session: Session }) {
  const locale = localeOf();
  const [status, setStatus] = useState<"loading" | "ok" | "needsPremium" | "error">("loading");
  const [configured, setConfigured] = useState(true);
  const [messages, setMessages] = useState<AiAdvisorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [weeklyInsight, setWeeklyInsight] = useState("");
  const [weeklyInsightStatus, setWeeklyInsightStatus] = useState<"idle" | "loading" | "ok" | "needsPremium" | "error">("idle");

  const load = () => {
    if (!session) return;
    setStatus("loading");
    api
      .get<{ ok: true; configured: boolean; messages: AiAdvisorMessage[] }>("/member/ai-advisor/messages")
      .then((data) => {
        setMessages(data.messages);
        setConfigured(data.configured);
        setStatus("ok");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) setStatus("needsPremium");
        else setStatus("error");
      });
  };
  useEffect(load, [session]);

  const loadWeeklyInsight = () => {
    if (!session) return;
    setWeeklyInsightStatus("loading");
    api
      .get<{ ok: true; insight: string }>(`/member/ai-advisor/weekly-insight?locale=${encodeURIComponent(locale)}`)
      .then((data) => {
        setWeeklyInsight(data.insight);
        setWeeklyInsightStatus("ok");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) setWeeklyInsightStatus("needsPremium");
        else setWeeklyInsightStatus("error");
      });
  };
  useEffect(loadWeeklyInsight, [session]);

  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    setNotice("");
    const optimistic: AiAdvisorMessage = { role: "user", text, at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await api.post<{ ok: true; reply: string; messages: AiAdvisorMessage[] }>(
        "/member/ai-advisor/messages",
        { text },
      );
      setMessages(res.messages);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m !== optimistic));
      setDraft(text);
      if (err instanceof ApiError && err.status === 402) setStatus("needsPremium");
      else setNotice("Could not send that message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const clear = async () => {
    try {
      await api.delete("/member/ai-advisor/messages");
      setMessages([]);
    } catch {
      // Silent - same as mobile: worst case the old history just stays visible.
    }
  };

  if (status === "loading") {
    return (
      <section className="access-card">
        <h1>AI Family Advisor</h1>
        <p>Loading…</p>
      </section>
    );
  }

  if (status === "needsPremium") {
    return (
      <section className="access-card">
        <h1>AI Family Advisor</h1>
        <p>
          The AI Family Advisor is available with Family Builder or Pro. Upgrade to ask
          questions about the process, terminology, or how to use
          LetsBeParents at any time.
        </p>
        <Link className="primary" to={`/${locale}/subscription`}>
          View Premium
        </Link>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="access-card">
        <h1>AI Family Advisor</h1>
        <p className="error">Could not load the AI Family Advisor. Please try again.</p>
      </section>
    );
  }

  return (
    <section className="advisor-page">
      {weeklyInsightStatus !== "idle" && weeklyInsightStatus !== "needsPremium" && (
        <div className="list-card advisor-card weekly-insight-card">
          <h2>Your weekly check-in</h2>
          {weeklyInsightStatus === "loading" && <p className="notice">Loading…</p>}
          {weeklyInsightStatus === "error" && (
            <p className="error">Could not load your weekly check-in.</p>
          )}
          {weeklyInsightStatus === "ok" && <p>{weeklyInsight}</p>}
        </div>
      )}
      <div className="list-card advisor-card">
        <div className="message-title">
          <h1>AI Family Advisor</h1>
          <button type="button" className="secondary" onClick={() => void clear()}>
            Clear conversation
          </button>
        </div>
        <p>
          Ask about the process, terminology, or how to use LetsBeParents -
          I'll help you find the right next step. This isn't medical, legal
          or financial advice.
        </p>
        {!configured && (
          <p className="error">The AI Family Advisor isn't set up yet - please check back soon.</p>
        )}
        {notice && <p className="error">{notice}</p>}
        <div className="message-list advisor-list">
          {messages.length === 0 ? (
            <p className="notice">Say hello to get started.</p>
          ) : (
            messages.map((message, index) => (
              <div
                key={`${message.role}-${message.at}-${index}`}
                className={`message-bubble ${message.role === "user" ? "advisor-bubble-user" : "advisor-bubble-assistant"}`}
              >
                <span>{message.text}</span>
              </div>
            ))
          )}
          {sending && <p className="notice">Typing…</p>}
        </div>
        <form onSubmit={(event) => void send(event)}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask the Family Advisor…"
            disabled={!configured}
          />
          <button
            className="primary"
            disabled={!draft.trim() || sending || !configured}
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </section>
  );
}

// "Compatibility Score & Why you match" (Family Builder) / "Detailed
// Compatibility Report" (Family Builder Pro) - see backend/main.py's
// COMPATIBILITY SCORE section. Mirrors mobile's CompatibilityAnswersScreen:
// free for everyone to fill in (the Premium gate is only on viewing a
// two-sided report with a match, see CompatibilityReport below). Reached
// from the account nav (MemberLinks) since it does not need a match.
function CompatibilityAnswers({ session }: { session: Session }) {
  const locale = localeOf();
  const [questions, setQuestions] = useState<Row[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!session) return;
    Promise.all([
      api.get<Row>("/member/compatibility/questions"),
      api.get<Row>("/member/compatibility/answers"),
    ])
      .then(([q, a]) => {
        setQuestions((q.items as Row[]) || []);
        setAnswers((a.answers as Record<string, string>) || {});
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [session]);

  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;

  const answeredCount = Object.keys(answers).length;

  const save = async () => {
    setSaving(true);
    setNotice("");
    try {
      await api.post<Row>("/member/compatibility/answers", { answers });
      setNotice("saved");
    } catch {
      setNotice("error");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <section className="access-card">
        <h1>Compatibility profile</h1>
        <p>Loading...</p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="access-card">
        <h1>Compatibility profile</h1>
        <p className="error">Could not load the compatibility questions. Please try again.</p>
      </section>
    );
  }

  return (
    <section className="compatibility-answers">
      <h1>Compatibility profile</h1>
      <p>
        Answer a few questions about parenting, involvement, timeline and
        boundaries. When you match with someone, you will both see where you
        align and what is worth discussing - no percentage, no pass or fail.
      </p>
      <p className="compatibility-progress">
        {answeredCount} of {questions.length} answered
      </p>
      {notice === "saved" && <p className="notice">Saved.</p>}
      {notice === "error" && <p className="error">Could not save your answers. Please try again.</p>}

      {questions.map((question) => {
        const qid = asText(question.id);
        const options = (question.options as Row[]) || [];
        return (
          <div className="list-card compatibility-question-card" key={qid}>
            <h3>{asText(question.prompt)}</h3>
            {options.map((option) => {
              const key = asText(option.key);
              const selected = answers[qid] === key;
              return (
                <button
                  type="button"
                  key={key}
                  className={`compatibility-option${selected ? " compatibility-option-selected" : ""}`}
                  onClick={() => setAnswers((prev) => ({ ...prev, [qid]: key }))}
                >
                  <span className="compatibility-radio" />
                  {asText(option.label)}
                </button>
              );
            })}
          </div>
        );
      })}

      <div className="plan-actions">
        <button className="primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save answers"}
        </button>
      </div>
    </section>
  );
}

// Two-sided "Compatibility Score & Why you match" / "Detailed
// Compatibility Report" - mirrors mobile's CompatibilityReportScreen.
// Gating mirrors FamilyRoom exactly: Premium (402) and an active match
// (404) are both server-checked and rendered here, not guessed
// client-side. Reached from the Messages page next to the Family Room
// link, using the same conversation other_profile_id.
function CompatibilityReport({ session }: { session: Session }) {
  const locale = localeOf();
  const { profileId = "" } = useParams();
  const [status, setStatus] = useState<
    "loading" | "ok" | "needsPremium" | "noMatch" | "error"
  >("loading");
  const [report, setReport] = useState<Row | null>(null);

  useEffect(() => {
    if (!session || !profileId) return;
    setStatus("loading");
    api
      .get<Row>(`/member/compatibility-report/${encodeURIComponent(profileId)}`)
      .then((data) => {
        setReport(data);
        setStatus("ok");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) setStatus("needsPremium");
        else if (err instanceof ApiError && err.status === 404) setStatus("noMatch");
        else setStatus("error");
      });
  }, [session, profileId]);

  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;

  if (status === "loading") {
    return (
      <section className="access-card">
        <h1>Compatibility Report</h1>
        <p>Loading...</p>
      </section>
    );
  }

  if (status === "needsPremium") {
    return (
      <section className="access-card">
        <h1>Compatibility Report</h1>
        <p>
          The Compatibility Report is part of Family Builder Pro. Upgrade to
          see where you and your match align.
        </p>
        <Link className="primary" to={`/${locale}/subscription`}>
          View Premium
        </Link>
      </section>
    );
  }

  if (status === "noMatch") {
    return (
      <section className="access-card">
        <h1>Compatibility Report</h1>
        <p>
          You do not have an active match with this profile, so there is no
          shared report here yet.
        </p>
        <Link className="secondary" to={`/${locale}/messages`}>
          Back to Messages
        </Link>
      </section>
    );
  }

  if (status === "error" || !report) {
    return (
      <section className="access-card">
        <h1>Compatibility Report</h1>
        <p className="error">Could not load the Compatibility Report. Please try again.</p>
      </section>
    );
  }

  if (report.status === "incomplete") {
    const youCompleted = Boolean(report.youCompleted);
    return (
      <section className="access-card">
        <h1>Compatibility Report</h1>
        <p>
          {youCompleted
            ? "Your match has not filled in their compatibility profile yet. Check back once they have."
            : "Fill in your compatibility profile first, then check back once your match has too."}
        </p>
        {!youCompleted && (
          <Link className="primary" to={`/${locale}/compatibility`}>
            Fill in your compatibility profile
          </Link>
        )}
      </section>
    );
  }

  const strongest = (report.strongest as string[]) || [];
  const worthDiscussing = (report.worthDiscussing as string[]) || [];
  const talkingPoints = (report.talkingPoints as string[]) || [];

  return (
    <section className="compatibility-report">
      <h1>Compatibility Report</h1>

      <div className="list-card compatibility-report-card">
        <h2>Your strongest areas</h2>
        {strongest.length === 0 ? (
          <p className="notice">Not enough matching answers yet to call out a strongest area.</p>
        ) : (
          <div className="compatibility-pill-row">
            {strongest.map((label) => (
              <span className="compatibility-pill" key={label}>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="list-card compatibility-report-card">
        <h2>Worth discussing</h2>
        {worthDiscussing.length === 0 ? (
          <p className="notice">Nothing stands out here - you are aligned everywhere you have both answered.</p>
        ) : (
          <div className="compatibility-pill-row">
            {worthDiscussing.map((label) => (
              <span className="compatibility-pill compatibility-pill-muted" key={label}>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {talkingPoints.length > 0 && (
        <div className="list-card compatibility-report-card">
          <h2>Questions to talk through together</h2>
          <ul className="compatibility-talking-points">
            {talkingPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </div>
      )}
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
        features: ["Compatibility Score & Why you match", "AI Family Advisor", "Advanced family filters", "See who liked you", "Video & audio calls", "15 likes/day, 5 reach-outs/day", "Priority in discovery"],
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
      { name: "Stand out & stay safe", rows: [
        { label: "Profile Boost", values: ["check", "check", "check"] },
        { label: "Invite & earn a Boost", values: ["check", "check", "check"] },
        { label: "Safety Check-In", values: ["check", "check", "check"] },
        { label: "Video Verification badge", values: ["check", "check", "check"] },
      ] },
      { name: "Connect & communicate", rows: [
        { label: "Video & audio calls", values: ["", "check", "check"] },
        { label: "Private photos", values: ["", "check", "check"] },
        { label: "Incognito mode", values: ["", "check", "check"] },
        { label: "AI-drafted message starters", values: ["", "check", "check"] },
      ] },
      { name: "Build your family", rows: [
        { label: "Family Plan (shared)", values: ["", "Limited", "check"] },
        { label: "AI Family Advisor", values: ["", "check", "check"] },
        { label: "Weekly AI Advisor insight", values: ["", "check", "check"] },
        { label: "Co-Parenting Agreement sign-off", values: ["", "", "check"] },
        { label: "Community groups & discussions", values: ["", "", "check"] },
        { label: "Detailed Compatibility Report", values: ["", "", "check"] },
        { label: "Document & checklist tools", values: ["", "", "check"] },
        { label: "Priority support", values: ["", "", "check"] },
      ] },
    ],
    oneTime: {
      eyebrow: "ONE-TIME PURCHASES",
      title: "Need just one boost? Buy it once.",
      intro: "Prefer not to subscribe? These extras are available as one-time purchases in the LetsBeParents app (iOS - Android coming soon). Prices shown are approximate and set in the app.",
      items: [
        { name: "Boost", body: "Get shown more often in Browse for 24 hours.", price: "≈ €3.99" },
        { name: "Superlike", body: "Stand out immediately - skips the daily like limit.", price: "≈ €1.99" },
        { name: "Rewind", body: "Undo your last swipe.", price: "≈ €1.99" },
        { name: "See who liked you (48h)", body: "Reveal everyone who's liked you for 48 hours.", price: "≈ €4.99–5.99" },
        { name: "Full Compatibility Report", body: "Unlock the detailed report for one match.", price: "≈ €2.99" },
        { name: "+10 extra likes", body: "Get 10 extra likes to use today.", price: "≈ €2.99" },
      ],
      note: "Purchases are made in the mobile app, not on this website.",
    },
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
        features: ["Оценка совместимости и «почему вы подходите»", "AI Family Advisor", "Расширенные семейные фильтры", "Кто лайкнул вас", "Видео- и аудиозвонки", "15 лайков/день, 5 обращений/день", "Приоритет в поиске"],
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
      { name: "Заметность и безопасность", rows: [
        { label: "Boost профиля", values: ["check", "check", "check"] },
        { label: "Приглашай и получай Boost", values: ["check", "check", "check"] },
        { label: "Safety Check-In", values: ["check", "check", "check"] },
        { label: "Значок Video Verification", values: ["check", "check", "check"] },
      ] },
      { name: "Связь и общение", rows: [
        { label: "Видео- и аудиозвонки", values: ["", "check", "check"] },
        { label: "Приватные фото", values: ["", "check", "check"] },
        { label: "Режим инкогнито", values: ["", "check", "check"] },
        { label: "AI-подсказки для первого сообщения", values: ["", "check", "check"] },
      ] },
      { name: "Постройте свою семью", rows: [
        { label: "Семейный план (общий)", values: ["", "Ограниченно", "check"] },
        { label: "AI Family Advisor", values: ["", "check", "check"] },
        { label: "Еженедельный совет от AI Advisor", values: ["", "check", "check"] },
        { label: "Подписание Co-Parenting Agreement", values: ["", "", "check"] },
        { label: "Группы и обсуждения Community", values: ["", "", "check"] },
        { label: "Подробный отчёт о совместимости", values: ["", "", "check"] },
        { label: "Документы и чек-листы", values: ["", "", "check"] },
        { label: "Приоритетная поддержка", values: ["", "", "check"] },
      ] },
    ],
    oneTime: {
      eyebrow: "РАЗОВЫЕ ПОКУПКИ",
      title: "Нужен только один буст? Купите один раз.",
      intro: "Не хотите оформлять подписку? Эти дополнения доступны как разовые покупки в приложении LetsBeParents (iOS - Android скоро). Указанные цены приблизительные и задаются в приложении.",
      items: [
        { name: "Буст", body: "Ваша анкета будет чаще показываться в Обзоре в течение 24 часов.", price: "≈ €3.99" },
        { name: "Суперлайк", body: "Выделитесь сразу - лайк не учитывается в дневном лимите.", price: "≈ €1.99" },
        { name: "Rewind", body: "Отмените последний свайп.", price: "≈ €1.99" },
        { name: "Кто вас лайкнул (48 часов)", body: "Откройте всех, кто вас лайкнул, на 48 часов.", price: "≈ €4.99–5.99" },
        { name: "Полный отчёт совместимости", body: "Откройте подробный отчёт совместимости для одного мэтча.", price: "≈ €2.99" },
        { name: "+10 лайков", body: "Получите 10 дополнительных лайков на сегодня.", price: "≈ €2.99" },
      ],
      note: "Покупки совершаются в мобильном приложении, а не на этом сайте.",
    },
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
        features: ["Puntuación de compatibilidad y «por qué haces match»", "AI Family Advisor", "Filtros familiares avanzados", "Ver quién te dio like", "Videollamadas y llamadas de audio", "15 likes/día, 5 contactos/día", "Prioridad en el descubrimiento"],
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
      { name: "Destaca y mantente seguro", rows: [
        { label: "Boost de perfil", values: ["check", "check", "check"] },
        { label: "Invita y gana un Boost", values: ["check", "check", "check"] },
        { label: "Safety Check-In", values: ["check", "check", "check"] },
        { label: "Insignia Video Verification", values: ["check", "check", "check"] },
      ] },
      { name: "Conectar y comunicarse", rows: [
        { label: "Videollamadas y llamadas de audio", values: ["", "check", "check"] },
        { label: "Fotos privadas", values: ["", "check", "check"] },
        { label: "Modo incógnito", values: ["", "check", "check"] },
        { label: "Mensajes iniciales sugeridos por IA", values: ["", "check", "check"] },
      ] },
      { name: "Construye tu familia", rows: [
        { label: "Plan familiar (compartido)", values: ["", "Limitado", "check"] },
        { label: "AI Family Advisor", values: ["", "check", "check"] },
        { label: "Consejo semanal del AI Advisor", values: ["", "check", "check"] },
        { label: "Firma del Co-Parenting Agreement", values: ["", "", "check"] },
        { label: "Grupos y debates de Community", values: ["", "", "check"] },
        { label: "Informe de compatibilidad detallado", values: ["", "", "check"] },
        { label: "Documentos y listas de verificación", values: ["", "", "check"] },
        { label: "Soporte prioritario", values: ["", "", "check"] },
      ] },
    ],
    oneTime: {
      eyebrow: "COMPRAS ÚNICAS",
      title: "¿Solo necesitas un boost? Cómpralo una vez.",
      intro: "¿Prefieres no suscribirte? Estos extras están disponibles como compras únicas en la app de LetsBeParents (iOS - Android próximamente). Los precios mostrados son aproximados y se establecen en la app.",
      items: [
        { name: "Boost", body: "Aparece con más frecuencia en Explorar durante 24 horas.", price: "≈ €3.99" },
        { name: "Superlike", body: "Destaca al instante - tu like no cuenta para el límite diario.", price: "≈ €1.99" },
        { name: "Rewind", body: "Deshaz tu último swipe.", price: "≈ €1.99" },
        { name: "Ve quién te dio like (48h)", body: "Descubre a todos los que te dieron like durante 48 horas.", price: "≈ €4.99–5.99" },
        { name: "Informe de compatibilidad completo", body: "Desbloquea el informe detallado para un match.", price: "≈ €2.99" },
        { name: "+10 likes extra", body: "Obtén 10 likes extra para usar hoy.", price: "≈ €2.99" },
      ],
      note: "Las compras se realizan en la app móvil, no en este sitio web.",
    },
  },
  pt: {
    eyebrow: "PREÇOS",
    title: "Encontre a pessoa certa para construir uma família.",
    intro: "Matches melhores. Compatibilidade mais profunda. Mais confiança. Comece grátis e faça upgrade quando estiver pronto para ir mais fundo.",
    plans: [
      {
        key: "explore", name: "Explore", price: "€0", priceNote: "Grátis para sempre", altNote: "",
        tagline: "Crie o seu perfil e comece a descobrir.",
        features: ["Perfil completo e descoberta básica", "3 likes por dia", "Compatibilidade básica"],
        cta: "Comece grátis", badge: "",
      },
      {
        key: "familyBuilder", name: "Family Builder", price: "€24.99", priceNote: "por mês, faturação mensal",
        altNote: "ou €49.99 por 3 meses - €16.66/mês, poupe 33%",
        tagline: "Para quem está pronto para procurar com intenção.",
        features: ["Pontuação de Compatibilidade e por que combinam", "AI Family Advisor", "Filtros familiares avançados", "Veja quem gostou de si", "Chamadas de vídeo e áudio", "15 likes/dia, 5 contactos/dia", "Prioridade na descoberta"],
        cta: "Começar com Family Builder", badge: "Melhor valor",
      },
      {
        key: "familyBuilderPro", name: "Family Builder Pro", price: "€29.99", priceNote: "por mês", altNote: "",
        tagline: "Tudo do Family Builder, com acompanhamento mais aprofundado.",
        features: ["Tudo do Family Builder", "AI Family Advisor", "Relatório de Compatibilidade detalhado", "Family Plan e Sala Familiar Partilhada", "Ferramentas de documentos e listas de verificação", "Suporte prioritário"],
        cta: "Passar para o Pro", badge: "",
      },
    ],
    footnote: "Preços apresentados em EUR e podem variar consoante a região. Cancele quando quiser. O Premium requer verificação de perfil.",
    faqLinkLabel: "Veja como verificamos os membros",
    compareTitle: "Compare todas as funcionalidades",
    compareSub: "Veja exatamente o que está incluído em cada plano.",
    matrixGroups: [
      { name: "Encontre melhores matches", rows: [
        { label: "Likes diários", values: ["3", "15", "Ilimitado"] },
        { label: "Ser o primeiro a contactar", values: ["", "5/dia", "Ilimitado"] },
        { label: "Filtros familiares avançados", values: ["", "check", "check"] },
        { label: "Prioridade no catálogo", values: ["", "check", "check"] },
        { label: "Veja quem gostou de si", values: ["", "check", "check"] },
        { label: "Veja quem visitou o seu perfil", values: ["", "check", "check"] },
      ] },
      { name: "Compreenda a compatibilidade", rows: [
        { label: "Pontuação de Compatibilidade", values: ["", "check", "check"] },
        { label: "Por que combinam", values: ["", "check", "check"] },
        { label: "Informações de perfil ampliadas", values: ["", "check", "check"] },
        { label: "Informações de verificação", values: ["", "check", "check"] },
      ] },
      { name: "Destaque-se e mantenha-se seguro", rows: [
        { label: "Boost de perfil", values: ["check", "check", "check"] },
        { label: "Convide e ganhe um Boost", values: ["check", "check", "check"] },
        { label: "Safety Check-In", values: ["check", "check", "check"] },
        { label: "Selo de Video Verification", values: ["check", "check", "check"] },
      ] },
      { name: "Conecte-se e comunique", rows: [
        { label: "Chamadas de vídeo e áudio", values: ["", "check", "check"] },
        { label: "Fotos privadas", values: ["", "check", "check"] },
        { label: "Modo incógnito", values: ["", "check", "check"] },
        { label: "Sugestões de mensagens com IA", values: ["", "check", "check"] },
      ] },
      { name: "Construa a sua família", rows: [
        { label: "Family Plan (partilhado)", values: ["", "Limitado", "check"] },
        { label: "AI Family Advisor", values: ["", "check", "check"] },
        { label: "Análise semanal do AI Advisor", values: ["", "check", "check"] },
        { label: "Assinatura do Co-Parenting Agreement", values: ["", "", "check"] },
        { label: "Grupos e discussões da comunidade", values: ["", "", "check"] },
        { label: "Relatório de Compatibilidade detalhado", values: ["", "", "check"] },
        { label: "Ferramentas de documentos e listas de verificação", values: ["", "", "check"] },
        { label: "Suporte prioritário", values: ["", "", "check"] },
      ] },
    ],
    oneTime: {
      eyebrow: "COMPRAS ÚNICAS",
      title: "Só precisa de um boost? Compre uma vez.",
      intro: "Prefere não assinar? Estes extras estão disponíveis como compras únicas na app LetsBeParents (iOS - Android brevemente). Os preços apresentados são aproximados e definidos na app.",
      items: [
        { name: "Boost", body: "Apareça com mais frequência na navegação durante 24 horas.", price: "≈ 3,99 €" },
        { name: "Superlike", body: "Destaque-se imediatamente - ignora o limite diário de likes.", price: "≈ 1,99 €" },
        { name: "Rewind", body: "Desfaça o seu último swipe.", price: "≈ 1,99 €" },
        { name: "Ver quem gostou de você (48h)", body: "Revele todas as pessoas que gostaram de você durante 48 horas.", price: "≈ 4,99–5,99 €" },
        { name: "Relatório de Compatibilidade Completo", body: "Desbloqueie o relatório detalhado de um match.", price: "≈ 2,99 €" },
        { name: "+10 likes extra", body: "Receba 10 likes extra para usar hoje.", price: "≈ 2,99 €" },
      ],
      note: "As compras são feitas na app, não neste site.",
    },
  },
  fr: {
    eyebrow: "TARIFS",
    title: "Trouvez la bonne personne pour construire une famille.",
    intro: "De meilleurs matchs. Une compatibilité plus profonde. Plus de confiance. Commencez gratuitement, passez à un forfait supérieur quand vous êtes prêt à aller plus loin.",
    plans: [
      {
        key: "explore", name: "Explore", price: "€0", priceNote: "Gratuit pour toujours", altNote: "",
        tagline: "Créez votre profil et commencez à découvrir.",
        features: ["Profil complet et découverte de base", "3 likes par jour", "Mise en relation de base"],
        cta: "Commencer gratuitement", badge: "",
      },
      {
        key: "familyBuilder", name: "Family Builder", price: "€24.99", priceNote: "par mois, facturation mensuelle",
        altNote: "ou €49.99 pour 3 mois - €16.66/mois, économisez 33%",
        tagline: "Pour les membres prêts à matcher avec intention.",
        features: ["Score de compatibilité et pourquoi vous matchez", "AI Family Advisor", "Filtres familiaux avancés", "Voir qui vous a liké", "Appels vidéo et audio", "15 likes/jour, 5 prises de contact/jour", "Priorité dans la découverte"],
        cta: "Choisir Family Builder", badge: "Meilleur rapport qualité-prix",
      },
      {
        key: "familyBuilderPro", name: "Family Builder Pro", price: "€29.99", priceNote: "par mois", altNote: "",
        tagline: "Tout Family Builder, avec un accompagnement plus approfondi.",
        features: ["Tout Family Builder", "AI Family Advisor", "Rapport de compatibilité détaillé", "Family Plan et Espace Familial Partagé", "Outils de documents et listes de vérification", "Support prioritaire"],
        cta: "Passer au Pro", badge: "",
      },
    ],
    footnote: "Prix affichés en EUR, pouvant varier selon la région. Annulation à tout moment. Premium nécessite la vérification du profil.",
    faqLinkLabel: "Découvrez comment nous vérifions les membres",
    compareTitle: "Comparez toutes les fonctionnalités",
    compareSub: "Découvrez exactement ce qui est inclus dans chaque forfait.",
    matrixGroups: [
      { name: "Mieux matcher", rows: [
        { label: "Likes quotidiens", values: ["3", "15", "Illimité"] },
        { label: "Prendre contact en premier", values: ["", "5/jour", "Illimité"] },
        { label: "Filtres familiaux avancés", values: ["", "check", "check"] },
        { label: "Priorité dans le catalogue", values: ["", "check", "check"] },
        { label: "Voir qui vous a liké", values: ["", "check", "check"] },
        { label: "Voir les visiteurs du profil", values: ["", "check", "check"] },
      ] },
      { name: "Comprendre la compatibilité", rows: [
        { label: "Score de compatibilité", values: ["", "check", "check"] },
        { label: "Pourquoi vous matchez", values: ["", "check", "check"] },
        { label: "Informations de profil étendues", values: ["", "check", "check"] },
        { label: "Informations de vérification", values: ["", "check", "check"] },
      ] },
      { name: "Se démarquer et rester en sécurité", rows: [
        { label: "Boost de profil", values: ["check", "check", "check"] },
        { label: "Invitez et gagnez un Boost", values: ["check", "check", "check"] },
        { label: "Safety Check-In", values: ["check", "check", "check"] },
        { label: "Badge Video Verification", values: ["check", "check", "check"] },
      ] },
      { name: "Se connecter et communiquer", rows: [
        { label: "Appels vidéo et audio", values: ["", "check", "check"] },
        { label: "Photos privées", values: ["", "check", "check"] },
        { label: "Mode incognito", values: ["", "check", "check"] },
        { label: "Messages de démarrage suggérés par l'IA", values: ["", "check", "check"] },
      ] },
      { name: "Construisez votre famille", rows: [
        { label: "Family Plan (partagé)", values: ["", "Limité", "check"] },
        { label: "AI Family Advisor", values: ["", "check", "check"] },
        { label: "Conseil hebdomadaire de l'AI Advisor", values: ["", "check", "check"] },
        { label: "Signature du Co-Parenting Agreement", values: ["", "", "check"] },
        { label: "Groupes et discussions communautaires", values: ["", "", "check"] },
        { label: "Rapport de compatibilité détaillé", values: ["", "", "check"] },
        { label: "Outils de documents et listes de vérification", values: ["", "", "check"] },
        { label: "Support prioritaire", values: ["", "", "check"] },
      ] },
    ],
    oneTime: {
      eyebrow: "ACHATS UNIQUES",
      title: "Besoin d'un seul boost ? Achetez-le une seule fois.",
      intro: "Vous préférez ne pas vous abonner ? Ces options sont disponibles en achat unique dans l'application LetsBeParents (iOS - Android bientôt disponible). Les prix indiqués sont approximatifs et définis dans l'application.",
      items: [
        { name: "Boost", body: "Apparaissez plus souvent lors de la navigation, pendant 24 heures.", price: "≈ 3,99 €" },
        { name: "Superlike", body: "Démarquez-vous immédiatement - passe outre la limite quotidienne de likes.", price: "≈ 1,99 €" },
        { name: "Rewind", body: "Annulez votre dernier swipe.", price: "≈ 1,99 €" },
        { name: "Voir qui vous a liké (48h)", body: "Révélez toutes les personnes qui vous ont liké(e) pendant 48 heures.", price: "≈ 4,99–5,99 €" },
        { name: "Rapport de compatibilité complet", body: "Débloquez le rapport détaillé pour un match.", price: "≈ 2,99 €" },
        { name: "+10 likes supplémentaires", body: "Obtenez 10 likes supplémentaires à utiliser aujourd'hui.", price: "≈ 2,99 €" },
      ],
      note: "Les achats se font dans l'application mobile, pas sur ce site.",
    },
  },
  de: {
    eyebrow: "PREISE",
    title: "Finden Sie die richtige Person, um eine Familie zu gründen.",
    intro: "Bessere Matches. Tiefere Kompatibilität. Mehr Sicherheit. Starten Sie kostenlos und upgraden Sie, wenn Sie bereit für mehr sind.",
    plans: [
      {
        key: "explore", name: "Explore", price: "€0", priceNote: "Für immer kostenlos", altNote: "",
        tagline: "Erstellen Sie Ihr Profil und beginnen Sie zu entdecken.",
        features: ["Vollständiges Profil & einfache Entdeckung", "3 Likes pro Tag", "Einfaches Matching"],
        cta: "Kostenlos starten", badge: "",
      },
      {
        key: "familyBuilder", name: "Family Builder", price: "€24.99", priceNote: "pro Monat, monatliche Abrechnung",
        altNote: "oder €49.99 für 3 Monate - €16.66/Monat, 33 % sparen",
        tagline: "Für Mitglieder, die gezielt matchen möchten.",
        features: ["Kompatibilitäts-Score & warum ihr zueinander passt", "AI Family Advisor", "Erweiterte Familienfilter", "Sehen, wer Sie geliked hat", "Video- und Audioanrufe", "15 Likes/Tag, 5 Kontaktaufnahmen/Tag", "Priorität in der Entdeckung"],
        cta: "Family Builder starten", badge: "Bester Wert",
      },
      {
        key: "familyBuilderPro", name: "Family Builder Pro", price: "€29.99", priceNote: "pro Monat", altNote: "",
        tagline: "Alles aus Family Builder, plus tiefere Begleitung.",
        features: ["Alles aus Family Builder", "AI Family Advisor", "Detaillierter Kompatibilitätsbericht", "Family Plan & gemeinsamer Familienraum", "Dokument- & Checklisten-Tools", "Prioritäts-Support"],
        cta: "Zu Pro wechseln", badge: "",
      },
    ],
    footnote: "Preise in EUR angegeben und können je nach Region abweichen. Jederzeit kündbar. Premium erfordert eine Profilverifizierung.",
    faqLinkLabel: "So verifizieren wir Mitglieder",
    compareTitle: "Alle Funktionen vergleichen",
    compareSub: "Sehen Sie genau, was in jedem Plan enthalten ist.",
    matrixGroups: [
      { name: "Besser matchen", rows: [
        { label: "Likes pro Tag", values: ["3", "15", "Unbegrenzt"] },
        { label: "Zuerst Kontakt aufnehmen", values: ["", "5/Tag", "Unbegrenzt"] },
        { label: "Erweiterte Familienfilter", values: ["", "check", "check"] },
        { label: "Priorität im Katalog", values: ["", "check", "check"] },
        { label: "Sehen, wer Sie geliked hat", values: ["", "check", "check"] },
        { label: "Profilbesucher sehen", values: ["", "check", "check"] },
      ] },
      { name: "Kompatibilität verstehen", rows: [
        { label: "Kompatibilitäts-Score", values: ["", "check", "check"] },
        { label: "Warum ihr zueinander passt", values: ["", "check", "check"] },
        { label: "Erweiterte Profilinformationen", values: ["", "check", "check"] },
        { label: "Verifizierungsinformationen", values: ["", "check", "check"] },
      ] },
      { name: "Auffallen & sicher bleiben", rows: [
        { label: "Profil-Boost", values: ["check", "check", "check"] },
        { label: "Einladen & einen Boost erhalten", values: ["check", "check", "check"] },
        { label: "Safety Check-In", values: ["check", "check", "check"] },
        { label: "Video-Verification-Abzeichen", values: ["check", "check", "check"] },
      ] },
      { name: "Verbinden & kommunizieren", rows: [
        { label: "Video- und Audioanrufe", values: ["", "check", "check"] },
        { label: "Private Fotos", values: ["", "check", "check"] },
        { label: "Inkognito-Modus", values: ["", "check", "check"] },
        { label: "KI-vorgeschlagene Gesprächseinstiege", values: ["", "check", "check"] },
      ] },
      { name: "Bauen Sie Ihre Familie auf", rows: [
        { label: "Family Plan (gemeinsam)", values: ["", "Eingeschränkt", "check"] },
        { label: "AI Family Advisor", values: ["", "check", "check"] },
        { label: "Wöchentliche Einblicke des AI Advisor", values: ["", "check", "check"] },
        { label: "Unterzeichnung der Co-Parenting Agreement", values: ["", "", "check"] },
        { label: "Community-Gruppen & Diskussionen", values: ["", "", "check"] },
        { label: "Detaillierter Kompatibilitätsbericht", values: ["", "", "check"] },
        { label: "Dokument- & Checklisten-Tools", values: ["", "", "check"] },
        { label: "Prioritäts-Support", values: ["", "", "check"] },
      ] },
    ],
    oneTime: {
      eyebrow: "EINMALKÄUFE",
      title: "Brauchst du nur einen Boost? Einmal kaufen.",
      intro: "Kein Abo gewünscht? Diese Extras sind als Einmalkäufe in der LetsBeParents App erhältlich (iOS - Android folgt in Kürze). Die angezeigten Preise sind ungefähre Richtwerte und werden in der App festgelegt.",
      items: [
        { name: "Boost", body: "Du wirst beim Stöbern 24 Stunden lang häufiger angezeigt.", price: "≈ 3,99 €" },
        { name: "Superlike", body: "Falle sofort auf - umgeht das tägliche Like-Limit.", price: "≈ 1,99 €" },
        { name: "Rewind", body: "Mache deinen letzten Swipe rückgängig.", price: "≈ 1,99 €" },
        { name: "Wer hat dich geliked? (48 Std.)", body: "Zeigt dir 48 Stunden lang alle, die dich geliked haben.", price: "≈ 4,99–5,99 €" },
        { name: "Vollständiger Kompatibilitätsbericht", body: "Schalte den detaillierten Bericht für ein Match frei.", price: "≈ 2,99 €" },
        { name: "+10 zusätzliche Likes", body: "Erhalte 10 zusätzliche Likes für den heutigen Tag.", price: "≈ 2,99 €" },
      ],
      note: "Käufe erfolgen in der mobilen App, nicht auf dieser Website.",
    },
  },
  it: {
    eyebrow: "PREZZI",
    title: "Trova la persona giusta con cui costruire una famiglia.",
    intro: "Match migliori. Compatibilità più profonda. Più sicurezza. Inizia gratis e passa a un piano superiore quando sei pronto ad andare oltre.",
    plans: [
      {
        key: "explore", name: "Explore", price: "€0", priceNote: "Gratis per sempre", altNote: "",
        tagline: "Crea il tuo profilo e inizia a scoprire.",
        features: ["Profilo completo e scoperta di base", "3 like al giorno", "Abbinamento di base"],
        cta: "Inizia gratis", badge: "",
      },
      {
        key: "familyBuilder", name: "Family Builder", price: "€24.99", priceNote: "al mese, fatturazione mensile",
        altNote: "oppure €49.99 per 3 mesi - €16.66/mese, risparmia il 33%",
        tagline: "Per chi è pronto a fare match con intenzione.",
        features: ["Punteggio di Compatibilità e perché siete compatibili", "AI Family Advisor", "Filtri familiari avanzati", "Vedi chi ti ha messo like", "Videochiamate e chiamate audio", "15 like/giorno, 5 contatti/giorno", "Priorità nella scoperta"],
        cta: "Inizia con Family Builder", badge: "Miglior valore",
      },
      {
        key: "familyBuilderPro", name: "Family Builder Pro", price: "€29.99", priceNote: "al mese", altNote: "",
        tagline: "Tutto Family Builder, con un accompagnamento più approfondito.",
        features: ["Tutto Family Builder", "AI Family Advisor", "Report di Compatibilità dettagliato", "Family Plan e Family Room condivisa", "Strumenti per documenti e checklist", "Supporto prioritario"],
        cta: "Passa a Pro", badge: "",
      },
    ],
    footnote: "Prezzi mostrati in EUR e possono variare in base alla regione. Annulla in qualsiasi momento. Premium richiede la verifica del profilo.",
    faqLinkLabel: "Scopri come verifichiamo i membri",
    compareTitle: "Confronta tutte le funzionalità",
    compareSub: "Scopri esattamente cosa è incluso in ciascun piano.",
    matrixGroups: [
      { name: "Trova match migliori", rows: [
        { label: "Like giornalieri", values: ["3", "15", "Illimitati"] },
        { label: "Scrivere per primi", values: ["", "5/giorno", "Illimitato"] },
        { label: "Filtri familiari avanzati", values: ["", "check", "check"] },
        { label: "Priorità nel catalogo", values: ["", "check", "check"] },
        { label: "Vedi chi ti ha messo like", values: ["", "check", "check"] },
        { label: "Vedi chi ha visitato il profilo", values: ["", "check", "check"] },
      ] },
      { name: "Capire la compatibilità", rows: [
        { label: "Punteggio di Compatibilità", values: ["", "check", "check"] },
        { label: "Perché siete compatibili", values: ["", "check", "check"] },
        { label: "Informazioni di profilo estese", values: ["", "check", "check"] },
        { label: "Informazioni di verifica", values: ["", "check", "check"] },
      ] },
      { name: "Distinguiti e resta al sicuro", rows: [
        { label: "Boost del profilo", values: ["check", "check", "check"] },
        { label: "Invita e ottieni un Boost", values: ["check", "check", "check"] },
        { label: "Safety Check-In", values: ["check", "check", "check"] },
        { label: "Badge Video Verification", values: ["check", "check", "check"] },
      ] },
      { name: "Connettiti e comunica", rows: [
        { label: "Videochiamate e chiamate audio", values: ["", "check", "check"] },
        { label: "Foto private", values: ["", "check", "check"] },
        { label: "Modalità incognito", values: ["", "check", "check"] },
        { label: "Messaggi di apertura suggeriti dall'IA", values: ["", "check", "check"] },
      ] },
      { name: "Costruisci la tua famiglia", rows: [
        { label: "Family Plan (condiviso)", values: ["", "Limitato", "check"] },
        { label: "AI Family Advisor", values: ["", "check", "check"] },
        { label: "Approfondimento settimanale dell'AI Advisor", values: ["", "check", "check"] },
        { label: "Firma del Co-Parenting Agreement", values: ["", "", "check"] },
        { label: "Gruppi e discussioni della community", values: ["", "", "check"] },
        { label: "Report di Compatibilità dettagliato", values: ["", "", "check"] },
        { label: "Strumenti per documenti e checklist", values: ["", "", "check"] },
        { label: "Supporto prioritario", values: ["", "", "check"] },
      ] },
    ],
    oneTime: {
      eyebrow: "ACQUISTI UNA TANTUM",
      title: "Ti serve solo un boost? Acquistalo una volta sola.",
      intro: "Preferisci non abbonarti? Questi extra sono disponibili come acquisti una tantum nell'app LetsBeParents (iOS - Android in arrivo). I prezzi mostrati sono indicativi e vengono impostati nell'app.",
      items: [
        { name: "Boost", body: "Vieni mostrato più spesso durante la navigazione per 24 ore.", price: "≈ 3,99 €" },
        { name: "Superlike", body: "Fatti notare subito - salta il limite giornaliero di like.", price: "≈ 1,99 €" },
        { name: "Rewind", body: "Annulla il tuo ultimo swipe.", price: "≈ 1,99 €" },
        { name: "Scopri chi ti ha messo like (48h)", body: "Rivela tutte le persone che ti hanno messo like nelle ultime 48 ore.", price: "≈ 4,99–5,99 €" },
        { name: "Report di compatibilità completo", body: "Sblocca il report dettagliato per un match.", price: "≈ 2,99 €" },
        { name: "+10 like extra", body: "Ricevi 10 like extra da usare oggi.", price: "≈ 2,99 €" },
      ],
      note: "Gli acquisti si effettuano nell'app mobile, non su questo sito.",
    },
  },
  pl: {
    eyebrow: "CENY",
    title: "Znajdź odpowiednią osobę, z którą założysz rodzinę.",
    intro: "Lepsze dopasowania. Głębsza kompatybilność. Więcej pewności. Zacznij za darmo, ulepsz plan, gdy będziesz gotowy na więcej.",
    plans: [
      {
        key: "explore", name: "Explore", price: "€0", priceNote: "Zawsze za darmo", altNote: "",
        tagline: "Stwórz profil i zacznij odkrywać.",
        features: ["Pełny profil i podstawowe odkrywanie", "3 polubienia dziennie", "Podstawowe dopasowanie"],
        cta: "Zacznij za darmo", badge: "",
      },
      {
        key: "familyBuilder", name: "Family Builder", price: "€24.99", priceNote: "miesięcznie, rozliczenie co miesiąc",
        altNote: "lub €49.99 za 3 miesiące - €16.66/miesiąc, oszczędź 33%",
        tagline: "Dla osób gotowych na świadome dopasowania.",
        features: ["Wskaźnik Kompatybilności i dlaczego pasujecie do siebie", "AI Family Advisor", "Zaawansowane filtry rodzinne", "Zobacz, kto Cię polubił", "Połączenia wideo i audio", "15 polubień/dzień, 5 kontaktów/dzień", "Priorytet w wyszukiwaniu"],
        cta: "Wybierz Family Builder", badge: "Najlepsza wartość",
      },
      {
        key: "familyBuilderPro", name: "Family Builder Pro", price: "€29.99", priceNote: "miesięcznie", altNote: "",
        tagline: "Wszystko z Family Builder oraz głębsze wsparcie.",
        features: ["Wszystko z Family Builder", "AI Family Advisor", "Szczegółowy Raport Kompatybilności", "Family Plan i wspólny Pokój Rodzinny", "Narzędzia do dokumentów i list kontrolnych", "Priorytetowe wsparcie"],
        cta: "Przejdź na Pro", badge: "",
      },
    ],
    footnote: "Ceny podane w EUR i mogą się różnić w zależności od regionu. Anuluj w dowolnym momencie. Premium wymaga weryfikacji profilu.",
    faqLinkLabel: "Zobacz, jak weryfikujemy użytkowników",
    compareTitle: "Porównaj wszystkie funkcje",
    compareSub: "Zobacz dokładnie, co zawiera każdy plan.",
    matrixGroups: [
      { name: "Dopasuj się lepiej", rows: [
        { label: "Polubienia dziennie", values: ["3", "15", "Bez limitu"] },
        { label: "Pierwszy kontakt", values: ["", "5/dzień", "Bez limitu"] },
        { label: "Zaawansowane filtry rodzinne", values: ["", "check", "check"] },
        { label: "Priorytet w katalogu", values: ["", "check", "check"] },
        { label: "Zobacz, kto Cię polubił", values: ["", "check", "check"] },
        { label: "Zobacz, kto odwiedził profil", values: ["", "check", "check"] },
      ] },
      { name: "Zrozum kompatybilność", rows: [
        { label: "Wskaźnik Kompatybilności", values: ["", "check", "check"] },
        { label: "Dlaczego pasujecie do siebie", values: ["", "check", "check"] },
        { label: "Rozszerzone informacje o profilu", values: ["", "check", "check"] },
        { label: "Informacje o weryfikacji", values: ["", "check", "check"] },
      ] },
      { name: "Wyróżnij się i zachowaj bezpieczeństwo", rows: [
        { label: "Boost profilu", values: ["check", "check", "check"] },
        { label: "Zaproś i zdobądź Boost", values: ["check", "check", "check"] },
        { label: "Safety Check-In", values: ["check", "check", "check"] },
        { label: "Odznaka Video Verification", values: ["check", "check", "check"] },
      ] },
      { name: "Łącz się i komunikuj", rows: [
        { label: "Połączenia wideo i audio", values: ["", "check", "check"] },
        { label: "Prywatne zdjęcia", values: ["", "check", "check"] },
        { label: "Tryb incognito", values: ["", "check", "check"] },
        { label: "Sugestie wiadomości od AI", values: ["", "check", "check"] },
      ] },
      { name: "Zbuduj swoją rodzinę", rows: [
        { label: "Family Plan (wspólny)", values: ["", "Ograniczony", "check"] },
        { label: "AI Family Advisor", values: ["", "check", "check"] },
        { label: "Cotygodniowa analiza od AI Advisor", values: ["", "check", "check"] },
        { label: "Podpisanie Co-Parenting Agreement", values: ["", "", "check"] },
        { label: "Grupy i dyskusje społeczności", values: ["", "", "check"] },
        { label: "Szczegółowy Raport Kompatybilności", values: ["", "", "check"] },
        { label: "Narzędzia do dokumentów i list kontrolnych", values: ["", "", "check"] },
        { label: "Priorytetowe wsparcie", values: ["", "", "check"] },
      ] },
    ],
    oneTime: {
      eyebrow: "ZAKUPY JEDNORAZOWE",
      title: "Potrzebujesz tylko jednego boosta? Kup go raz.",
      intro: "Wolisz nie subskrybować? Te dodatki są dostępne jako zakupy jednorazowe w aplikacji LetsBeParents (iOS - Android wkrótce). Podane ceny są przybliżone i ustalane w aplikacji.",
      items: [
        { name: "Boost", body: "Pojawiaj się częściej podczas przeglądania przez 24 godziny.", price: "≈ 3,99 €" },
        { name: "Superlike", body: "Wyróżnij się od razu - pomija dzienny limit polubień.", price: "≈ 1,99 €" },
        { name: "Rewind", body: "Cofnij swój ostatni swipe.", price: "≈ 1,99 €" },
        { name: "Zobacz, kto cię polubił (48h)", body: "Odkryj wszystkie osoby, które cię polubiły, przez 48 godzin.", price: "≈ 4,99–5,99 €" },
        { name: "Pełny raport kompatybilności", body: "Odblokuj szczegółowy raport dla jednego dopasowania.", price: "≈ 2,99 €" },
        { name: "+10 dodatkowych polubień", body: "Otrzymaj 10 dodatkowych polubień do wykorzystania dziś.", price: "≈ 2,99 €" },
      ],
      note: "Zakupy odbywają się w aplikacji mobilnej, a nie na tej stronie.",
    },
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
      {/* Item 19, 2026-09-15 - Alena: "Так сейчас создай экраны сам для
          приложения и сайта" (also asked earlier "Там нету про разовые
          покупки и их цена" about the mobile Premium screen). This is the
          website half: an informational-only showcase of the six one-time
          consumable purchases sold in the mobile app - no checkout here,
          per her explicit choice ("Только показать цены"). */}
      {text.oneTime ? (
        <section className="pricing-onetime">
          <div className="landing-section-intro">
            <span>{text.oneTime.eyebrow}</span>
            <h2>{text.oneTime.title}</h2>
            <p className="resources-section-sub">{text.oneTime.intro}</p>
          </div>
          <div className="pricing-onetime-grid">
            {text.oneTime.items.map((item) => (
              <div key={item.name} className="pricing-onetime-card">
                <h4>{item.name}</h4>
                <p>{item.body}</p>
                <strong>{item.price}</strong>
              </div>
            ))}
          </div>
          <p className="pricing-onetime-note">{text.oneTime.note}</p>
        </section>
      ) : null}
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
  pt: {
    "ivf-in-vitro-fertilization": "FIV - Fertilização in vitro",
    "co-parenting": "Coparentalidade",
    "sperm-donor": "Doador de esperma",
    fertility: "Fertilidade",
    lgbtq: "LGBTQ+",
  },
  fr: {
    "ivf-in-vitro-fertilization": "FIV - Fécondation in vitro",
    "co-parenting": "Coparentalité",
    "sperm-donor": "Donneur de sperme",
    fertility: "Fertilité",
    lgbtq: "LGBTQ+",
  },
  de: {
    "ivf-in-vitro-fertilization": "IVF - In-vitro-Fertilisation",
    "co-parenting": "Co-Parenting",
    "sperm-donor": "Samenspender",
    fertility: "Fruchtbarkeit",
    lgbtq: "LGBTQ+",
  },
  it: {
    "ivf-in-vitro-fertilization": "FIVET - Fecondazione in vitro",
    "co-parenting": "Co-genitorialità",
    "sperm-donor": "Donatore di sperma",
    fertility: "Fertilità",
    lgbtq: "LGBTQ+",
  },
  pl: {
    "ivf-in-vitro-fertilization": "In vitro - Zapłodnienie pozaustrojowe",
    "co-parenting": "Współrodzicielstwo",
    "sperm-donor": "Dawca nasienia",
    fertility: "Płodność",
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
  pt: {
    title: "Central de Conhecimento",
    intro: "Artigos de especialistas sobre doação, coparentalidade e saúde reprodutiva",
    all: "Todos",
    categoriesLabel: "Categorias de artigos",
    views: "visualizações",
    unavailable: "Este artigo não está disponível.",
    back: "Voltar à Central de Conhecimento",
    published: "Publicado em",
    previous: "Artigo anterior",
    next: "Próximo artigo",
    navigationLabel: "Navegação de artigos",
  },
  fr: {
    title: "Centre de connaissances",
    intro: "Articles d'experts sur le don, la coparentalité et la santé reproductive",
    all: "Tous",
    categoriesLabel: "Catégories d'articles",
    views: "vues",
    unavailable: "Cet article n'est pas disponible.",
    back: "Retour au centre de connaissances",
    published: "Publié le",
    previous: "Article précédent",
    next: "Article suivant",
    navigationLabel: "Navigation des articles",
  },
  de: {
    title: "Wissenszentrum",
    intro: "Expertenartikel zu Spende, Co-Parenting und reproduktiver Gesundheit",
    all: "Alle",
    categoriesLabel: "Artikelkategorien",
    views: "Aufrufe",
    unavailable: "Dieser Artikel ist nicht verfügbar.",
    back: "Zurück zum Wissenszentrum",
    published: "Veröffentlicht am",
    previous: "Vorheriger Artikel",
    next: "Nächster Artikel",
    navigationLabel: "Artikelnavigation",
  },
  it: {
    title: "Centro di conoscenza",
    intro: "Articoli di esperti su donazione, co-genitorialità e salute riproduttiva",
    all: "Tutti",
    categoriesLabel: "Categorie di articoli",
    views: "visualizzazioni",
    unavailable: "Questo articolo non è disponibile.",
    back: "Torna al Centro di conoscenza",
    published: "Pubblicato il",
    previous: "Articolo precedente",
    next: "Articolo successivo",
    navigationLabel: "Navigazione articoli",
  },
  pl: {
    title: "Centrum Wiedzy",
    intro: "Artykuły ekspertów na temat dawstwa, współrodzicielstwa i zdrowia reprodukcyjnego",
    all: "Wszystkie",
    categoriesLabel: "Kategorie artykułów",
    views: "wyświetleń",
    unavailable: "Ten artykuł jest niedostępny.",
    back: "Powrót do Centrum Wiedzy",
    published: "Opublikowano",
    previous: "Poprzedni artykuł",
    next: "Następny artykuł",
    navigationLabel: "Nawigacja artykułów",
  },
};


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
  pt: { idle: "Carregar mais", loading: "Carregando ..." },
  fr: { idle: "Charger plus", loading: "Chargement ..." },
  de: { idle: "Mehr laden", loading: "Wird geladen ..." },
  it: { idle: "Carica altro", loading: "Caricamento ..." },
  pl: { idle: "Załaduj więcej", loading: "Ładowanie ..." },
};

const articlePreviewCopy: Record<CookieLocale, string> = {
  en: "Preview Mode — This article is not published yet",
  ru: "Режим предпросмотра — Эта статья ещё не опубликована",
  es: "Modo de vista previa — Este artículo aún no está publicado",
  pt: "Modo de pré-visualização — Este artigo ainda não foi publicado",
  fr: "Mode aperçu — Cet article n'est pas encore publié",
  de: "Vorschaumodus — Dieser Artikel wurde noch nicht veröffentlicht",
  it: "Modalità anteprima — Questo articolo non è ancora stato pubblicato",
  pl: "Tryb podglądu — Ten artykuł nie został jeszcze opublikowany",
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
  const [data, setData] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    setVisibleCount(12);
    loadKnowledgeArticles(api, locale)
      .then((items) => { if (alive) setData(items); })
      .catch(() => { if (alive) setError(copy.unavailable); });
    return () => { alive = false; };
  }, [copy.unavailable, locale]);
  const allArticles: Row[] = (data ?? []).map((item) => ({
    ...item,
    categoryName: knowledgeCategoryName(String(item.categorySlug), locale),
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
      {error && <p className="error" role="alert">{error}</p>}
      {!data && !error && <LoadingIndicator />}
      <div className="knowledge-grid">
        {visibleArticles.map((item) => (
          <Link
            className="knowledge-card"
            key={String(item.id)}
            to={`/${locale}/knowledge-hub/${encodeURIComponent(asText(item.slug))}`}
          >
            <div className="knowledge-card-image">{Boolean(item.coverUrl) && <img src={asText(item.coverUrl)} alt={asText(item.title)} />}</div>
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
  const [searchParams] = useSearchParams();
  const activeLocale = locale as CookieLocale;
  const copy = knowledgeHubCopy[activeLocale];
  const previewMode = searchParams.get("preview") === "true";
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
    setNavigationArticles([]);
    loadKnowledgeArticles(api, locale)
      .then((items) => {
        if (!alive) return;
        setNavigationArticles(items);
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
          `/public/articles/${encodeURIComponent(locale)}/${encodeURIComponent(slug)}${previewMode ? "?preview=true" : ""}`,
        );
        if (alive) setArticle(normalizeArticle(result));
      } catch {
        if (alive) setError(copy.unavailable);
      }
    };
    void load();
    return () => { alive = false; };
  }, [copy.unavailable, locale, previewMode, slug]);
  useEffect(() => {
    if (!article) return;
    const meta = article.meta && typeof article.meta === "object" && !Array.isArray(article.meta)
      ? article.meta as Row
      : {};
    const translation = meta.translation && typeof meta.translation === "object" && !Array.isArray(meta.translation)
      ? meta.translation as Row
      : {};
    const firstText = (...values: unknown[]) =>
      values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
    const title = firstText(meta.metaTitle, meta.seoTitle, translation.metaTitle, translation.seoTitle, article.title, "LetsBeParents");
    const description = firstText(meta.metaDescription, meta.seoDescription, translation.metaDescription, translation.seoDescription, article.excerpt);
    const imageValue = firstText(meta.ogImage, meta.ogImageUrl, translation.ogImage, translation.ogImageUrl, article.coverUrl, article.cover_url);
    let image = "";
    try {
      image = imageValue ? new URL(imageValue, window.location.origin).href : "";
    } catch {
      image = "";
    }
    const canonical = `${window.location.origin}/${locale}/knowledge-hub/${encodeURIComponent(slug)}`;
    const localeTag = locale === "ru" ? "ru_RU" : locale === "es" ? "es_ES" : "en_US";
    const managed: HTMLElement[] = [];
    const setMeta = (attribute: "name" | "property", key: string, content: string) => {
      if (!content) return;
      const element = document.createElement("meta");
      element.setAttribute(attribute, key);
      element.setAttribute("content", content);
      element.dataset.articleSeo = "true";
      document.head.appendChild(element);
      managed.push(element);
    };
    const canonicalLink = document.createElement("link");
    canonicalLink.rel = "canonical";
    canonicalLink.href = canonical;
    canonicalLink.dataset.articleSeo = "true";
    document.head.appendChild(canonicalLink);
    managed.push(canonicalLink);
    document.title = title || "LetsBeParents";
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonical);
    setMeta("property", "og:site_name", "LetsBeParents");
    setMeta("property", "og:locale", localeTag);
    setMeta("property", "og:type", "article");
    setMeta("property", "article:published_time", String(article.publishedAt ?? article.published_at ?? ""));
    setMeta("property", "article:modified_time", String(article.updated_at ?? article.updatedAt ?? ""));
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);
    return () => {
      managed.forEach((element) => element.remove());
      document.title = "LetsBeParents";
    };
  }, [article, locale, slug]);
  const previewBanner = previewMode ? (
    <div className="article-preview-banner" role="status">
      {articlePreviewCopy[activeLocale]}
    </div>
  ) : null;
  if (error)
    return (
      <>
        {previewBanner}
        <section className="access-card">
          <p className="error">{error}</p>
          <Link to={`/${locale}/knowledge-hub`}>{copy.back}</Link>
        </section>
      </>
    );
  if (!article) return <>{previewBanner}<LoadingIndicator /></>;
  const categoryName = knowledgeCategoryName(String(article.categorySlug ?? ""), activeLocale);
  const coverUrl = article.coverUrl;
  const publishedAt = article.publishedAt;
  const views = article.views;
  const bodyHtml = article.bodyHtml ?? article.body_html ?? article.content;
  const referenceBodyHtml = asText(bodyHtml).replaceAll("https://letsbeparents.com/", "/");
  const navigationIndex = navigationArticles.findIndex((item) => asText(item.slug) === slug);
  const previous = (article.prev as Row | null | undefined)
      ?? (article.previous as Row | null | undefined)
      ?? (navigationIndex > 0 ? navigationArticles[navigationIndex - 1] : null);
  const next = (article.next as Row | null | undefined)
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
    <>
      {previewBanner}
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
    </>
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
  pt: {
    address: "Endereço:", registration: "Número de registro:", phone: "Telefone:", email: "Email:",
    title: "Contate-nos", intro: "Envie-nos uma mensagem e entraremos em contato.", name: "Seu nome",
    emailField: "Seu email", reason: "Motivo", message: "Mensagem",
    options: ["Pergunta geral", "Suporte", "Parceria", "Reportar um erro", "Outro"], send: "Enviar mensagem",
    success: "Obrigado. Sua mensagem foi enviada.", error: "Não foi possível enviar sua mensagem. Tente novamente.",
  },
  fr: {
    address: "Adresse :", registration: "N° d'enregistrement :", phone: "Téléphone :", email: "Email :",
    title: "Contactez-nous", intro: "Envoyez-nous un message et nous vous répondrons.", name: "Votre nom",
    emailField: "Votre email", reason: "Motif", message: "Message",
    options: ["Question générale", "Assistance", "Partenariat", "Signaler un bug", "Autre"], send: "Envoyer le message",
    success: "Merci. Votre message a été envoyé.", error: "Nous n'avons pas pu envoyer votre message. Veuillez réessayer.",
  },
  de: {
    address: "Adresse:", registration: "Registrierungsnummer:", phone: "Telefon:", email: "E-Mail:",
    title: "Kontaktieren Sie uns", intro: "Senden Sie uns eine Nachricht und wir melden uns bei Ihnen.", name: "Ihr Name",
    emailField: "Ihre E-Mail", reason: "Grund", message: "Nachricht",
    options: ["Allgemeine Frage", "Support", "Partnerschaft", "Fehlerbericht", "Sonstiges"], send: "Nachricht senden",
    success: "Vielen Dank. Ihre Nachricht wurde gesendet.", error: "Ihre Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
  },
  it: {
    address: "Indirizzo:", registration: "Numero di registrazione:", phone: "Telefono:", email: "Email:",
    title: "Contattaci", intro: "Inviaci un messaggio e ti risponderemo.", name: "Il tuo nome",
    emailField: "La tua email", reason: "Motivo", message: "Messaggio",
    options: ["Domanda generale", "Assistenza", "Collaborazione", "Segnala un bug", "Altro"], send: "Invia messaggio",
    success: "Grazie. Il tuo messaggio è stato inviato.", error: "Non è stato possibile inviare il messaggio. Riprova.",
  },
  pl: {
    address: "Adres:", registration: "Numer rejestracyjny:", phone: "Telefon:", email: "Email:",
    title: "Skontaktuj się z nami", intro: "Wyślij nam wiadomość, a odpowiemy najszybciej jak to możliwe.", name: "Twoje imię",
    emailField: "Twój email", reason: "Temat", message: "Wiadomość",
    options: ["Pytanie ogólne", "Wsparcie", "Współpraca", "Zgłoszenie błędu", "Inne"], send: "Wyślij wiadomość",
    success: "Dziękujemy. Twoja wiadomość została wysłana.", error: "Nie udało się wysłać wiadomości. Spróbuj ponownie.",
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
          <dd><a href="mailto:support@letsbeparents.com">support@letsbeparents.com</a></dd>
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
        <Link className="resources-pro-button" to={`/${locale}/professionals`}>Learn about professional support {resourceArrow()}</Link>
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
  pt: {
    eyebrow: "Encontre o seu caminho",
    whatThisLooksLike: "Como é esse caminho na prática",
    resourcesTitle: "Recursos para este caminho",
    resourcesAllTitle: "Ainda não tem certeza? Veja tudo",
    resourcesAllCopy: "Explore o conjunto completo de checklists, planilhas e modelos para cada caminho - coparentalidade, fertilidade, concepção com doador e planejamento futuro.",
    resourcesAllCta: "Ver todos os recursos e ferramentas",
    paths: [
      {
        slug: "co-parenting", registerKey: "coparent",
        h1: "Encontrar o coparceiro certo começa por saber o que você quer",
        subtitle: "Coparentalidade significa criar um filho juntos sem uma relação romântica. Funciona quando ambas as pessoas estão claras sobre as expectativas desde o início.",
        paragraphs: [
          "A coparentalidade na LetsBeParents significa construir uma família com alguém com quem você não tem uma relação romântica - duas casas separadas, decisões compartilhadas sobre a vida do seu filho. Funciona melhor quando ambas as pessoas são honestas sobre o que querem antes de começar a procurar, não depois de já terem encontrado alguém de quem gostam.",
          "Em vez de um feed baseado em swipe, a compatibilização aqui começa com um questionário baseado em valores e uma Pontuação de Compatibilidade que mostra onde você e um possível coparceiro realmente se alinham - em estilo de criação, envolvimento, prazos e limites - para que você compare o que importa, não apenas uma foto.",
          "Depois da primeira conversa, os próximos passos são os mesmos que qualquer decisão de coparentalidade bem pensada exige: mais conversas, um plano por escrito e, quando estiver pronto, aconselhamento jurídico independente.",
        ],
        resources: [
          { category: "co-parenting", tool: "questions-to-ask" },
          { category: "co-parenting", tool: "red-flags-checklist" },
          { category: "co-parenting", tool: "planning-template" },
        ],
        ctaLabel: "Criar o seu perfil", ctaType: "register",
      },
      {
        slug: "donor", registerKey: "donor",
        h1: "Encontre o doador certo para a sua família",
        subtitle: "Quer esteja à procura de um doador conhecido ou anônimo, a LetsBeParents ajuda você a filtrar pelo que mais importa.",
        paragraphs: [
          "Escolher um doador é uma das decisões mais pessoais na construção de uma família, com implicações médicas, jurídicas e de longo prazo reais. Algumas pessoas querem um doador conhecido, com uma relação contínua com a criança; outras preferem o anonimato através de uma clínica. Ambos os caminhos são válidos e levam a perguntas diferentes.",
          "Na LetsBeParents, os perfis de doadores incluem as informações que realmente importam para essa decisão, e cada doador passa por verificação de identidade antes que você possa entrar em contato. Você define os filtros que importam para você - histórico médico, abertura ao contato, localização - em vez de percorrer perfis às cegas.",
          "Antes de avançar com qualquer doador, vale a pena esclarecer as questões práticas com uma clínica de fertilidade e, quando relevante, com um advogado, fazendo isso cedo, em vez de depois de já ter tomado uma decisão emocional.",
        ],
        resources: [
          { category: "fertility-donor", tool: "fertility-consultation-questions" },
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "fertility-donor", tool: "fertility-clinic-checklist" },
        ],
        ctaLabel: "Ver perfis de doadores", ctaType: "register",
      },
      {
        slug: "partner", registerKey: "partner",
        h1: "Construa uma família com um parceiro que compartilhe a sua visão",
        subtitle: "Um parceiro de construção familiar não é um doador nem um coparceiro à distância - é alguém com quem você constrói uma vida familiar compartilhada.",
        paragraphs: [
          "Um parceiro de construção familiar é diferente tanto de um coparceiro quanto de um doador: é alguém com quem você construiria um lar e uma vida diária compartilhados, como faria um casal - só que com a parentalidade como objetivo explícito e compartilhado desde o início, em vez de algo que você espera que surja.",
          "Como isso está mais próximo de uma parceria de vida do que de uma transação, a LetsBeParents não trata isso como um app de namoro. Aqui não há swipe - tudo começa com um breve questionário de compatibilidade que revela como cada um de vocês pensa sobre parentalidade, compromisso e vida cotidiana, para que as primeiras conversas comecem a partir de um alinhamento real, e não de uma foto de perfil.",
        ],
        resources: [
          { category: "co-parenting", tool: "parenting-values-worksheet" },
        ],
        ctaLabel: "Fazer o questionário de compatibilidade", ctaType: "quiz",
      },
      {
        slug: "couple-donor", registerKey: "couple-donor",
        h1: "Encontrem um doador juntos, como casal",
        subtitle: "Procurar um doador como casal traz suas próprias questões - desde a filiação legal até o quanto vocês querem que o doador esteja envolvido.",
        paragraphs: [
          "Procurar um doador como casal levanta perguntas que uma busca individual não traz: o quanto (ou o quão pouco) vocês querem que o doador esteja envolvido, como funcionará a filiação legal para ambos, e como vocês tomarão decisões juntos ao longo do processo. Alinhar-se com o parceiro antes de começar a procurar poupa muito atrito depois.",
          "A LetsBeParents permite que vocês dois explorem e filtrem perfis de doadores juntos, com o mesmo grupo de doadores com identidade verificada e os mesmos filtros - histórico médico, abertura ao contato e mais - disponíveis quer estejam procurando sozinhos ou em dupla.",
        ],
        resources: [
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "parenthood-planning", tool: "financial-planning" },
        ],
        ctaLabel: "Criar o seu perfil", ctaType: "register",
      },
      {
        slug: "exploring", registerKey: "exploring",
        h1: "Ainda está definindo o seu caminho? Comece aqui.",
        subtitle: "Você não precisa ter tudo resolvido. A maioria das pessoas começa explorando as suas opções antes de decidir um caminho.",
        paragraphs: [
          "A maioria das pessoas que acaba construindo uma família com a LetsBeParents não começou com certeza de como seria exatamente. Se você ainda está pesando coparentalidade contra concepção com doador, ou um parceiro contra seguir sozinho, esse é um lugar completamente normal em que estar - e não algo que precise resolver antes de começar.",
          "O melhor próximo passo não é uma decisão, é informação: leia o que cada caminho realmente envolve e faça o Questionário de Compatibilidade para ter uma ideia mais clara do que você procura. Não há pressão para se cadastrar ou se comprometer com nada enquanto você ainda está explorando.",
        ],
        resources: "all",
        ctaLabel: "Fazer o Questionário de Compatibilidade de Coparentalidade", ctaType: "quiz",
      },
    ],
  },
  fr: {
    eyebrow: "Trouvez votre voie",
    whatThisLooksLike: "À quoi ressemble ce parcours",
    resourcesTitle: "Ressources pour ce parcours",
    resourcesAllTitle: "Pas encore sûr(e) ? Explorez tout",
    resourcesAllCopy: "Découvrez l'ensemble des checklists, fiches pratiques et modèles pour chaque parcours - coparentalité, fertilité, conception avec donneur et planification.",
    resourcesAllCta: "Voir toutes les ressources et tous les outils",
    paths: [
      {
        slug: "co-parenting", registerKey: "coparent",
        h1: "Trouver le bon coparent commence par savoir ce que vous voulez",
        subtitle: "La coparentalité, c'est élever un enfant ensemble sans relation amoureuse. Cela fonctionne quand les deux personnes sont claires sur leurs attentes dès le départ.",
        paragraphs: [
          "La coparentalité sur LetsBeParents signifie construire une famille avec une personne avec qui vous n'avez pas de relation amoureuse - deux foyers distincts, des décisions partagées concernant la vie de votre enfant. Cela fonctionne mieux quand les deux personnes sont honnêtes sur ce qu'elles veulent avant de commencer à chercher, et non après avoir déjà trouvé quelqu'un qui leur plaît.",
          "Plutôt qu'un fil basé sur le swipe, la mise en relation commence ici par un questionnaire basé sur les valeurs et un Score de Compatibilité qui montre où vous et un coparent potentiel êtes réellement alignés - style parental, implication, calendrier et limites - pour que vous compariez ce qui compte vraiment, pas seulement une photo.",
          "Après une première conversation, les étapes suivantes sont les mêmes que pour toute décision de coparentalité réfléchie : davantage de discussions, un plan écrit et, le moment venu, un avis juridique indépendant.",
        ],
        resources: [
          { category: "co-parenting", tool: "questions-to-ask" },
          { category: "co-parenting", tool: "red-flags-checklist" },
          { category: "co-parenting", tool: "planning-template" },
        ],
        ctaLabel: "Créer votre profil", ctaType: "register",
      },
      {
        slug: "donor", registerKey: "donor",
        h1: "Trouvez le bon donneur pour votre famille",
        subtitle: "Que vous recherchiez un donneur connu ou anonyme, LetsBeParents vous aide à filtrer selon ce qui compte le plus pour vous.",
        paragraphs: [
          "Choisir un donneur est l'une des décisions les plus personnelles dans la construction d'une famille, avec de réelles implications médicales, juridiques et à long terme. Certaines personnes souhaitent un donneur connu avec une relation continue avec l'enfant ; d'autres préfèrent l'anonymat via une clinique. Les deux voies sont légitimes et soulèvent des questions différentes.",
          "Sur LetsBeParents, les profils de donneurs incluent les informations qui comptent réellement pour cette décision, et chaque donneur passe par une vérification d'identité avant que vous puissiez le contacter. Vous définissez les filtres qui vous importent - antécédents médicaux, ouverture au contact, localisation - au lieu de parcourir des profils à l'aveugle.",
          "Avant d'avancer avec un donneur, il est utile de traiter les questions pratiques avec une clinique de fertilité et, le cas échéant, avec un avocat, et de le faire tôt plutôt qu'après avoir déjà pris une décision sur le plan émotionnel.",
        ],
        resources: [
          { category: "fertility-donor", tool: "fertility-consultation-questions" },
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "fertility-donor", tool: "fertility-clinic-checklist" },
        ],
        ctaLabel: "Parcourir les profils de donneurs", ctaType: "register",
      },
      {
        slug: "partner", registerKey: "partner",
        h1: "Construisez une famille avec un partenaire qui partage votre vision",
        subtitle: "Un partenaire de construction familiale n'est ni un donneur ni un coparent à distance - c'est une personne avec qui vous bâtissez une vie de famille partagée.",
        paragraphs: [
          "Un partenaire de construction familiale est différent à la fois d'un coparent et d'un donneur : c'est une personne avec qui vous construiriez un foyer et une vie quotidienne partagés, comme le ferait un couple - sauf que la parentalité est l'objectif explicite et partagé dès le départ, plutôt qu'une chose que vous espérez voir émerger.",
          "Comme cela se rapproche davantage d'un partenariat de vie que d'une transaction, LetsBeParents ne traite pas cela comme un site de rencontres. Il n'y a pas de swipe ici - tout commence par un court questionnaire de compatibilité qui met en évidence la façon dont chacun de vous envisage la parentalité, l'engagement et la vie quotidienne, afin que les premières conversations partent d'un véritable alignement plutôt que d'une photo de profil.",
        ],
        resources: [
          { category: "co-parenting", tool: "parenting-values-worksheet" },
        ],
        ctaLabel: "Faire le questionnaire de compatibilité", ctaType: "quiz",
      },
      {
        slug: "couple-donor", registerKey: "couple-donor",
        h1: "Trouvez un donneur ensemble, en couple",
        subtitle: "Chercher un donneur en couple soulève ses propres questions - de la filiation légale au degré d'implication que vous souhaitez pour le donneur.",
        paragraphs: [
          "Chercher un donneur en couple soulève des questions qu'une recherche en solo ne pose pas : à quel point (ou non) vous souhaitez que le donneur soit impliqué, comment la filiation légale fonctionnera pour vous deux, et comment vous prendrez les décisions ensemble en cours de route. S'accorder avec son ou sa partenaire avant de commencer à chercher évite bien des frictions par la suite.",
          "LetsBeParents vous permet, à tous les deux, de parcourir et de filtrer les profils de donneurs ensemble, avec le même vivier de donneurs à identité vérifiée et les mêmes filtres - antécédents médicaux, ouverture au contact et plus - que vous cherchiez seul(e) ou à deux.",
        ],
        resources: [
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "parenthood-planning", tool: "financial-planning" },
        ],
        ctaLabel: "Créer votre profil", ctaType: "register",
      },
      {
        slug: "exploring", registerKey: "exploring",
        h1: "Vous cherchez encore votre voie ? Commencez ici.",
        subtitle: "Vous n'avez pas besoin d'avoir tout résolu. La plupart des gens commencent par explorer leurs options avant de choisir une voie.",
        paragraphs: [
          "La plupart des personnes qui finissent par construire une famille avec LetsBeParents ne savaient pas exactement, au départ, à quoi cela ressemblerait. Si vous hésitez encore entre la coparentalité et la conception avec donneur, ou entre un partenaire et le fait de vous lancer seul(e), c'est une situation tout à fait normale - et ce n'est pas quelque chose que vous devez résoudre avant de commencer.",
          "La meilleure prochaine étape n'est pas une décision, c'est de l'information : lisez ce que chaque voie implique réellement, et faites le Questionnaire de Compatibilité pour mieux cerner ce que vous recherchez. Il n'y a aucune pression pour vous inscrire ou vous engager tant que vous êtes encore en phase d'exploration.",
        ],
        resources: "all",
        ctaLabel: "Faire le Questionnaire de Compatibilité de Coparentalité", ctaType: "quiz",
      },
    ],
  },
  de: {
    eyebrow: "Finden Sie Ihren Weg",
    whatThisLooksLike: "So sieht dieser Weg in der Praxis aus",
    resourcesTitle: "Ressourcen für diesen Weg",
    resourcesAllTitle: "Noch nicht sicher? Alles durchstöbern",
    resourcesAllCopy: "Entdecken Sie die vollständige Sammlung an Checklisten, Arbeitsblättern und Vorlagen für jeden Weg - Co-Parenting, Kinderwunschbehandlung, Samenspende und Zukunftsplanung.",
    resourcesAllCta: "Alle Ressourcen und Tools durchstöbern",
    paths: [
      {
        slug: "co-parenting", registerKey: "coparent",
        h1: "Den richtigen Co-Elternteil zu finden beginnt damit, zu wissen, was man will",
        subtitle: "Co-Parenting bedeutet, gemeinsam ein Kind großzuziehen, ohne romantisch liiert zu sein. Es funktioniert, wenn beide von Anfang an klar über ihre Erwartungen sind.",
        paragraphs: [
          "Co-Parenting auf LetsBeParents bedeutet, mit jemandem eine Familie aufzubauen, mit dem man nicht romantisch liiert ist - zwei getrennte Haushalte, gemeinsame Entscheidungen über das Leben des Kindes. Es funktioniert am besten, wenn beide ehrlich darüber sind, was sie wollen, bevor sie mit der Suche beginnen - nicht erst, nachdem sie bereits jemanden gefunden haben, der ihnen gefällt.",
          "Statt eines Swipe-Feeds beginnt das Matching hier mit einem werteorientierten Quiz und einem Compatibility Score, der zeigt, wo Sie und ein möglicher Co-Elternteil tatsächlich übereinstimmen - bei Erziehungsstil, Engagement, Zeitplan und Grenzen -, sodass Sie das vergleichen, was wirklich zählt, und nicht nur ein Foto.",
          "Nach dem ersten Gespräch folgen dieselben Schritte, die jede durchdachte Co-Parenting-Entscheidung braucht: weitere Gespräche, ein schriftlicher Plan und, sobald Sie bereit sind, unabhängige Rechtsberatung.",
        ],
        resources: [
          { category: "co-parenting", tool: "questions-to-ask" },
          { category: "co-parenting", tool: "red-flags-checklist" },
          { category: "co-parenting", tool: "planning-template" },
        ],
        ctaLabel: "Profil erstellen", ctaType: "register",
      },
      {
        slug: "donor", registerKey: "donor",
        h1: "Finden Sie den richtigen Samenspender für Ihre Familie",
        subtitle: "Ob Sie einen bekannten oder anonymen Spender suchen - LetsBeParents hilft Ihnen, nach dem zu filtern, was Ihnen am wichtigsten ist.",
        paragraphs: [
          "Die Wahl eines Spenders ist eine der persönlichsten Entscheidungen beim Aufbau einer Familie, mit realen medizinischen, rechtlichen und langfristigen Folgen. Manche Menschen wünschen sich einen bekannten Spender mit fortlaufendem Kontakt zum Kind; andere bevorzugen Anonymität über eine Klinik. Beide Wege sind legitim und führen zu unterschiedlichen Fragen.",
          "Bei LetsBeParents enthalten Spenderprofile die Informationen, die für diese Entscheidung wirklich zählen, und jeder Spender durchläuft eine Identitätsprüfung, bevor Sie Kontakt aufnehmen können. Sie legen selbst fest, welche Filter für Sie wichtig sind - Krankengeschichte, Offenheit für Kontakt, Standort - statt blind zu suchen.",
          "Bevor Sie mit einem Spender weitermachen, lohnt es sich, die praktischen Fragen frühzeitig mit einer Kinderwunschklinik und, wo relevant, mit einem Anwalt zu klären - statt erst, nachdem Sie sich bereits emotional entschieden haben.",
        ],
        resources: [
          { category: "fertility-donor", tool: "fertility-consultation-questions" },
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "fertility-donor", tool: "fertility-clinic-checklist" },
        ],
        ctaLabel: "Spenderprofile durchstöbern", ctaType: "register",
      },
      {
        slug: "partner", registerKey: "partner",
        h1: "Bauen Sie eine Familie mit einem Partner auf, der Ihre Vision teilt",
        subtitle: "Ein Partner für den Familienaufbau ist weder ein Spender noch ein Co-Elternteil auf Distanz - es ist jemand, mit dem Sie ein gemeinsames Familienleben aufbauen.",
        paragraphs: [
          "Ein Partner für den Familienaufbau unterscheidet sich sowohl von einem Co-Elternteil als auch von einem Spender: Es ist jemand, mit dem Sie einen gemeinsamen Haushalt und Alltag aufbauen würden, wie es ein Paar tun würde - nur dass die Elternschaft von Anfang an das ausdrückliche, gemeinsame Ziel ist, statt etwas, von dem Sie hoffen, dass es sich ergibt.",
          "Weil dies eher einer Lebenspartnerschaft als einer Transaktion ähnelt, behandelt LetsBeParents es nicht wie Dating. Hier gibt es kein Swipen - es beginnt mit einem kurzen Kompatibilitätsquiz, das zeigt, wie jeder von Ihnen über Elternschaft, Verbindlichkeit und den Alltag denkt, sodass die ersten Gespräche von echter Übereinstimmung ausgehen und nicht von einem Profilfoto.",
        ],
        resources: [
          { category: "co-parenting", tool: "parenting-values-worksheet" },
        ],
        ctaLabel: "Kompatibilitätsquiz machen", ctaType: "quiz",
      },
      {
        slug: "couple-donor", registerKey: "couple-donor",
        h1: "Finden Sie gemeinsam als Paar einen Spender",
        subtitle: "Die Suche nach einem Spender als Paar wirft eigene Fragen auf - von der rechtlichen Elternschaft bis dazu, wie eingebunden der Spender sein soll.",
        paragraphs: [
          "Die Suche nach einem Spender als Paar wirft Fragen auf, die eine Einzelsuche nicht stellt: wie eingebunden (oder nicht) der Spender sein soll, wie die rechtliche Elternschaft für Sie beide funktioniert und wie Sie unterwegs gemeinsam Entscheidungen treffen. Sich mit dem Partner abzustimmen, bevor die Suche beginnt, erspart später viel Reibung.",
          "LetsBeParents ermöglicht es Ihnen beiden, Spenderprofile gemeinsam zu durchstöbern und zu filtern - mit demselben identitätsgeprüften Spenderpool und denselben Filtern (Krankengeschichte, Offenheit für Kontakt und mehr), egal ob Sie allein oder zu zweit suchen.",
        ],
        resources: [
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "parenthood-planning", tool: "financial-planning" },
        ],
        ctaLabel: "Profil erstellen", ctaType: "register",
      },
      {
        slug: "exploring", registerKey: "exploring",
        h1: "Noch auf der Suche nach Ihrem Weg? Fangen Sie hier an.",
        subtitle: "Sie müssen nicht schon alles wissen. Die meisten Menschen beginnen damit, ihre Möglichkeiten zu erkunden, bevor sie sich für einen Weg entscheiden.",
        paragraphs: [
          "Die meisten Menschen, die am Ende mit LetsBeParents eine Familie aufbauen, wussten anfangs nicht genau, wie das aussehen würde. Wenn Sie noch zwischen Co-Parenting und Samenspende abwägen, oder zwischen einem Partner und dem Alleingang, ist das ein völlig normaler Zustand - und nichts, das Sie klären müssen, bevor Sie starten.",
          "Der beste nächste Schritt ist keine Entscheidung, sondern Information: Lesen Sie, was jeder Weg wirklich bedeutet, und machen Sie das Compatibility Quiz, um ein klareres Bild davon zu bekommen, wonach Sie suchen. Solange Sie noch erkunden, besteht kein Druck, sich zu registrieren oder sich auf etwas festzulegen.",
        ],
        resources: "all",
        ctaLabel: "Co-Parenting-Kompatibilitätsquiz machen", ctaType: "quiz",
      },
    ],
  },
  it: {
    eyebrow: "Trova il tuo percorso",
    whatThisLooksLike: "Com'è questo percorso nella pratica",
    resourcesTitle: "Risorse per questo percorso",
    resourcesAllTitle: "Non sei ancora sicuro/a? Esplora tutto",
    resourcesAllCopy: "Scopri l'intera raccolta di checklist, schede pratiche e modelli per ogni percorso - co-parenting, fertilità, concepimento con donatore e pianificazione futura.",
    resourcesAllCta: "Sfoglia tutte le risorse e gli strumenti",
    paths: [
      {
        slug: "co-parenting", registerKey: "coparent",
        h1: "Trovare il co-genitore giusto inizia dal sapere cosa vuoi",
        subtitle: "Il co-parenting significa crescere un figlio insieme senza una relazione romantica. Funziona quando entrambe le persone sono chiare fin dall'inizio sulle proprie aspettative.",
        paragraphs: [
          "Il co-parenting su LetsBeParents significa costruire una famiglia con qualcuno con cui non hai una relazione romantica - due case separate, decisioni condivise sulla vita di tuo figlio. Funziona meglio quando entrambe le persone sono oneste su ciò che vogliono prima di iniziare a cercare, non dopo aver già trovato qualcuno che piace.",
          "Invece di un feed basato sullo swipe, l'abbinamento qui inizia con un quiz basato sui valori e un Compatibility Score che mostra dove tu e un potenziale co-genitore vi allineate davvero - stile genitoriale, coinvolgimento, tempistiche e confini - così confronti ciò che conta, non solo una foto.",
          "Dopo una prima conversazione, i passi successivi sono gli stessi richiesti da qualsiasi decisione di co-parenting ponderata: altre conversazioni, un piano scritto e, quando sarai pronto/a, una consulenza legale indipendente.",
        ],
        resources: [
          { category: "co-parenting", tool: "questions-to-ask" },
          { category: "co-parenting", tool: "red-flags-checklist" },
          { category: "co-parenting", tool: "planning-template" },
        ],
        ctaLabel: "Crea il tuo profilo", ctaType: "register",
      },
      {
        slug: "donor", registerKey: "donor",
        h1: "Trova il donatore giusto per la tua famiglia",
        subtitle: "Che tu stia cercando un donatore conosciuto o anonimo, LetsBeParents ti aiuta a filtrare in base a ciò che conta di più per te.",
        paragraphs: [
          "Scegliere un donatore è una delle decisioni più personali nella costruzione di una famiglia, con reali implicazioni mediche, legali e a lungo termine. Alcune persone desiderano un donatore conosciuto, con una relazione continuativa con il bambino; altre preferiscono l'anonimato tramite una clinica. Entrambi i percorsi sono validi e portano a domande diverse.",
          "Su LetsBeParents, i profili dei donatori includono le informazioni che contano davvero per questa decisione, e ogni donatore passa attraverso una verifica dell'identità prima che tu possa contattarlo. Sei tu a impostare i filtri importanti per te - anamnesi medica, apertura al contatto, posizione - invece di scorrere alla cieca.",
          "Prima di procedere con qualsiasi donatore, vale la pena affrontare presto le domande pratiche con una clinica della fertilità e, dove rilevante, con un avvocato, piuttosto che dopo aver già preso una decisione sul piano emotivo.",
        ],
        resources: [
          { category: "fertility-donor", tool: "fertility-consultation-questions" },
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "fertility-donor", tool: "fertility-clinic-checklist" },
        ],
        ctaLabel: "Sfoglia i profili dei donatori", ctaType: "register",
      },
      {
        slug: "partner", registerKey: "partner",
        h1: "Costruisci una famiglia con un partner che condivide la tua visione",
        subtitle: "Un partner per costruire una famiglia non è un donatore né un co-genitore a distanza - è qualcuno con cui costruisci una vita familiare condivisa.",
        paragraphs: [
          "Un partner per costruire una famiglia è diverso sia da un co-genitore sia da un donatore: è qualcuno con cui costruiresti una casa e una vita quotidiana condivise, come farebbe una coppia - solo che la genitorialità è l'obiettivo esplicito e condiviso fin dall'inizio, invece di qualcosa che speri emerga.",
          "Poiché questo si avvicina più a un'unione di vita che a una transazione, LetsBeParents non lo tratta come un'app di incontri. Qui non c'è swipe - si parte con un breve quiz di compatibilità che fa emergere come ciascuno di voi pensa alla genitorialità, all'impegno e alla vita quotidiana, così le prime conversazioni partono da un allineamento reale e non da una foto profilo.",
        ],
        resources: [
          { category: "co-parenting", tool: "parenting-values-worksheet" },
        ],
        ctaLabel: "Fai il quiz di compatibilità", ctaType: "quiz",
      },
      {
        slug: "couple-donor", registerKey: "couple-donor",
        h1: "Trovate un donatore insieme, come coppia",
        subtitle: "Cercare un donatore in coppia porta con sé domande proprie - dalla genitorialità legale a quanto volete che il donatore sia coinvolto.",
        paragraphs: [
          "Cercare un donatore in coppia solleva domande che una ricerca individuale non pone: quanto (o quanto poco) volete che il donatore sia coinvolto, come funzionerà la genitorialità legale per entrambi, e come prenderete le decisioni insieme lungo il percorso. Allinearvi con il partner prima di iniziare a cercare risparmia molti attriti in seguito.",
          "LetsBeParents permette a entrambi di sfogliare e filtrare i profili dei donatori insieme, con lo stesso pool di donatori a identità verificata e gli stessi filtri - anamnesi medica, apertura al contatto e altro - disponibili sia che cerchiate da soli sia in coppia.",
        ],
        resources: [
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "parenthood-planning", tool: "financial-planning" },
        ],
        ctaLabel: "Crea il tuo profilo", ctaType: "register",
      },
      {
        slug: "exploring", registerKey: "exploring",
        h1: "Stai ancora definendo il tuo percorso? Inizia da qui.",
        subtitle: "Non devi avere già tutto chiaro. La maggior parte delle persone inizia esplorando le proprie opzioni prima di scegliere un percorso.",
        paragraphs: [
          "La maggior parte delle persone che finisce per costruire una famiglia con LetsBeParents non sapeva esattamente, all'inizio, come sarebbe stato. Se stai ancora valutando il co-parenting rispetto al concepimento con donatore, o un partner rispetto a procedere da solo/a, è una condizione del tutto normale - e non qualcosa che devi risolvere prima di iniziare.",
          "Il passo successivo migliore non è una decisione, è informazione: leggi cosa comporta davvero ogni percorso, e fai il Compatibility Quiz per avere un'idea più chiara di ciò che stai cercando. Non c'è alcuna pressione a registrarti o a impegnarti in qualcosa mentre stai ancora esplorando.",
        ],
        resources: "all",
        ctaLabel: "Fai il Quiz di Compatibilità per il Co-Parenting", ctaType: "quiz",
      },
    ],
  },
  pl: {
    eyebrow: "Znajdź swoją drogę",
    whatThisLooksLike: "Jak wygląda ta droga w praktyce",
    resourcesTitle: "Zasoby dla tej drogi",
    resourcesAllTitle: "Jeszcze nie masz pewności? Zobacz wszystko",
    resourcesAllCopy: "Poznaj pełny zestaw list kontrolnych, arkuszy i szablonów dla każdej drogi - co-parenting, płodność, poczęcie z dawcą i planowanie na przyszłość.",
    resourcesAllCta: "Zobacz wszystkie zasoby i narzędzia",
    paths: [
      {
        slug: "co-parenting", registerKey: "coparent",
        h1: "Znalezienie odpowiedniego co-rodzica zaczyna się od wiedzy, czego chcesz",
        subtitle: "Co-parenting oznacza wspólne wychowywanie dziecka bez związku romantycznego. Sprawdza się, gdy oboje od początku jasno określają swoje oczekiwania.",
        paragraphs: [
          "Co-parenting na LetsBeParents oznacza budowanie rodziny z osobą, z którą nie łączy cię związek romantyczny - dwa oddzielne gospodarstwa domowe, wspólne decyzje dotyczące życia dziecka. Działa najlepiej, gdy oboje są szczerzy co do tego, czego chcą, zanim zaczną szukać - a nie dopiero po tym, jak już znaleźli kogoś, kto im się podoba.",
          "Zamiast kanału opartego na przesuwaniu profili, dopasowywanie zaczyna się tu od quizu opartego na wartościach i Wskaźnika Kompatybilności, który pokazuje, w czym Ty i potencjalny co-rodzic naprawdę się zgadzacie - styl wychowania, zaangażowanie, harmonogram i granice - dzięki czemu porównujecie to, co ważne, a nie tylko zdjęcie.",
          "Po pierwszej rozmowie kolejne kroki są takie same jak przy każdej przemyślanej decyzji o co-parentingu: więcej rozmów, spisany plan i, gdy będziecie gotowi, niezależna porada prawna.",
        ],
        resources: [
          { category: "co-parenting", tool: "questions-to-ask" },
          { category: "co-parenting", tool: "red-flags-checklist" },
          { category: "co-parenting", tool: "planning-template" },
        ],
        ctaLabel: "Utwórz swój profil", ctaType: "register",
      },
      {
        slug: "donor", registerKey: "donor",
        h1: "Znajdź odpowiedniego dawcę dla swojej rodziny",
        subtitle: "Niezależnie od tego, czy szukasz dawcy znanego, czy anonimowego, LetsBeParents pomaga filtrować według tego, co jest dla Ciebie najważniejsze.",
        paragraphs: [
          "Wybór dawcy to jedna z najbardziej osobistych decyzji przy budowaniu rodziny, z realnymi konsekwencjami medycznymi, prawnymi i długoterminowymi. Niektórzy chcą dawcy znanego, z ciągłą relacją z dzieckiem; inni wolą anonimowość za pośrednictwem kliniki. Obie drogi są uzasadnione i prowadzą do różnych pytań.",
          "Na LetsBeParents profile dawców zawierają informacje, które naprawdę mają znaczenie przy tej decyzji, a każdy dawca przechodzi weryfikację tożsamości, zanim będziesz mógł się z nim skontaktować. To Ty ustawiasz filtry, które są dla Ciebie ważne - historię medyczną, otwartość na kontakt, lokalizację - zamiast przeglądać na oślep.",
          "Zanim zdecydujesz się na konkretnego dawcę, warto wcześnie omówić praktyczne kwestie z kliniką leczenia niepłodności, a tam, gdzie to istotne, także z prawnikiem - zamiast robić to dopiero po podjęciu decyzji emocjonalnej.",
        ],
        resources: [
          { category: "fertility-donor", tool: "fertility-consultation-questions" },
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "fertility-donor", tool: "fertility-clinic-checklist" },
        ],
        ctaLabel: "Przeglądaj profile dawców", ctaType: "register",
      },
      {
        slug: "partner", registerKey: "partner",
        h1: "Zbuduj rodzinę z partnerem, który podziela Twoją wizję",
        subtitle: "Partner do budowania rodziny to nie dawca ani co-rodzic na odległość - to ktoś, z kim budujesz wspólne życie rodzinne.",
        paragraphs: [
          "Partner do budowania rodziny różni się zarówno od co-rodzica, jak i od dawcy: to ktoś, z kim zbudowałbyś/zbudowałabyś wspólny dom i codzienne życie, tak jak robi to para - z tą różnicą, że rodzicielstwo jest jawnym, wspólnym celem od samego początku, a nie czymś, czego się mamy nadzieję dorobić.",
          "Ponieważ jest to bliższe partnerstwu życiowemu niż transakcji, LetsBeParents nie traktuje tego jak randkowania. Nie ma tu przesuwania profili - zaczyna się od krótkiego quizu kompatybilności, który pokazuje, jak każde z Was myśli o rodzicielstwie, zaangażowaniu i codziennym życiu, dzięki czemu pierwsze rozmowy zaczynają się od prawdziwego dopasowania, a nie od zdjęcia profilowego.",
        ],
        resources: [
          { category: "co-parenting", tool: "parenting-values-worksheet" },
        ],
        ctaLabel: "Wypełnij quiz kompatybilności", ctaType: "quiz",
      },
      {
        slug: "couple-donor", registerKey: "couple-donor",
        h1: "Znajdźcie dawcę razem, jako para",
        subtitle: "Szukanie dawcy jako para wiąże się z własnymi pytaniami - od prawnego rodzicielstwa po to, jak bardzo zaangażowany ma być dawca.",
        paragraphs: [
          "Szukanie dawcy jako para rodzi pytania, których nie ma przy szukaniu w pojedynkę: jak bardzo (lub jak mało) zaangażowany ma być dawca, jak będzie wyglądać prawne rodzicielstwo dla Was obojga i jak będziecie razem podejmować decyzje w trakcie tego procesu. Ustalenie wspólnego stanowiska z partnerem/partnerką przed rozpoczęciem poszukiwań oszczędza wiele napięć później.",
          "LetsBeParents pozwala Wam obojgu wspólnie przeglądać i filtrować profile dawców, z tą samą pulą dawców o zweryfikowanej tożsamości i tymi samymi filtrami - historią medyczną, otwartością na kontakt i innymi - dostępnymi bez względu na to, czy szukacie sami, czy we dwoje.",
        ],
        resources: [
          { category: "fertility-donor", tool: "donor-conception-questions" },
          { category: "parenthood-planning", tool: "financial-planning" },
        ],
        ctaLabel: "Utwórz swój profil", ctaType: "register",
      },
      {
        slug: "exploring", registerKey: "exploring",
        h1: "Wciąż zastanawiasz się nad swoją drogą? Zacznij tutaj.",
        subtitle: "Nie musisz mieć wszystkiego ustalonego. Większość osób zaczyna od zapoznania się z opcjami, zanim wybierze drogę.",
        paragraphs: [
          "Większość osób, które ostatecznie budują rodzinę z LetsBeParents, na początku nie była pewna, jak dokładnie będzie to wyglądać. Jeśli wciąż rozważasz co-parenting w porównaniu z poczęciem z dawcą, albo partnera w porównaniu z samodzielną drogą, to zupełnie normalny etap - i nie musisz go rozstrzygać, zanim zaczniesz.",
          "Najlepszym kolejnym krokiem nie jest decyzja, lecz informacja: przeczytaj, co naprawdę wiąże się z każdą drogą, i wypełnij Quiz Kompatybilności, aby lepiej zrozumieć, czego szukasz. Nie ma presji, by się rejestrować czy się do czegokolwiek zobowiązywać, dopóki wciąż eksplorujesz możliwości.",
        ],
        resources: "all",
        ctaLabel: "Wypełnij Quiz Kompatybilności Co-Parentingu", ctaType: "quiz",
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
        <Link className="resources-pro-button" to={`/${locale}/professionals`}>Learn about professional support {resourceArrow()}</Link>
      </section>
    </div>
  );
}

function professionalIcon(key: string) {
  if (key === "scale") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18" /><path d="m19 8 3 8a5 5 0 0 1-6 0zV7" /><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" /><path d="m5 8 3 8a5 5 0 0 1-6 0zV7" /><path d="M7 21h10" /></svg>;
  if (key === "wallet") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>;
  if (key === "support") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" /><path d="m4.93 4.93 4.24 4.24" /><path d="m14.83 9.17 4.24-4.24" /><path d="m14.83 14.83 4.24 4.24" /><path d="m9.17 14.83-4.24 4.24" /></svg>;
  return resourceCategoryIcon("fertility");
}

function professionalStepIcon(icon: string) {
  if (icon === "profile") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>;
  if (icon === "match") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 2v2" /><path d="M5 2v2" /><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" /><path d="M8 15a6 6 0 0 0 12 0v-3" /><circle cx="20" cy="10" r="2" /></svg>;
}

// Public directory of vetted professionals, per the /professionals TZ (Sept 2026).
// Clinics & lawyers reuse the existing catalog directories once signed in; therapists and
// financial advisors are marked available:false until real profiles are onboarded - flip
// those two flags (and swap in real copy) once that's true.
const PROFESSIONALS_TEXT: Record<CookieLocale, {
  eyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaPrimary: string;
  heroCtaSecondary: string;
  categoriesEyebrow: string;
  categoriesTitle: string;
  categoriesSubtitle: string;
  categories: Array<{ key: string; icon: string; title: string; description: string; statSuffix: string | null; available: boolean }>;
  comingSoonLabel: string;
  stepsEyebrow: string;
  stepsTitle: string;
  steps: Array<[string, string, string, string]>;
  trustTitle: string;
  trustDescription: string;
  trustCta: string;
  closingTitle: string;
  closingSubtitle: string;
  closingCta: string;
}> = {
  en: {
    eyebrow: "Professional support",
    heroTitle: "Trusted experts for every step of your journey",
    heroSubtitle: "Fertility clinics, family lawyers, therapists and financial advisors - vetted, verified, and available when you're ready to talk.",
    heroCtaPrimary: "Sign up free",
    heroCtaSecondary: "See how verification works",
    categoriesEyebrow: "Who's on the platform",
    categoriesTitle: "Support for every part of building a family",
    categoriesSubtitle: "Browse categories publicly - full profiles and booking unlock once you create a free account.",
    categories: [
      { key: "clinics", icon: "fertility", title: "Fertility clinics", description: "Compare verified fertility clinics worldwide. Book video consultations once you're signed in.", statSuffix: "partner clinics", available: true },
      { key: "lawyers", icon: "scale", title: "Family lawyers", description: "Reproductive law specialists for contracts, parentage and co-parenting agreements.", statSuffix: "lawyers", available: true },
      { key: "therapists", icon: "support", title: "Therapists & counselors", description: "Talk through the emotional side of building a family - before, during and after you find your match.", statSuffix: null, available: false },
      { key: "financial", icon: "wallet", title: "Financial advisors", description: "Understand the real cost of donor conception, surrogacy or adoption before you commit.", statSuffix: null, available: false },
    ],
    comingSoonLabel: "Coming soon",
    stepsEyebrow: "How it works",
    stepsTitle: "From browsing to booking, in three steps",
    steps: [
      ["01", "Browse categories", "See who's available in your country, across all four categories.", "clinic"],
      ["02", "Sign up free", "Create your account to unlock full profiles and details.", "profile"],
      ["03", "Book a consultation", "Chat or video call, right inside LetsBeParents.", "match"],
    ],
    trustTitle: "Every professional is verified before they're listed",
    trustDescription: "Licenses and credentials are checked before a clinic or lawyer appears on LetsBeParents. See exactly what we check and what's still on you to confirm yourself.",
    trustCta: "See what we check",
    closingTitle: "Ready to connect with the right expert?",
    closingSubtitle: "Create your free account to unlock full profiles and book your first consultation.",
    closingCta: "Create free account",
  },
  ru: {
    eyebrow: "Профессиональная поддержка",
    heroTitle: "Проверенные специалисты на каждом этапе вашего пути",
    heroSubtitle: "Клиники репродукции, семейные юристы, психологи и финансовые консультанты - проверены, верифицированы и готовы поговорить, когда вы будете готовы.",
    heroCtaPrimary: "Зарегистрироваться бесплатно",
    heroCtaSecondary: "Как работает проверка",
    categoriesEyebrow: "Кто есть на платформе",
    categoriesTitle: "Поддержка на каждом этапе создания семьи",
    categoriesSubtitle: "Категории можно посмотреть без регистрации - полные профили и бронирование открываются после создания бесплатного аккаунта.",
    categories: [
      { key: "clinics", icon: "fertility", title: "Клиники репродукции", description: "Сравнивайте проверенные клиники репродукции по всему миру. Бронируйте видеоконсультации после входа в аккаунт.", statSuffix: "партнёрских клиник", available: true },
      { key: "lawyers", icon: "scale", title: "Семейные юристы", description: "Специалисты по репродуктивному праву - контракты, установление родительства, соглашения о совместном родительстве.", statSuffix: "юристов", available: true },
      { key: "therapists", icon: "support", title: "Психологи и консультанты", description: "Обсудите эмоциональную сторону создания семьи - до, во время и после того, как найдёте пару.", statSuffix: null, available: false },
      { key: "financial", icon: "wallet", title: "Финансовые консультанты", description: "Разберитесь в реальной стоимости донорского зачатия, суррогатного материнства или усыновления, прежде чем принимать решение.", statSuffix: null, available: false },
    ],
    comingSoonLabel: "Скоро",
    stepsEyebrow: "Как это работает",
    stepsTitle: "От просмотра до бронирования - три шага",
    steps: [
      ["01", "Просмотрите категории", "Смотрите, кто доступен в вашей стране, по всем четырём категориям.", "clinic"],
      ["02", "Зарегистрируйтесь бесплатно", "Создайте аккаунт, чтобы открыть полные профили и подробности.", "profile"],
      ["03", "Забронируйте консультацию", "Чат или видеозвонок - прямо внутри LetsBeParents.", "match"],
    ],
    trustTitle: "Каждый специалист проходит проверку перед публикацией",
    trustDescription: "Лицензии и квалификация проверяются прежде, чем клиника или юрист появятся на LetsBeParents. Посмотрите, что именно мы проверяем, а что стоит уточнить самостоятельно.",
    trustCta: "Что мы проверяем",
    closingTitle: "Готовы связаться с нужным специалистом?",
    closingSubtitle: "Создайте бесплатный аккаунт, чтобы открыть полные профили и забронировать первую консультацию.",
    closingCta: "Создать бесплатный аккаунт",
  },
  es: {
    eyebrow: "Apoyo profesional",
    heroTitle: "Expertos de confianza en cada paso de tu camino",
    heroSubtitle: "Clínicas de fertilidad, abogados de familia, terapeutas y asesores financieros - verificados y disponibles cuando estés listo para hablar.",
    heroCtaPrimary: "Regístrate gratis",
    heroCtaSecondary: "Cómo funciona la verificación",
    categoriesEyebrow: "Quién está en la plataforma",
    categoriesTitle: "Apoyo para cada parte de formar una familia",
    categoriesSubtitle: "Explora las categorías sin registrarte - los perfiles completos y la reserva se desbloquean al crear una cuenta gratuita.",
    categories: [
      { key: "clinics", icon: "fertility", title: "Clínicas de fertilidad", description: "Compara clínicas de fertilidad verificadas en todo el mundo. Reserva videoconsultas una vez que hayas iniciado sesión.", statSuffix: "clínicas partner", available: true },
      { key: "lawyers", icon: "scale", title: "Abogados de familia", description: "Especialistas en derecho reproductivo para contratos, filiación y acuerdos de coparentalidad.", statSuffix: "abogados", available: true },
      { key: "therapists", icon: "support", title: "Terapeutas y consejeros", description: "Habla sobre el lado emocional de formar una familia - antes, durante y después de encontrar tu match.", statSuffix: null, available: false },
      { key: "financial", icon: "wallet", title: "Asesores financieros", description: "Entiende el coste real de la donación, la gestación subrogada o la adopción antes de decidir.", statSuffix: null, available: false },
    ],
    comingSoonLabel: "Próximamente",
    stepsEyebrow: "Cómo funciona",
    stepsTitle: "De explorar a reservar, en tres pasos",
    steps: [
      ["01", "Explora las categorías", "Mira quién está disponible en tu país, en las cuatro categorías.", "clinic"],
      ["02", "Regístrate gratis", "Crea tu cuenta para desbloquear perfiles completos y detalles.", "profile"],
      ["03", "Reserva una consulta", "Chat o videollamada, directamente en LetsBeParents.", "match"],
    ],
    trustTitle: "Cada profesional se verifica antes de aparecer en la lista",
    trustDescription: "Las licencias y credenciales se comprueban antes de que una clínica o un abogado aparezca en LetsBeParents. Descubre exactamente qué comprobamos nosotros y qué te corresponde confirmar a ti.",
    trustCta: "Ver qué comprobamos",
    closingTitle: "¿Listo para conectar con el experto adecuado?",
    closingSubtitle: "Crea tu cuenta gratuita para desbloquear perfiles completos y reservar tu primera consulta.",
    closingCta: "Crear cuenta gratuita",
  },
  pt: {
    eyebrow: "Apoio profissional",
    heroTitle: "Especialistas de confiança em cada etapa da sua jornada",
    heroSubtitle: "Clínicas de fertilidade, advogados de família, terapeutas e consultores financeiros - avaliados, verificados e disponíveis quando você estiver pronto para conversar.",
    heroCtaPrimary: "Cadastre-se grátis",
    heroCtaSecondary: "Veja como funciona a verificação",
    categoriesEyebrow: "Quem está na plataforma",
    categoriesTitle: "Apoio para cada parte da construção de uma família",
    categoriesSubtitle: "Explore as categorias publicamente - os perfis completos e o agendamento são desbloqueados ao criar uma conta gratuita.",
    categories: [
      { key: "clinics", icon: "fertility", title: "Clínicas de fertilidade", description: "Compare clínicas de fertilidade verificadas em todo o mundo. Agende videoconsultas depois de entrar na sua conta.", statSuffix: "clínicas parceiras", available: true },
      { key: "lawyers", icon: "scale", title: "Advogados de família", description: "Especialistas em direito reprodutivo para contratos, filiação e acordos de coparentalidade.", statSuffix: "advogados", available: true },
      { key: "therapists", icon: "support", title: "Terapeutas e conselheiros", description: "Converse sobre o lado emocional de construir uma família - antes, durante e depois de encontrar o seu match.", statSuffix: null, available: false },
      { key: "financial", icon: "wallet", title: "Consultores financeiros", description: "Entenda o custo real da concepção com doador, da barriga de aluguel ou da adoção antes de se comprometer.", statSuffix: null, available: false },
    ],
    comingSoonLabel: "Em breve",
    stepsEyebrow: "Como funciona",
    stepsTitle: "Da busca ao agendamento, em três passos",
    steps: [
      ["01", "Explore as categorias", "Veja quem está disponível no seu país, nas quatro categorias.", "clinic"],
      ["02", "Cadastre-se grátis", "Crie a sua conta para desbloquear perfis completos e detalhes.", "profile"],
      ["03", "Agende uma consulta", "Converse por chat ou videochamada, direto na LetsBeParents.", "match"],
    ],
    trustTitle: "Todo profissional é verificado antes de ser listado",
    trustDescription: "Licenças e credenciais são verificadas antes que uma clínica ou advogado apareça na LetsBeParents. Veja exatamente o que verificamos e o que ainda cabe a você confirmar.",
    trustCta: "Veja o que verificamos",
    closingTitle: "Pronto para se conectar com o especialista certo?",
    closingSubtitle: "Crie a sua conta gratuita para desbloquear perfis completos e agendar a sua primeira consulta.",
    closingCta: "Criar conta gratuita",
  },
  fr: {
    eyebrow: "Accompagnement professionnel",
    heroTitle: "Des experts de confiance à chaque étape de votre parcours",
    heroSubtitle: "Cliniques de fertilité, avocats spécialisés en droit de la famille, thérapeutes et conseillers financiers - vérifiés et disponibles dès que vous êtes prêt(e) à en parler.",
    heroCtaPrimary: "Inscrivez-vous gratuitement",
    heroCtaSecondary: "Découvrir comment fonctionne la vérification",
    categoriesEyebrow: "Qui est présent sur la plateforme",
    categoriesTitle: "Un accompagnement pour chaque étape de la construction d'une famille",
    categoriesSubtitle: "Parcourez les catégories librement - les profils complets et la réservation se débloquent dès la création d'un compte gratuit.",
    categories: [
      { key: "clinics", icon: "fertility", title: "Cliniques de fertilité", description: "Comparez des cliniques de fertilité vérifiées dans le monde entier. Réservez des consultations vidéo une fois connecté(e).", statSuffix: "cliniques partenaires", available: true },
      { key: "lawyers", icon: "scale", title: "Avocats spécialisés en droit de la famille", description: "Spécialistes du droit de la reproduction pour les contrats, la filiation et les accords de coparentalité.", statSuffix: "avocats", available: true },
      { key: "therapists", icon: "support", title: "Thérapeutes et conseillers", description: "Parlez de la dimension émotionnelle de la construction d'une famille - avant, pendant et après avoir trouvé votre match.", statSuffix: null, available: false },
      { key: "financial", icon: "wallet", title: "Conseillers financiers", description: "Comprenez le coût réel de la conception avec donneur, de la GPA ou de l'adoption avant de vous engager.", statSuffix: null, available: false },
    ],
    comingSoonLabel: "Bientôt disponible",
    stepsEyebrow: "Comment ça marche",
    stepsTitle: "De la recherche à la réservation, en trois étapes",
    steps: [
      ["01", "Parcourez les catégories", "Découvrez qui est disponible dans votre pays, dans les quatre catégories.", "clinic"],
      ["02", "Inscrivez-vous gratuitement", "Créez votre compte pour débloquer les profils complets et tous les détails.", "profile"],
      ["03", "Réservez une consultation", "Chat ou appel vidéo, directement au sein de LetsBeParents.", "match"],
    ],
    trustTitle: "Chaque professionnel est vérifié avant d'être référencé",
    trustDescription: "Les licences et qualifications sont vérifiées avant qu'une clinique ou un avocat n'apparaisse sur LetsBeParents. Découvrez exactement ce que nous vérifions et ce qu'il vous reste à confirmer vous-même.",
    trustCta: "Voir ce que nous vérifions",
    closingTitle: "Prêt(e) à entrer en contact avec le bon expert ?",
    closingSubtitle: "Créez votre compte gratuit pour débloquer les profils complets et réserver votre première consultation.",
    closingCta: "Créer un compte gratuit",
  },
  de: {
    eyebrow: "Professionelle Unterstützung",
    heroTitle: "Vertrauenswürdige Expertinnen und Experten für jeden Schritt Ihrer Reise",
    heroSubtitle: "Kinderwunschkliniken, Familienanwälte, Therapeutinnen und Finanzberater - geprüft, verifiziert und verfügbar, sobald Sie bereit sind zu sprechen.",
    heroCtaPrimary: "Kostenlos registrieren",
    heroCtaSecondary: "So funktioniert die Verifizierung",
    categoriesEyebrow: "Wer auf der Plattform vertreten ist",
    categoriesTitle: "Unterstützung für jeden Teil des Familienaufbaus",
    categoriesSubtitle: "Kategorien können öffentlich durchstöbert werden - vollständige Profile und Buchung werden freigeschaltet, sobald Sie ein kostenloses Konto erstellen.",
    categories: [
      { key: "clinics", icon: "fertility", title: "Kinderwunschkliniken", description: "Vergleichen Sie verifizierte Kinderwunschkliniken weltweit. Buchen Sie Videoberatungen, sobald Sie angemeldet sind.", statSuffix: "Partnerkliniken", available: true },
      { key: "lawyers", icon: "scale", title: "Familienanwälte", description: "Spezialisten für Reproduktionsrecht - Verträge, Elternschaft und Co-Parenting-Vereinbarungen.", statSuffix: "Anwälte", available: true },
      { key: "therapists", icon: "support", title: "Therapeuten & Beraterinnen", description: "Sprechen Sie über die emotionale Seite des Familienaufbaus - davor, währenddessen und nachdem Sie Ihr Match gefunden haben.", statSuffix: null, available: false },
      { key: "financial", icon: "wallet", title: "Finanzberater", description: "Verstehen Sie die tatsächlichen Kosten von Samenspende, Leihmutterschaft oder Adoption, bevor Sie sich festlegen.", statSuffix: null, available: false },
    ],
    comingSoonLabel: "Demnächst verfügbar",
    stepsEyebrow: "So funktioniert's",
    stepsTitle: "Vom Stöbern bis zur Buchung in drei Schritten",
    steps: [
      ["01", "Kategorien durchstöbern", "Sehen Sie, wer in Ihrem Land verfügbar ist - in allen vier Kategorien.", "clinic"],
      ["02", "Kostenlos registrieren", "Erstellen Sie Ihr Konto, um vollständige Profile und Details freizuschalten.", "profile"],
      ["03", "Beratung buchen", "Chat oder Videoanruf, direkt in LetsBeParents.", "match"],
    ],
    trustTitle: "Jede Fachperson wird vor der Aufnahme verifiziert",
    trustDescription: "Lizenzen und Qualifikationen werden geprüft, bevor eine Klinik oder ein Anwalt auf LetsBeParents erscheint. Erfahren Sie genau, was wir prüfen und was Sie selbst noch bestätigen sollten.",
    trustCta: "Sehen, was wir prüfen",
    closingTitle: "Bereit, die richtige Fachperson kennenzulernen?",
    closingSubtitle: "Erstellen Sie Ihr kostenloses Konto, um vollständige Profile freizuschalten und Ihre erste Beratung zu buchen.",
    closingCta: "Kostenloses Konto erstellen",
  },
  it: {
    eyebrow: "Supporto professionale",
    heroTitle: "Esperti di fiducia per ogni fase del tuo percorso",
    heroSubtitle: "Cliniche della fertilità, avvocati di famiglia, terapeuti e consulenti finanziari - verificati e disponibili quando sei pronto/a a parlarne.",
    heroCtaPrimary: "Iscriviti gratis",
    heroCtaSecondary: "Scopri come funziona la verifica",
    categoriesEyebrow: "Chi è presente sulla piattaforma",
    categoriesTitle: "Supporto per ogni fase della costruzione di una famiglia",
    categoriesSubtitle: "Sfoglia le categorie pubblicamente - i profili completi e la prenotazione si sbloccano creando un account gratuito.",
    categories: [
      { key: "clinics", icon: "fertility", title: "Cliniche della fertilità", description: "Confronta cliniche della fertilità verificate in tutto il mondo. Prenota videoconsulti una volta effettuato l'accesso.", statSuffix: "cliniche partner", available: true },
      { key: "lawyers", icon: "scale", title: "Avvocati di famiglia", description: "Specialisti in diritto della riproduzione per contratti, genitorialità legale e accordi di co-parenting.", statSuffix: "avvocati", available: true },
      { key: "therapists", icon: "support", title: "Terapeuti e consulenti", description: "Parla del lato emotivo della costruzione di una famiglia - prima, durante e dopo aver trovato il tuo match.", statSuffix: null, available: false },
      { key: "financial", icon: "wallet", title: "Consulenti finanziari", description: "Comprendi il costo reale del concepimento con donatore, della maternità surrogata o dell'adozione prima di impegnarti.", statSuffix: null, available: false },
    ],
    comingSoonLabel: "Prossimamente",
    stepsEyebrow: "Come funziona",
    stepsTitle: "Dalla ricerca alla prenotazione, in tre passi",
    steps: [
      ["01", "Sfoglia le categorie", "Scopri chi è disponibile nel tuo paese, in tutte e quattro le categorie.", "clinic"],
      ["02", "Iscriviti gratis", "Crea il tuo account per sbloccare profili completi e dettagli.", "profile"],
      ["03", "Prenota una consulenza", "Chat o videochiamata, direttamente dentro LetsBeParents.", "match"],
    ],
    trustTitle: "Ogni professionista viene verificato prima di essere inserito nell'elenco",
    trustDescription: "Licenze e credenziali vengono controllate prima che una clinica o un avvocato compaia su LetsBeParents. Scopri esattamente cosa verifichiamo noi e cosa spetta a te confermare.",
    trustCta: "Scopri cosa verifichiamo",
    closingTitle: "Pronto/a a entrare in contatto con l'esperto giusto?",
    closingSubtitle: "Crea il tuo account gratuito per sbloccare i profili completi e prenotare la tua prima consulenza.",
    closingCta: "Crea account gratuito",
  },
  pl: {
    eyebrow: "Wsparcie profesjonalistów",
    heroTitle: "Zaufani eksperci na każdym etapie Twojej drogi",
    heroSubtitle: "Kliniki leczenia niepłodności, prawnicy rodzinni, terapeuci i doradcy finansowi - zweryfikowani i dostępni, gdy będziesz gotowy/a porozmawiać.",
    heroCtaPrimary: "Zarejestruj się za darmo",
    heroCtaSecondary: "Zobacz, jak działa weryfikacja",
    categoriesEyebrow: "Kto jest na platformie",
    categoriesTitle: "Wsparcie na każdym etapie budowania rodziny",
    categoriesSubtitle: "Przeglądaj kategorie publicznie - pełne profile i możliwość rezerwacji odblokowują się po założeniu darmowego konta.",
    categories: [
      { key: "clinics", icon: "fertility", title: "Kliniki leczenia niepłodności", description: "Porównuj zweryfikowane kliniki leczenia niepłodności na całym świecie. Rezerwuj konsultacje wideo po zalogowaniu.", statSuffix: "klinik partnerskich", available: true },
      { key: "lawyers", icon: "scale", title: "Prawnicy rodzinni", description: "Specjaliści prawa reprodukcyjnego - umowy, ustalanie rodzicielstwa i porozumienia dotyczące co-parentingu.", statSuffix: "prawników", available: true },
      { key: "therapists", icon: "support", title: "Terapeuci i doradcy", description: "Porozmawiaj o emocjonalnej stronie budowania rodziny - przed, w trakcie i po znalezieniu dopasowania.", statSuffix: null, available: false },
      { key: "financial", icon: "wallet", title: "Doradcy finansowi", description: "Poznaj rzeczywisty koszt poczęcia z dawcą, surogacji lub adopcji, zanim podejmiesz decyzję.", statSuffix: null, available: false },
    ],
    comingSoonLabel: "Wkrótce",
    stepsEyebrow: "Jak to działa",
    stepsTitle: "Od przeglądania do rezerwacji w trzech krokach",
    steps: [
      ["01", "Przeglądaj kategorie", "Zobacz, kto jest dostępny w Twoim kraju, we wszystkich czterech kategoriach.", "clinic"],
      ["02", "Zarejestruj się za darmo", "Utwórz konto, aby odblokować pełne profile i szczegóły.", "profile"],
      ["03", "Zarezerwuj konsultację", "Czat lub rozmowa wideo - bezpośrednio w LetsBeParents.", "match"],
    ],
    trustTitle: "Każdy profesjonalista jest weryfikowany, zanim trafi na listę",
    trustDescription: "Licencje i kwalifikacje są sprawdzane, zanim klinika lub prawnik pojawią się na LetsBeParents. Zobacz dokładnie, co weryfikujemy, a co nadal musisz potwierdzić samodzielnie.",
    trustCta: "Zobacz, co weryfikujemy",
    closingTitle: "Gotowy/a, by skontaktować się z odpowiednim ekspertem?",
    closingSubtitle: "Załóż darmowe konto, aby odblokować pełne profile i zarezerwować pierwszą konsultację.",
    closingCta: "Załóż darmowe konto",
  },
};

function Professionals() {
  const locale = localeOf();
  const t = PROFESSIONALS_TEXT[locale];
  const stats = LANDING_TEXT[locale].stats;
  const clinicsCount = stats[2][0];
  const lawyersCount = stats[3][0];
  const statFor = (key: string, suffix: string | null) => {
    if (!suffix) return null;
    if (key === "clinics") return `${clinicsCount}+ ${suffix}`;
    if (key === "lawyers") return `${lawyersCount}+ ${suffix}`;
    return null;
  };
  return (
    <div className="professionals-page">
      <section className="professionals-hero">
        <span className="landing-pill"><i /><span>{t.eyebrow}</span></span>
        <h1>{t.heroTitle}</h1>
        <p>{t.heroSubtitle}</p>
        <div className="professionals-hero-actions">
          <Link className="landing-gradient-button" to={`/${locale}/auth/register`}>{t.heroCtaPrimary} {resourceArrow()}</Link>
          <Link className="professionals-secondary-link" to={`/${locale}/trust-safety`}>{t.heroCtaSecondary}</Link>
        </div>
      </section>

      <section className="professionals-categories">
        <div className="landing-section-intro">
          <span>{t.categoriesEyebrow}</span>
          <h2>{t.categoriesTitle}</h2>
          <p className="resources-section-sub">{t.categoriesSubtitle}</p>
        </div>
        <div className="professionals-cat-grid">
          {t.categories.map((cat) => {
            const stat = statFor(cat.key, cat.statSuffix);
            return (
              <div key={cat.key} className={`professionals-card${cat.available ? "" : " is-soon"}`}>
                {!cat.available && <span className="resources-tool-tag soon professionals-soon-tag">{t.comingSoonLabel}</span>}
                <span className="resources-category-icon">{professionalIcon(cat.icon)}</span>
                <h3>{cat.title}</h3>
                <p>{cat.description}</p>
                {stat && <div className="professionals-card-stat">{stat}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="professionals-steps-section">
        <div className="landing-section-intro">
          <span>{t.stepsEyebrow}</span>
          <h2>{t.stepsTitle}</h2>
        </div>
        <div className="professionals-steps-row">
          {t.steps.map(([number, title, description, icon]) => (
            <article key={number} className="professionals-step-card">
              <div className="landing-step-icon">{professionalStepIcon(icon)}</div>
              <div className="landing-step-number">{number}</div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="resources-pro">
        <span className="resources-pro-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>
        </span>
        <div className="resources-pro-copy">
          <h2>{t.trustTitle}</h2>
          <p>{t.trustDescription}</p>
        </div>
        <Link className="resources-pro-button" to={`/${locale}/trust-safety`}>{t.trustCta} {resourceArrow()}</Link>
      </section>

      <section className="landing-cta">
        <h2>{t.closingTitle}</h2>
        <p>{t.closingSubtitle}</p>
        <Link to={`/${locale}/auth/register`}>{t.closingCta} <span>{"→"}</span></Link>
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
  pt: {
    pill: "Confiança e Segurança",
    title: "Todos os perfis têm identidade verificada - veja exatamente o que verificamos.",
    intro: "Construir uma família significa confiar nas pessoas que você conhece pelo caminho. Veja o que a LetsBeParents verifica antes de você se conectar, e o que ainda cabe a você conferir por conta própria.",
    checks: [
      ["Verificação de identidade", "Antes de desbloquear acesso completo às combinações, os membros confirmam sua identidade por meio de uma verificação segura de documentos, realizada por nosso parceiro de verificação, a Didit. Não armazenamos seu documento de identidade ou selfie nos servidores da LetsBeParents - esses dados são processados e mantidos pela Didit conforme seus próprios termos de privacidade, e podem ser excluídos mediante solicitação."],
      ["Revisão de fotos", "Cada foto de perfil é analisada automaticamente em busca de violações das políticas, e qualquer foto denunciada é revisada por nossa equipe."],
      ["Mensagens e vídeo privados", "Conversas e chamadas de vídeo acontecem dentro da LetsBeParents. Seu telefone e e-mail permanecem privados até você decidir compartilhá-los."],
      ["Clínicas e advogados avaliados", "Cada clínica e advogado em nosso diretório é avaliado antes de ser listado, para que você nunca precise adivinhar com quem está falando."],
      ["Denuncie e bloqueie, a qualquer momento", "Você pode denunciar ou bloquear qualquer membro com um toque. Cada denúncia é revisada por nossa equipe, não por um robô."],
      ["Proteção de dados", "Seus dados são criptografados em trânsito e em repouso. Nunca vendemos suas informações, e você controla o que é visível no seu perfil."],
    ],
    diditLinks: { privacy: "Política de Privacidade da Didit", terms: "Termos de Verificação de Identidade da Didit" },
    noteTitle: "O que a verificação significa - e o que não significa",
    noteCopy: "As verificações de identidade e de fotos reduzem perfis falsos e duplicados, mas não são uma garantia médica, jurídica ou de verificação de antecedentes. Recomendamos fortemente buscar aconselhamento jurídico independente antes de qualquer acordo de doação ou coparentalidade, e encontrar novas conexões pela primeira vez em um local público.",
    ctaTitle: "Dúvidas sobre segurança na LetsBeParents?",
    ctaButton: "Fale com nossa equipe",
  },
  fr: {
    pill: "Confiance et sécurité",
    title: "Chaque profil a une identité vérifiée - découvrez exactement ce que nous contrôlons.",
    intro: "Fonder une famille, c'est faire confiance aux personnes que vous rencontrez en chemin. Voici ce que LetsBeParents vérifie avant que vous entriez en contact, et ce qu'il vous reste à vérifier vous-même.",
    checks: [
      ["Vérification d'identité", "Avant de débloquer l'accès complet aux mises en relation, les membres confirment leur identité via une vérification sécurisée de documents, assurée par notre partenaire de vérification, Didit. Nous ne conservons pas votre pièce d'identité ni votre selfie sur les serveurs de LetsBeParents - ces données sont traitées et conservées par Didit selon ses propres conditions de confidentialité, et peuvent être supprimées sur demande."],
      ["Contrôle des photos", "Chaque photo de profil est automatiquement analysée pour détecter les violations des règles, et toute photo signalée est examinée par notre équipe."],
      ["Messagerie et vidéo privées", "Les discussions et appels vidéo se déroulent au sein de LetsBeParents. Votre numéro de téléphone et votre e-mail restent privés jusqu'à ce que vous choisissiez de les partager."],
      ["Cliniques et avocats vérifiés", "Chaque clinique et avocat de notre annuaire est examiné avant d'être répertorié, afin que vous n'ayez jamais à deviner à qui vous vous adressez."],
      ["Signaler et bloquer, à tout moment", "Vous pouvez signaler ou bloquer n'importe quel membre en un geste. Chaque signalement est examiné par notre équipe, pas par un robot."],
      ["Protection des données", "Vos données sont chiffrées en transit et au repos. Nous ne vendons jamais vos informations, et vous contrôlez ce qui est visible sur votre profil."],
    ],
    diditLinks: { privacy: "Politique de confidentialité de Didit", terms: "Conditions de vérification d'identité de Didit" },
    noteTitle: "Ce que signifie la vérification - et ce qu'elle ne signifie pas",
    noteCopy: "Les vérifications d'identité et de photos réduisent les profils faux et en double, mais elles ne constituent pas une garantie médicale, juridique ou de vérification des antécédents. Nous recommandons vivement de consulter un conseil juridique indépendant avant tout accord de don ou de coparentalité, et de rencontrer une nouvelle personne pour la première fois dans un lieu public.",
    ctaTitle: "Des questions sur la sécurité sur LetsBeParents ?",
    ctaButton: "Contacter notre équipe",
  },
  de: {
    pill: "Vertrauen & Sicherheit",
    title: "Jedes Profil ist identitätsgeprüft - sehen Sie genau, was wir kontrollieren.",
    intro: "Eine Familie zu gründen bedeutet, den Menschen zu vertrauen, die Sie auf diesem Weg treffen. Hier erfahren Sie, was LetsBeParents prüft, bevor Sie in Kontakt treten, und was Sie selbst noch überprüfen sollten.",
    checks: [
      ["Identitätsprüfung", "Bevor Mitglieder vollen Zugriff auf Matches erhalten, bestätigen sie ihre Identität durch eine sichere Dokumentenprüfung, die von unserem Verifizierungspartner Didit durchgeführt wird. Wir speichern Ihr Ausweisdokument oder Selfie nicht auf den eigenen Servern von LetsBeParents - diese Daten werden von Didit gemäß dessen eigenen Datenschutzbestimmungen verarbeitet und gespeichert und können auf Anfrage gelöscht werden."],
      ["Fotoprüfung", "Jedes Profilfoto wird automatisch auf Regelverstöße geprüft, und jedes gemeldete Foto wird von unserem Team überprüft."],
      ["Private Nachrichten & Video", "Chats und Videoanrufe finden innerhalb von LetsBeParents statt. Ihre Telefonnummer und E-Mail-Adresse bleiben privat, bis Sie sich entscheiden, sie zu teilen."],
      ["Geprüfte Kliniken & Anwälte", "Jede Klinik und jeder Anwalt in unserem Verzeichnis wird vor der Aufnahme überprüft, sodass Sie nie raten müssen, mit wem Sie es zu tun haben."],
      ["Jederzeit melden & blockieren", "Sie können jedes Mitglied mit einem Tippen melden oder blockieren. Jede Meldung wird von unserem Team geprüft, nicht von einem Bot."],
      ["Datenschutz", "Ihre Daten werden bei der Übertragung und Speicherung verschlüsselt. Wir verkaufen Ihre Informationen niemals, und Sie bestimmen, was in Ihrem Profil sichtbar ist."],
    ],
    diditLinks: { privacy: "Datenschutzrichtlinie von Didit", terms: "Bedingungen zur Identitätsprüfung von Didit" },
    noteTitle: "Was die Verifizierung bedeutet - und was nicht",
    noteCopy: "Identitäts- und Fotoprüfungen verringern gefälschte und doppelte Profile, sind aber keine medizinische, rechtliche oder Background-Check-Garantie. Wir empfehlen dringend, vor jeder Samenspende- oder Co-Elternschaftsvereinbarung unabhängigen rechtlichen Rat einzuholen und neue Kontakte zum ersten Mal an einem öffentlichen Ort zu treffen.",
    ctaTitle: "Fragen zur Sicherheit auf LetsBeParents?",
    ctaButton: "Unser Team kontaktieren",
  },
  it: {
    pill: "Fiducia e sicurezza",
    title: "Ogni profilo ha l'identità verificata - scopri esattamente cosa controlliamo.",
    intro: "Costruire una famiglia significa fidarsi delle persone che incontri lungo il percorso. Ecco cosa verifica LetsBeParents prima che tu ti metta in contatto, e cosa spetta ancora a te controllare.",
    checks: [
      ["Verifica dell'identità", "Prima di sbloccare l'accesso completo agli abbinamenti, i membri confermano la propria identità tramite un controllo sicuro dei documenti, gestito dal nostro partner di verifica, Didit. Non conserviamo il tuo documento d'identità o il selfie sui server di LetsBeParents - questi dati vengono elaborati e conservati da Didit secondo i propri termini sulla privacy, e possono essere cancellati su richiesta."],
      ["Revisione delle foto", "Ogni foto del profilo viene controllata automaticamente per individuare violazioni delle regole, e ogni foto segnalata viene rivista dal nostro team."],
      ["Messaggi e video privati", "Chat e videochiamate avvengono all'interno di LetsBeParents. Il tuo numero di telefono e la tua email restano privati finché non decidi di condividerli."],
      ["Cliniche e avvocati verificati", "Ogni clinica e avvocato nella nostra directory viene esaminato prima di essere inserito, così non devi mai indovinare con chi stai parlando."],
      ["Segnala e blocca, in qualsiasi momento", "Puoi segnalare o bloccare qualsiasi membro con un tocco. Ogni segnalazione viene esaminata dal nostro team, non da un bot."],
      ["Protezione dei dati", "I tuoi dati sono crittografati in transito e a riposo. Non vendiamo mai le tue informazioni, e sei tu a controllare cosa è visibile nel tuo profilo."],
    ],
    diditLinks: { privacy: "Informativa sulla privacy di Didit", terms: "Termini di verifica dell'identità di Didit" },
    noteTitle: "Cosa significa la verifica - e cosa non significa",
    noteCopy: "I controlli sull'identità e sulle foto riducono i profili falsi e duplicati, ma non sono una garanzia medica, legale o di controllo dei precedenti. Consigliamo vivamente di richiedere una consulenza legale indipendente prima di qualsiasi accordo di donazione o co-genitorialità, e di incontrare per la prima volta nuove persone in un luogo pubblico.",
    ctaTitle: "Domande sulla sicurezza su LetsBeParents?",
    ctaButton: "Contatta il nostro team",
  },
  pl: {
    pill: "Zaufanie i bezpieczeństwo",
    title: "Każdy profil ma zweryfikowaną tożsamość - zobacz dokładnie, co sprawdzamy.",
    intro: "Budowanie rodziny oznacza zaufanie do osób, które spotykasz po drodze. Oto, co LetsBeParents weryfikuje, zanim się skontaktujesz, i co nadal warto sprawdzić samodzielnie.",
    checks: [
      ["Weryfikacja tożsamości", "Zanim członkowie odblokują pełny dostęp do dopasowań, potwierdzają swoją tożsamość poprzez bezpieczną weryfikację dokumentów, przeprowadzaną przez naszego partnera weryfikacyjnego, Didit. Nie przechowujemy Twojego dokumentu tożsamości ani selfie na własnych serwerach LetsBeParents - te dane są przetwarzane i przechowywane przez Didit zgodnie z ich własnymi zasadami prywatności i mogą zostać usunięte na żądanie."],
      ["Weryfikacja zdjęć", "Każde zdjęcie profilowe jest automatycznie sprawdzane pod kątem naruszeń zasad, a każde zgłoszone zdjęcie jest sprawdzane przez nasz zespół."],
      ["Prywatne wiadomości i wideo", "Czaty i połączenia wideo odbywają się w ramach LetsBeParents. Twój numer telefonu i e-mail pozostają prywatne, dopóki sam(a) nie zdecydujesz się je udostępnić."],
      ["Zweryfikowane kliniki i prawnicy", "Każda klinika i prawnik w naszym katalogu są sprawdzani, zanim zostaną dodani do listy, więc nigdy nie musisz zgadywać, z kim się kontaktujesz."],
      ["Zgłoś i zablokuj w każdej chwili", "Możesz zgłosić lub zablokować dowolnego członka jednym dotknięciem. Każde zgłoszenie jest sprawdzane przez nasz zespół, a nie przez bota."],
      ["Ochrona danych", "Twoje dane są szyfrowane podczas przesyłania i przechowywania. Nigdy nie sprzedajemy Twoich informacji, a Ty decydujesz, co jest widoczne w Twoim profilu."],
    ],
    diditLinks: { privacy: "Polityka prywatności Didit", terms: "Warunki weryfikacji tożsamości Didit" },
    noteTitle: "Co oznacza weryfikacja - a czego nie oznacza",
    noteCopy: "Weryfikacja tożsamości i zdjęć zmniejsza liczbę fałszywych i zduplikowanych profili, ale nie stanowi gwarancji medycznej, prawnej ani sprawdzenia przeszłości. Zdecydowanie zalecamy skorzystanie z niezależnej porady prawnej przed zawarciem jakiejkolwiek umowy dawstwa lub co-rodzicielstwa oraz spotykanie się z nowo poznanymi osobami po raz pierwszy w miejscu publicznym.",
    ctaTitle: "Masz pytania dotyczące bezpieczeństwa na LetsBeParents?",
    ctaButton: "Skontaktuj się z naszym zespołem",
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

function Boost({ session }: { session: Session }) {
  const locale = localeOf();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [active, setActive] = useState(false);
  const [activeUntil, setActiveUntil] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [requesting, setRequesting] = useState(false);

  const load = () => {
    if (!session) return;
    setStatus("loading");
    api
      .get<{ active: boolean; activeUntil: string | null; pendingRequestId: unknown }>("/member/boost")
      .then((data) => {
        setActive(data.active);
        setActiveUntil(data.activeUntil);
        setPendingRequestId(data.pendingRequestId);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [session]);

  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;

  const requestBoost = async () => {
    setRequesting(true);
    setNotice("");
    setErrorMsg("");
    try {
      const data = await api.post<{
        ok: true;
        status: string;
        activeUntil?: string;
        requestId?: number;
        message?: string;
      }>("/member/boost", {});
      setNotice(data.message || "Boost requested.");
      load();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 403
          ? "You need to be verified before requesting a Boost."
          : "Could not request a Boost right now.",
      );
    } finally {
      setRequesting(false);
    }
  };

  return (
    <section className="member-form">
      <h1>Boost</h1>
      <MemberLinks locale={locale} />
      <p>
        Boost puts your profile near the top of Catalog results for a
        limited time, so more people see you first.
      </p>
      {status === "loading" && <p className="notice">Loading…</p>}
      {status === "error" && (
        <p className="error">Could not load your Boost status.</p>
      )}
      {status === "ok" && (
        <>
          {active ? (
            <p className="notice">
              Your Boost is active until {asText(activeUntil)}.
            </p>
          ) : pendingRequestId ? (
            <p className="notice">Your Boost request is under review.</p>
          ) : (
            <button
              className="primary"
              onClick={() => void requestBoost()}
              disabled={requesting}
            >
              {requesting ? "Requesting…" : "Request a Boost"}
            </button>
          )}
        </>
      )}
      {notice && <p className="notice">{notice}</p>}
      {errorMsg && <p className="error">{errorMsg}</p>}
    </section>
  );
}

function Referral({ session }: { session: Session }) {
  const locale = localeOf();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [code, setCode] = useState("");
  const [referredCount, setReferredCount] = useState(0);
  const [rewardedCount, setRewardedCount] = useState(0);
  const [redeemedCode, setRedeemedCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState("");
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const load = () => {
    if (!session) return;
    setStatus("loading");
    api
      .get<{
        code: string;
        referredCount: number;
        rewardedCount: number;
        redeemedCode: string | null;
      }>("/member/referral")
      .then((data) => {
        setCode(data.code);
        setReferredCount(data.referredCount);
        setRewardedCount(data.rewardedCount);
        setRedeemedCode(data.redeemedCode);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [session]);

  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;

  const redeem = async () => {
    const value = inputCode.trim();
    if (!value) return;
    setRedeeming(true);
    setNotice("");
    setErrorMsg("");
    try {
      await api.post("/member/referral/redeem", { code: value });
      setNotice("Invite code redeemed.");
      setInputCode("");
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409)
        setErrorMsg("You've already used an invite code.");
      else if (err instanceof ApiError && err.status === 404)
        setErrorMsg("That invite code was not found.");
      else if (err instanceof ApiError && err.status === 422)
        setErrorMsg("You can't use your own invite code.");
      else setErrorMsg("Could not redeem that code.");
    } finally {
      setRedeeming(false);
    }
  };

  // Alena: "а почему нельзя прислать ссылку просто для регистрации" - the
  // code alone made a friend type it in by hand on the "Have an invite
  // code?" field below. A link is much lower-friction: Signup (see the
  // Signup() component above) now reads ?invite=CODE from the URL and
  // redeems it automatically right after the friend's account is created,
  // so sharing this link is a true one-click flow. The raw code is kept
  // too - some people prefer to just read it out loud or paste it in a
  // message rather than a link.
  const inviteLink = typeof window !== "undefined" && code
    ? `${window.location.origin}/${locale}/auth/register?invite=${encodeURIComponent(code)}`
    : "";
  const [linkCopied, setLinkCopied] = useState(false);
  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      setErrorMsg("Could not copy the link - you can select and copy it manually.");
    }
  };

  return (
    <section className="member-form">
      <h1>Referral</h1>
      <MemberLinks locale={locale} />
      <p>
        Invite friends to LetsBeParents - when they join and get verified,
        you earn a profile Boost.
      </p>
      {status === "loading" && <p className="notice">Loading…</p>}
      {status === "error" && (
        <p className="error">Could not load your referral info.</p>
      )}
      {status === "ok" && (
        <>
          <div className="list-card referral-code-card">
            <p>Your invite link</p>
            <div className="referral-link-row">
              <input className="referral-link-field" value={inviteLink} readOnly onFocus={(event) => event.target.select()} />
              <button type="button" className="primary" onClick={() => void copyInviteLink()}>
                {linkCopied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <p className="referral-code-fallback">
              Or share the code directly: <strong>{code}</strong>
            </p>
            <p>
              {referredCount} friend(s) invited - {rewardedCount} rewarded
            </p>
          </div>
          {!redeemedCode ? (
            <>
              <label>
                Have an invite code?
                <input
                  value={inputCode}
                  onChange={(event) => setInputCode(event.target.value)}
                  placeholder="Enter invite code"
                />
              </label>
              <button
                className="primary"
                onClick={() => void redeem()}
                disabled={!inputCode.trim() || redeeming}
              >
                {redeeming ? "Redeeming…" : "Redeem code"}
              </button>
            </>
          ) : (
            <p className="notice">
              You've already redeemed an invite code ({redeemedCode}).
            </p>
          )}
        </>
      )}
      {notice && <p className="notice">{notice}</p>}
      {errorMsg && <p className="error">{errorMsg}</p>}
    </section>
  );
}

function SafetyCheckIn({ session }: { session: Session }) {
  const locale = localeOf();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [checkins, setCheckins] = useState<Row[]>([]);
  const [withWhom, setWithWhom] = useState("");
  const [plan, setPlan] = useState("");
  const [hours, setHours] = useState(3);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const load = () => {
    if (!session) return;
    setStatus("loading");
    api
      .get<{ ok: true; checkins: Row[] }>("/member/safety-checkins")
      .then((data) => {
        setCheckins(data.checkins || []);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [session]);

  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;

  const create = async () => {
    if (!plan.trim()) return;
    setCreating(true);
    setNotice("");
    setErrorMsg("");
    try {
      await api.post("/member/safety-checkins", {
        withWhom: withWhom.trim() || undefined,
        plan: plan.trim(),
        hoursUntilCheckIn: hours,
      });
      setPlan("");
      setWithWhom("");
      setNotice("Check-in scheduled.");
      load();
    } catch {
      setErrorMsg("Could not schedule that check-in.");
    } finally {
      setCreating(false);
    }
  };

  const markSafe = async (item: Row) => {
    try {
      await api.post(
        `/member/safety-checkins/${encodeURIComponent(asText(item.id))}/safe`,
        {},
      );
      load();
    } catch {
      setErrorMsg("Could not mark that check-in as safe.");
    }
  };

  const cancelCheckin = async (item: Row) => {
    try {
      await api.post(
        `/member/safety-checkins/${encodeURIComponent(asText(item.id))}/cancel`,
        {},
      );
      load();
    } catch {
      setErrorMsg("Could not cancel that check-in.");
    }
  };

  return (
    <section className="member-form">
      <h1>Safety Check-In</h1>
      <MemberLinks locale={locale} />
      <p>
        Meeting someone in person for the first time? Set a check-in - it
        stays on your record here as a reminder to follow up with yourself
        by the deadline.
      </p>
      {status === "loading" && <p className="notice">Loading…</p>}
      {status === "error" && (
        <p className="error">Could not load your check-ins.</p>
      )}
      <label>
        Meeting with (optional)
        <input
          value={withWhom}
          onChange={(event) => setWithWhom(event.target.value)}
          placeholder="Who are you meeting?"
        />
      </label>
      <label>
        Plan
        <textarea
          rows={3}
          value={plan}
          onChange={(event) => setPlan(event.target.value)}
          placeholder="Where and when, in case someone needs to check on you"
        />
      </label>
      <label>
        Check in with yourself after
        <select
          value={hours}
          onChange={(event) => setHours(Number(event.target.value))}
        >
          <option value={1}>1 hour</option>
          <option value={2}>2 hours</option>
          <option value={3}>3 hours</option>
          <option value={6}>6 hours</option>
          <option value={12}>12 hours</option>
          <option value={24}>24 hours</option>
          <option value={48}>48 hours</option>
          <option value={72}>72 hours</option>
        </select>
      </label>
      <button
        className="primary"
        onClick={() => void create()}
        disabled={!plan.trim() || creating}
      >
        {creating ? "Scheduling…" : "Schedule check-in"}
      </button>
      {notice && <p className="notice">{notice}</p>}
      {errorMsg && <p className="error">{errorMsg}</p>}
      <div className="list-card">
        <h2>Your check-ins</h2>
        {checkins.length === 0 ? (
          <p className="notice">No check-ins yet.</p>
        ) : (
          <ul className="family-room-documents">
            {checkins.map((item) => (
              <li key={asText(item.id)}>
                <span>
                  {asText(item.plan)}
                  {item.withWhom ? ` - with ${asText(item.withWhom)}` : ""}
                  {" - "}
                  {asText(item.status)}
                </span>
                {item.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => void markSafe(item)}
                    >
                      I'm safe
                    </button>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => void cancelCheckin(item)}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function VideoVerification({ session }: { session: Session }) {
  const locale = localeOf();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [videoVerified, setVideoVerified] = useState(false);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const load = () => {
    if (!session) return;
    setStatus("loading");
    api
      .get<{
        videoVerified: boolean;
        videoVerifiedAt: string | null;
        requestId: unknown;
        requestStatus: string | null;
      }>("/member/video-verification")
      .then((data) => {
        setVideoVerified(data.videoVerified);
        setRequestStatus(data.requestStatus);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [session]);

  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setNotice("");
    setErrorMsg("");
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api.upload<{
        ok: true;
        requestStatus?: string;
        message?: string;
      }>("/member/video-verification", data);
      setNotice(res.message || "Video submitted for review.");
      load();
    } catch (err) {
      setErrorMsg(
        err instanceof ApiError && err.status === 415
          ? "Unsupported video type - use MP4, MOV or WebM."
          : err instanceof ApiError && err.status === 413
          ? "That video is too large."
          : "Could not submit your video.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="member-form">
      <h1>Video Verification</h1>
      <MemberLinks locale={locale} />
      <p>
        Record a short video of yourself to earn the video-verified badge
        on your profile - a human reviews every submission.
      </p>
      {status === "loading" && <p className="notice">Loading…</p>}
      {status === "error" && (
        <p className="error">Could not load your video verification status.</p>
      )}
      {status === "ok" && (
        <>
          {videoVerified ? (
            <p className="notice">Your profile is video-verified.</p>
          ) : requestStatus === "PENDING" ? (
            <p className="notice">Your video is under review.</p>
          ) : (
            <>
              {requestStatus === "DECLINED" && (
                <p className="error">
                  Your last submission was declined - you can record a new
                  video and try again.
                </p>
              )}
              <label className="upload-control">
                {uploading ? "Uploading…" : "Upload a video (MP4, MOV or WebM)"}
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  disabled={uploading}
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
              </label>
            </>
          )}
        </>
      )}
      {notice && <p className="notice">{notice}</p>}
      {errorMsg && <p className="error">{errorMsg}</p>}
    </section>
  );
}

type ParenthoodCostItem = { key: string; low: number; high: number };
type ParenthoodCostPathDef = {
  key: string;
  perCycle: boolean;
  defaultUnits: number;
  minUnits: number;
  maxUnits: number;
  title: string;
  desc: string;
  tip: string;
  items: ParenthoodCostItem[];
};

const PARENTHOOD_COST_ITEM_LABELS: Record<string, string> = {
  legalFees: "Legal fees",
  agencyFees: "Agency / program fees",
  programFees: "Program & country fees",
  medicalFees: "Medical & clinic fees",
  medications: "Medications",
  screening: "Screening & testing",
  donorCompensation: "Donor compensation",
  surrogateCompensation: "Surrogate compensation",
  travel: "Travel",
  insurance: "Insurance & contingency",
  homeStudy: "Home study & training",
  postPlacement: "Post-placement / finalization",
  monitoring: "Monitoring & procedure fee",
};

const PARENTHOOD_COST_PATHS: ParenthoodCostPathDef[] = [
  {
    key: "knownDonor",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
    title: "Known donor (home insemination)",
    desc: "Conceiving with a donor you already know, without a fertility clinic.",
    tip: "A known-donor legal agreement, even between friends, protects everyone's parental rights later - don't skip it.",
    items: [
      { key: "screening", low: 300, high: 600 },
      { key: "legalFees", low: 500, high: 1500 },
    ],
  },
  {
    key: "cryobankIui",
    perCycle: true,
    defaultUnits: 3,
    minUnits: 1,
    maxUnits: 8,
    title: "Sperm bank + IUI",
    desc: "A donor vial from a licensed bank, inseminated at a clinic.",
    tip: "Many people need 3-6 cycles before a pregnancy - budgeting for several attempts up front avoids surprises.",
    items: [
      { key: "medicalFees", low: 900, high: 1300 },
      { key: "monitoring", low: 300, high: 800 },
    ],
  },
  {
    key: "ivfOwnEggs",
    perCycle: true,
    defaultUnits: 2,
    minUnits: 1,
    maxUnits: 6,
    title: "IVF (your own eggs)",
    desc: "In-vitro fertilization using your own eggs and sperm or a donor's.",
    tip: "Ask every clinic for an itemized quote - a flat 'IVF package' price often excludes medications and genetic testing.",
    items: [
      { key: "medicalFees", low: 12000, high: 20000 },
      { key: "medications", low: 3000, high: 7000 },
    ],
  },
  {
    key: "ivfDonorEggs",
    perCycle: true,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 3,
    title: "IVF with donor eggs",
    desc: "In-vitro fertilization using eggs from a donor.",
    tip: "Frozen (bank) donor eggs are typically cheaper than a fresh cycle matched specifically to you - worth asking both prices.",
    items: [
      { key: "donorCompensation", low: 10000, high: 20000 },
      { key: "medicalFees", low: 15000, high: 25000 },
      { key: "legalFees", low: 1500, high: 3000 },
    ],
  },
  {
    key: "surrogacy",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
    title: "Gestational surrogacy",
    desc: "A surrogate carries a pregnancy created with your embryo.",
    tip: "Get separate legal counsel for yourself and the surrogate - nearly every country/state requires it, and it protects both sides.",
    items: [
      { key: "surrogateCompensation", low: 40000, high: 60000 },
      { key: "agencyFees", low: 20000, high: 30000 },
      { key: "legalFees", low: 10000, high: 15000 },
      { key: "medicalFees", low: 20000, high: 30000 },
      { key: "insurance", low: 5000, high: 10000 },
    ],
  },
  {
    key: "domesticAdoption",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
    title: "Domestic adoption",
    desc: "Adopting a child born in your own country.",
    tip: "Costs vary hugely by agency - get a full written fee schedule before committing to one.",
    items: [
      { key: "agencyFees", low: 20000, high: 40000 },
      { key: "legalFees", low: 3000, high: 10000 },
      { key: "postPlacement", low: 1000, high: 3000 },
    ],
  },
  {
    key: "internationalAdoption",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
    title: "International adoption",
    desc: "Adopting a child from another country.",
    tip: "Timelines can run 1-3 years - factor in multiple trips and possible extended stays abroad.",
    items: [
      { key: "agencyFees", low: 15000, high: 30000 },
      { key: "programFees", low: 5000, high: 15000 },
      { key: "travel", low: 5000, high: 10000 },
      { key: "homeStudy", low: 3000, high: 6000 },
    ],
  },
  {
    key: "fosterAdopt",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
    title: "Foster-to-adopt",
    desc: "Fostering a child through the state system, with adoption as the goal.",
    tip: "In many countries this path is state-subsidized and dramatically cheaper than private paths - worth exploring if cost is the main barrier.",
    items: [
      { key: "homeStudy", low: 0, high: 1000 },
      { key: "legalFees", low: 500, high: 2000 },
    ],
  },
];

function parenthoodCostSum(items: ParenthoodCostItem[], field: "low" | "high"): number {
  return items.reduce((total, item) => total + item[field], 0);
}

function formatUsdRange(low: number, high: number): string {
  const fmt = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
  return `${fmt(low)} - ${fmt(high)}`;
}

function CostCalculator() {
  const locale = localeOf();
  const [selectedKey, setSelectedKey] = useState(PARENTHOOD_COST_PATHS[0].key);
  const [units, setUnits] = useState<Record<string, number>>(() =>
    Object.fromEntries(PARENTHOOD_COST_PATHS.map((path) => [path.key, path.defaultUnits])),
  );
  const selected =
    PARENTHOOD_COST_PATHS.find((path) => path.key === selectedKey) || PARENTHOOD_COST_PATHS[0];
  const selectedUnits = units[selected.key] ?? selected.defaultUnits;
  const perUnitLow = parenthoodCostSum(selected.items, "low");
  const perUnitHigh = parenthoodCostSum(selected.items, "high");
  const factor = selected.perCycle ? Math.max(1, selectedUnits) : 1;
  const totalLow = perUnitLow * factor;
  const totalHigh = perUnitHigh * factor;
  const adjustUnits = (delta: number) => {
    setUnits((prev) => {
      const current = prev[selected.key] ?? selected.defaultUnits;
      const next = Math.min(selected.maxUnits, Math.max(selected.minUnits, current + delta));
      return { ...prev, [selected.key]: next };
    });
  };
  return (
    <section className="member-form">
      <h1>Cost of Parenthood Calculator</h1>
      <MemberLinks locale={locale} />
      <p>
        Rough reference ranges for the most common paths to parenthood, so
        you can start budgeting with realistic numbers.
      </p>
      <p className="notice">
        These are rough US-market reference ranges only, not quotes. Real
        costs vary enormously by country, provider and individual
        circumstances - always get a written quote before committing to
        anything.
      </p>
      <div className="list-card">
        <h2>Choose a path</h2>
        <ul className="family-room-documents">
          {PARENTHOOD_COST_PATHS.map((path) => (
            <li key={path.key}>
              <button
                type="button"
                className={`link-button${path.key === selectedKey ? " active" : ""}`}
                onClick={() => setSelectedKey(path.key)}
              >
                {path.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="list-card">
        <h2>{selected.title}</h2>
        <p>{selected.desc}</p>
        {selected.perCycle && (
          <p>
            How many cycles to plan for?{" "}
            <button
              type="button"
              className="secondary"
              onClick={() => adjustUnits(-1)}
              disabled={selectedUnits <= selected.minUnits}
            >
              -
            </button>{" "}
            {selectedUnits}{" "}
            <button
              type="button"
              className="secondary"
              onClick={() => adjustUnits(1)}
              disabled={selectedUnits >= selected.maxUnits}
            >
              +
            </button>
          </p>
        )}
        <p>
          <strong>Estimated total: {formatUsdRange(totalLow, totalHigh)}</strong>{" "}
          {selected.perCycle ? `for ${selectedUnits} cycles` : "one-time total for this path"}
        </p>
        <h3>Cost breakdown</h3>
        <ul className="family-room-documents">
          {selected.items.map((item) => (
            <li key={item.key}>
              <span>{PARENTHOOD_COST_ITEM_LABELS[item.key] || item.key}</span>
              <span>
                {formatUsdRange(item.low, item.high)}
                {selected.perCycle ? " / cycle" : ""}
              </span>
            </li>
          ))}
        </ul>
        <p className="notice">{selected.tip}</p>
      </div>
      <Link className="link-button" to={`/${locale}/resources/parenthood-planning/financial-planning`}>
        Full worksheet: Financial Planning for Future Parents
      </Link>
      <Link className="link-button" to={`/${locale}/ai-advisor`}>
        Ask the AI Family Advisor about your situation
      </Link>
      <p className="notice">
        Not financial, legal or medical advice. For planning and discussion
        purposes only.
      </p>
    </section>
  );
}

function CommunityGroups({ session }: { session: Session }) {
  const locale = localeOf();
  const [groups, setGroups] = useState<Row[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  useEffect(() => {
    if (!session) return;
    setStatus("loading");
    api
      .get<{ ok: true; groups: Row[] }>("/member/community/groups")
      .then((data) => {
        setGroups(data.groups || []);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [session]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  return (
    <section>
      <h1>Community</h1>
      <MemberLinks locale={locale} />
      {status === "loading" && <p className="notice">Loading…</p>}
      {status === "error" && <p className="error">Could not load community groups.</p>}
      <div className="list-card">
        {status === "ok" && groups.length === 0 ? (
          <p className="notice">No groups yet.</p>
        ) : (
          <ul className="family-room-documents">
            {groups.map((group) => (
              <li key={asText(group.id)}>
                <Link to={`/${locale}/community/${encodeURIComponent(asText(group.id))}`}>
                  {asText(group.name)}
                </Link>
                <span>{asText(group.description)}</span>
                <span>{asText(group.postCount)} posts</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CommunityGroupPosts({ session }: { session: Session }) {
  const locale = localeOf();
  const { groupId = "" } = useParams();
  const [posts, setPosts] = useState<Row[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState("");
  const load = () => {
    if (!session || !groupId) return;
    setStatus("loading");
    api
      .get<{ ok: true; posts: Row[] }>(
        `/member/community/groups/${encodeURIComponent(groupId)}/posts`,
      )
      .then((data) => {
        setPosts(data.posts || []);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [session, groupId]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const submitPost = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setNotice("");
    try {
      await api.post(
        `/member/community/groups/${encodeURIComponent(groupId)}/posts`,
        { body },
      );
      setDraft("");
      load();
    } catch {
      setNotice("Could not post that message.");
    } finally {
      setPosting(false);
    }
  };
  const removePost = async (item: Row) => {
    try {
      await api.delete(
        `/member/community/posts/${encodeURIComponent(asText(item.id))}`,
      );
      load();
    } catch {
      setNotice("Could not delete that post.");
    }
  };
  return (
    <section>
      <h1>Community</h1>
      <MemberLinks locale={locale} />
      <Link to={`/${locale}/community`}>Back to groups</Link>
      {status === "loading" && <p className="notice">Loading…</p>}
      {status === "error" && (
        <p className="error">Could not load this group's posts.</p>
      )}
      {notice && <p className="error">{notice}</p>}
      <div className="member-form">
        <label>
          New post
          <textarea
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Share something with the group…"
          />
        </label>
        <button
          className="primary"
          onClick={() => void submitPost()}
          disabled={!draft.trim() || posting}
        >
          {posting ? "Posting…" : "Post"}
        </button>
      </div>
      <div className="list-card">
        {status === "ok" && posts.length === 0 ? (
          <p className="notice">No posts yet.</p>
        ) : (
          <ul className="family-room-documents">
            {posts.map((item) => (
              <li key={asText(item.id)}>
                <Link to={`/${locale}/community/post/${encodeURIComponent(asText(item.id))}`}>
                  {asText(item.authorName)}
                  {item.isExpert ? " (Expert)" : ""}: {asText(item.body)}
                </Link>
                <span>{asText(item.replyCount)} replies</span>
                {Boolean(item.isMine) && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => void removePost(item)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CommunityPostDetail({ session }: { session: Session }) {
  const locale = localeOf();
  const { postId = "" } = useParams();
  const [replies, setReplies] = useState<Row[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [notice, setNotice] = useState("");
  const load = () => {
    if (!session || !postId) return;
    setStatus("loading");
    api
      .get<{ ok: true; replies: Row[] }>(
        `/member/community/posts/${encodeURIComponent(postId)}/replies`,
      )
      .then((data) => {
        setReplies(data.replies || []);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  };
  useEffect(load, [session, postId]);
  if (!session) return <Navigate to={`/${locale}/auth/login`} replace />;
  const submitReply = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setNotice("");
    try {
      await api.post(
        `/member/community/posts/${encodeURIComponent(postId)}/replies`,
        { body },
      );
      setDraft("");
      load();
    } catch {
      setNotice("Could not post that reply.");
    } finally {
      setPosting(false);
    }
  };
  const removeReply = async (item: Row) => {
    try {
      await api.delete(
        `/member/community/replies/${encodeURIComponent(asText(item.id))}`,
      );
      load();
    } catch {
      setNotice("Could not delete that reply.");
    }
  };
  return (
    <section>
      <h1>Community post</h1>
      <MemberLinks locale={locale} />
      {status === "loading" && <p className="notice">Loading…</p>}
      {status === "error" && <p className="error">Could not load replies.</p>}
      {notice && <p className="error">{notice}</p>}
      <div className="member-form">
        <label>
          Reply
          <textarea
            rows={3}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a reply…"
          />
        </label>
        <button
          className="primary"
          onClick={() => void submitReply()}
          disabled={!draft.trim() || posting}
        >
          {posting ? "Replying…" : "Reply"}
        </button>
      </div>
      <div className="list-card">
        {status === "ok" && replies.length === 0 ? (
          <p className="notice">No replies yet.</p>
        ) : (
          <ul className="family-room-documents">
            {replies.map((item) => (
              <li key={asText(item.id)}>
                <span>
                  {asText(item.authorName)}
                  {item.isExpert ? " (Expert)" : ""}: {asText(item.body)}
                </span>
                {Boolean(item.isMine) && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => void removeReply(item)}
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function WebApp() {
  const locale = localeOf();
  const location = useLocation();
  const [session, setSession] = useState<Session | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const load = () => {
      void api
        .get<{ user: Row }>("/auth/me")
        .then((response) => {
          if (active) setSession({ user: response.user });
        })
        .catch(() => {
          if (active) setSession(null);
        });
    };
    load();
    window.addEventListener("lbp-member-changed", load);
    return () => {
      active = false;
      window.removeEventListener("lbp-member-changed", load);
    };
  }, [location.pathname]);
  const logout = async () => {
    await api.post("/auth/logout");
    setSession(null);
  };
  if (session === undefined) return <Shell session={null} onLogout={logout} pendingSession><LoadingIndicator fullPage /></Shell>;
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
      <Route path="/chat" element={<ChatLegacyRedirect />} />
      <Route path="/chat/:conversationId" element={<ChatLegacyRedirect />} />
      <Route path="/messages/:conversationId" element={<ChatLegacyRedirect />} />
      <Route
        path="/messages"
        element={<ChatLegacyRedirect />}
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
        path="/:locale/profile/:id"
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
      <Route path="/:locale/professionals" element={content(<Professionals />)} />
      <Route path="/:locale/pages/:slug" element={content(<ContentPage />)} />
      <Route
        path="/:locale/likes"
        element={content(<Likes session={session} />)}
      />
      <Route
        path="/:locale/profile"
        element={content(<MemberAccount session={session} locale={legacyLocaleOf(locale)} onLogout={logout} />)}
      />
 <Route path="/:locale/profile/edit" element={content(<MemberProfileEdit locale={legacyLocaleOf(localeOf())} />)} />
 <Route path="/:locale/profile/photos" element={content(<MemberProfilePhotos locale={legacyLocaleOf(localeOf())} />)} />
 <Route path="/:locale/profile/verification" element={content(<MemberProfileVerification locale={legacyLocaleOf(localeOf())} />)} />
      <Route path="/:locale/profile/notifications" element={content(<MemberAccount session={session} locale={legacyLocaleOf(locale)} onLogout={logout} view="notifications" />)} />
      <Route path="/:locale/profile/blocked" element={content(<MemberAccount session={session} locale={legacyLocaleOf(locale)} onLogout={logout} view="blocked" />)} />
      <Route
        path="/:locale/photos"
        element={content(<MemberProfilePhotos locale={legacyLocaleOf(localeOf())} />)}
      />
      <Route
        path="/:locale/settings"
        element={content(<Settings session={session} />)}
      />
      <Route
        path="/:locale/verification"
        element={content(<MemberProfileVerification locale={legacyLocaleOf(localeOf())} />)}
      />
      <Route
        path="/:locale/messages"
        element={<ChatLegacyRedirect />}
      />
      <Route
        path="/:locale/chat"
        element={content(<Conversations session={session} />)}
      />
      <Route path="/:locale/chat/:conversationId" element={content(<Conversations session={session} />)} />
      <Route path="/:locale/messages/:conversationId" element={<ChatLegacyRedirect />} />
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
        path="/:locale/family-room/:profileId"
        element={content(<FamilyRoom session={session} />)}
      />
      <Route
        path="/:locale/ai-advisor"
        element={content(<AiAdvisor session={session} />)}
      />
      <Route
        path="/:locale/subscription"
        element={content(<Subscription session={session} />)}
      />
      <Route
        path="/:locale/compatibility"
        element={content(<CompatibilityAnswers session={session} />)}
      />
      <Route
        path="/:locale/compatibility-report/:profileId"
        element={content(<CompatibilityReport session={session} />)}
      />
      <Route
        path="/:locale/boost"
        element={content(<Boost session={session} />)}
      />
      <Route
        path="/:locale/referral"
        element={content(<Referral session={session} />)}
      />
      <Route
        path="/:locale/safety-checkin"
        element={content(<SafetyCheckIn session={session} />)}
      />
      <Route
        path="/:locale/cost-calculator"
        element={content(<CostCalculator />)}
      />
      <Route
        path="/:locale/video-verification"
        element={content(<VideoVerification session={session} />)}
      />
      <Route
        path="/:locale/community"
        element={content(<CommunityGroups session={session} />)}
      />
      <Route
        path="/:locale/community/:groupId"
        element={content(<CommunityGroupPosts session={session} />)}
      />
      <Route
        path="/:locale/community/post/:postId"
        element={content(<CommunityPostDetail session={session} />)}
      />
      <Route path="*" element={content(<NotFoundPage locale={legacyLocaleOf(locale)} />)} />
      </Routes>
    </>
  );
}
