"use client";

import { useEffect, useState } from "react";
import HoldBanner from "@/components/HoldBanner";
import Notice from "@/components/Notice";
import SponsorForm from "@/components/SponsorForm";

type HoldState =
  | { kind: "loading" }
  | { kind: "ready"; expiresAt: string }
  | { kind: "unavailable"; message: string };

export default function CheckoutExperience({
  itemId,
  occasionHref,
  minyanHref,
  tokenizationKey,
  banquestEnvironment,
}: {
  itemId: string;
  occasionHref: string;
  minyanHref: string;
  tokenizationKey: string;
  banquestEnvironment: "sandbox" | "production";
}) {
  const [state, setState] = useState<HoldState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/hold", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kibbudId: itemId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          expiresAt?: string;
          error?: { message?: string };
        };
        if (!response.ok || !body.expiresAt) {
          throw new Error(body.error?.message || "This kibbud could not be reserved.");
        }
        setState({ kind: "ready", expiresAt: body.expiresAt });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          kind: "unavailable",
          message: error instanceof Error ? error.message : "This kibbud is unavailable.",
        });
      });
    return () => controller.abort();
  }, [itemId]);

  if (state.kind === "loading") {
    return (
      <div className="form-card" role="status" aria-live="polite">
        <p>Reserving this kibbud for you…</p>
      </div>
    );
  }
  if (state.kind === "unavailable") {
    return (
      <Notice
        glyph="asterisk"
        title="This kibbud could not be reserved"
        body={state.message}
        primaryHref={occasionHref}
        primaryLabel="See the remaining kibbudim"
        secondaryHref={minyanHref}
        secondaryLabel="Other days"
      />
    );
  }
  return (
    <>
      <HoldBanner expiresAt={state.expiresAt} itemId={itemId} />
      <div className="form-card">
        <SponsorForm
          itemId={itemId}
          tokenizationKey={tokenizationKey}
          banquestEnvironment={banquestEnvironment}
        />
      </div>
    </>
  );
}
