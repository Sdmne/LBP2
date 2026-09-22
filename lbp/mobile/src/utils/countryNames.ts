// Full country names for a 2-letter ISO code, in the app's own language.
// Directory's country filter/list used to show raw codes ("AE", "AG",
// "CH") everywhere - Alena: "страны везде должны полностью писаться"
// (country names should be written out in full everywhere).
//
// UPDATE (Sept 2026): the original version of this file relied ENTIRELY on
// the platform's Intl.DisplayNames (Hermes was assumed to ship full ICU
// data on Expo SDK 57), with the raw code as its only fallback. Alena
// reported the SAME raw-code bug again on her real Android phone
// ("Опять не полное название стран") - i.e. that assumption was wrong for
// at least her device/build: Intl.DisplayNames either isn't constructible
// there or silently returns nothing, so displayNamesFor() below returns
// null and every call fell straight back to the bare code, which is
// exactly what her screenshot showed. Rather than depend on engine/OS
// support that has already proven inconsistent, COUNTRY_NAMES_EN below is
// a real, hand-maintained ISO-3166-1 alpha-2 table that always works,
// everywhere, regardless of Intl support - Intl.DisplayNames is now only
// a best-effort LOCALIZED upgrade over that guaranteed English baseline,
// not the only path. A ru/es user gets a localized name when the engine
// supports it and a real English name otherwise - never a bare code.
let cache: { locale: string; names: Intl.DisplayNames | null } | null = null;

function displayNamesFor(locale: string): Intl.DisplayNames | null {
  if (cache && cache.locale === locale) return cache.names;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "region" });
    // Some engines construct Intl.DisplayNames successfully but then
    // return undefined/the bare code from every real .of() call (rather
    // than throwing) - probe it once with a code that's never ambiguous
    // so a half-broken implementation is treated the same as no support.
    if (!names || names.of("US") !== "United States") {
      names = null;
    }
  } catch {
    names = null;
  }
  cache = { locale, names };
  return names;
}

// Real ISO-3166-1 alpha-2 -> English short name table. This is the
// guaranteed fallback (and, for English-locale users, the primary path) -
// keep it in sync with any new country codes this app's country picker
// can produce (profiles.data.country / clinic-lawyer directory entries).
const COUNTRY_NAMES_EN: Record<string, string> = {
  AD: "Andorra", AE: "United Arab Emirates", AF: "Afghanistan", AG: "Antigua and Barbuda",
  AI: "Anguilla", AL: "Albania", AM: "Armenia", AO: "Angola", AQ: "Antarctica",
  AR: "Argentina", AS: "American Samoa", AT: "Austria", AU: "Australia", AW: "Aruba",
  AX: "Åland Islands", AZ: "Azerbaijan", BA: "Bosnia and Herzegovina", BB: "Barbados",
  BD: "Bangladesh", BE: "Belgium", BF: "Burkina Faso", BG: "Bulgaria", BH: "Bahrain",
  BI: "Burundi", BJ: "Benin", BL: "Saint Barthélemy", BM: "Bermuda", BN: "Brunei",
  BO: "Bolivia", BQ: "Bonaire, Sint Eustatius and Saba", BR: "Brazil", BS: "Bahamas",
  BT: "Bhutan", BV: "Bouvet Island", BW: "Botswana", BY: "Belarus", BZ: "Belize",
  CA: "Canada", CC: "Cocos (Keeling) Islands", CD: "DR Congo",
  CF: "Central African Republic", CG: "Congo", CH: "Switzerland", CI: "Côte d'Ivoire",
  CK: "Cook Islands", CL: "Chile", CM: "Cameroon", CN: "China", CO: "Colombia",
  CR: "Costa Rica", CU: "Cuba", CV: "Cabo Verde", CW: "Curaçao", CX: "Christmas Island",
  CY: "Cyprus", CZ: "Czechia", DE: "Germany", DJ: "Djibouti", DK: "Denmark",
  DM: "Dominica", DO: "Dominican Republic", DZ: "Algeria", EC: "Ecuador",
  EE: "Estonia", EG: "Egypt", EH: "Western Sahara", ER: "Eritrea", ES: "Spain",
  ET: "Ethiopia", FI: "Finland", FJ: "Fiji", FK: "Falkland Islands", FM: "Micronesia",
  FO: "Faroe Islands", FR: "France", GA: "Gabon", GB: "United Kingdom", GD: "Grenada",
  GE: "Georgia", GF: "French Guiana", GG: "Guernsey", GH: "Ghana", GI: "Gibraltar",
  GL: "Greenland", GM: "Gambia", GN: "Guinea", GP: "Guadeloupe", GQ: "Equatorial Guinea",
  GR: "Greece", GS: "South Georgia and the South Sandwich Islands", GT: "Guatemala",
  GU: "Guam", GW: "Guinea-Bissau", GY: "Guyana", HK: "Hong Kong",
  HM: "Heard Island and McDonald Islands", HN: "Honduras", HR: "Croatia", HT: "Haiti",
  HU: "Hungary", ID: "Indonesia", IE: "Ireland", IL: "Israel", IM: "Isle of Man",
  IN: "India", IO: "British Indian Ocean Territory", IQ: "Iraq", IR: "Iran",
  IS: "Iceland", IT: "Italy", JE: "Jersey", JM: "Jamaica", JO: "Jordan", JP: "Japan",
  KE: "Kenya", KG: "Kyrgyzstan", KH: "Cambodia", KI: "Kiribati", KM: "Comoros",
  KN: "Saint Kitts and Nevis", KP: "North Korea", KR: "South Korea", KW: "Kuwait",
  KY: "Cayman Islands", KZ: "Kazakhstan", LA: "Laos", LB: "Lebanon", LC: "Saint Lucia",
  LI: "Liechtenstein", LK: "Sri Lanka", LR: "Liberia", LS: "Lesotho", LT: "Lithuania",
  LU: "Luxembourg", LV: "Latvia", LY: "Libya", MA: "Morocco", MC: "Monaco",
  MD: "Moldova", ME: "Montenegro", MF: "Saint Martin", MG: "Madagascar",
  MH: "Marshall Islands", MK: "North Macedonia", ML: "Mali", MM: "Myanmar",
  MN: "Mongolia", MO: "Macao", MP: "Northern Mariana Islands", MQ: "Martinique",
  MR: "Mauritania", MS: "Montserrat", MT: "Malta", MU: "Mauritius", MV: "Maldives",
  MW: "Malawi", MX: "Mexico", MY: "Malaysia", MZ: "Mozambique", NA: "Namibia",
  NC: "New Caledonia", NE: "Niger", NF: "Norfolk Island", NG: "Nigeria",
  NI: "Nicaragua", NL: "Netherlands", NO: "Norway", NP: "Nepal", NR: "Nauru",
  NU: "Niue", NZ: "New Zealand", OM: "Oman", PA: "Panama", PE: "Peru",
  PF: "French Polynesia", PG: "Papua New Guinea", PH: "Philippines", PK: "Pakistan",
  PL: "Poland", PM: "Saint Pierre and Miquelon", PN: "Pitcairn", PR: "Puerto Rico",
  PS: "Palestine", PT: "Portugal", PW: "Palau", PY: "Paraguay", QA: "Qatar",
  RE: "Réunion", RO: "Romania", RS: "Serbia", RU: "Russia", RW: "Rwanda",
  SA: "Saudi Arabia", SB: "Solomon Islands", SC: "Seychelles", SD: "Sudan",
  SE: "Sweden", SG: "Singapore", SH: "Saint Helena", SI: "Slovenia",
  SJ: "Svalbard and Jan Mayen", SK: "Slovakia", SL: "Sierra Leone", SM: "San Marino",
  SN: "Senegal", SO: "Somalia", SR: "Suriname", SS: "South Sudan",
  ST: "São Tomé and Príncipe", SV: "El Salvador", SX: "Sint Maarten", SY: "Syria",
  SZ: "Eswatini", TC: "Turks and Caicos Islands", TD: "Chad",
  TF: "French Southern Territories", TG: "Togo", TH: "Thailand", TJ: "Tajikistan",
  TK: "Tokelau", TL: "Timor-Leste", TM: "Turkmenistan", TN: "Tunisia", TO: "Tonga",
  TR: "Turkey", TT: "Trinidad and Tobago", TV: "Tuvalu", TW: "Taiwan",
  TZ: "Tanzania", UA: "Ukraine", UG: "Uganda",
  UM: "United States Minor Outlying Islands", US: "United States", UY: "Uruguay",
  UZ: "Uzbekistan", VA: "Vatican City", VC: "Saint Vincent and the Grenadines",
  VE: "Venezuela", VG: "British Virgin Islands", VI: "United States Virgin Islands",
  VN: "Vietnam", VU: "Vanuatu", WF: "Wallis and Futuna", WS: "Samoa", YE: "Yemen",
  YT: "Mayotte", ZA: "South Africa", ZM: "Zambia", ZW: "Zimbabwe",
};

export function countryName(code: string, locale: string): string {
  const upper = (code || "").trim().toUpperCase();
  if (!upper) return code;
  const fallback = COUNTRY_NAMES_EN[upper] || code;
  const names = displayNamesFor(locale);
  try {
    return (names && names.of(upper)) || fallback;
  } catch {
    return fallback;
  }
}
