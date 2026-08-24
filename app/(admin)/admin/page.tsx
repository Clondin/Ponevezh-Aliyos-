import Link from "next/link";
import { getMinyanim, occasionsForMinyan } from "@/lib/catalog";
import { usd } from "@/lib/format";
import { getRepository } from "@/lib/storage/repository";
import ReconcileButton from "@/components/ReconcileButton";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const minyanim = getMinyanim();
  const [orders, pledges] = await Promise.all([
    getRepository().allOrders(),
    getRepository().pendingPledges(),
  ]);
  const raised = orders.reduce((s, o) => s + o.amount, 0);

  return (
    <section className="admin-section">
      <div className="container">
        <h1 className="admin-title">Season overview &mdash; 5787</h1>
        <p className="admin-sub">Tishrei 5787 &middot; 348 kibbudim across six minyanim.</p>
        <div style={{ marginBottom: 28 }}><ReconcileButton /></div>

        <div className="admin-grid" style={{ marginBottom: 48 }}>
          <div className="stat-card">
            <div className="micro">Sponsored</div>
            <div className="stat-card__value">{orders.length}</div>
            <div className="stat-card__note">of 348 kibbudim</div>
          </div>
          <div className="stat-card">
            <div className="micro">Raised</div>
            <div className="stat-card__value">{usd(raised)}</div>
            <div className="stat-card__note">of $773,600 face value</div>
          </div>
          <div className="stat-card">
            <div className="micro">Pending pledges</div>
            <div className="stat-card__value">{pledges.length}</div>
            <div className="stat-card__note">
              <Link href="/admin/pledges">awaiting wire &mdash; review</Link>
            </div>
          </div>
        </div>

        <h2 className="admin-title" style={{ fontSize: 26 }}>
          Gabbai sheets
        </h2>
        <p className="admin-sub">
          One sheet per minyan per tefillah, in kriah order. Print to A4.
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
