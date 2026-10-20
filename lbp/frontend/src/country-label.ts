export function countryLabel(value: unknown, locale: string): string {
  const country = String(value ?? "").trim();
  const code = ({ USA: "US", UK: "GB", UAE: "AE" } as Record<string, string>)[country.toUpperCase()] || country.toUpperCase();
  if (locale === "en" && code === "GB") return "United Kingdom";
  if (locale === "en" && code === "CZ") return "Czech Republic";
  try {
    return /^[A-Z]{2}$/.test(code)
      ? new Intl.DisplayNames([locale], { type: "region" }).of(code) || country
      : country;
  } catch {
    return country;
  }
}
