import type { Metadata } from "next";
import EmailRetryButton from "@/components/EmailRetryButton";
import { formatDateTime } from "@/lib/format";
import { queuedEmails } from "@/lib/notifications/email";

export const metadata: Metadata = { title: "Email delivery" };
export const dynamic = "force-dynamic";

export default async function EmailPage() {
  const records = (await queuedEmails()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <section className="admin-section">
      <div className="container">
        <div className="admin-head">
          <div>
            <div className="admin-eyebrow">Ponevez Office</div>
            <h1 className="admin-title">Email delivery</h1>
            <p className="admin-sub">Receipts and notifications still waiting to be sent.</p>
          </div>
        </div>
        {records.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Recipient</th>
                  <th>Subject</th>
                  <th style={{ textAlign: "center" }}>Tries</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(record.createdAt)}</td>
                    <td>{record.to}</td>
                    <td>
                      <strong>{record.subject}</strong>
                      {record.lastError ? (
                        <div className="form-error" style={{ marginTop: 6 }}>{record.lastError}</div>
                      ) : null}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`status ${record.attempts ? "status--warn" : "status--muted"}`}>
                        {record.attempts ?? 0}
                      </span>
                    </td>
                    <td><EmailRetryButton id={record.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="notice" style={{ padding: "56px 0" }}>
            <div className="notice__glyph" aria-hidden="true">✳</div>
            <h1>All emails sent</h1>
            <p>Nothing is waiting in the delivery queue.</p>
          </div>
        )}
      </div>
    </section>
  );
}
