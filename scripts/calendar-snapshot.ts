import assert from "node:assert/strict";
import fixture from "../contracts/fixtures/catalog-5787.json";
import type { Catalog, MinyanSlug, OccasionSlug } from "../contracts/types";
import { generateCatalog } from "../lib/calendar/catalog";

const expected5787: Record<string, number> = {
  "rh-1": 17,
  "rh-2": 10,
  "yk-shacharis": 11,
  "yk-mincha": 5,
  neilah: 1,
  "hoshana-rabbah": 7,
  "simchas-torah": 15,
};

const expectedFace: Record<MinyanSlug, number> = {
  "ponevez-yeshiva": 261000,
  "ponevez-kollelim": 229400,
  grodna: 114700,
  perlman: 114700,
  "yeshiva-ketana": 22940,
  "chayei-avraham": 21860,
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
  5787: { "rh-1": 17, "rh-2": 10, "yk-shacharis": 11, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
  5788: { "rh-1": 17, "rh-2": 10, "yk-shacharis": 11, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
  5789: { "rh-1": 10, "rh-2": 10, "yk-shacharis": 12, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
  5790: { "rh-1": 10, "rh-2": 10, "yk-shacharis": 11, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
  5791: { "rh-1": 17, "rh-2": 10, "yk-shacharis": 11, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
  5792: { "rh-1": 10, "rh-2": 10, "yk-shacharis": 12, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
  5793: { "rh-1": 10, "rh-2": 10, "yk-shacharis": 11, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
  5794: { "rh-1": 17, "rh-2": 10, "yk-shacharis": 11, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
  5795: { "rh-1": 10, "rh-2": 10, "yk-shacharis": 12, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
  5796: { "rh-1": 10, "rh-2": 10, "yk-shacharis": 12, "yk-mincha": 5, neilah: 1, "hoshana-rabbah": 7, "simchas-torah": 15 },
};

const snapshots: Record<number, Record<string, number>> = {};
for (let year = 5787; year <= 5796; year += 1) {
  const catalog = generateCatalog(year);
  snapshots[year] = itemCounts(catalog, "ponevez-yeshiva");
}
assert.deepEqual(snapshots, expectedAllYears);

const generated = generateCatalog(5787);
assert.deepEqual(itemCounts(generated, "ponevez-yeshiva"), expected5787);
assert.equal(generated.items.length, 358);
assert.equal(generated.occasions.some((occasion) => occasion.slug === "sukkos-1"), false);
assert.equal(generated.items.some((item) => item.occasion === "sukkos-1"), false);

for (const minyan of generated.minyanim) {
  const slugs = (occasion: OccasionSlug) =>
    generated.items
      .filter((item) => item.minyan === minyan.slug && item.occasion === occasion)
      .map((item) => item.slug);
  assert.deepEqual(slugs("neilah"), ["pesicha-1"]);
  for (const occasion of ["rh-1", "rh-2", "yk-shacharis"] as const) {
    assert.ok(slugs(occasion).includes("hotzaah-1"));
    assert.ok(slugs(occasion).includes("hotzaah-2"));
    assert.ok(slugs(occasion).includes("hagbah-1"));
    assert.ok(slugs(occasion).includes("hagbah-2"));
  }
}
assert.ok(
  generated.items.some(
    (item) =>
      item.id === "ponevez-yeshiva/hoshana-rabbah/pesicha-hoshanos"
  )
);
assert.equal(
  generated.items.filter(
    (item) => item.minyan === "grodna" && item.slug.startsWith("mincha-")
  ).length,
  5
);
assert.equal(
  generated.items.filter(
    (item) => item.minyan === "grodna" && item.slug.startsWith("night-")
  ).length,
  3
);
assert.equal(
  generated.items.filter(
    (item) =>
      item.minyan === "chayei-avraham" && item.slug.startsWith("night-")
  ).length,
  0
);

for (const minyan of generated.minyanim) {
  const face = generated.items
    .filter((item) => item.minyan === minyan.slug)
    .reduce((sum, item) => sum + generated.prices[minyan.level][item.tier], 0);
  assert.equal(face, expectedFace[minyan.slug], `${minyan.slug} face value`);
}
assert.equal(Object.values(expectedFace).reduce((sum, value) => sum + value, 0), 764600);

// Cutoffs in the frozen fixture were explicitly marked as placeholders. All
// other 5787 catalog semantics must remain identical.
const normalize = (catalog: Catalog) => ({
  ...catalog,
  generatedAt: "ignored",
  occasions: catalog.occasions.map((occasion) => ({ ...occasion, cutoffISO: "ignored" })),
});
assert.deepEqual(normalize(generated), normalize(fixture as unknown as Catalog));

console.log("calendar snapshot and 5787 fixture comparison passed");
