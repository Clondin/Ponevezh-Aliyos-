import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CheckoutExperience from "@/components/CheckoutExperience";
import Notice from "@/components/Notice";
import { getKibbud, getMinyan, getOccasion, priceForKibbud } from "@/lib/catalog";
import { TIER_LABEL, kibbudHe } from "@/lib/hebrew";
import { getRepository } from "@/lib/storage/repository";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ minyan: string; occasion: string; kibbud: string }>;
}): Promise<Metadata> {
  const { minyan, occasion, kibbud } = await params;
  const item = getKibbud(minyan, occasion, kibbud);
  return { title: item ? `Sponsor ${item.name}` : "Kibbud" };
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
  const tokenizationKey = process.env.BANQUEST_TOKENIZATION_KEY?.trim() ?? "";
  const banquestEnvironment =
    process.env.BANQUEST_ENV?.trim().toLowerCase() === "production"
      ? "production"
      : "sandbox";

  if (status && status.state !== "available" && status.state !== "held") {
    const sold = status.state === "sold";
    return (
      <Notice
        glyph="asterisk"
        title={sold ? "This kibbud has been sponsored" : "This kibbud is reserved"}
        body={
          sold
            ? "It has already found its sponsor, and remains listed in that sponsor's honor."
            : "Another donor is completing this kibbud right now. If it is not completed, it reopens shortly."
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
        <CheckoutExperience
          itemId={item.id}
          occasionHref={`/${m.slug}/${o.slug}`}
          minyanHref={`/${m.slug}`}
          tokenizationKey={tokenizationKey}
          banquestEnvironment={banquestEnvironment}
        />
      </section>
    </>
  );
}
