// Cost-of-parenthood-path calculator data (premium roadmap, step 6).
// Deliberately plain, static reference data - no backend, no live pricing
// feed. Figures are rough US-market reference ranges only (this app's
// largest single user base per the master brief, ~43%); real costs vary
// enormously by country, clinic/agency, and individual circumstances - the
// screen says this explicitly, more than once, so nobody mistakes a range
// here for a quote. This mirrors the existing "Financial Planning for
// Future Parents" worksheet in Resources (a planning/discussion tool, also
// explicitly not financial advice) rather than trying to replace it - the
// calculator screen links out to that worksheet for anyone who wants the
// deeper, download-and-fill-in version.
//
// Every dollar figure is a plain number (USD); the UI formats and totals
// them. Item labels are looked up via `costCalc.item.<itemKey>` translation
// keys and deliberately reused across paths (e.g. "Legal fees" means the
// same thing everywhere) to keep the translation surface small instead of
// one label per path.

export type CostItemKey =
  | "legalFees"
  | "agencyFees"
  | "programFees"
  | "medicalFees"
  | "medications"
  | "screening"
  | "donorCompensation"
  | "surrogateCompensation"
  | "travel"
  | "insurance"
  | "homeStudy"
  | "postPlacement"
  | "monitoring";

export type CostItem = { key: CostItemKey; low: number; high: number };

export type ParenthoodCostPath = {
  key: string;
  icon: string; // Feather icon name
  // When true, the screen shows a "how many cycles/attempts to plan for"
  // stepper and multiplies the per-cycle range by it. When false, the
  // range below is already the one-time total for the whole path.
  perCycle: boolean;
  defaultUnits: number;
  minUnits: number;
  maxUnits: number;
  items: CostItem[];
};

function sum(items: CostItem[], field: "low" | "high"): number {
  return items.reduce((total, item) => total + item[field], 0);
}

export const PARENTHOOD_COST_PATHS: ParenthoodCostPath[] = [
  {
    key: "knownDonor",
    icon: "users",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
    items: [
      { key: "screening", low: 300, high: 600 },
      { key: "legalFees", low: 500, high: 1500 },
    ],
  },
  {
    key: "cryobankIui",
    icon: "droplet",
    perCycle: true,
    defaultUnits: 3,
    minUnits: 1,
    maxUnits: 8,
    items: [
      { key: "medicalFees", low: 900, high: 1300 },
      { key: "monitoring", low: 300, high: 800 },
    ],
  },
  {
    key: "ivfOwnEggs",
    icon: "activity",
    perCycle: true,
    defaultUnits: 2,
    minUnits: 1,
    maxUnits: 6,
    items: [
      { key: "medicalFees", low: 12000, high: 20000 },
      { key: "medications", low: 3000, high: 7000 },
    ],
  },
  {
    key: "ivfDonorEggs",
    icon: "heart",
    perCycle: true,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 3,
    items: [
      { key: "donorCompensation", low: 10000, high: 20000 },
      { key: "medicalFees", low: 15000, high: 25000 },
      { key: "legalFees", low: 1500, high: 3000 },
    ],
  },
  {
    key: "surrogacy",
    icon: "sun",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
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
    icon: "home",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
    items: [
      { key: "agencyFees", low: 20000, high: 40000 },
      { key: "legalFees", low: 3000, high: 10000 },
      { key: "postPlacement", low: 1000, high: 3000 },
    ],
  },
  {
    key: "internationalAdoption",
    icon: "globe",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
    items: [
      { key: "agencyFees", low: 15000, high: 30000 },
      { key: "programFees", low: 5000, high: 15000 },
      { key: "travel", low: 5000, high: 10000 },
      { key: "homeStudy", low: 3000, high: 6000 },
    ],
  },
  {
    key: "fosterAdopt",
    icon: "shield",
    perCycle: false,
    defaultUnits: 1,
    minUnits: 1,
    maxUnits: 1,
    items: [
      { key: "homeStudy", low: 0, high: 1000 },
      { key: "legalFees", low: 500, high: 2000 },
    ],
  },
];

export function pathPerUnitRange(path: ParenthoodCostPath): { low: number; high: number } {
  return { low: sum(path.items, "low"), high: sum(path.items, "high") };
}

export function pathTotalRange(path: ParenthoodCostPath, units: number): { low: number; high: number } {
  const perUnit = pathPerUnitRange(path);
  const factor = path.perCycle ? Math.max(1, units) : 1;
  return { low: perUnit.low * factor, high: perUnit.high * factor };
}
