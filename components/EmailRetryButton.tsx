"use client";

import { useState } from "react";
import { withBasePath } from "@/lib/site-paths";

export default function EmailRetryButton({ id }: { id: string }) {
  const [status, setStatus] = useState<"idle" | "busy" | "sent" | "queued" | "error">("idle");

  async function retry() {
    setStatus("busy");
    try {
      const response = await fetch(withBasePath(`/api/admin/email/${encodeURIComponent(id)}/retry`), {
        method: "POST",
      });
      const body = (await response.json()) as { status?: "sent" | "queued" };
      if (!response.ok || !body.status) throw new Error();
      setStatus(body.status);
    } catch {
      setStatus("error");
    }
  }

  return (
    <button type="button" className="btn btn--sm btn--outline-bronze" onClick={() => void retry()} disabled={status === "busy"}>
      {status === "busy" ? "Retrying…" : status === "sent" ? "Sent" : status === "queued" ? "Still waiting" : status === "error" ? "Try again" : "Retry"}
    </button>
  );
}
