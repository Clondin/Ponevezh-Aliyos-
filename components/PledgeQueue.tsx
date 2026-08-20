"use client";

import { useState } from "react";
import type { Pledge } from "@/contracts/types";
import { usd, formatDateTime } from "@/lib/format";

/**
 * Pending pledge queue. Confirm/release act on local state only —
 * at integration they call POST /api/admin/pledge/[id]/confirm|release.
 */
export default function PledgeQueue({
  pledges,
  itemNames,
}: {
  pledges: Pledge[];
  itemNames: Record<string, string>;
}) {
  const [resolved, setResolved] = useState<Record<string, "confirmed" | "released">>({});
  const open = pledges.filter((p) => !resolved[p.id]);

  if (pledges.length === 0) {
    return (
      <div className="notice" style={{ padding: "40px 0 60px" }}>
        <div className="notice__glyph" aria-hidden="true">
          ✳
        </div>
        <h1>No pending pledges</h1>
        <p>Every reserve-and-wire pledge has been settled.</p>
      </div>
    );
  }

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Kibbud</th>
              <th>Donor</th>
              <th>Amount</th>
              <th>Expires</th>
              <th>Mi Shebeirach</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pledges.map((p) => {
              const done = resolved[p.id];
              return (
                <tr key={p.id} className={done ? "row--muted" : undefined}>
                  <td style={{ fontWeight: 600 }}>
                    {itemNames[p.kibbudId] ?? p.kibbudId}
                    <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 400 }}>
                      {p.kibbudId}
                    </div>
                  </td>
                  <td>
                    {p.donorName}
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {p.email}
                      {p.phone ? <> &middot; {p.phone}</> : null}
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{usd(p.amount)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(p.expiresAt)}</td>
                  <td className="rtl" lang="he">
                    {p.misheberachNames.join(" וכן ")}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {done ? (
                      <span className="badge">{done}</span>
                    ) : (
                      <span style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn--sm btn--fill"
                          onClick={() => setResolved((r) => ({ ...r, [p.id]: "confirmed" }))}
                        >
                          Wire received
                        </button>
                        <button
                          className="btn btn--sm btn--outline-bronze"
                          onClick={() => setResolved((r) => ({ ...r, [p.id]: "released" }))}
                        >
                          Release
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="admin-note">
        {open.length} awaiting settlement. Confirming marks the kibbud sold;
        releasing returns it to the site immediately.
      </p>
    </>
  );
}
