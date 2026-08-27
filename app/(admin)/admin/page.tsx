import Link from "next/link";
import { getCatalog, getMinyanim, occasionsForMinyan, priceForKibbud } from "@/lib/catalog";
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
  const items = getCatalog().items;
  const faceValue = items.reduce((s, item) => s + priceForKibbud(item), 0);

  const soldPct = items.length ? Math.round((orders.length / items.length) * 100) : 0;
  const raisedPct = faceValue ? Math.round((raised / faceValue) * 100) : 0;

  return (
    <section className="admin-section">
      <div className="container">
        <div className="admin-head">
          <div>
            <div className="admin-eyebrow">Ponevez Office</div>
            <h1 className="admin-title">Season overview &mdash; 5787</h1>
            <p className="admin-sub">
              Tishrei 5787 &middot; {items.length} kibbudim across {minyanim.length} minyanim.
            </p>
          </div>
          <ReconcileButton />
        </div>

        <div className="admin-grid" style={{ marginBottom: 52 }}>
          <div className="stat-card stat-card--accent">
            <div className="stat-card__label">
              <span>Sponsored</span>
              <span>{soldPct}%</span>
            </div>
            <div className="stat-card__value">{orders.length}</div>
            <div className="stat-card__note">of {items.length} kibbudim</div>
            <div className="stat-card__meter">
              <span style={{ width: `${soldPct}%` }} />
            </div>
          </div>
          <div className="stat-card stat-card--accent">
            <div className="stat-card__label">
              <span>Raised</span>
              <span>{raisedPct}%</span>
            </div>
            <div className="stat-card__value">{usd(raised)}</div>
            <div className="stat-card__note">of {usd(faceValue)} listed</div>
            <div className="stat-card__meter">
              <span style={{ width: `${raisedPct}%` }} />
            </div>
          </div>
          <div className={`stat-card${pledges.length ? " stat-card--flag" : ""}`}>
            <div className="stat-card__label">
              <span>Payments to review</span>
            </div>
            <div className="stat-card__value">{pledges.length}</div>
            <div className="stat-card__note">
              {pledges.length ? (
                <Link href="/admin/pledges">Open review list &rarr;</Link>
              ) : (
                "Nothing waiting"
              )}
            </div>
          </div>
        </div>

        <div className="admin-head" style={{ marginBottom: 20 }}>
          <div>
            <h2 className="admin-title" style={{ fontSize: 26 }}>
              Gabbai sheets
            </h2>
            <p className="admin-sub">
              One printable sheet for each minyan and tefillah.
            </p>
          </div>
        </div>

        <div className="gabbai-grid">
          {minyanim.map((m) => {
            const occasions = occasionsForMinyan(m.slug);
            return (
              <div key={m.slug} className="gabbai-card">
                <div className="gabbai-card__name">{m.name}</div>
                <div className="gabbai-card__meta">
                  {occasions.length} tefillos &middot; level {m.level}
                </div>
                <div className="gabbai-card__sheets">
                  {occasions.map((o) => (
                    <Link
                      key={o.slug}
                      href={`/admin/gabbai/${m.slug}/${o.slug}`}
                      className="gabbai-chip"
                    >
                      {o.shortName}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
