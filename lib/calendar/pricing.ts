import type { Level, Tier } from "@/contracts/types";
import { PRICES } from "@/lib/calendar/catalog";

/** Resolve USD cents from the trusted catalog price table. */
export function priceFor(level: Level, tier: Tier): number {
  return PRICES[level][tier];
}

