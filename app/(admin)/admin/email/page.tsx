import type { Metadata } from "next";
import EmailRetryButton from "@/components/EmailRetryButton";
import { formatDateTime } from "@/lib/format";
import { queuedEmails } from "@/lib/notifications/email";

export const metadata: Metadata = { title: "Email delivery" };
export const dynamic = "force-dynamic";

export default async function EmailPage() {
  const records = (await queuedEmails()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <section className="admin-section"><div className="container"><h1 className="admin-title">Email delivery</h1><p className="admin-sub">Receipts and office notifications that are waiting for delivery. Configure Resend to empty this queue.</p><div className="table-wrap"><table className="table"><thead><tr><th>Created</th><th>Recipient</th><th>Subject</th><th>Attempts</th><th></th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{formatDateTime(record.createdAt)}</td><td>{record.to}</td><td><strong>{record.subject}</strong>{record.lastError ? <div className="form-error" style={{ marginTop: 6 }}>{record.lastError}</div> : null}</td><td>{record.attempts ?? 0}</td><td><EmailRetryButton id={record.id} /></td></tr>)}</tbody></table></div>{records.length ? null : <div className="notice" style={{ padding: "40px 0" }}><h1>Email queue is clear</h1><p>No messages are waiting for delivery.</p></div>}</div></section>;
}
