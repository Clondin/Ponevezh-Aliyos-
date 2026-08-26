"use client";

import { useState } from "react";
import { withBasePath } from "@/lib/site-paths";

export default function ReconcileButton() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function reconcile() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(withBasePath("/api/admin/reconcile-banquest"), { method: "POST" });
      const body = (await response.json()) as { checked?: number; updated?: number };
      if (!response.ok) throw new Error();
      setMessage(`${body.checked ?? 0} checked; ${body.updated ?? 0} updated.`);
    } catch {
      setMessage("Could not check payments. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return <div className="reconcile-control"><button type="button" className="btn btn--sm btn--outline-bronze" disabled={busy} onClick={() => void reconcile()}>{busy ? "Checking…" : "Check old card payments"}</button>{message ? <span role="status">{message}</span> : null}</div>;
}
