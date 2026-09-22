// Ported directly from lbp/frontend/src/ui.tsx (CATALOG_ENUM_OPTIONS +
// catalogOptionLabel) as of Sept 2026. The website already maps the
// backend's raw catalog enum values (SINGLE_MAN, SPERM_DONOR, ...) to
// human-readable labels ("Single Man", "Sperm donor") before rendering
// them; the mobile app was rendering the raw enum strings directly on the
// Browse/Catalog swipe card (badge + "Looking for" tag), which is a real,
// user-reported bug (raw values like SINGLE_MAN shown on screen). This
// file gives the mobile app the same lookup tables + fallback formatter,
// so it matches the website and the prototype's copy ("Single Man",
// "Sperm donor") instead of showing backend enum tokens.
//
// Only the fields the mobile app actually needs are ported here:
// profileTypes/donorTypes/lookingFor (Catalog/SwipeCard's badges),
// ethnicity (EditProfileScreen's Basic info field), and hairColor/
// eyeColor/education/religion (ProfileWizardScreen's Appearance/About
// steps, added Sept 2026 alongside the wizard).

export type CatalogLabelOption = { value: string; label: string; icon?: string };

export const CATALOG_ENUM_OPTIONS: Record<string, CatalogLabelOption[]> = {
  profileTypes: [
    { value: "SINGLE_WOMAN", label: "Single Woman" },
    { value: "SINGLE_MAN", label: "Single Man" },
    { value: "HETERO_COUPLE", label: "Heterosexual Couple" },
    { value: "LESBIAN_COUPLE", label: "Lesbian Couple" },
    { value: "GAY_COUPLE", label: "Gay Couple" },
  ],
  donorTypes: [
    { value: "SPERM", label: "Sperm Donor", icon: "🧬" },
    { value: "EGG", label: "Egg Donor", icon: "🥚" },
  ],
  lookingFor: [
    { value: "SPERM_DONOR", label: "Sperm donor" },
    { value: "EGG_DONOR", label: "Egg donor" },
    { value: "CO_PARENTING_PARTNER", label: "Co-parenting partner" },
  ],
  // Added Sept 2026: EditProfileScreen's "Donor's contact" field used to be
  // free text (confirmed: no enum for this exists anywhere - not in this
  // app's signup wizard, not on the website's signup or edit forms, not in
  // the backend's Pydantic model). Alena then sent the actual original
  // design reference ("Edit questionnaire", step 4 of 4, "What contact do
  // you want the donor to have with the child?") showing these 4 options
  // with icons - this list matches that reference exactly, not a guess.
  // FULL_ANONYMITY is also the exact value already stored on existing
  // profiles (Alena's own test account included), so old data still
  // displays correctly once this ships.
  donorContact: [
    { value: "FULL_ANONYMITY", label: "Full anonymity", icon: "🔒" },
    { value: "IDENTITY_DISCLOSED_AT_18", label: "Identity disclosed at 18", icon: "📅" },
    { value: "LIMITED_CONTACT", label: "Limited contact", icon: "✉️" },
    { value: "ONGOING_RELATIONSHIP", label: "Ongoing relationship", icon: "🤝" },
  ],
  // Ported from the website's ui.tsx CATALOG_ENUM_OPTIONS - same values,
  // used by EditProfileScreen's Ethnicity picker and ProfileWizardScreen's
  // Appearance/About steps.
  ethnicity: [
    { value: "CAUCASIAN_WHITE", label: "Caucasian / White" },
    { value: "AFRICAN_AMERICAN_BLACK", label: "African American / Black" },
    { value: "HISPANIC_LATINO", label: "Hispanic / Latino" },
    { value: "ASIAN_EAST", label: "East Asian" },
    { value: "ASIAN_SOUTH", label: "South Asian" },
    { value: "MIXED_MULTIRACIAL", label: "Mixed / Multiracial" },
  ],
  hairColor: [
    { value: "BLONDE", label: "Blonde" },
    { value: "LIGHT_BROWN", label: "Light brown" },
    { value: "DARK_BROWN", label: "Dark brown" },
    { value: "BLACK", label: "Black" },
    { value: "RED", label: "Red" },
  ],
  eyeColor: [
    { value: "GREY", label: "Grey" },
    { value: "BLUE", label: "Blue" },
    { value: "GREEN", label: "Green" },
    { value: "BROWN_HAZEL", label: "Brown / hazel" },
    { value: "BLACK", label: "Black" },
  ],
  education: [
    { value: "HIGH_SCHOOL", label: "High school" },
    { value: "VOCATIONAL", label: "Vocational" },
    { value: "BACHELORS", label: "Bachelor's degree" },
    { value: "MASTERS", label: "Master's degree" },
    { value: "PHD", label: "PhD" },
  ],
  religion: [
    { value: "CHRISTIAN_ORTHODOX", label: "Christian Orthodox" },
    { value: "CHRISTIAN_CATHOLIC", label: "Christian Catholic" },
    { value: "JEWISH_SECULAR", label: "Jewish Secular" },
    { value: "SPIRITUAL", label: "Spiritual" },
    { value: "NOT_RELIGIOUS", label: "Not religious" },
  ],
};

// Same fallback as the website's catalogOptionLabel: look the raw token up
// in the table above (case-insensitive), and if it's not there (a value
// added on the backend that hasn't been added here yet), humanize it
// ("SOME_NEW_VALUE" -> "Some New Value") rather than showing the raw enum.
export const catalogOptionLabel = (field: string, value: unknown): string => {
  const token = String(value || "").toUpperCase();
  const known = CATALOG_ENUM_OPTIONS[field]?.find((option) => option.value === token)?.label;
  if (known) return known;
  return token
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};
