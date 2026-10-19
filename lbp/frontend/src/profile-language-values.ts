import { TOOLS_LANGUAGES } from "./member-tools-reference";

const locales = ["en", "ru", "es", "pt", "fr", "de", "it", "pl"];

export function profileLanguageCodes(value: unknown): string[] {
  let entries = value;
  if (typeof entries === "string") {
    const serialized = entries;
    try {
      entries = JSON.parse(serialized);
    } catch {
      entries = serialized.split(/[,;]+/);
    }
  }
  if (!Array.isArray(entries)) return [];
  const codes = entries.map((entry) => {
    if (entry && typeof entry === "object") {
      const item = entry as Record<string, unknown>;
      const nested =
        item.language && typeof item.language === "object"
          ? (item.language as Record<string, unknown>)
          : {};
      entry =
        item.code ||
        item.value ||
        nested.code ||
        item.name ||
        item.label ||
        nested.name;
    }
    if (typeof entry !== "string") return "";
    const label = entry.trim();
    if (!label) return "";
    const canonical = label.toLowerCase().replace(/_/g, "-");
    return (
      TOOLS_LANGUAGES.find(
        (code) =>
          code === canonical ||
        [...locales, code].some((locale) => {
            try {
              return (
                new Intl.DisplayNames([locale], { type: "language" })
                  .of(code)
                  ?.toLocaleLowerCase() === canonical
              );
            } catch {
              return false;
            }
          }),
      ) || label
    );
  });
  return [...new Set(codes.filter(Boolean))];
}
