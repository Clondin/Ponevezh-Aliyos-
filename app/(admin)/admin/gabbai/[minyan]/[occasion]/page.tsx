import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PrintButton from "@/components/PrintButton";
import { getMinyan, getOccasion, itemsFor } from "@/lib/catalog";
import { OCCASION_HE, kibbudHe } from "@/lib/hebrew";
import { orderFor, pledgeFor, statusMap } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ minyan: string; occasion: string }>;
}): Promise<Metadata> {
  const { minyan, occasion } = await params;
  const m = getMinyan(minyan);
  const o = getOccasion(occasion);
  return { title: m && o ? `Gabbai sheet — ${m.name}, ${o.shortName}` : "Gabbai sheet" };
}

export default async function GabbaiSheet({
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
  const statuses = statusMap(m.slug, o.slug);

  return (
    <section className="admin-section print-sheet">
      <div className="container">
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <nav className="crumbs" style={{ marginBottom: 0 }}>
            <Link href="/admin">Office</Link>
            <span aria-hidden="true">/</span>
            <span className="current">Gabbai sheet</span>
          </nav>
          <PrintButton />
        </div>

        <header style={{ marginBottom: 22 }}>
          <div className="he he--left" lang="he" style={{ fontSize: 26, marginBottom: 4 }}>
            {OCCASION_HE[o.slug]}
          </div>
          <h1 className="admin-title" style={{ marginBottom: 4 }}>
            {m.name} Minyan &mdash; {o.name}
          </h1>
          <div className="admin-sub" style={{ marginBottom: 0 }}>
            {o.dateLabel} &middot; {o.hebrewDateLabel} &middot; Kibbudim in
            kriah order
          </div>
        </header>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Kibbud</th>
                <th>Sponsor</th>
                <th style={{ textAlign: "right" }}>Mi Shebeirach</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const st = statuses.get(item.id)?.state ?? "available";
                const order = st === "sold" ? orderFor(item.id) : undefined;
                const pledge = st === "pending" ? pledgeFor(item.id) : undefined;
                const unsold = st !== "sold" && st !== "pending";
                return (
                  <tr key={item.id} className={unsold ? "row--muted" : undefined}>
                    <td>{item.order}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span
                        className="he he--left"
                        lang="he"
                        style={{ display: "block", fontSize: 17, lineHeight: 1.3 }}
                      >
                        {kibbudHe(item.slug, item.name)}
                      </span>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                    </td>
                    <td>
                      {order?.donorName ??
                        (pledge ? (
                          <>
                            {pledge.donorName}{" "}
                            <span className="badge badge--pending no-print">pledge</span>
                          </>
                        ) : (
                          <span style={{ color: "var(--hairline)" }}>&mdash;</span>
                        ))}
                    </td>
                    <td className="rtl" lang="he">
                      {(order?.misheberachNames ?? pledge?.misheberachNames)?.join(" וכן ") ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="admin-note" style={{ marginTop: 18 }}>
          Unsold kibbudim are shown dimmed so the gabbai has the complete
          order of the kriah. Generated {new Date().toLocaleDateString("en-US")} &mdash; Yomim
          Noraim 5787.
        </p>
      </div>
    </section>
  );
}
