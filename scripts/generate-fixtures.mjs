import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "lib", "calendar", "generated", "catalog-5787.json");
const destination = join(root, "contracts", "fixtures", "catalog-5787.json");
const catalog = JSON.parse(await readFile(source, "utf8"));

await writeFile(destination, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`5787 fixture refreshed from ${source}`);
