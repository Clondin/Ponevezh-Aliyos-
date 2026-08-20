import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalog } from "../contracts/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const currentYear = Number(process.argv[2] ?? 5787);
const nextYear = currentYear + 1;
const readCatalog = async (year: number) =>
  JSON.parse(
    await readFile(join(root, "lib", "calendar", "generated", `catalog-${year}.json`), "utf8")
  ) as Catalog;

const [current, next] = await Promise.all([readCatalog(currentYear), readCatalog(nextYear)]);
const currentById = new Map(current.items.map((item) => [item.id, item]));
const nextById = new Map(next.items.map((item) => [item.id, item]));

console.log(`PONEVEZ KIBBUDIM CATALOG SIGN-OFF: ${currentYear} -> ${nextYear}`);
console.log("=".repeat(72));
for (const occasion of next.occasions) {
  const previous = current.occasions.find((item) => item.slug === occasion.slug);
  console.log(`\n${occasion.name}`);
  console.log(`  Date: ${previous?.dateLabel ?? "n/a"} -> ${occasion.dateLabel}`);
  console.log(`  Cutoff: ${previous?.cutoffISO ?? "n/a"} -> ${occasion.cutoffISO}`);
}

const added = next.items.filter((item) => !currentById.has(item.id));
const removed = current.items.filter((item) => !nextById.has(item.id));
const changed = next.items.filter((item) => {
  const before = currentById.get(item.id);
  return before && JSON.stringify(before) !== JSON.stringify(item);
});

console.log("\nITEM CHANGES");
console.log(`  Added: ${added.length}`);
for (const item of added) console.log(`    + ${item.id} (${item.name}, ${item.tier})`);
console.log(`  Removed: ${removed.length}`);
for (const item of removed) console.log(`    - ${item.id} (${item.name}, ${item.tier})`);
console.log(`  Changed: ${changed.length}`);
for (const item of changed) console.log(`    * ${item.id}`);
console.log("\nGabbai signature: __________________________  Date: ____________");

