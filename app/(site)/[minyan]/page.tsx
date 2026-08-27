import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PhotoBand from "@/components/PhotoBand";
import { getMinyan, occasionsForMinyan } from "@/lib/catalog";
import { availabilitySnapshot } from "@/lib/availability";
import {
  HEADING_HE,
  MINYAN_HE,
  OCCASION_HE,
  OCCASION_HE_DAY,
  minyanHeTitle,
} from "@/lib/hebrew";
import { shortDate, usd } from "@/lib/format";
import { minyanPhoto } from "@/lib/photos";
import { campaignUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ minyan: string }>;
}): Promise<Metadata> {
  const { minyan } = await params;
  const m = getMinyan(minyan);
  return {
    title: m ? `${m.name} Minyan` : "Minyan",
    ...(m ? { alternates: { canonical: campaignUrl(`/${m.slug}`) } } : {}),
  };
}

export default async function MinyanPage({
  params,
}: {
  params: Promise<{ minyan: string }>;
}) {
  const { minyan } = await params;
  const m = getMinyan(minyan);
  if (!m) notFound();

  const occasions = occasionsForMinyan(m.slug);
  const availability = await availabilitySnapshot();

  return (
    <>
      <div className="band">
        <div className="container" style={{ padding: "40px 40px 60px" }}>
          <nav className="crumbs" aria-label="Breadcrumb" style={{ marginBottom: 52 }}>
            <Link href="/">Kibbudim</Link>
            <span aria-hidden="true">/</span>
            <span className="current">{m.name}</span>
          </nav>
          <div className="page-head">
            <div className="he he--left" lang="he">
              {minyanHeTitle(m.slug)}
            </div>
            <h1>{m.name} Minyan</h1>
          </div>
        </div>
      </div>

      <PhotoBand
        photo={minyanPhoto(m.slug)}
        he={MINYAN_HE[m.slug]}
        caption={`${m.name} Minyan`}
        priority
      />

      <section className="container" style={{ padding: "60px 40px 96px" }}>
        <div className="micro micro--wide" style={{ marginBottom: 22 }}>
          Days and tefillos &middot;{" "}
          <span lang="he">{HEADING_HE.daysAndTefillos}</span>
        </div>

        <div className="day-list">
          {occasions.map((o) => {
            const key = `${m.slug}/${o.slug}`;
            const fraction = availability.occasion.get(key)?.fraction ?? "00 / 00";
            const fromPrice = availability.occasionFromPrice.get(key) ?? 0;
            return (
              <Link key={o.slug} href={`/${m.slug}/${o.slug}`} className="day-row">
                <span className="day-row__date">
                  <span className="day-row__letter" lang="he">
                    {OCCASION_HE_DAY[o.slug]}
                  </span>
                  <span className="day-row__short">{shortDate(o.dateISO)}</span>
                </span>
                <span className="day-row__names">
                  <span className="day-row__he" lang="he">
                    {OCCASION_HE[o.slug]}
                  </span>
                  <span className="day-row__name">{o.name}</span>
                </span>
                <span className="day-row__stats">
                  <span className="day-row__fraction">{fraction}</span>
                  <span className="day-row__avail">Available</span>
                </span>
                <span className="day-row__from">
                  {fromPrice ? usd(fromPrice) : "Closed"}
                </span>
                <span className="day-row__chevron" aria-hidden="true">
                  &rarr;
                </span>
              </Link>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 34 }}>
          <Link href="/" className="btn btn--sm btn--outline-bronze">
            Other minyanim
          </Link>
        </div>
      </section>
    </>
  );
}
