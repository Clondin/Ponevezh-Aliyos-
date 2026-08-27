import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import KibbudCard from "@/components/KibbudCard";
import PhotoBand from "@/components/PhotoBand";
import { getMinyan, getOccasion, itemsFor, priceForKibbud } from "@/lib/catalog";
import { availabilityFromStatuses } from "@/lib/availability";
import { OCCASION_HE } from "@/lib/hebrew";
import { getRepository } from "@/lib/storage/repository";
import { saleWindowFor, waveOpensAt } from "@/lib/calendar/sales";
import { minyanPhoto } from "@/lib/photos";
import { campaignUrl } from "@/lib/seo";
import { decodeHoldCookie, HOLD_COOKIE } from "@/lib/api/hold-cookie";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ minyan: string; occasion: string }>;
}): Promise<Metadata> {
  const { minyan, occasion } = await params;
  const m = getMinyan(minyan);
  const o = getOccasion(occasion);
  return {
    title: m && o ? `${o.name} — ${m.name}` : "Kibbudim",
    ...(m && o
      ? { alternates: { canonical: campaignUrl(`/${m.slug}/${o.slug}`) } }
      : {}),
  };
}

export default async function OccasionPage({
  params,
}: {
  params: Promise<{ minyan: string; occasion: string }>;
}) {
  const { minyan, occasion } = await params;
  const m = getMinyan(minyan);
  const o = getOccasion(occasion);
  if (!m || !o) notFound();
  if (o.minyanim && !o.minyanim.includes(m.slug)) notFound();

  const items = itemsFor(m.slug, o.slug);
  const repository = getRepository();
  const statusList = await repository.statuses(items.map((item) => item.id));
  const statuses = new Map(statusList.map((status) => [status.id, status]));
  const cookieStore = await cookies();
  const holdCookie = decodeHoldCookie(cookieStore.get(HOLD_COOKIE)?.value);
  const cookieIds = new Set(
    holdCookie?.kibbudIds ?? (holdCookie ? [holdCookie.kibbudId] : [])
  );
  const ownedHolds = new Set<string>();
  if (holdCookie) {
    const candidates = items.filter((item) => cookieIds.has(item.id));
    const checks = await Promise.allSettled(
      candidates.map((item) => repository.holdOwnedBy(item.id, holdCookie.token))
    );
    checks.forEach((result, index) => {
      if (result.status === "fulfilled") ownedHolds.add(candidates[index].id);
    });
  }
  const saleWindow = saleWindowFor(o);
  const { fraction } = availabilityFromStatuses(
    items.length,
    statusList,
    saleWindow === "open"
  );
  const opensAt = saleWindow === "upcoming" ? waveOpensAt(o.wave) : undefined;

  return (
    <>
      <div className="band">
        <div className="container" style={{ padding: "40px 40px 56px" }}>
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Kibbudim</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/${m.slug}`}>{m.name}</Link>
            <span aria-hidden="true">/</span>
            <span className="current">{o.shortName}</span>
          </nav>

          <div className="head-split">
            <div className="page-head">
              <div className="he he--left" lang="he">
                {OCCASION_HE[o.slug]}
              </div>
              <h1>{o.name}</h1>
              <div className="meta">
                {o.dateLabel} &middot; {o.hebrewDateLabel} &middot; {m.name} Minyan
              </div>
            </div>
            <div className="head-stat">
              <div className="head-stat__value">{fraction}</div>
              <div className="head-stat__label">Available</div>
            </div>
          </div>
        </div>
      </div>

      <PhotoBand photo={minyanPhoto(m.slug)} slim />

      <section className="container" style={{ padding: "56px 40px 96px" }}>
        {opensAt ? (
          <div className="campaign-notice" role="status">
            Sponsorship opens {new Date(opensAt).toLocaleString("en-US", {
              timeZone: "America/New_York",
              dateStyle: "long",
              timeStyle: "short",
            })} ET.
          </div>
        ) : null}
        {saleWindow === "closed" ? (
          <div className="campaign-notice" role="status">
            Sponsorship for this tefillah is closed.
          </div>
        ) : null}
        {items.length === 0 ? (
          <div className="notice" style={{ padding: "40px 0 60px" }}>
            <div className="notice__glyph" aria-hidden="true">
              ✳
            </div>
            <h2>No kibbudim listed</h2>
            <p>Please check back or contact the office.</p>
            <div className="actions">
              <Link href={`/${m.slug}`} className="btn btn--fill">
                Other days
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="micro micro--wide" style={{ marginBottom: 22 }}>
              In the order of the kriah
            </div>
            <div className="kibbud-grid">
              {items.map((item) => (
                <KibbudCard
                  key={item.id}
                  item={item}
                  price={priceForKibbud(item)}
                  status={statuses.get(item.id) ?? { id: item.id, state: "available" }}
                  opensAt={opensAt}
                  closed={saleWindow === "closed"}
                  ownedHold={ownedHolds.has(item.id)}
                />
              ))}
            </div>

            <div className="grid-footnote" style={{ justifyContent: "flex-end" }}>
              <Link
                href={`/${m.slug}`}
                className="btn btn--sm btn--outline-bronze"
              >
                Other days
              </Link>
            </div>
          </>
        )}
      </section>
    </>
  );
}
