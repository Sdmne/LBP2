import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const locales = ["en", "ru", "es", "pt", "fr", "de", "it", "pl"] as const;
type Locale = (typeof locales)[number];

const routeLabels: Record<string, Record<Locale, string>> = {
  "auth/login": { en: "Sign in", ru: "Вход", es: "Iniciar sesión", pt: "Iniciar sessão", fr: "Connexion", de: "Anmelden", it: "Accedi", pl: "Zaloguj się" },
  "auth/register": { en: "Create account", ru: "Регистрация", es: "Crear cuenta", pt: "Criar conta", fr: "Créer un compte", de: "Konto erstellen", it: "Crea un account", pl: "Utwórz konto" },
  "auth/forgot-password": { en: "Reset password", ru: "Восстановление пароля", es: "Restablecer contraseña", pt: "Repor palavra-passe", fr: "Réinitialiser le mot de passe", de: "Passwort zurücksetzen", it: "Reimposta password", pl: "Zresetuj hasło" },
  "find-your-path": { en: "Find your path", ru: "Найдите свой путь", es: "Encuentra tu camino", pt: "Encontre o seu caminho", fr: "Trouvez votre voie", de: "Finden Sie Ihren Weg", it: "Trova il tuo percorso", pl: "Znajdź swoją drogę" },
  "ai-advisor": { en: "AI Family Advisor", ru: "Семейный ИИ-консультант", es: "Asesor familiar con IA", pt: "Consultor familiar com IA", fr: "Conseiller familial IA", de: "KI-Familienberater", it: "Consulente familiare IA", pl: "Doradca rodzinny AI" },
  "cost-calculator": { en: "Cost calculator", ru: "Калькулятор расходов", es: "Calculadora de costes", pt: "Calculadora de custos", fr: "Calculateur de coûts", de: "Kostenrechner", it: "Calcolatore dei costi", pl: "Kalkulator kosztów" },
  home: { en: "Build your family", ru: "Создайте свою семью", es: "Crea tu familia", pt: "Construa sua família", fr: "Construisez votre famille", de: "Gründen Sie Ihre Familie", it: "Crea la tua famiglia", pl: "Zbuduj swoją rodzinę" },
  catalog: { en: "Find a match", ru: "Найти партнёра", es: "Encuentra pareja", pt: "Encontre uma combinação", fr: "Trouver un profil", de: "Passende Profile finden", it: "Trova un profilo", pl: "Znajdź dopasowanie" },
  clinics: { en: "Fertility clinics", ru: "Клиники", es: "Clínicas", pt: "Clínicas", fr: "Cliniques", de: "Kliniken", it: "Cliniche", pl: "Kliniki" },
  lawyers: { en: "Family lawyers", ru: "Юристы", es: "Abogados", pt: "Advogados", fr: "Avocats", de: "Anwälte", it: "Avvocati", pl: "Prawnicy" },
  "knowledge-hub": { en: "Knowledge Hub", ru: "База знаний", es: "Centro de conocimiento", pt: "Central de conhecimento", fr: "Centre de connaissances", de: "Wissenszentrum", it: "Centro informazioni", pl: "Centrum wiedzy" },
  resources: { en: "Resources", ru: "Ресурсы", es: "Recursos", pt: "Recursos", fr: "Ressources", de: "Ressourcen", it: "Risorse", pl: "Zasoby" },
  professionals: { en: "For professionals", ru: "Для специалистов", es: "Para profesionales", pt: "Para profissionais", fr: "Pour les professionnels", de: "Für Fachleute", it: "Per professionisti", pl: "Dla specjalistów" },
  pricing: { en: "Pricing", ru: "Тарифы", es: "Precios", pt: "Preços", fr: "Tarifs", de: "Preise", it: "Prezzi", pl: "Cennik" },
  contact: { en: "Contact us", ru: "Контакты", es: "Contacto", pt: "Contacto", fr: "Contact", de: "Kontakt", it: "Contatti", pl: "Kontakt" },
  "trust-safety": { en: "Trust & Safety", ru: "Безопасность", es: "Confianza y seguridad", pt: "Confiança e segurança", fr: "Confiance et sécurité", de: "Vertrauen und Sicherheit", it: "Fiducia e sicurezza", pl: "Zaufanie i bezpieczeństwo" },
  "terms-of-use": { en: "Terms of Use", ru: "Условия использования", es: "Términos de uso", pt: "Termos de utilização", fr: "Conditions d’utilisation", de: "Nutzungsbedingungen", it: "Termini di utilizzo", pl: "Warunki użytkowania" },
  "privacy-policy": { en: "Privacy Policy", ru: "Политика конфиденциальности", es: "Política de privacidad", pt: "Política de privacidade", fr: "Politique de confidentialité", de: "Datenschutzerklärung", it: "Informativa sulla privacy", pl: "Polityka prywatności" },
  "delete-account": { en: "Delete account", ru: "Удаление аккаунта", es: "Eliminar cuenta", pt: "Eliminar conta", fr: "Supprimer le compte", de: "Konto löschen", it: "Elimina account", pl: "Usuń konto" },
  auth: { en: "Account access", ru: "Вход в аккаунт", es: "Acceso a la cuenta", pt: "Acesso à conta", fr: "Accès au compte", de: "Kontozugang", it: "Accesso all’account", pl: "Dostęp do konta" },
  profile: { en: "Profile", ru: "Профиль", es: "Perfil", pt: "Perfil", fr: "Profil", de: "Profil", it: "Profilo", pl: "Profil" },
  settings: { en: "Settings", ru: "Настройки", es: "Ajustes", pt: "Definições", fr: "Paramètres", de: "Einstellungen", it: "Impostazioni", pl: "Ustawienia" },
  messages: { en: "Messages", ru: "Сообщения", es: "Mensajes", pt: "Mensagens", fr: "Messages", de: "Nachrichten", it: "Messaggi", pl: "Wiadomości" },
  chat: { en: "Messages", ru: "Сообщения", es: "Mensajes", pt: "Mensagens", fr: "Messages", de: "Nachrichten", it: "Messaggi", pl: "Wiadomości" },
  subscription: { en: "Subscription", ru: "Подписка", es: "Suscripción", pt: "Subscrição", fr: "Abonnement", de: "Abonnement", it: "Abbonamento", pl: "Subskrypcja" },
  community: { en: "Community", ru: "Сообщество", es: "Comunidad", pt: "Comunidade", fr: "Communauté", de: "Community", it: "Community", pl: "Społeczność" },
};

const descriptions: Record<Locale, string> = {
  en: "Trusted information, people and professional support for every path to parenthood.",
  ru: "Проверенная информация, люди и профессиональная поддержка для каждого пути к родительству.",
  es: "Información fiable, personas y apoyo profesional para cada camino hacia la paternidad.",
  pt: "Informação fiável, pessoas e apoio profissional para cada caminho para a parentalidade.",
  fr: "Des informations fiables, des rencontres et un accompagnement professionnel pour chaque parcours vers la parentalité.",
  de: "Verlässliche Informationen, Kontakte und professionelle Unterstützung für jeden Weg zur Elternschaft.",
  it: "Informazioni affidabili, persone e supporto professionale per ogni percorso verso la genitorialità.",
  pl: "Rzetelne informacje, ludzie i profesjonalne wsparcie na każdej drodze do rodzicielstwa.",
};

const privateRoutes = new Set(["auth", "profile", "settings", "messages", "chat", "likes", "visitors", "favourites", "blocked", "subscription", "boost", "referral", "community", "verification", "photos", "account", "family-room", "ai-advisor", "compatibility", "compatibility-report", "safety-checkin", "video-verification"]);

function localeFromPath(pathname: string): Locale {
  const candidate = pathname.split("/").filter(Boolean)[0] as Locale | undefined;
  return candidate && locales.includes(candidate) ? candidate : "en";
}

function readableSlug(value: string) {
  let decoded = value || "";
  try { decoded = decodeURIComponent(decoded); } catch { /* Preserve malformed route text without crashing navigation. */ }
  return decoded
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"][data-route-seo]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    element.dataset.routeSeo = "true";
    document.head.appendChild(element);
  }
  element.content = content;
  return element;
}

export function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.head.querySelectorAll("[data-route-seo]").forEach((element) => element.remove());
    const parts = pathname.split("/").filter(Boolean);
    const locale = localeFromPath(pathname);
    document.documentElement.lang = locale;
    const route = parts[1] || "home";
    const isArticle = route === "knowledge-hub" && Boolean(parts[2]);
    if (isArticle) return;

    const nestedLabel = routeLabels[`${route}/${parts[2]}`]?.[locale];
    const baseLabel = routeLabels[route]?.[locale] || readableSlug(route) || routeLabels.home[locale];
    const label = nestedLabel || (parts[2] ? `${baseLabel} — ${readableSlug(parts.at(-1) || "")}` : baseLabel);
    const title = `${label} | LetsBeParents`;
    const description = `${label}. ${descriptions[locale]}`;
    const canonical = `${window.location.origin}${pathname.replace(/\/$/, "") || `/${locale}`}`;
    const suffix = parts.length > 1 ? `/${parts.slice(1).join("/")}` : "";
    const localeTag: Record<Locale, string> = { en: "en_US", ru: "ru_RU", es: "es_ES", pt: "pt_PT", fr: "fr_FR", de: "de_DE", it: "it_IT", pl: "pl_PL" };

    document.documentElement.lang = locale;
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:locale", localeTag[locale]);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    if (privateRoutes.has(route)) upsertMeta("name", "robots", "noindex, nofollow");

    const canonicalLink = document.createElement("link");
    canonicalLink.rel = "canonical";
    canonicalLink.href = canonical;
    canonicalLink.dataset.routeSeo = "true";
    document.head.appendChild(canonicalLink);
    for (const alternateLocale of locales) {
      const alternate = document.createElement("link");
      alternate.rel = "alternate";
      alternate.hreflang = alternateLocale;
      alternate.href = `${window.location.origin}/${alternateLocale}${suffix}`;
      alternate.dataset.routeSeo = "true";
      document.head.appendChild(alternate);
    }
    const fallback = document.createElement("link");
    fallback.rel = "alternate";
    fallback.hreflang = "x-default";
    fallback.href = `${window.location.origin}/en${suffix}`;
    fallback.dataset.routeSeo = "true";
    document.head.appendChild(fallback);
  }, [pathname]);

  return null;
}
