import type { Metadata } from "next";
import { getCatalog, getMinyan, getOccasion } from "@/lib/catalog";
import { getRepository } from "@/lib/storage/repository";

export const metadata: Metadata = { title: "With gratitude" };
export const dynamic = "force-dynamic";

export default async function SponsorsPage() {
  const catalog = getCatalog();
  const orders = (await getRepository().allOrders()).filter((order) => order.publicRecognition && order.recognitionName);
  return <><div className="band"><div className="container" style={{ padding: "52px 40px" }}><div className="page-head"><div className="he he--left" lang="he">בהכרת הטוב</div><h1>With gratitude</h1><div className="meta">Thank you to our sponsors.</div></div></div></div><section className="container" style={{ padding: "56px 40px 96px" }}>{orders.length ? <div className="recognition-grid">{orders.map((order) => { const item = catalog.items.find((candidate) => candidate.id === order.kibbudId); const minyan = item ? getMinyan(item.minyan) : undefined; const occasion = item ? getOccasion(item.occasion) : undefined; return <article className="recognition-card" key={order.id}><h2>{order.recognitionName}</h2><p>{item?.name ?? "Kibbud sponsorship"}{occasion ? ` · ${occasion.shortName}` : ""}{minyan ? ` · ${minyan.name}` : ""}</p>{order.dedicationType && order.dedicationName ? <div>{order.dedicationType === "memory" ? "In memory of" : "In honor of"} <strong>{order.dedicationName}</strong></div> : null}</article>; })}</div> : <div className="notice" style={{ padding: "48px 0" }}><h1>Every sponsorship matters</h1><p>Sponsor names will appear here when shared publicly.</p></div>}</section></>;
}
