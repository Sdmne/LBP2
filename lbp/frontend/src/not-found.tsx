import { Link } from "react-router-dom";

export type NotFoundLocale = "en" | "ru" | "es";

const NOT_FOUND_TEXT = {
  en: {
    title: "Page not found",
    description: "The page you are looking for does not exist.",
    action: "Go Home",
  },
  ru: {
    title: "Страница не найдена",
    description: "Страница, которую вы ищете, не существует.",
    action: "На главную",
  },
  es: {
    title: "Página no encontrada",
    description: "La página que buscas no existe.",
    action: "Ir al inicio",
  },
} satisfies Record<NotFoundLocale, {
  title: string;
  description: string;
  action: string;
}>;

export function NotFoundPage({ locale }: { locale: NotFoundLocale }) {
  const copy = NOT_FOUND_TEXT[locale];

  return (
    <section className="not-found-page" aria-labelledby="not-found-heading">
      <strong className="not-found-code" aria-hidden="true">404</strong>
      <h1 id="not-found-heading">{copy.title}</h1>
      <p>{copy.description}</p>
      <Link className="not-found-action" to={`/${locale}`}>{copy.action}</Link>
    </section>
  );
}
