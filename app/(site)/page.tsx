import Link from "next/link";
import Image from "next/image";
import SectionHeading from "@/components/SectionHeading";
import { getMinyanim, getOccasions } from "@/lib/catalog";
import { minyanAvailability, minyanFromPrice } from "@/lib/availability";
import { HEADING_HE, MINYAN_HE, OCCASION_HE } from "@/lib/hebrew";
import { shortDate, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    num: "01",
    title: "Choose a kibbud",
    body: "A minyan, a day, and the honor itself.",
  },
  {
    num: "02",
    title: "Enter your names",
    body: "In Hebrew or English, as they should be read from the bimah.",
  },
  {
    num: "03",
    title: "Complete your sponsorship",
    body: "Card, bank transfer, or a wire arranged with the office.",
  },
];

export default async function HomePage() {
  const minyanim = getMinyanim();
  const occasions = getOccasions();
  const availability = new Map(
    await Promise.all(
      minyanim.map(async (minyan) => [
        minyan.slug,
        await minyanAvailability(minyan.slug),
      ] as const)
    )
  );

  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__copy">
            <div className="eyebrow">Tishrei 5787</div>
            <div className="hero__he" lang="he">
              {HEADING_HE.hero}
            </div>
            <h1>Kibbudim of the Yomim Noraim</h1>
            <p>Each kibbud is given once, in one minyan, on one day.</p>
            <div className="hero__actions">
              <a href="#minyanim" className="btn btn--fill">
                Choose a minyan
              </a>
              <a href="#how" className="btn btn--outline">
                How it works
              </a>
            </div>
          </div>

          <figure className="hero__visual">
            <Image
              src="/images/yeshiva/beis-medrash.webp"
              alt="The Ponevez Yeshiva beis medrash filled with talmidim learning"
              width={1920}
              height={1078}
              sizes="(max-width: 900px) 100vw, 56vw"
              priority
              unoptimized
            />
            <figcaption>
              <span lang="he">בית המדרש</span>
              Ponevez Yeshiva, Bnei Brak
            </figcaption>
          </figure>
        </div>
      </section>

      <section id="minyanim" className="container" style={{ padding: "88px 40px" }}>
        <SectionHeading he={HEADING_HE.chooseMinyan}>Choose a minyan</SectionHeading>
        <div className="minyan-grid">
          {minyanim.map((m) => {
            const fraction = availability.get(m.slug)?.fraction ?? "00 / 00";
            return (
              <Link key={m.slug} href={`/${m.slug}`} className="minyan-card">
                <div>
                  <div className="minyan-card__he" lang="he">
                    {MINYAN_HE[m.slug]}
                  </div>
                  <div className="minyan-card__name">{m.name}</div>
                </div>
                <div className="minyan-card__strip">
                  <span className="minyan-card__from">
                    From {usd(minyanFromPrice(m.slug))}
                  </span>
                  <span className="micro micro--bronze">{fraction} available</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="yeshiva-story band band--rules">
        <div className="container yeshiva-story__inner">
          <div className="yeshiva-story__media">
            <figure className="yeshiva-story__image yeshiva-story__image--learning">
              <Image
                src="/images/yeshiva/learning.webp"
                alt="Talmidim learning together in the Ponevez beis medrash"
                width={1920}
                height={1280}
                sizes="(max-width: 900px) 70vw, 42vw"
                unoptimized
              />
            </figure>
            <figure className="yeshiva-story__image yeshiva-story__image--tefillah">
              <Image
                src="/images/yeshiva/tefillah.webp"
                alt="The Ponevez beis medrash gathered for tefillah"
                width={1920}
                height={936}
                sizes="(max-width: 900px) 30vw, 18vw"
                unoptimized
              />
            </figure>
          </div>

          <div className="yeshiva-story__copy">
            <div className="eyebrow">The beis medrash</div>
            <div className="yeshiva-story__he" lang="he">
              קול תורה
            </div>
            <h2>Carry the tefillos with you</h2>
            <p>
              Each kibbud connects your family to the tefillos of the Yomim
              Noraim and supports the enduring voice of Torah at Ponevez.
            </p>
            <a href="#how" className="yeshiva-story__link">
              How sponsorship works <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        </div>
      </section>

      <section className="band band--rules">
        <div className="container" style={{ padding: "72px 40px" }}>
          <SectionHeading he={HEADING_HE.daysOfTishrei}>
            The days of Tishrei
          </SectionHeading>
          <div className="tishrei-grid">
            {occasions.map((o) => (
              <div key={o.slug} className="tishrei-col">
                <div className="tishrei-col__he" lang="he">
                  {OCCASION_HE[o.slug]}
                </div>
                <div className="tishrei-col__name">{o.name}</div>
                <div className="tishrei-col__date">{shortDate(o.dateISO)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="container" style={{ padding: "84px 40px 96px" }}>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.num}>
              <div className="step__num">{s.num}</div>
              <div className="step__title">{s.title}</div>
              <div className="step__body">{s.body}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
