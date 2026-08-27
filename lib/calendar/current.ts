import type {
  Catalog,
  Kibbud,
  Minyan,
  Occasion,
  OccasionSlug,
} from "@/contracts/types";
import generatedCatalog from "@/lib/calendar/generated/catalog-5787.json";

const catalog = generatedCatalog as unknown as Catalog;

export function currentCatalog(): Catalog {
  return catalog;
}

export function currentKibbud(kibbudId: string): Kibbud | undefined {
  return catalog.items.find((item) => item.id === kibbudId);
}

export function currentMinyan(slug: string): Minyan | undefined {
  return catalog.minyanim.find((minyan) => minyan.slug === slug);
}

export function currentOccasion(slug: string): Occasion | undefined {
  return catalog.occasions.find((occasion) => occasion.slug === slug);
}

export function currentItems(minyan: string, occasion: string): Kibbud[] {
  return catalog.items
    .filter((item) => item.minyan === minyan && item.occasion === occasion)
    .sort((left, right) => left.order - right.order);
}

export function currentPrice(item: Kibbud): number {
  const minyan = currentMinyan(item.minyan);
  if (!minyan) throw new Error(`Unknown minyan ${item.minyan}`);
  return catalog.prices[minyan.level][item.tier];
}

export function occasionCutoff(slug: OccasionSlug): string {
  const occasion = currentOccasion(slug);
  if (!occasion) throw new Error(`Unknown occasion ${slug}`);
  return occasion.cutoffISO;
}
