import type { Metadata } from "next";
import KibbudFinder, { type FinderItem } from "@/components/KibbudFinder";
import { getCatalog, getMinyan, getOccasion, priceForKibbud } from "@/lib/catalog";
import { kibbudHe } from "@/lib/hebrew";
import { saleWindowFor } from "@/lib/calendar/sales";
import { getRepository } from "@/lib/storage/repository";

export const metadata: Metadata = { title: "Find a kibbud", description: "Search available Yomim Noraim kibbudim by minyan, day, type and price." };
export const dynamic = "force-dynamic";

export default async function FindPage() {
  const catalog = getCatalog();
  const statuses = await getRepository().statuses(catalog.items.map((item) => item.id));
  const statusMap = new Map(statuses.map((status) => [status.id, status.state]));
  const items: FinderItem[] = catalog.items.map((item) => {
    const minyan = getMinyan(item.minyan)!;
    const occasion = getOccasion(item.occasion)!;
    const window = saleWindowFor(occasion);
    return {
      id: item.id,
      name: item.name,
      hebrewName: kibbudHe(item.slug, item.name),
      minyan: item.minyan,
      minyanName: minyan.name,
      occasion: item.occasion,
      occasionName: occasion.name,
      dateLabel: occasion.dateLabel,
      tier: item.tier,
      price: priceForKibbud(item),
      state: window === "upcoming" ? "upcoming" : window === "closed" ? "closed" : statusMap.get(item.id) ?? "available",
      href: `/${item.minyan}/${item.occasion}/${item.slug}`,
    };
  });
  return <><div className="band"><div className="container" style={{ padding: "52px 40px" }}><div className="page-head"><div className="he he--left" lang="he">מצאו כיבוד</div><h1>Find a kibbud</h1><div className="meta">Search by minyan, day, type, or price.</div></div></div></div><section className="container" style={{ padding: "48px 40px 96px" }}><KibbudFinder items={items} /></section></>;
}
