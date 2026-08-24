/**
 * Hebrew strings for the bilingual UI.
 *
 * The design handoff asked for these to live in the catalog fixture, but
 * `contracts/` is frozen — neither agent edits it — so they live here, in a
 * UI-owned module keyed by the same stable slugs. If the contract is ever
 * reopened to carry Hebrew, this module collapses into a lookup on the
 * catalog and nothing else changes.
 *
 * Pending review by the office before shipping.
 */
import type { MinyanSlug, OccasionSlug } from "@/contracts/types";

export const MINYAN_HE: Record<MinyanSlug, string> = {
  "ponevez-yeshiva": "ישיבת פוניבז׳",
  "ponevez-kollelim": "כולל פוניבז'",
  grodna: "גרודנא",
  perlman: "פרלמן",
  "yeshiva-ketana": "ישיבה קטנה",
  "chayei-avraham": "חיי אברהם",
};

/** The minyan name prefixed with מניין, for the minyan page title. */
export function minyanHeTitle(slug: MinyanSlug): string {
  return `מניין ${MINYAN_HE[slug]}`;
}

export const OCCASION_HE: Record<OccasionSlug, string> = {
  "rh-1": "ראש השנה — יום א׳",
  "rh-2": "ראש השנה — יום ב׳",
  "yk-shacharis": "יום כיפור — שחרית",
  "yk-mincha": "יום כיפור — מנחה",
  neilah: "נעילה",
  "sukkos-1": "סוכות — יום א׳",
  "hoshana-rabbah": "הושענא רבה",
  "simchas-torah": "שמיני עצרת / שמחת תורה",
};

/** Hebrew day-of-Tishrei letter, for the date block on the minyan page. */
export const OCCASION_HE_DAY: Record<OccasionSlug, string> = {
  "rh-1": "א׳",
  "rh-2": "ב׳",
  "yk-shacharis": "י׳",
  "yk-mincha": "י׳",
  neilah: "י׳",
  "sukkos-1": "ט״ו",
  "hoshana-rabbah": "כ״א",
  "simchas-torah": "כ״ב",
};

/** Keyed by kibbud slug — the last segment of the item id. */
export const KIBBUD_HE: Record<string, string> = {
  hotzaah: "הוצאה והכנסה",
  kohen: "כהן",
  levi: "לוי",
  shlishi: "שלישי",
  revii: "רביעי",
  chamishi: "חמישי",
  shishi: "שישי",
  shevii: "שביעי",
  maftir: "מפטיר",
  hagbah: "הגבהה וגלילה",
  "maftir-yonah": "מפטיר יונה",
  "pesicha-1": "פתיחת הארון — ראשונה",
  "pesicha-2": "פתיחת הארון — שנייה",
  "pesicha-3": "פתיחת הארון — נעילת השער",
  "kol-hanearim": "כל הנערים",
  "chasan-torah": "חתן תורה",
  "chasan-bereishis": "חתן בראשית",
};

export function kibbudHe(slug: string, fallback: string): string {
  return KIBBUD_HE[slug] ?? fallback;
}

export const HEADING_HE = {
  hero: "כיבודי הימים הנוראים",
  chooseMinyan: "בחירת מניין",
  daysOfTishrei: "ימי תשרי",
  daysAndTefillos: "ימים ותפילות",
} as const;

export const TIER_LABEL = {
  regular: "Regular",
  special: "Special",
  "very-special": "Very special",
} as const;
