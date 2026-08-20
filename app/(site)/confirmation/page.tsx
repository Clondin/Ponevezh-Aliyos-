import Link from "next/link";
import type { Metadata } from "next";
import { getCatalog, getMinyan, getOccasion, priceForKibbud } from "@/lib/catalog";
import { kibbudHe } from "@/lib/hebrew";
import { usd } from "@/lib/format";

export const metadata: Metadata = { title: "Confirmation" };
export const dynamic = "force-dynamic";

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; method?: string; donor?: string }>;
}) {
  const { item: itemId, method, donor } = await searchParams;
  const item = getCatalog().items.find((i) => i.id === itemId);
  const m = item ? getMinyan(item.minyan) : undefined;
  const o = item ? getOccasion(item.occasion) : undefined;
  const isWire = method === "wire";

  return (
    <div className="confirm">
      <div className="confirm__glyph" aria-hidden="true">
        ✳
      </div>
      <h1>{isWire ? "Your kibbud is reserved" : "Thank you"}</h1>

      {item && m && o && (
        <div className="receipt">
          <div className="receipt__he" lang="he">
            {kibbudHe(item.slug, item.name)}
          </div>
          <div className="receipt__name">{item.name}</div>
          <div className="receipt__where">
            {o.name} &middot; {m.name} Minyan
          </div>
          <div className="receipt__split">
            <span className="receipt__date">{o.dateLabel}</span>
            <span className="receipt__price">{usd(priceForKibbud(item))}</span>
          </div>
          {donor && <div className="receipt__donor">Sponsored by {donor}</div>}
        </div>
      )}

      <p className="confirm__body">
        {isWire
          ? "The kibbud is held for you for 72 hours. The office will email wire instructions to the address you provided."
          : "A receipt has been emailed to you. The names you entered will be read at the Mi Shebeirach from the bimah."}
      </p>
      <p className="confirm__note">
        {isWire
          ? "If payment does not arrive within 72 hours, the kibbud is released."
          : "No goods or services were provided in exchange for this contribution."}
      </p>

      <div className="actions">
        <Link href={m ? `/${m.slug}` : "/"} className="btn btn--fill">
          Sponsor another
        </Link>
        <Link href="/" className="btn btn--outline">
          Home
        </Link>
      </div>
    </div>
  );
}
