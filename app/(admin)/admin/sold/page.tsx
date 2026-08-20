import type { Metadata } from "next";
import { getCatalog, getMinyanim, priceFor } from "@/lib/catalog";
import { usd } from "@/lib/format";
import { getRepository } from "@/lib/redis/repository";

export const metadata: Metadata = { title: "Sold summary" };
export const dynamic = "force-dynamic";

export default async function SoldSummaryPage() {
  const minyanim = getMinyanim();
  const catalog = getCatalog();
  const orders = await getRepository().allOrders();
  const soldIds = new Set(orders.map((o) => o.kibbudId));

  const rows = minyanim.map((m) => {
    const items = catalog.items.filter((i) => i.minyan === m.slug);
    const sold = items.filter((i) => soldIds.has(i.id));
    const face = items.reduce((s, i) => s + priceFor(m.level, i.tier), 0);
    const raised = orders
      .filter((o) => o.kibbudId.startsWith(`${m.slug}/`))
      .reduce((s, o) => s + o.amount, 0);
    return { m, total: items.length, sold: sold.length, face, raised };
  });

  const totals = rows.reduce(
    (t, r) => ({
      total: t.total + r.total,
      sold: t.sold + r.sold,
      face: t.face + r.face,
      raised: t.raised + r.raised,
    }),
    { total: 0, sold: 0, face: 0, raised: 0 }
  );

  return (
    <section className="admin-section">
      <div className="container">
        <h1 className="admin-title">Sold summary by minyan</h1>
        <p className="admin-sub">
          Completed payments only; pending pledges are excluded until the wire
          arrives.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Minyan</th>
                <th>Level</th>
                <th style={{ textAlign: "right" }}>Sold</th>
                <th style={{ textAlign: "right" }}>Items</th>
                <th style={{ textAlign: "right" }}>Raised</th>
                <th style={{ textAlign: "right" }}>Face value</th>
                <th style={{ textAlign: "right" }}>Sell-through</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, total, sold, face, raised }) => (
                <tr key={m.slug}>
                  <td style={{ fontWeight: 600 }}>{m.name}</td>
                  <td>{m.level}</td>
                  <td style={{ textAlign: "right" }}>{sold}</td>
                  <td style={{ textAlign: "right" }}>{total}</td>
                  <td style={{ textAlign: "right" }}>{usd(raised)}</td>
                  <td style={{ textAlign: "right" }}>{usd(face)}</td>
                  <td style={{ textAlign: "right" }}>
                    {total ? Math.round((sold / total) * 100) : 0}%
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700 }}>
                <td>Total</td>
                <td></td>
                <td style={{ textAlign: "right" }}>{totals.sold}</td>
                <td style={{ textAlign: "right" }}>{totals.total}</td>
                <td style={{ textAlign: "right" }}>{usd(totals.raised)}</td>
                <td style={{ textAlign: "right" }}>{usd(totals.face)}</td>
                <td style={{ textAlign: "right" }}>
                  {Math.round((totals.sold / totals.total) * 100)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
