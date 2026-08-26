import type { MinyanSlug } from "@/contracts/types";

/**
 * Site photo bands, pre-cropped to 2.4:1 and exported at two widths under
 * /images/bands/<key>-{1440,720}.webp. Keys are referenced by PhotoBand.
 */
export interface SitePhoto {
  /** File stem under /images/bands/. */
  key: string;
  alt: string;
}

export const PHOTOS = {
  "minyan-ponevez-yeshiva": {
    key: "minyan-ponevez-yeshiva",
    alt: "The main Ponevez beis medrash in full seder beneath its chandeliers",
  },
  "minyan-ponevez-kollelim": {
    key: "minyan-ponevez-kollelim",
    alt: "Two senior talmidei chachamim learning together over one gemara",
  },
  "minyan-grodna": {
    key: "minyan-grodna",
    alt: "Rows of talmidim over open gemaras seen from above",
  },
  "minyan-perlman": {
    key: "minyan-perlman",
    alt: "Talmidim in animated discussion around a table by the windows",
  },
  "minyan-yeshiva-ketana": {
    key: "minyan-yeshiva-ketana",
    alt: "The yeshiva ketana learning together in its beis medrash",
  },
  "minyan-chayei-avraham": {
    key: "minyan-chayei-avraham",
    alt: "A bright beis medrash filled with learners beneath stained-glass windows",
  },
  "about-campus": {
    key: "about-campus",
    alt: "The Ponevez Yeshiva campus in Bnei Brak under a clear sky",
  },
  "contact-lobby": {
    key: "contact-lobby",
    alt: "Talmidim gathered in the lobby of the yeshiva between sedarim",
  },
  "find-overview": {
    key: "find-overview",
    alt: "The full beis medrash seen from above, every shtender occupied",
  },
  "sponsors-tefillah": {
    key: "sponsors-tefillah",
    alt: "The beis medrash standing in tefillah before the aron kodesh",
  },
  "basket-seforim": {
    key: "basket-seforim",
    alt: "Stacks of well-worn seforim piled on the beis medrash tables",
  },
  "legal-hats": {
    key: "legal-hats",
    alt: "Hats and jackets resting along the stair rail outside the beis medrash",
  },
  "confirm-aron": {
    key: "confirm-aron",
    alt: "Talmidim in conversation beside the golden aron kodesh",
  },
} satisfies Record<string, SitePhoto>;

export type PhotoKey = keyof typeof PHOTOS;

const MINYAN_PHOTO: Record<MinyanSlug, PhotoKey> = {
  "ponevez-yeshiva": "minyan-ponevez-yeshiva",
  "ponevez-kollelim": "minyan-ponevez-kollelim",
  grodna: "minyan-grodna",
  perlman: "minyan-perlman",
  "yeshiva-ketana": "minyan-yeshiva-ketana",
  "chayei-avraham": "minyan-chayei-avraham",
};

export function minyanPhoto(slug: MinyanSlug): PhotoKey {
  return MINYAN_PHOTO[slug];
}
