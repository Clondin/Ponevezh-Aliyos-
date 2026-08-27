/**
 * Availability counts — pure functions over the catalog and state layers.
 * The redesign leads with what is still available rather than what has sold.
 */
import type { KibbudStatus, MinyanSlug } from "@/contracts/types";
import { getCatalog, itemsFor, occasionsForMinyan, priceForKibbud } from "@/lib/catalog";
import { saleWindowFor } from "@/lib/calendar/sales";
import { getRepository } from "@/lib/storage/repository";

export interface Availability {
  available: number;
  total: number;
  /** Zero-padded available count over total, e.g. "07 / 10". */
  fraction: string;
}

function fraction(available: number, total: number): string {
  // Pad both sides alike so "08 / 08" never sits beside "10 / 10".
  const width = Math.max(2, String(total).length);
  return `${String(available).padStart(width, "0")} / ${String(total).padStart(width, "0")}`;
}

export function availabilityFromStatuses(
  total: number,
  statuses: KibbudStatus[],
  saleOpen = true
): Availability {
  const unavailable = new Set(statuses.map((status) => status.id));
  const available = saleOpen ? Math.max(0, total - unavailable.size) : 0;
  return { available, total, fraction: fraction(available, total) };
}

export interface AvailabilitySnapshot {
  minyan: Map<MinyanSlug, Availability>;
  occasion: Map<string, Availability>;
  minyanFromPrice: Map<MinyanSlug, number>;
  occasionFromPrice: Map<string, number>;
}

/** One state read for the entire catalog, then all counts are derived in memory. */
export async function availabilitySnapshot(): Promise<AvailabilitySnapshot> {
  const catalog = getCatalog();
  const statuses = await getRepository().statuses(catalog.items.map((item) => item.id));
  const unavailable = new Set(statuses.map((status) => status.id));
  const minyan = new Map<MinyanSlug, Availability>();
  const occasion = new Map<string, Availability>();
  const minyanFromPrice = new Map<MinyanSlug, number>();
  const occasionFromPrice = new Map<string, number>();

  for (const m of catalog.minyanim) {
    let minyanAvailable = 0;
    let minyanTotal = 0;
    const minyanPrices: number[] = [];
    for (const o of occasionsForMinyan(m.slug)) {
      const items = itemsFor(m.slug, o.slug);
      const open = saleWindowFor(o) === "open";
      const availableItems = open
        ? items.filter((item) => !unavailable.has(item.id))
        : [];
      const key = `${m.slug}/${o.slug}`;
      const count: Availability = {
        available: availableItems.length,
        total: items.length,
        fraction: fraction(availableItems.length, items.length),
      };
      occasion.set(key, count);
      minyanAvailable += count.available;
      minyanTotal += count.total;
      const prices = availableItems.map(priceForKibbud);
      occasionFromPrice.set(key, prices.length ? Math.min(...prices) : 0);
      minyanPrices.push(...prices);
    }
    minyan.set(m.slug, {
      available: minyanAvailable,
      total: minyanTotal,
      fraction: fraction(minyanAvailable, minyanTotal),
    });
    minyanFromPrice.set(m.slug, minyanPrices.length ? Math.min(...minyanPrices) : 0);
  }
  return { minyan, occasion, minyanFromPrice, occasionFromPrice };
}
