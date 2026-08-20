import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateCatalog } from "../lib/calendar/catalog";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "lib", "calendar", "generated");
await mkdir(outputDirectory, { recursive: true });

for (let year = 5787; year <= 5796; year += 1) {
  const catalog = generateCatalog(year);
  const destination = join(outputDirectory, `catalog-${year}.json`);
  await writeFile(destination, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  console.log(`${year}: ${catalog.items.length} items -> ${destination}`);
}

