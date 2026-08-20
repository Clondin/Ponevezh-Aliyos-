/**
 * Availability counts — pure functions over the catalog and state layers.
 * The redesign leads with what is still available rather than what has sold.
 */
import type { KibbudStatus, MinyanSlug, OccasionSlug } from "@/contracts/types";
import { itemsFor, occasionsForMinyan, priceForKibbud } from "@/lib/catalog";
import { getRepository } from "@/lib/redis/repository";

export interface Availability {
  available: number;
  total: number;
  /** Zero-padded available count over total, e.g. "07 / 10". */
  fraction: string;
}

function fraction(available: number, total: number): string {
  return `${String(available).padStart(2, "0")} / ${total}`;
}

export function availabilityFromStatuses(
  total: number,
  statuses: KibbudStatus[]
): Availability {
  const unavailable = new Set(statuses.map((status) => status.id));
  const available = Math.max(0, total - unavailable.size);
  return { available, total, fraction: fraction(available, total) };
}

export async function occasionAvailability(
  minyan: MinyanSlug,
  occasion: OccasionSlug
): Promise<Availability> {
  const items = itemsFor(minyan, occasion);
  const statuses = await getRepository().statuses(items.map((item) => item.id));
  return availabilityFromStatuses(items.length, statuses);
}

/** Summed across every day that minyan offers. */
export async function minyanAvailability(minyan: MinyanSlug): Promise<Availability> {
  let available = 0;
  let total = 0;
  const results = await Promise.all(
    occasionsForMinyan(minyan).map((occasion) =>
      occasionAvailability(minyan, occasion.slug)
    )
  );
  for (const a of results) {
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
