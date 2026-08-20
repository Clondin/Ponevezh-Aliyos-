/**
 * Generates contracts/fixtures/catalog-5787.json (the frozen 348-item catalog)
 * and lib/fixtures/state-5787.json (UI-owned demo state so every screen state
 * renders from fixtures with zero network calls).
 *
 * In production the catalog files are emitted by the backend's calendar
 * engine (@hebcal/leyning + override table). This script hard-codes the
 * confirmed 5787 structure from the build plan, section 2.
 *
 * Note on Simchas Torah: the plan's totals (12 items, 57 per minyan, 348
 * overall, face values) are consistent with SIX distinct aliyos plus
 * Kol HaNearim — i.e. Kol HaNearim absorbs one aliyah (open item #1).
 * The fixture follows the totals.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PRICES = {
  1: { regular: 3600, special: 5000, "very-special": 10000 },
  2: { regular: 1800, special: 2500, "very-special": 5000 },
  3: { regular: 360, special: 500, "very-special": 1000 },
};

const MINYANIM = [
  { slug: "ponevez-yeshiva", name: "Ponevez Yeshiva", level: 1 },
  { slug: "ponevez-kollelim", name: "Ponevez Kollelim", level: 1 },
  { slug: "grodna", name: "Grodna", level: 2 },
  { slug: "perlman", name: "Perlman", level: 2 },
  { slug: "yeshiva-ketana", name: "Yeshiva Ketana", level: 3 },
  { slug: "chayei-avraham", name: "Chayei Avraham", level: 3 },
];

const ALIYOS = [
  ["kohen", "Kohen"],
  ["levi", "Levi"],
  ["shlishi", "Shlishi"],
  ["revii", "Revi'i"],
  ["chamishi", "Chamishi"],
  ["shishi", "Shishi"],
  ["shevii", "Shevi'i"],
];

const HOTZAAH = ["hotzaah", "Hotza'ah VeHachnasah"];
const HAGBAH = ["hagbah", "Hagbah VeGelilah"];
const MAFTIR = ["maftir", "Maftir"];

function standard(aliyosCount, withMaftir) {
  const items = [HOTZAAH, ...ALIYOS.slice(0, aliyosCount)];
  if (withMaftir) items.push(MAFTIR);
  items.push(HAGBAH);
  return items.map(([slug, name]) => ({ slug, name, tier: "regular" }));
}

const t = (arr, tier) => arr.map((x) => ({ ...x, tier }));

const OCCASIONS = [
  {
    slug: "rh-1",
    name: "Rosh Hashanah — First Day",
    shortName: "Rosh Hashanah I",
    dateISO: "2026-09-12",
    dateLabel: "Shabbos, 12 September 2026",
    hebrewDateLabel: "1 Tishrei 5787",
    wave: 1,
    cutoffISO: "2026-09-11T18:21:00+03:00",
    items: standard(7, true),
  },
  {
    slug: "rh-2",
    name: "Rosh Hashanah — Second Day",
    shortName: "Rosh Hashanah II",
    dateISO: "2026-09-13",
    dateLabel: "Sunday, 13 September 2026",
    hebrewDateLabel: "2 Tishrei 5787",
    wave: 1,
    cutoffISO: "2026-09-11T18:21:00+03:00",
    items: standard(5, true),
  },
  {
    slug: "yk-shacharis",
    name: "Yom Kippur — Shacharis",
    shortName: "Yom Kippur Shacharis",
    dateISO: "2026-09-21",
    dateLabel: "Monday, 21 September 2026",
    hebrewDateLabel: "10 Tishrei 5787",
    wave: 1,
    cutoffISO: "2026-09-20T18:08:00+03:00",
    items: standard(6, true),
  },
  {
    slug: "yk-mincha",
    name: "Yom Kippur — Mincha",
    shortName: "Yom Kippur Mincha",
    dateISO: "2026-09-21",
    dateLabel: "Monday, 21 September 2026",
    hebrewDateLabel: "10 Tishrei 5787",
    wave: 1,
    cutoffISO: "2026-09-20T18:08:00+03:00",
    items: [
      { slug: "hotzaah", name: "Hotza'ah VeHachnasah", tier: "regular" },
      { slug: "kohen", name: "Kohen", tier: "regular" },
      { slug: "levi", name: "Levi", tier: "regular" },
      { slug: "maftir-yonah", name: "Maftir Yonah", tier: "very-special" },
      { slug: "hagbah", name: "Hagbah VeGelilah", tier: "regular" },
    ],
  },
  {
    slug: "neilah",
    name: "Neilah",
    shortName: "Neilah",
    dateISO: "2026-09-21",
    dateLabel: "Monday, 21 September 2026",
    hebrewDateLabel: "10 Tishrei 5787",
    wave: 1,
    cutoffISO: "2026-09-20T18:08:00+03:00",
    items: t(
      [
        { slug: "pesicha-1", name: "Pesichas HaAron — First" },
        { slug: "pesicha-2", name: "Pesichas HaAron — Second" },
        { slug: "pesicha-3", name: "Pesichas HaAron — Neilas HaShaar" },
      ],
      "very-special"
    ),
  },
  {
    slug: "sukkos-1",
    name: "Sukkos — First Day",
    shortName: "Sukkos I",
    dateISO: "2026-09-26",
    dateLabel: "Shabbos, 26 September 2026",
    hebrewDateLabel: "15 Tishrei 5787",
    wave: 2,
    cutoffISO: "2026-09-25T18:01:00+03:00",
    items: standard(7, true),
  },
  {
    slug: "hoshana-rabbah",
    name: "Hoshana Rabbah",
    shortName: "Hoshana Rabbah",
    dateISO: "2026-10-02",
    dateLabel: "Friday, 2 October 2026",
    hebrewDateLabel: "21 Tishrei 5787",
    wave: 2,
    cutoffISO: "2026-10-01T18:30:00+03:00",
    minyanim: ["ponevez-yeshiva"],
    items: standard(4, false),
  },
  {
    slug: "simchas-torah",
    name: "Shemini Atzeres / Simchas Torah",
    shortName: "Simchas Torah",
    dateISO: "2026-10-03",
    dateLabel: "Shabbos, 3 October 2026",
    hebrewDateLabel: "22 Tishrei 5787",
    wave: 2,
    cutoffISO: "2026-10-02T17:53:00+03:00",
    items: [
      { slug: "hotzaah", name: "Hotza'ah VeHachnasah", tier: "regular" },
      ...ALIYOS.slice(0, 6).map(([slug, name]) => ({ slug, name, tier: "regular" })),
      { slug: "kol-hanearim", name: "Kol HaNearim", tier: "special" },
      { slug: "chasan-torah", name: "Chasan Torah", tier: "special" },
      { slug: "chasan-bereishis", name: "Chasan Bereishis", tier: "special" },
      { slug: "maftir", name: "Maftir", tier: "regular" },
      { slug: "hagbah", name: "Hagbah VeGelilah", tier: "regular" },
    ],
  },
];

// ---- build catalog ----
const items = [];
for (const m of MINYANIM) {
  for (const o of OCCASIONS) {
    if (o.minyanim && !o.minyanim.includes(m.slug)) continue;
    o.items.forEach((it, idx) => {
      items.push({
        id: `${m.slug}/${o.slug}/${it.slug}`,
        minyan: m.slug,
        occasion: o.slug,
        slug: it.slug,
        name: it.name,
        tier: it.tier,
        order: idx + 1,
      });
    });
  }
}

// ---- assertions from the build plan ----
const assert = (cond, msg) => {
  if (!cond) throw new Error(`Fixture check failed: ${msg}`);
};
const perOccasion = { "rh-1": 10, "rh-2": 8, "yk-shacharis": 9, "yk-mincha": 5, neilah: 3, "sukkos-1": 10, "hoshana-rabbah": 6, "simchas-torah": 12 };
for (const [slug, n] of Object.entries(perOccasion)) {
  const got = items.filter((i) => i.minyan === "ponevez-yeshiva" && i.occasion === slug).length;
  assert(got === n, `${slug}: expected ${n}, got ${got}`);
}
assert(items.length === 348, `total items: expected 348, got ${items.length}`);
const face = (mSlug) => {
  const level = MINYANIM.find((m) => m.slug === mSlug).level;
  return items.filter((i) => i.minyan === mSlug).reduce((s, i) => s + PRICES[level][i.tier], 0);
};
assert(face("ponevez-yeshiva") === 256600, `PY face value ${face("ponevez-yeshiva")}`);
assert(face("ponevez-kollelim") === 235000, `PK face value ${face("ponevez-kollelim")}`);
assert(face("grodna") === 117500, `Grodna face value ${face("grodna")}`);
assert(face("yeshiva-ketana") === 23500, `YK face value ${face("yeshiva-ketana")}`);

const catalog = {
  hebrewYear: 5787,
  generatedAt: "2026-08-20T00:00:00.000Z",
  prices: PRICES,
  minyanim: MINYANIM,
  occasions: OCCASIONS.map(({ items: _drop, ...o }) => o),
  items,
};

// ---- demo state (UI-owned, not part of contracts) ----
// Deterministic pseudo-random from the item id so regeneration is stable.
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const HEBREW_NAMES = [
  ["אברהם בן שרה", "רבקה בת לאה"],
  ["יעקב משה בן רחל"],
  ["חיים דוד בן מרים", "אסתר בת חנה", "שלמה זלמן בן דבורה"],
  ["ישראל מאיר בן גיטל"],
  ["נחמן בן פייגא", "ברכה בת שיינדל"],
  ["אליעזר בן טובה"],
  ["מרדכי בן חיה שרה", "יהודית בת מלכה"],
];
const DONORS = [
  "The Goldberg Family", "R' Shmuel Weinstein", "The Friedman Family, Lakewood",
  "Dr. and Mrs. Y. Katz", "The Stern Family, Monsey", "R' Dovid Halberstam",
  "Anonymous", "The Rosenberg Family", "M. and E. Schwartz", "The Landau Family, Flatbush",
];

// Sell-through rates per level — level 3 sells fastest.
const SOLD_RATE = { 1: 0.32, 2: 0.38, 3: 0.55 };

const forced = new Map([
  ["ponevez-yeshiva/yk-mincha/maftir-yonah", "sold"],
  ["ponevez-yeshiva/neilah/pesicha-3", "sold"],
  ["grodna/yk-mincha/maftir-yonah", "held"],
  ["ponevez-yeshiva/simchas-torah/chasan-torah", "pending"],
  ["perlman/neilah/pesicha-1", "pending"],
  ["ponevez-kollelim/rh-1/maftir", "held"],
  // keep a clean fully-available occasion and a nearly-sold one for demos
  ["yeshiva-ketana/rh-1/kohen", "sold"],
]);

const statuses = [];
const orders = [];
const pledges = [];
let orderN = 0;
let pledgeN = 0;

for (const it of items) {
  const level = MINYANIM.find((m) => m.slug === it.minyan).level;
  const r = hash(it.id);
  let state = forced.get(it.id);
  if (!state) {
    if (it.tier !== "regular") state = r < 0.18 ? "sold" : "available";
    else state = r < SOLD_RATE[level] ? "sold" : "available";
  }
  if (state === "available") continue;

  const amount = PRICES[level][it.tier];
  if (state === "sold") {
    const donor = DONORS[Math.floor(hash(it.id + "d") * DONORS.length)];
    const names = HEBREW_NAMES[Math.floor(hash(it.id + "n") * HEBREW_NAMES.length)];
    orders.push({
      id: `ord_${String(++orderN).padStart(4, "0")}`,
      kibbudId: it.id,
      donorName: donor,
      email: "donor@example.com",
      misheberachNames: names,
      amount,
      method: hash(it.id + "m") < 0.6 ? "ach" : "card",
      createdAt: "2026-09-07T09:00:00.000Z",
    });
    statuses.push({ id: it.id, state: "sold" });
  } else if (state === "held") {
    // expiresInMinutes is a demo shim: the loader converts it to an
    // absolute expiresAt at read time so the countdown is always live.
    statuses.push({ id: it.id, state: "held", expiresInMinutes: 7 + Math.floor(hash(it.id + "h") * 5) });
  } else if (state === "pending") {
    const donor = DONORS[Math.floor(hash(it.id + "d") * DONORS.length)];
    const names = HEBREW_NAMES[Math.floor(hash(it.id + "n") * HEBREW_NAMES.length)];
    pledges.push({
      id: `plg_${String(++pledgeN).padStart(3, "0")}`,
      kibbudId: it.id,
      donorName: donor,
      email: "donor@example.com",
      phone: "+1 718 555 0134",
      misheberachNames: names,
      amount,
      status: "pending",
      expiresInHours: 24 + Math.floor(hash(it.id + "p") * 48),
      createdAt: "2026-09-06T21:40:00.000Z",
    });
    statuses.push({ id: it.id, state: "pending" });
  }
}

const state = { hebrewYear: 5787, statuses, orders, pledges };

mkdirSync(join(root, "contracts", "fixtures"), { recursive: true });
mkdirSync(join(root, "lib", "fixtures"), { recursive: true });
writeFileSync(join(root, "contracts", "fixtures", "catalog-5787.json"), JSON.stringify(catalog, null, 2));
writeFileSync(join(root, "lib", "fixtures", "state-5787.json"), JSON.stringify(state, null, 2));

console.log(`catalog: ${items.length} items across ${MINYANIM.length} minyanim`);
console.log(`state:   ${orders.length} sold, ${statuses.filter((s) => s.state === "held").length} held, ${pledges.length} pending pledges`);
