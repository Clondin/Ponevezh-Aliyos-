import type { Metadata } from "next";
import { formatDateTime } from "@/lib/format";
import { getRepository } from "@/lib/storage/repository";
import type { AuditRecord } from "@/lib/storage/types";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<AuditRecord["action"], string> = {
  hold_created: "Reserved",
  payment_started: "Payment started",
  payment_pending: "Payment pending",
  payment_completed: "Payment confirmed",
  payment_released: "Reservation released",
  payment_reversed: "Payment reversed",
  pledge_created: "Payment submitted",
  pledge_confirmed: "Payment confirmed",
  pledge_released: "Reservation released",
  email_retried: "Email retried",
  reconciliation_run: "Payments checked",
};

export default async function ActivityPage() {
  const records = await getRepository().auditRecords();
  return <section className="admin-section"><div className="container"><h1 className="admin-title">History</h1><p className="admin-sub">Recent reservation, payment, and email changes.</p><div className="table-wrap"><table className="table"><thead><tr><th>Time</th><th>Action</th><th>Kibbud</th><th>Reference</th><th>Details</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{formatDateTime(record.createdAt)}</td><td><span className="badge">{ACTION_LABELS[record.action]}</span></td><td>{record.kibbudId ?? "—"}</td><td>{record.referenceId ?? "—"}</td><td>{record.detail ?? ""}</td></tr>)}</tbody></table></div>{records.length ? null : <p className="admin-note">No history yet.</p>}</div></section>;
}
