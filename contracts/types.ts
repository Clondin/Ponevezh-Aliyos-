/**
 * contracts/types.ts — FROZEN.
 * Neither the UI agent nor the backend agent edits this file.
 * A change here is escalated, not made.
 */

export type MinyanSlug =
  | "ponevez-yeshiva"
  | "ponevez-kollelim"
  | "grodna"
  | "perlman"
  | "yeshiva-ketana"
  | "chayei-avraham";

export type OccasionSlug =
  | "rh-1"
  | "rh-2"
  | "yk-shacharis"
  | "yk-mincha"
  | "neilah"
  | "sukkos-1"
  | "hoshana-rabbah"
  | "simchas-torah";

export type Level = 1 | 2 | 3;

export type Tier = "regular" | "special" | "very-special";

export type KibbudState = "available" | "held" | "sold" | "pending";

export interface Minyan {
  slug: MinyanSlug;
  name: string;
  level: Level;
}

export interface Occasion {
  slug: OccasionSlug;
  name: string;
  shortName: string;
  /** Civil date in Israel, ISO. */
  dateISO: string;
  /** e.g. "Shabbos, 12 September 2026" */
  dateLabel: string;
  /** e.g. "1 Tishrei 5787" */
  hebrewDateLabel: string;
  /** Selling wave: 1 opens 6 Sep, 2 opens 16 Sep. */
  wave: 1 | 2;
  /**
   * Sales cutoff — candle lighting at Bnei Brak for the occasion's erev,
   * enforced per occasion. ISO with offset. Derived by the calendar
   * engine; the value in the fixture is the frozen 5787 output.
   */
  cutoffISO: string;
  /**
   * If present, the occasion is offered only in these minyanim.
   * Absent means all six.
   */
  minyanim?: MinyanSlug[];
}

export interface Kibbud {
  /** Stable identity across years: "grodna/yk-mincha/maftir-yonah". */
  id: string;
  minyan: MinyanSlug;
  occasion: OccasionSlug;
  /** Last segment of id, unique within (minyan, occasion). */
  slug: string;
  name: string;
  tier: Tier;
  /** Kriah order within the occasion, 1-based. */
  order: number;
}

/**
 * Prices are never persisted on an item. They resolve from
 * (minyan level × kibbud tier) at read time.
 */
export type PriceTable = Record<Level, Record<Tier, number>>;

export interface Catalog {
  hebrewYear: number;
  generatedAt: string;
  prices: PriceTable;
  minyanim: Minyan[];
  occasions: Occasion[];
  items: Kibbud[];
}

/** One row of GET /api/state/[minyan]/[occasion]. */
export interface KibbudStatus {
  id: string;
  state: KibbudState;
  /** Present iff state is "held" — end of the 12-minute checkout hold. */
  expiresAt?: string;
}

export interface Order {
  id: string;
  kibbudId: string;
  donorName: string;
  email: string;
  /** Mi Shebeirach names, Hebrew accepted, rendered RTL. */
  misheberachNames: string[];
  /** USD, resolved from level × tier at time of sale. */
  amount: number;
  method: "card" | "ach";
  createdAt: string;
}

export interface Pledge {
  id: string;
  kibbudId: string;
  donorName: string;
  email: string;
  phone?: string;
  misheberachNames: string[];
  amount: number;
  status: "pending" | "confirmed" | "released";
  /** End of the 72-hour pledge hold. */
  expiresAt: string;
  createdAt: string;
}
