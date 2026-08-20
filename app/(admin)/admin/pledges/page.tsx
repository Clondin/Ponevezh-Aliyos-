import type { Metadata } from "next";
import PledgeQueue from "@/components/PledgeQueue";
import { getCatalog } from "@/lib/catalog";
import { getRepository } from "@/lib/redis/repository";

export const metadata: Metadata = { title: "Pending pledges" };
export const dynamic = "force-dynamic";

export default async function PledgesPage() {
  const pledges = await getRepository().pendingPledges();
  const itemNames: Record<string, string> = {};
  for (const i of getCatalog().items) itemNames[i.id] = i.name;

  return (
    <section className="admin-section">
      <div className="container">
        <h1 className="admin-title">Pending pledges</h1>
        <p className="admin-sub">
          Reserve-and-pay-by-wire holds. Each holds its kibbud for 72 hours from
          the pledge.
        </p>
        <PledgeQueue pledges={pledges} itemNames={itemNames} />
      </div>
    </section>
  );
}
