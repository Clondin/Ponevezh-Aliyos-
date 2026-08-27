import Link from "next/link";
import type { Metadata } from "next";
import { getCatalog, getMinyan, getOccasion } from "@/lib/catalog";
import { usd } from "@/lib/format";
import { getRepository } from "@/lib/storage/repository";

export const metadata: Metadata = { title: "Combined sponsorship confirmation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BasketConfirmation({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  const repository = getRepository();
  const checkout = key ? await repository.checkout(key) : null;
  const orders = checkout?.status === "sold" && key ? await repository.ordersForPayment(key) : [];
  const catalog = getCatalog();
  const pending = checkout?.status === "created" || checkout?.status === "processing" || checkout?.status === "pending" || checkout?.status === "needs_review";
  const unsuccessful = checkout?.status === "released" || checkout?.status === "reversed";
  return <div className="confirm combined-confirm"><div className="confirm__glyph" aria-hidden="true">✳</div><h1>{!checkout ? "Confirmation unavailable" : unsuccessful ? "Payment not completed" : pending ? "Payment submitted" : "Thank you"}</h1>{checkout ? <div className="receipt"><div className="receipt__name">{orders.length || checkout.kibbudIds?.length || 0} kibbudim</div><div className="receipt__where">Combined Ponevez sponsorship</div><div className="receipt__split"><span className="receipt__date">Receipt {checkout.paymentId}</span><span className="receipt__price">{usd(checkout.amount)}</span></div>{orders.length ? <ul className="combined-confirm__items">{orders.map((order) => { const item = catalog.items.find((candidate) => candidate.id === order.kibbudId); const minyan = item ? getMinyan(item.minyan) : undefined; const occasion = item ? getOccasion(item.occasion) : undefined; return <li key={order.id}><strong>{item?.name ?? order.kibbudId}</strong><span>{occasion?.shortName} · {minyan?.name}</span></li>; })}</ul> : null}</div> : null}<p className="confirm__body">{!checkout ? "This confirmation link is incomplete or expired." : unsuccessful ? "Your payment was not completed. The kibbudim are available again." : pending ? "Your payment is being confirmed. The selected kibbudim remain reserved." : "Your kibbudim are confirmed. Admire will email your official receipt."}</p><p className="confirm__note">No goods or services were provided in exchange for this contribution.</p><div className="actions"><Link href="/find" className="btn btn--fill">Sponsor another</Link><Link href="/" className="btn btn--outline">Home</Link></div></div>;
}
