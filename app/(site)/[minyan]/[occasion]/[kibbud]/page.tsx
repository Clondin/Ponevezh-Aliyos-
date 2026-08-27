import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CheckoutExperience from "@/components/CheckoutExperience";
import Notice from "@/components/Notice";
import { getKibbud, getMinyan, getOccasion, priceForKibbud } from "@/lib/catalog";
import { TIER_LABEL, kibbudHe } from "@/lib/hebrew";
import { getRepository } from "@/lib/storage/repository";
import { usd } from "@/lib/format";
import { saleWindowFor, waveOpensAt } from "@/lib/calendar/sales";
import ShareActions from "@/components/ShareActions";
import BasketButton from "@/components/BasketButton";
import { banquestPublicConfiguration } from "@/lib/banquest/client";
import { campaignUrl, socialImageUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ minyan: string; occasion: string; kibbud: string }>;
}): Promise<Metadata> {
  const { minyan, occasion, kibbud } = await params;
  const item = getKibbud(minyan, occasion, kibbud);
  const m = getMinyan(minyan);
  const o = getOccasion(occasion);
  if (!item || !m || !o) return { title: "Kibbud" };
  const description = `Sponsor ${item.name} for ${o.name} in the ${m.name} Minyan at Ponevez Yeshiva.`;
  return {
    title: `Sponsor ${item.name}`,
    description,
    alternates: {
      canonical: campaignUrl(`/${item.minyan}/${item.occasion}/${item.slug}`),
    },
    openGraph: {
      title: `${item.name} — ${o.name}`,
      description,
      type: "website",
      images: [{ url: socialImageUrl(), width: 1200, height: 630 }],
    },
  };
}

export default async function KibbudPage({
  params,
}: {
  params: Promise<{ minyan: string; occasion: string; kibbud: string }>;
}) {
  const { minyan, occasion, kibbud } = await params;
  const m = getMinyan(minyan);
  const o = getOccasion(occasion);
  const item = getKibbud(minyan, occasion, kibbud);
  if (!m || !o || !item) notFound();

  const price = priceForKibbud(item);
  const [status] = await getRepository().statuses([item.id]);
  const banquest = banquestPublicConfiguration();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";

  const saleWindow = saleWindowFor(o);
  if (saleWindow === "upcoming") {
    return (
      <Notice
        glyph="asterisk"
        title="Sponsorship has not opened yet"
        body={`This kibbud becomes available ${new Date(waveOpensAt(o.wave)).toLocaleString("en-US", {
          timeZone: "America/New_York",
          dateStyle: "long",
          timeStyle: "short",
        })} ET.`}
        primaryHref={`/${m.slug}/${o.slug}`}
        primaryLabel="View this tefillah"
        secondaryHref={`/${m.slug}`}
        secondaryLabel="Other days"
      />
    );
  }

  if (saleWindow === "closed") {
    return (
      <Notice
        glyph="asterisk"
        title="Sponsorship is closed"
        body="The deadline for this tefillah has passed."
        primaryHref={`/${m.slug}`}
        primaryLabel="Other days"
        secondaryHref="/find"
        secondaryLabel="Find a kibbud"
      />
    );
  }

  if (status && status.state !== "available" && status.state !== "held") {
    const sold = status.state === "sold";
    return (
      <Notice
        glyph="asterisk"
        title={sold ? "This kibbud has been sponsored" : "This kibbud is reserved"}
        body={
          sold
            ? "This kibbud already has a sponsor."
            : "Another donor is completing this sponsorship. It may reopen shortly."
        }
        primaryHref={`/${m.slug}/${o.slug}`}
        primaryLabel="See the remaining kibbudim"
        secondaryHref={`/${m.slug}`}
        secondaryLabel="Other days"
      />
    );
  }

  return (
    <>
      <div className="band">
        <div className="container container--narrow" style={{ padding: "40px 40px 48px" }}>
          <nav className="crumbs" aria-label="Breadcrumb" style={{ marginBottom: 44 }}>
            <Link href="/">Kibbudim</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/${m.slug}`}>{m.name}</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/${m.slug}/${o.slug}`}>{o.shortName}</Link>
            <span aria-hidden="true">/</span>
            <span className="current">{item.name}</span>
          </nav>

          <div className="head-split">
            <div className="page-head">
              <div className="he he--left" lang="he">
                {kibbudHe(item.slug, item.name)}
              </div>
              <h1>{item.name}</h1>
              <div className="meta">
                {o.name} &middot; {o.dateLabel} &middot; {m.name} Minyan
              </div>
            </div>
            <div className="head-stat">
              <div className="head-stat__value">{usd(price)}</div>
              <div className="head-stat__label">{TIER_LABEL[item.tier]}</div>
            </div>
          </div>
        </div>
      </div>

      <section
        className="container container--narrow"
        style={{ padding: "32px 40px 96px" }}
      >
        <ShareActions
          title={`${item.name} — ${o.name}`}
          text={`Sponsor ${item.name} for ${o.name} in the ${m.name} Minyan at Ponevez.`}
        />
        <div className="sponsorship-list-action"><BasketButton itemId={item.id} /></div>
        <CheckoutExperience
          itemId={item.id}
          amount={price}
          occasionHref={`/${m.slug}/${o.slug}`}
          minyanHref={`/${m.slug}`}
          tokenizationKey={banquest.tokenizationKey}
          banquestEnvironment={banquest.environment}
          checkoutReady={banquest.checkoutReady}
          turnstileSiteKey={turnstileSiteKey}
        />
      </section>
    </>
  );
}
