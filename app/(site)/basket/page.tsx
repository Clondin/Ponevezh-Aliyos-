import type { Metadata } from "next";
import { cookies } from "next/headers";
import PhotoBand from "@/components/PhotoBand";
import CartCheckoutExperience, { type CartItem } from "@/components/CartCheckoutExperience";
import { getCatalog, getMinyan, getOccasion, priceForKibbud } from "@/lib/catalog";
import { saleWindowFor } from "@/lib/calendar/sales";
import { getRepository } from "@/lib/storage/repository";
import { banquestPublicConfiguration } from "@/lib/banquest/client";
import { decodeHoldCookie, HOLD_COOKIE } from "@/lib/api/hold-cookie";

export const metadata: Metadata = { title: "Sponsorship list", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BasketPage() {
  const catalog = getCatalog();
  const repository = getRepository();
  const statuses = await repository.statuses(catalog.items.map((item) => item.id));
  const statusMap = new Map(statuses.map((status) => [status.id, status.state]));
  const cookieStore = await cookies();
  const holdCookie = decodeHoldCookie(cookieStore.get(HOLD_COOKIE)?.value);
  const cookieIds = holdCookie?.kibbudIds ?? (holdCookie ? [holdCookie.kibbudId] : []);
  const ownedHolds = new Set<string>();
  if (holdCookie) {
    const checks = await Promise.allSettled(
      cookieIds.map((id) => repository.holdOwnedBy(id, holdCookie.token))
    );
    checks.forEach((result, index) => {
      if (result.status === "fulfilled") ownedHolds.add(cookieIds[index]);
    });
  }
  const items: CartItem[] = catalog.items.map((item) => {
    const minyan = getMinyan(item.minyan)!;
    const occasion = getOccasion(item.occasion)!;
    const state = statusMap.get(item.id);
    return {
      id: item.id,
      name: item.name,
      minyanName: minyan.name,
      occasionName: occasion.name,
      price: priceForKibbud(item),
      href: `/${item.minyan}/${item.occasion}/${item.slug}`,
      available:
        saleWindowFor(occasion) === "open" &&
        (!state || (state === "held" && ownedHolds.has(item.id))),
    };
  });
  const banquest = banquestPublicConfiguration();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  return <><div className="band"><div className="container" style={{ padding: "52px 40px" }}><div className="page-head"><div className="he he--left" lang="he">רשימת הכיבודים</div><h1>Your sponsorship list</h1><div className="meta">One payment for all selected kibbudim.</div></div></div></div><PhotoBand photo="basket-seforim" slim priority /><section className="container" style={{ padding: "48px 40px 96px" }}><CartCheckoutExperience items={items} tokenizationKey={banquest.tokenizationKey} banquestEnvironment={banquest.environment} checkoutReady={banquest.checkoutReady} turnstileSiteKey={turnstileSiteKey} /></section></>;
}
