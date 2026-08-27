import type { Metadata } from "next";
import PledgeQueue from "@/components/PledgeQueue";
import { getCatalog } from "@/lib/catalog";
import { getRepository } from "@/lib/storage/repository";
import { formatDateTime, usd } from "@/lib/format";

export const metadata: Metadata = { title: "Payments to review" };
export const dynamic = "force-dynamic";

export default async function PledgesPage() {
  const repository = getRepository();
  const [pledges, activeCheckouts] = await Promise.all([
    repository.pendingPledges(),
    repository.activeCheckouts(),
  ]);
  const reviews = activeCheckouts;
  const itemNames: Record<string, string> = {};
  for (const i of getCatalog().items) itemNames[i.id] = i.name;

  return (
    <section className="admin-section">
      <div className="container">
        <h1 className="admin-title">Payments to review</h1>
        <p className="admin-sub">
          Review gateway exceptions and legacy reservations.
        </p>
        {reviews.length ? (
          <><h2 className="admin-title" style={{ fontSize: 24 }}>Card payments in progress or needing review</h2><div className="table-wrap" style={{ marginBottom: 36 }}><table className="table"><thead><tr><th>Payment</th><th>Donor</th><th>Amount</th><th>Status</th><th>Reason</th></tr></thead><tbody>{reviews.map((checkout) => <tr key={checkout.paymentId}><td><strong>{checkout.paymentId}</strong><div className="muted">{formatDateTime(checkout.createdAt)}</div></td><td>{checkout.donorName}<div className="muted">{checkout.email}</div></td><td>{usd(checkout.amount)}</td><td>{checkout.status.replaceAll("_", " ")}</td><td>{checkout.reversalReason ?? (checkout.status === "pending" ? "Awaiting Banquest confirmation" : "Payment is being processed")}</td></tr>)}</tbody></table></div></>
        ) : null}
        <h2 className="admin-title" style={{ fontSize: 24 }}>Legacy reservations</h2>
        <PledgeQueue pledges={pledges} itemNames={itemNames} />
      </div>
    </section>
  );
}
