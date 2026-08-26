"use client";

import { useMemo, useState } from "react";
import EmailRetryButton from "@/components/EmailRetryButton";
import { formatDateTime, usd } from "@/lib/format";

export interface AdminOrderRow {
  id: string;
  kibbudId: string;
  itemName: string;
  minyanName: string;
  occasionName: string;
  donorName: string;
  email: string;
  amount: number;
  method: "card" | "ach";
  createdAt: string;
  dedication?: string;
  paymentId?: string;
  gatewayTransactionId?: string;
  gatewayReference?: string;
  emailStatus: "sent" | "queued" | "missing";
  receiptEmailId: string;
  assignmentAcceptedAt?: string;
}

export default function AdminOrdersTable({ rows }: { rows: AdminOrderRow[] }) {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("all");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesMethod = method === "all" || row.method === method;
      const haystack = `${row.donorName} ${row.email} ${row.itemName} ${row.minyanName} ${row.occasionName} ${row.paymentId ?? ""} ${row.gatewayTransactionId ?? ""}`.toLowerCase();
      return matchesMethod && (!needle || haystack.includes(needle));
    });
  }, [method, query, rows]);

  return (
    <>
      <div className="admin-filters no-print">
        <label>
          <span>Search orders</span>
          <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Donor, email, kibbud or transaction" type="search" />
        </label>
        <label>
          <span>Method</span>
          <select className="input" value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="all">All methods</option>
            <option value="card">Credit card</option>
            <option value="ach">Office confirmed</option>
          </select>
        </label>
        <div className="admin-filter-count">{filtered.length} order{filtered.length === 1 ? "" : "s"}</div>
      </div>
      <div className="table-wrap">
        <table className="table admin-orders-table">
          <thead><tr><th>Order</th><th>Sponsorship</th><th>Donor</th><th>Payment</th><th>Receipt</th></tr></thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.id}</strong><div className="muted">{formatDateTime(row.createdAt)}</div></td>
                <td><strong>{row.itemName}</strong><div className="muted">{row.occasionName} · {row.minyanName}</div>{row.dedication ? <div>{row.dedication}</div> : null}</td>
                <td><strong>{row.donorName}</strong><div><a href={`mailto:${row.email}`}>{row.email}</a></div><div className="muted">{row.assignmentAcceptedAt ? `Terms accepted ${formatDateTime(row.assignmentAcceptedAt)}` : "Legacy order — no terms record"}</div></td>
                <td><strong>{usd(row.amount)}</strong><div className="muted">{row.method === "card" ? "Credit card" : "Office confirmed"}</div><div className="muted">Provider reference: {row.gatewayTransactionId ?? row.gatewayReference ?? "not returned"}</div></td>
                <td><span className={`badge${row.emailStatus === "queued" ? " badge--pending" : ""}`}>{row.emailStatus}</span>{row.emailStatus !== "sent" ? <div style={{ marginTop: 8 }}><EmailRetryButton id={row.receiptEmailId} /></div> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length ? <p className="admin-note">No orders match these filters.</p> : null}
    </>
  );
}
