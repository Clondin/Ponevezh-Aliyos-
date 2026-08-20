import Link from "next/link";
import type { Kibbud, KibbudStatus } from "@/contracts/types";
import { usd } from "@/lib/format";
import { TIER_LABEL, kibbudHe } from "@/lib/hebrew";

const TIER_CLASS = {
  regular: "",
  special: " kibbud-card--special",
  "very-special": " kibbud-card--very-special",
} as const;

/**
 * Tier is encoded only in the 3px top rule. Sold and reserved items stay on
 * white and are dimmed by text colour alone; they are not links, so they
 * never take focus. Buyer names are never shown.
 */
export default function KibbudCard({
  item,
  price,
  status,
}: {
  item: Kibbud;
  price: number;
  status: KibbudStatus;
}) {
  const he = kibbudHe(item.slug, item.name);
  const dim = status.state !== "available";
  const className = `kibbud-card${TIER_CLASS[item.tier]}${dim ? " kibbud-card--dim" : ""}`;

  const face = (
    <>
      <div>
        <div className="kibbud-card__he" lang="he">
          {he}
        </div>
        <div className="kibbud-card__name">{item.name}</div>
        <div className="kibbud-card__tier">{TIER_LABEL[item.tier]}</div>
      </div>
      <div className="kibbud-card__strip">
        <span className="kibbud-card__price">{usd(price)}</span>
        <span className="kibbud-card__action">
          {status.state === "available" && "Sponsor"}
          {status.state === "sold" && "Sponsored"}
          {(status.state === "pending" || status.state === "held") && "Reserved"}
        </span>
      </div>
    </>
  );

  if (dim) {
    return <div className={className}>{face}</div>;
  }

  return (
    <Link
      href={`/${item.minyan}/${item.occasion}/${item.slug}`}
      className={className}
    >
      {face}
    </Link>
  );
}
