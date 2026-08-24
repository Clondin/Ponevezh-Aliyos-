"use client";

import { useState } from "react";

export default function ReconcileButton() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function reconcile() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/reconcile-banquest", { method: "POST" });
      const body = (await response.json()) as { checked?: number; updated?: number };
      if (!response.ok) throw new Error();
      setMessage(`Checked ${body.checked ?? 0}; updated ${body.updated ?? 0}.`);
    } catch {
      setMessage("Reconciliation failed. Check the deployment logs and Banquest credentials.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="reconcile-control"><button type="button" className="btn btn--sm btn--outline-bronze" disabled={busy} onClick={() => void reconcile()}>{busy ? "Checking Banquest…" : "Reconcile Banquest"}</button>{message ? <span role="status">{message}</span> : null}</div>;
}
