import type { Kibbud } from "@/contracts/types";

/**
 * A single-purpose $1 item used to verify the live payment pipeline.
 *
 * It deliberately stays outside the generated High Holidays catalog so it
 * never appears among, or changes the availability of, real kibbudim.
 */
export const PRODUCTION_TEST_ITEM: Kibbud = {
  id: "ponevez-yeshiva/rh-1/production-test",
  minyan: "ponevez-yeshiva",
  occasion: "rh-1",
  slug: "production-test",
  name: "Production Payment Test",
  tier: "regular",
  order: 0,
};

export const PRODUCTION_TEST_AMOUNT = 1;

export function isProductionTestItem(itemOrId: Kibbud | string): boolean {
  return (typeof itemOrId === "string" ? itemOrId : itemOrId.id) ===
    PRODUCTION_TEST_ITEM.id;
}
