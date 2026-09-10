// Full country names for a 2-letter ISO code, in the app's own language.
// Directory's country filter/list used to show raw codes ("AE", "AG",
// "CH") everywhere - Alena: "страны везде должны полностью писаться"
// (country names should be written out in full everywhere). Uses the
// platform's own Intl.DisplayNames (Hermes ships full ICU data on Expo
// SDK 57, so this covers every ISO region code without shipping and
// maintaining a 250-entry name table by hand) and falls back to the raw
// code if a given engine/OS build doesn't support it, rather than
// crashing the screen.
let cache: { locale: string; names: Intl.DisplayNames | null } | null = null;

function displayNamesFor(locale: string): Intl.DisplayNames | null {
  if (cache && cache.locale === locale) return cache.names;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    names = null;
  }
  cache = { locale, names };
  return names;
}

export function countryName(code: string, locale: string): string {
  const upper = (code || "").trim().toUpperCase();
  if (!upper) return code;
  const names = displayNamesFor(locale);
  try {
    return (names && names.of(upper)) || code;
  } catch {
    return code;
  }
}
