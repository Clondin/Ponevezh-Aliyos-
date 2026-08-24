import {
  HDate,
  HebrewCalendar,
  Location,
  Zmanim,
  months,
  type Event,
} from "@hebcal/core";
import {
  getLeyningForHolidayKey,
  getLeyningKeyForEvent,
  type Leyning,
} from "@hebcal/leyning";
import type {
  Catalog,
  Kibbud,
  Minyan,
  MinyanSlug,
  Occasion,
  OccasionSlug,
  PriceTable,
  Tier,
} from "@/contracts/types";

export const PRICES: PriceTable = {
  1: { regular: 3600, special: 5000, "very-special": 10000 },
  2: { regular: 1800, special: 2500, "very-special": 5000 },
  3: { regular: 360, special: 500, "very-special": 1000 },
};

export const MINYANIM: Minyan[] = [
  { slug: "ponevez-yeshiva", name: "Ponevez Yeshiva", level: 1 },
  { slug: "ponevez-kollelim", name: "Kollel Ponevez", level: 1 },
  { slug: "grodna", name: "Grodna", level: 2 },
  { slug: "perlman", name: "Perlman", level: 2 },
  { slug: "yeshiva-ketana", name: "Yeshiva Ketana", level: 3 },
  { slug: "chayei-avraham", name: "Chayei Avraham", level: 3 },
];

const BNEI_BRAK = new Location(
  32.0837,
  34.8338,
  true,
  "Asia/Jerusalem",
  "Bnei Brak",
  "IL"
);

const ALIYOS = [
  ["kohen", "Kohen"],
  ["levi", "Levi"],
  ["shlishi", "Shlishi"],
  ["revii", "Revi'i"],
  ["chamishi", "Chamishi"],
  ["shishi", "Shishi"],
  ["shevii", "Shevi'i"],
] as const;

type ItemTemplate = { slug: string; name: string; tier: Tier };

const HOTZAAH: ItemTemplate = {
  slug: "hotzaah",
  name: "Hotza'ah VeHachnasah",
  tier: "regular",
};

const HAGBAH: ItemTemplate = {
  slug: "hagbah",
  name: "Hagbah VeGelilah",
  tier: "regular",
};

function aliyahCount(reading: Leyning | undefined, label: string): number {
  if (!reading?.fullkriyah) {
    throw new Error(`No full kriyah found for ${label}`);
  }
  return Object.keys(reading.fullkriyah).filter((key) => /^\d+$/.test(key)).length;
}

function standard(reading: Leyning | undefined, label: string): ItemTemplate[] {
  const count = aliyahCount(reading, label);
  if (count > ALIYOS.length) {
    throw new Error(`${label} has ${count} ordinary aliyos; an override is required`);
  }
  const items: ItemTemplate[] = [
    HOTZAAH,
    ...ALIYOS.slice(0, count).map(([slug, name]) => ({
      slug,
      name,
      tier: "regular" as const,
    })),
  ];
  if (reading?.fullkriyah?.M) {
    items.push({ slug: "maftir", name: "Maftir", tier: "regular" });
  }
  items.push(HAGBAH);
  return items;
}

function localDateISO(hdate: HDate): string {
  const date = hdate.greg();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(hdate: HDate): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(hdate.greg());
  return formatted.replace(/^Saturday,/, "Shabbos,");
}

/** Candle-lighting time at Bnei Brak (20 minutes before sunset) on the erev. */
function cutoffFor(hdate: HDate): string {
  const erev = hdate.prev();
  const zmanim = new Zmanim(BNEI_BRAK, erev, false);
  const cutoff = zmanim.sunsetOffset(-20, true, true);
  return Zmanim.formatISOWithTimeZone(BNEI_BRAK.getTzid(), cutoff);
}

function eventsByTishreiDay(hebrewYear: number): Map<number, Event[]> {
  const events = HebrewCalendar.calendar({
    start: new HDate(1, months.TISHREI, hebrewYear),
    end: new HDate(22, months.TISHREI, hebrewYear),
    il: true,
  });
  const result = new Map<number, Event[]>();
  for (const event of events) {
    const day = event.getDate().getDate();
    const current = result.get(day) ?? [];
    current.push(event);
    result.set(day, current);
  }
  return result;
}

function readingOnDay(events: Map<number, Event[]>, day: number): Leyning {
  for (const event of events.get(day) ?? []) {
    const key = getLeyningKeyForEvent(event, true);
    if (!key) continue;
    const reading = getLeyningForHolidayKey(
      key,
      (event as Event & { cholHaMoedDay?: number }).cholHaMoedDay,
      true
    );
    if (reading?.fullkriyah) return reading;
  }
  throw new Error(`No holiday kriyah found on ${day} Tishrei`);
}

function occasion(
  hebrewYear: number,
  day: number,
  base: Pick<Occasion, "slug" | "name" | "shortName" | "wave" | "minyanim">
): Occasion {
  const hdate = new HDate(day, months.TISHREI, hebrewYear);
  return {
    ...base,
    dateISO: localDateISO(hdate),
    dateLabel: dateLabel(hdate),
    hebrewDateLabel: `${day} Tishrei ${hebrewYear}`,
    cutoffISO: cutoffFor(hdate),
  };
}

/**
 * Generates the sellable Tishrei catalog. This function is deterministic and
 * performs no I/O; callers commit its JSON output at build time.
 */
export function generateCatalog(hebrewYear: number): Catalog {
  if (!Number.isInteger(hebrewYear) || hebrewYear < 5000 || hebrewYear > 7000) {
    throw new RangeError("hebrewYear must be an integer between 5000 and 7000");
  }

  const events = eventsByTishreiDay(hebrewYear);
  const rh1 = readingOnDay(events, 1);
  const rh2 = readingOnDay(events, 2);
  const yomKippur = readingOnDay(events, 10);
  const sukkos1 = readingOnDay(events, 15);
  const hoshanaRabbah = readingOnDay(events, 21);
  const simchasTorah = readingOnDay(events, 22);
  const ykMincha = getLeyningForHolidayKey("Yom Kippur (Mincha)", undefined, true);

  // Guard the static structure against upstream leyning-data changes.
  if (
    aliyahCount(ykMincha, "Yom Kippur Mincha") !== 2 ||
    !ykMincha?.fullkriyah?.M
  ) {
    throw new Error("Yom Kippur Mincha override no longer matches Hebcal");
  }
  if (aliyahCount(simchasTorah, "Simchas Torah") < 7) {
    throw new Error("Simchas Torah override no longer matches Hebcal");
  }

  const definitions: Array<{ occasion: Occasion; items: ItemTemplate[] }> = [
    {
      occasion: occasion(hebrewYear, 1, {
        slug: "rh-1",
        name: "Rosh Hashanah — First Day",
        shortName: "Rosh Hashanah I",
        wave: 1,
      }),
      items: standard(rh1, "Rosh Hashanah I"),
    },
    {
      occasion: occasion(hebrewYear, 2, {
        slug: "rh-2",
        name: "Rosh Hashanah — Second Day",
        shortName: "Rosh Hashanah II",
        wave: 1,
      }),
      items: standard(rh2, "Rosh Hashanah II"),
    },
    {
      occasion: occasion(hebrewYear, 10, {
        slug: "yk-shacharis",
        name: "Yom Kippur — Shacharis",
        shortName: "Yom Kippur Shacharis",
        wave: 1,
      }),
      items: standard(yomKippur, "Yom Kippur Shacharis"),
    },
    {
      occasion: occasion(hebrewYear, 10, {
        slug: "yk-mincha",
        name: "Yom Kippur — Mincha",
        shortName: "Yom Kippur Mincha",
        wave: 1,
      }),
      items: [
        HOTZAAH,
        { slug: "kohen", name: "Kohen", tier: "regular" },
        { slug: "levi", name: "Levi", tier: "regular" },
        { slug: "maftir-yonah", name: "Maftir Yonah", tier: "very-special" },
        HAGBAH,
      ],
    },
    {
      occasion: occasion(hebrewYear, 10, {
        slug: "neilah",
        name: "Neilah",
        shortName: "Neilah",
        wave: 1,
      }),
      items: [
        { slug: "pesicha-1", name: "Pesichas HaAron — First", tier: "very-special" },
        { slug: "pesicha-2", name: "Pesichas HaAron — Second", tier: "very-special" },
        {
          slug: "pesicha-3",
          name: "Pesichas HaAron — Neilas HaShaar",
          tier: "very-special",
        },
      ],
    },
    {
      occasion: occasion(hebrewYear, 15, {
        slug: "sukkos-1",
        name: "Sukkos — First Day",
        shortName: "Sukkos I",
        wave: 2,
      }),
      items: standard(sukkos1, "Sukkos I"),
    },
    {
      occasion: occasion(hebrewYear, 21, {
        slug: "hoshana-rabbah",
        name: "Hoshana Rabbah",
        shortName: "Hoshana Rabbah",
        wave: 2,
        minyanim: ["ponevez-yeshiva"],
      }),
      items: standard(hoshanaRabbah, "Hoshana Rabbah"),
    },
    {
      occasion: occasion(hebrewYear, 22, {
        slug: "simchas-torah",
        name: "Shemini Atzeres / Simchas Torah",
        shortName: "Simchas Torah",
        wave: 2,
      }),
      // Ponevez fixture decision: six distinct aliyos, with Kol HaNearim
      // absorbing the seventh. Chasan Torah/Bereishis are separate kibbudim.
      items: [
        HOTZAAH,
        ...ALIYOS.slice(0, 6).map(([slug, name]) => ({
          slug,
          name,
          tier: "regular" as const,
        })),
        { slug: "kol-hanearim", name: "Kol HaNearim", tier: "special" },
        { slug: "chasan-torah", name: "Chasan Torah", tier: "special" },
        { slug: "chasan-bereishis", name: "Chasan Bereishis", tier: "special" },
        { slug: "maftir", name: "Maftir", tier: "regular" },
        HAGBAH,
      ],
    },
  ];

  const items: Kibbud[] = [];
  for (const minyan of MINYANIM) {
    for (const definition of definitions) {
      if (
        definition.occasion.minyanim &&
        !definition.occasion.minyanim.includes(minyan.slug)
      ) {
        continue;
      }
      definition.items.forEach((item, index) => {
        items.push({
          id: `${minyan.slug}/${definition.occasion.slug}/${item.slug}`,
          minyan: minyan.slug as MinyanSlug,
          occasion: definition.occasion.slug as OccasionSlug,
          slug: item.slug,
          name: item.name,
          tier: item.tier,
          order: index + 1,
        });
      });
    }
  }

  return {
    hebrewYear,
    generatedAt: new Date().toISOString(),
    prices: PRICES,
    minyanim: MINYANIM,
    occasions: definitions.map((definition) => definition.occasion),
    items,
  };
}
