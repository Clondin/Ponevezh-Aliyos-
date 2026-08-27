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
  payment_needs_review: "Payment needs review",
  admire_sync_queued: "Admire sync queued",
  admire_sync_completed: "Synced to Admire",
  admire_sync_failed: "Admire sync failed",
  pledge_created: "Payment submitted",
  pledge_confirmed: "Payment confirmed",
  pledge_released: "Reservation released",
  email_retried: "Email retried",
  reconciliation_run: "Payments checked",
};

const ACTION_TONE: Record<AuditRecord["action"], string> = {
  hold_created: "status--muted",
  payment_started: "status--muted",
  payment_pending: "status--warn",
  payment_completed: "status--ok",
  payment_released: "status--muted",
  payment_reversed: "status--bad",
  payment_needs_review: "status--bad",
  admire_sync_queued: "status--warn",
  admire_sync_completed: "status--ok",
  admire_sync_failed: "status--bad",
  pledge_created: "status--warn",
  pledge_confirmed: "status--ok",
  pledge_released: "status--muted",
  email_retried: "status--muted",
  reconciliation_run: "status--muted",
};

export default async function ActivityPage() {
  const records = await getRepository().auditRecords();
  return (
    <section className="admin-section">
      <div className="container">
        <div className="admin-head">
          <div>
            <div className="admin-eyebrow">Ponevez Office</div>
            <h1 className="admin-title">History</h1>
            <p className="admin-sub">Recent reservation, payment, and Admire changes.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Kibbud</th>
                <th>Reference</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(record.createdAt)}</td>
                  <td>
                    <span className={`status ${ACTION_TONE[record.action]}`}>
                      {ACTION_LABELS[record.action]}
                    </span>
                  </td>
                  <td>{record.kibbudId ?? "—"}</td>
                  <td>{record.referenceId ?? "—"}</td>
                  <td>{record.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {records.length ? null : <p className="admin-note">No history yet.</p>}
      </div>
    </section>
  );
}
