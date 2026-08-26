"use client";

import { useEffect, useState } from "react";
import HoldBanner from "@/components/HoldBanner";
import Notice from "@/components/Notice";
import SponsorForm from "@/components/SponsorForm";
import TurnstileWidget from "@/components/TurnstileWidget";
import { withBasePath } from "@/lib/site-paths";

type HoldState =
  | { kind: "loading" }
  | { kind: "ready"; expiresAt: string; admireReservation?: boolean }
  | { kind: "unavailable"; message: string };

export default function CheckoutExperience({
  itemId,
  amount,
  occasionHref,
  minyanHref,
  admireCampaignId,
  turnstileSiteKey,
}: {
  itemId: string;
  amount: number;
  occasionHref: string;
  minyanHref: string;
  admireCampaignId?: string;
  turnstileSiteKey: string;
}) {
  const [state, setState] = useState<HoldState>({ kind: "loading" });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    if (turnstileSiteKey && !turnstileToken) return;
    const controller = new AbortController();
    void fetch(withBasePath("/api/hold"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}),
      },
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
  }, [itemId, turnstileSiteKey, turnstileToken]);

  if (state.kind === "loading") {
    return (
      <div className="form-card">
        {turnstileSiteKey && !turnstileToken ? (
          <>
            <p style={{ marginBottom: 16 }}>Complete this quick security check.</p>
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              action="reserve_kibbud"
              onToken={setTurnstileToken}
            />
          </>
        ) : (
          <p role="status" aria-live="polite">Reserving this kibbud for you…</p>
        )}
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
      {state.admireReservation ? null : (
        <HoldBanner expiresAt={state.expiresAt} itemId={itemId} />
      )}
      <div className="form-card">
        <SponsorForm
          itemId={itemId}
          amount={amount}
          admireCampaignId={admireCampaignId}
          onReservationCreated={() =>
            setState((current) =>
              current.kind === "ready"
                ? { ...current, admireReservation: true }
                : current
            )
          }
        />
      </div>
    </>
  );
}
