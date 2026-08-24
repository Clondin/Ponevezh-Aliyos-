import type { Metadata } from "next";
import { formatDateTime } from "@/lib/format";
import { getRepository } from "@/lib/storage/repository";

export const metadata: Metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const records = await getRepository().auditRecords();
  return <section className="admin-section"><div className="container"><h1 className="admin-title">Activity</h1><p className="admin-sub">A recent history of holds, payments, reversals, pledges and email recovery.</p><div className="table-wrap"><table className="table"><thead><tr><th>Time</th><th>Action</th><th>Kibbud</th><th>Reference</th><th>Detail</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{formatDateTime(record.createdAt)}</td><td><span className="badge">{record.action.replaceAll("_", " ")}</span></td><td>{record.kibbudId ?? "—"}</td><td>{record.referenceId ?? "—"}</td><td>{record.detail ?? ""}</td></tr>)}</tbody></table></div>{records.length ? null : <p className="admin-note">No activity has been recorded yet.</p>}</div></section>;
}
