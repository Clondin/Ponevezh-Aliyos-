import Link from "next/link";
import { getCatalog, getMinyanim, occasionsForMinyan, priceForKibbud } from "@/lib/catalog";
import { usd } from "@/lib/format";
import { getRepository } from "@/lib/storage/repository";
import ReconcileButton from "@/components/ReconcileButton";
import { withBasePath } from "@/lib/site-paths";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const minyanim = getMinyanim();
  const repository = getRepository();
  const [allOrders, pledges, activeCheckouts] = await Promise.all([
    repository.allOrders(),
    repository.pendingPledges(),
    repository.activeCheckouts(),
  ]);
  const orders = allOrders.filter((order) => order.status !== "refunded");
  const paymentsToReview = activeCheckouts.length;
  const raised = orders.reduce((s, o) => s + o.amount, 0);
  const items = getCatalog().items;
  const faceValue = items.reduce((s, item) => s + priceForKibbud(item), 0);

  return (
    <section className="admin-section">
      <div className="container">
        <h1 className="admin-title">Season overview &mdash; 5787</h1>
        <p className="admin-sub">
          Tishrei 5787 &middot; {items.length} kibbudim across {minyanim.length} minyanim.
        </p>
        <div style={{ marginBottom: 28, display: "flex", gap: 10, flexWrap: "wrap" }}><ReconcileButton /><a className="btn btn--sm btn--outline-bronze" href={withBasePath("/api/admin/orders.csv")}>Download orders</a></div>

        <div className="admin-grid" style={{ marginBottom: 48 }}>
          <div className="stat-card">
            <div className="micro">Sponsored</div>
            <div className="stat-card__value">{orders.length}</div>
            <div className="stat-card__note">of {items.length} kibbudim</div>
          </div>
          <div className="stat-card">
            <div className="micro">Raised</div>
            <div className="stat-card__value">{usd(raised)}</div>
            <div className="stat-card__note">of {usd(faceValue)} listed</div>
          </div>
          <div className="stat-card">
            <div className="micro">Payments to review</div>
            <div className="stat-card__value">{pledges.length + paymentsToReview}</div>
            <div className="stat-card__note">
              <Link href="/admin/pledges">open review list</Link>
            </div>
          </div>
        </div>

        <h2 className="admin-title" style={{ fontSize: 26 }}>
          Gabbai sheets
        </h2>
        <p className="admin-sub">
          One printable sheet for each minyan and tefillah.
        </p>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Minyan</th>
                <th>Sheets</th>
              </tr>
            </thead>
            <tbody>
              {minyanim.map((m) => (
                <tr key={m.slug}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{m.name}</td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {occasionsForMinyan(m.slug).map((o) => (
                        <Link
                          key={o.slug}
                          href={`/admin/gabbai/${m.slug}/${o.slug}`}
                          className="btn btn--sm btn--outline-bronze"
                        >
                          {o.shortName}
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
