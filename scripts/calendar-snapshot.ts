import assert from "node:assert/strict";
import fixture from "../contracts/fixtures/catalog-5787.json";
import type { Catalog, MinyanSlug, OccasionSlug } from "../contracts/types";
import { generateCatalog } from "../lib/calendar/catalog";

const expected5787: Record<OccasionSlug, number> = {
  "rh-1": 10,
  "rh-2": 8,
  "yk-shacharis": 9,
  "yk-mincha": 5,
  neilah: 3,
  "sukkos-1": 10,
  "hoshana-rabbah": 6,
  "simchas-torah": 12,
};

const expectedFace: Record<MinyanSlug, number> = {
  "ponevez-yeshiva": 256600,
  "ponevez-kollelim": 235000,
  grodna: 117500,
  perlman: 117500,
  "yeshiva-ketana": 23500,
  "chayei-avraham": 23500,
};

function itemCounts(catalog: Catalog, minyan: MinyanSlug) {
  return Object.fromEntries(
    catalog.occasions.map((occasion) => [
      occasion.slug,
      catalog.items.filter(
        (item) => item.minyan === minyan && item.occasion === occasion.slug
      ).length,
    ])
  );
}

const expectedAllYears: Record<number, Record<string, number>> = {
  5787: { "rh-1": 10, "rh-2": 8, "yk-shacharis": 9, "yk-mincha": 5, neilah: 3, "sukkos-1": 10, "hoshana-rabbah": 6, "simchas-torah": 12 },
  5788: { "rh-1": 10, "rh-2": 8, "yk-shacharis": 9, "yk-mincha": 5, neilah: 3, "sukkos-1": 10, "hoshana-rabbah": 6, "simchas-torah": 12 },
  5789: { "rh-1": 8, "rh-2": 8, "yk-shacharis": 10, "yk-mincha": 5, neilah: 3, "sukkos-1": 8, "hoshana-rabbah": 6, "simchas-torah": 12 },
  5790: { "rh-1": 8, "rh-2": 8, "yk-shacharis": 9, "yk-mincha": 5, neilah: 3, "sukkos-1": 8, "hoshana-rabbah": 6, "simchas-torah": 12 },
  5791: { "rh-1": 10, "rh-2": 8, "yk-shacharis": 9, "yk-mincha": 5, neilah: 3, "sukkos-1": 10, "hoshana-rabbah": 6, "simchas-torah": 12 },
  5792: { "rh-1": 8, "rh-2": 8, "yk-shacharis": 10, "yk-mincha": 5, neilah: 3, "sukkos-1": 8, "hoshana-rabbah": 6, "simchas-torah": 12 },
  5793: { "rh-1": 8, "rh-2": 8, "yk-shacharis": 9, "yk-mincha": 5, neilah: 3, "sukkos-1": 8, "hoshana-rabbah": 6, "simchas-torah": 12 },
  5794: { "rh-1": 10, "rh-2": 8, "yk-shacharis": 9, "yk-mincha": 5, neilah: 3, "sukkos-1": 10, "hoshana-rabbah": 6, "simchas-torah": 12 },
  5795: { "rh-1": 8, "rh-2": 8, "yk-shacharis": 10, "yk-mincha": 5, neilah: 3, "sukkos-1": 8, "hoshana-rabbah": 6, "simchas-torah": 12 },
  5796: { "rh-1": 8, "rh-2": 8, "yk-shacharis": 10, "yk-mincha": 5, neilah: 3, "sukkos-1": 8, "hoshana-rabbah": 6, "simchas-torah": 12 },
};

const snapshots: Record<number, Record<string, number>> = {};
for (let year = 5787; year <= 5796; year += 1) {
  const catalog = generateCatalog(year);
  snapshots[year] = itemCounts(catalog, "ponevez-yeshiva");
}
assert.deepEqual(snapshots, expectedAllYears);

const generated = generateCatalog(5787);
assert.deepEqual(itemCounts(generated, "ponevez-yeshiva"), expected5787);
assert.equal(generated.items.length, 348);

for (const minyan of generated.minyanim) {
  const face = generated.items
    .filter((item) => item.minyan === minyan.slug)
    .reduce((sum, item) => sum + generated.prices[minyan.level][item.tier], 0);
  assert.equal(face, expectedFace[minyan.slug], `${minyan.slug} face value`);
}
assert.equal(Object.values(expectedFace).reduce((sum, value) => sum + value, 0), 773600);

// Cutoffs in the frozen fixture were explicitly marked as placeholders. All
// other 5787 catalog semantics must remain identical.
const normalize = (catalog: Catalog) => ({
  ...catalog,
  generatedAt: "ignored",
  occasions: catalog.occasions.map((occasion) => ({ ...occasion, cutoffISO: "ignored" })),
});
assert.deepEqual(normalize(generated), normalize(fixture as unknown as Catalog));

console.log("calendar snapshot and 5787 fixture comparison passed");
