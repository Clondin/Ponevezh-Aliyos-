import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(.:)/, "$1");
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".md"]);
const excluded = new Set(["node_modules", ".next", ".git"]);
const failures = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (extensions.has(extname(entry.name))) {
      const relativePath = relative(root, path);
      if (
        relativePath === join("docs", "backend-agent-prompt.md") ||
        relativePath === join("scripts", "check-terminology.mjs")
      ) {
        continue;
      }
      const text = await readFile(path, "utf8");
      if (/Ponevezh/i.test(text)) failures.push(`${relativePath}: use Ponevez`);
      if (/Petichas HaHeichal/i.test(text)) {
        failures.push(`${relativePath}: use Pesichas HaAron`);
      }
      if (/>(?:\s*)(?:Buy|Cart|Checkout)(?:\s*)</i.test(text)) {
        failures.push(`${relativePath}: donor-facing verb must be Sponsor`);
      }
    }
  }
}

await walk(root);
if (failures.length) throw new Error(`Terminology check failed:\n${failures.join("\n")}`);
console.log("terminology check passed");
