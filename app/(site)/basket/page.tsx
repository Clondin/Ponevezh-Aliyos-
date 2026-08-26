import type { Metadata } from "next";
import PhotoBand from "@/components/PhotoBand";
import CartCheckoutExperience, { type CartItem } from "@/components/CartCheckoutExperience";
import { getCatalog, getMinyan, getOccasion, priceForKibbud } from "@/lib/catalog";
import { saleWindowFor } from "@/lib/calendar/sales";
import { getRepository } from "@/lib/storage/repository";
import { banquestPublicConfiguration } from "@/lib/banquest/client";

export const metadata: Metadata = { title: "Sponsorship list", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BasketPage() {
  const catalog = getCatalog();
  const statuses = await getRepository().statuses(catalog.items.map((item) => item.id));
  const unavailable = new Set(statuses.map((status) => status.id));
  const items: CartItem[] = catalog.items.map((item) => { const minyan = getMinyan(item.minyan)!; const occasion = getOccasion(item.occasion)!; return { id: item.id, name: item.name, minyanName: minyan.name, occasionName: occasion.name, price: priceForKibbud(item), href: `/${item.minyan}/${item.occasion}/${item.slug}`, available: !unavailable.has(item.id) && saleWindowFor(occasion) === "open" }; });
  const banquest = banquestPublicConfiguration();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  return <><div className="band"><div className="container" style={{ padding: "52px 40px" }}><div className="page-head"><div className="he he--left" lang="he">רשימת הכיבודים</div><h1>Your sponsorship list</h1><div className="meta">One payment for all selected kibbudim.</div></div></div></div><PhotoBand photo="basket-seforim" slim priority /><section className="container" style={{ padding: "48px 40px 96px" }}><CartCheckoutExperience items={items} tokenizationKey={banquest.tokenizationKey} banquestEnvironment={banquest.environment} checkoutReady={banquest.checkoutReady} turnstileSiteKey={turnstileSiteKey} /></section></>;
}
