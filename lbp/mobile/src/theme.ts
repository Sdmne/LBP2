// UPDATE (Sep 2026): the earlier "#7c6cf0/#4e9bff purple-blue gradient" this
// file described was sourced from an outdated style.css.txt reference. The
// real, current, agreed design lives in the user's actual HTML prototype
// (Claude outputs/app-prototype-inline.html, the one she built and approved
// screen-by-screen) and it uses a flat pink brand color, NOT a purple
// gradient - grep that file's <style> block for `--pink`/`--blue` to
// double check if this ever needs re-deriving. Every existing call site
// that referenced `gradientStart`/`gradientEnd` (58+ spots across the app,
// mostly buttons/active-states/spinners) now resolves to the same pink,
// which is exactly how the prototype uses its primary color - one strong
// accent everywhere, not a two-tone blend. Kept both key names (rather than
// renaming to `primary` and touching every file) so this is a low-risk,
// high-leverage fix: one file change re-skins the whole app correctly.
// New code should prefer the more descriptive `pink`/`blue`/`ink`/`muted`/
// `line`/`card`/`tint` names below, which mirror the prototype's own CSS
// custom properties 1:1.
export const colors = {
  gradientStart: "#f31260",
  gradientEnd: "#f31260",
  pink: "#f31260",
  pinkSoft: "#f070a9",
  blue: "#4e9bff",
  blueDark: "#2f6fe0",
  ink: "#020817",
  muted: "#64748b",
  line: "#e2e8f0",
  card: "#ffffff",
  tint: "#eef4ff",
  tintPink: "#fce7ef",
  bg: "#fafafa",
  bgSoft: "#f5f6f8",
  text: "#020817",
  textMuted: "#64748b",
  border: "#e2e8f0",
  danger: "#e0433c",
  success: "#0f9d68",
  premium: "#f2b134",
  // Same gold hue, darkened for use as TEXT on the app's light
  // pink/lavender gradient backgrounds - #f2b134 itself reads fine on a
  // solid dark/white chip (that's how ProfileDetailScreen/SubscriptionScreen
  // use it) but is close to invisible as plain text on GradientBackground
  // "soft"/"vivid" (~1.5:1 contrast) - this is what Alena flagged as
  // unreadable on the Verification screen; same fix applied everywhere else
  // premium is used as a bare text color, not a fill.
  premiumDark: "#92400e",
  // colors.muted (#64748b) is fine on white cards but only ~3.7:1 against
  // the light gradient backgrounds - under the 4.5:1 AA minimum for body
  // text. Same Verification-screen readability report as premiumDark
  // above; use this instead of muted for body copy sitting directly on
  // GradientBackground rather than a white card.
  mutedOnGradient: "#475569",
  white: "#ffffff",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 28,
  pill: 999,
};

// UPDATE (Sept 2026): MainTabs now renders a floating "pill" tab bar
// (position:absolute, floating above the bottom edge) instead of docking a
// flat bar in the layout flow - matches the prototype's .tabbar. Anything
// that scrolls or absolutely-positions content in a tab screen needs this
// much clearance at the bottom so the pill doesn't sit on top of it -
// mirrors the prototype's own .tabbar-spacer{flex:0 0 92px}.
export const tabBarClearance = 96;
