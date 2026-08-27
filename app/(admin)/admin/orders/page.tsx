import type { Metadata } from "next";
import AdminOrdersTable, { type AdminOrderRow } from "@/components/AdminOrdersTable";
import { getCatalog, getMinyan, getOccasion } from "@/lib/catalog";
import { getRepository } from "@/lib/storage/repository";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const repository = getRepository();
  const orders = (await repository.allOrders()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const catalog = getCatalog();
  const rows: AdminOrderRow[] = await Promise.all(orders.map(async (order) => {
    const item = catalog.items.find((candidate) => candidate.id === order.kibbudId);
    const admireStatus = order.paymentId
      ? await repository.admireSyncStatus(order.paymentId)
      : "not_queued";
    const dedication = order.dedicationType && order.dedicationName
      ? `${order.dedicationType === "memory" ? "In memory of" : "In honor of"} ${order.dedicationName}`
      : undefined;
    return {
      id: order.id,
      kibbudId: order.kibbudId,
      itemName: item?.name ?? order.kibbudId,
      minyanName: item ? getMinyan(item.minyan)?.name ?? item.minyan : "Unknown",
      occasionName: item ? getOccasion(item.occasion)?.name ?? item.occasion : "Unknown",
      donorName: order.donorName,
      email: order.email,
      phone: order.phone,
      amount: order.amount,
      method: order.method,
      createdAt: order.createdAt,
      dedication,
      paymentId: order.paymentId,
      gatewayTransactionId: order.gatewayTransactionId,
      gatewayReference: order.gatewayReference,
      admireStatus,
      assignmentAcceptedAt: order.assignmentAcceptedAt,
      status: order.status ?? "paid",
    };
  }));
  return (
    <section className="admin-section">
      <div className="container">
        <div className="admin-head">
          <div>
            <div className="admin-eyebrow">Ponevez Office</div>
            <h1 className="admin-title">Orders</h1>
            <p className="admin-sub">Search donors, payments, and Admire records.</p>
          </div>
        </div>
        <AdminOrdersTable rows={rows} />
      </div>
    </section>
  );
}
