import type { Metadata } from "next";
import PledgeQueue from "@/components/PledgeQueue";
import { getCatalog } from "@/lib/catalog";
import { getRepository } from "@/lib/storage/repository";

export const metadata: Metadata = { title: "Payments to review" };
export const dynamic = "force-dynamic";

export default async function PledgesPage() {
  const pledges = await getRepository().pendingPledges();
  const itemNames: Record<string, string> = {};
  for (const i of getCatalog().items) itemNames[i.id] = i.name;

  return (
    <section className="admin-section">
      <div className="container">
        <h1 className="admin-title">Payments to review</h1>
        <p className="admin-sub">
          Admire reservations stay offline until you confirm or release them.
        </p>
        <PledgeQueue pledges={pledges} itemNames={itemNames} />
      </div>
    </section>
  );
}
