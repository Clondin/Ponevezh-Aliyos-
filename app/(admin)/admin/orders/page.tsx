import type { Metadata } from "next";
import AdminOrdersTable, { type AdminOrderRow } from "@/components/AdminOrdersTable";
import { getCatalog, getMinyan, getOccasion } from "@/lib/catalog";
import { emailRecord } from "@/lib/notifications/email";
import { getRepository } from "@/lib/storage/repository";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = (await getRepository().allOrders()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const catalog = getCatalog();
  const rows: AdminOrderRow[] = await Promise.all(orders.map(async (order) => {
    const item = catalog.items.find((candidate) => candidate.id === order.kibbudId);
    const delivery = await emailRecord(`order-confirmation-${order.id}`);
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
      emailStatus: delivery?.status ?? "missing",
      receiptEmailId: `order-confirmation-${order.id}`,
      assignmentAcceptedAt: order.assignmentAcceptedAt,
    };
  }));
  return <section className="admin-section"><div className="container"><div className="admin-head"><div><div className="admin-eyebrow">Ponevez Office</div><h1 className="admin-title">Orders</h1><p className="admin-sub">Search donors, payments, and receipts.</p></div></div><AdminOrdersTable rows={rows} /></div></section>;
}
