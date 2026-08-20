/**
 * Availability counts — pure functions over the catalog and state layers.
 * The redesign leads with what is still available rather than what has sold.
 */
import type { MinyanSlug, OccasionSlug } from "@/contracts/types";
import { itemsFor, occasionsForMinyan, priceForKibbud } from "@/lib/catalog";
import { statusMap } from "@/lib/state";

export interface Availability {
  available: number;
  total: number;
  /** Zero-padded available count over total, e.g. "07 / 10". */
  fraction: string;
}

function fraction(available: number, total: number): string {
  return `${String(available).padStart(2, "0")} / ${total}`;
}

export function occasionAvailability(
  minyan: MinyanSlug,
  occasion: OccasionSlug
): Availability {
  const items = itemsFor(minyan, occasion);
  const statuses = statusMap(minyan, occasion);
  const available = items.filter(
    (i) => (statuses.get(i.id)?.state ?? "available") === "available"
  ).length;
  return { available, total: items.length, fraction: fraction(available, items.length) };
}

/** Summed across every day that minyan offers. */
export function minyanAvailability(minyan: MinyanSlug): Availability {
  let available = 0;
  let total = 0;
  for (const o of occasionsForMinyan(minyan)) {
    const a = occasionAvailability(minyan, o.slug);
    available += a.available;
    total += a.total;
  }
  return { available, total, fraction: fraction(available, total) };
}

/** Lowest price among that day's items. */
export function occasionFromPrice(
  minyan: MinyanSlug,
  occasion: OccasionSlug
): number {
  const prices = itemsFor(minyan, occasion).map(priceForKibbud);
  return prices.length ? Math.min(...prices) : 0;
}

/** Lowest price across everything that minyan offers. */
export function minyanFromPrice(minyan: MinyanSlug): number {
  const prices = occasionsForMinyan(minyan).flatMap((o) =>
    itemsFor(minyan, o.slug).map(priceForKibbud)
  );
  return prices.length ? Math.min(...prices) : 0;
}
