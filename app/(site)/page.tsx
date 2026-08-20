import Link from "next/link";
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
