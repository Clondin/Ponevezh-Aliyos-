"use client";

import { useState } from "react";
import type { StoredPledge } from "@/lib/storage/types";
import { usd, formatDateTime } from "@/lib/format";
import { withBasePath } from "@/lib/site-paths";

export default function PledgeQueue({
  pledges,
  itemNames,
}: {
  pledges: StoredPledge[];
  itemNames: Record<string, string>;
}) {
  const [resolved, setResolved] = useState<Record<string, "confirmed" | "released">>({});
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const open = pledges.filter((p) => !resolved[p.id]);

  async function resolvePledge(id: string, action: "confirm" | "release") {
    setBusy(id);
    setError(undefined);
    try {
      const response = await fetch(withBasePath(`/api/admin/pledge/${id}/${action}`), {
        method: "POST",
      });
      if (!response.ok) throw new Error("The office action could not be saved.");
      setResolved((current) => ({
        ...current,
        [id]: action === "confirm" ? "confirmed" : "released",
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The office action could not be saved.");
    } finally {
      setBusy(undefined);
    }
  }

  if (pledges.length === 0) {
    return (
      <div className="notice" style={{ padding: "40px 0 60px" }}>
        <div className="notice__glyph" aria-hidden="true">
          ✳
        </div>
        <h2>No legacy reservations</h2>
        <p>Everything is up to date.</p>
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
              <th>Reservation</th>
              <th>Mi Shebeirach</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pledges.map((p) => {
              const done = resolved[p.id];
              const kibbudIds = p.kibbudIds?.length ? p.kibbudIds : [p.kibbudId];
              return (
                <tr key={p.id} className={done ? "row--muted" : undefined}>
                  <td style={{ fontWeight: 600 }}>
                    {kibbudIds.map((id) => itemNames[id] ?? id).join("; ")}
                    <div className="muted" style={{ fontSize: "0.8rem", fontWeight: 400 }}>
                      {p.externalReference ?? kibbudIds.join("; ")}
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
                  <td style={{ whiteSpace: "nowrap" }}>
                    {p.holdUntilReviewed || p.paymentSource === "admire"
                      ? "Until reviewed"
                      : formatDateTime(p.expiresAt)}
                  </td>
                  <td className="rtl" lang="he">
                    {p.misheberachNames.join(" וכן ")}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {done ? (
                      <span className={`status ${done === "confirmed" ? "status--ok" : "status--muted"}`}>
                        {done === "confirmed" ? "Confirmed" : "Released"}
                      </span>
                    ) : (
                      <span style={{ display: "flex", gap: 6 }}>
                        <button
                          className="btn btn--sm btn--fill"
                          disabled={busy === p.id}
                          onClick={() => void resolvePledge(p.id, "confirm")}
                        >
                          Payment received
                        </button>
                        <button
                          className="btn btn--sm btn--outline-bronze"
                          disabled={busy === p.id}
                          onClick={() => void resolvePledge(p.id, "release")}
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
      {error ? <p className="admin-note" role="alert">{error}</p> : null}
      <p className="admin-note">
        {open.length} awaiting review. Confirm to mark sold, or release to make
        available again.
      </p>
    </>
  );
}
