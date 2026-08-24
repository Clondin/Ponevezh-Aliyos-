import type {
  Catalog,
  Kibbud,
  Level,
  Minyan,
  MinyanSlug,
  Occasion,
  OccasionSlug,
  Tier,
} from "@/contracts/types";
import catalogJson from "@/lib/calendar/generated/catalog-5787.json";

const catalog = catalogJson as unknown as Catalog;

export function getCatalog(): Catalog {
  return catalog;
}

export function getMinyanim(): Minyan[] {
  return catalog.minyanim;
}

export function getMinyan(slug: string): Minyan | undefined {
  return catalog.minyanim.find((m) => m.slug === slug);
}

export function getOccasions(): Occasion[] {
  return catalog.occasions;
}

export function getOccasion(slug: string): Occasion | undefined {
  return catalog.occasions.find((o) => o.slug === slug);
}

export function occasionsForMinyan(minyan: MinyanSlug): Occasion[] {
  return catalog.occasions.filter(
    (o) => !o.minyanim || o.minyanim.includes(minyan)
  );
}

export function itemsFor(minyan: MinyanSlug, occasion: OccasionSlug): Kibbud[] {
  return catalog.items
    .filter((i) => i.minyan === minyan && i.occasion === occasion)
    .sort((a, b) => a.order - b.order);
}

export function getKibbud(
  minyan: string,
  occasion: string,
  slug: string
): Kibbud | undefined {
  return catalog.items.find(
    (i) => i.minyan === minyan && i.occasion === occasion && i.slug === slug
  );
}

/** Prices are never stored on an item — always resolved from level × tier. */
export function priceFor(level: Level, tier: Tier): number {
  return catalog.prices[level][tier];
}

export function priceForKibbud(item: Kibbud): number {
  const minyan = getMinyan(item.minyan);
  if (!minyan) throw new Error(`Unknown minyan ${item.minyan}`);
  return priceFor(minyan.level, item.tier);
}
