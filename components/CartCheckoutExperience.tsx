"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useBasket } from "@/components/BasketProvider";
import HoldBanner from "@/components/HoldBanner";
import SponsorForm from "@/components/SponsorForm";
import TurnstileWidget from "@/components/TurnstileWidget";
import { usd } from "@/lib/format";
import { withBasePath } from "@/lib/site-paths";

export interface CartItem {
  id: string;
  name: string;
  minyanName: string;
  occasionName: string;
  price: number;
  href: string;
  available: boolean;
}

type State =
  | { kind: "idle" }
  | { kind: "holding" }
  | { kind: "ready"; expiresAt: string; admireReservation?: boolean }
  | { kind: "error"; message: string };

export default function CartCheckoutExperience({
  items,
  admireCampaignId,
  turnstileSiteKey,
}: {
  items: CartItem[];
  admireCampaignId?: string;
  turnstileSiteKey: string;
}) {
  const basket = useBasket();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items]
  );
  const selected = useMemo(
    () =>
      basket.ids
        .map((id) => itemMap.get(id))
        .filter((item): item is CartItem => Boolean(item)),
    [basket.ids, itemMap]
  );
  const unavailable = selected.filter((item) => !item.available);
  const total = selected.reduce((sum, item) => sum + item.price, 0);

  async function reserve() {
    setState({ kind: "holding" });
    try {
      const response = await fetch(withBasePath("/api/cart/hold"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(turnstileToken ? { "x-turnstile-token": turnstileToken } : {}),
        },
        body: JSON.stringify({ kibbudIds: selected.map((item) => item.id) }),
      });
      const body = (await response.json()) as {
        expiresAt?: string;
        error?: { message?: string };
      };
      if (!response.ok || !body.expiresAt) {
        throw new Error(body.error?.message || "The kibbudim could not be reserved.");
      }
      setState({ kind: "ready", expiresAt: body.expiresAt });
    } catch (error) {
      if (turnstileSiteKey) {
        setTurnstileToken(null);
        setTurnstileAttempt((attempt) => attempt + 1);
      }
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "The kibbudim could not be reserved.",
      });
    }
  }

  if (!basket.ready) {
    return (
      <div className="form-card" role="status">
        Loading your sponsorship list…
      </div>
    );
  }

  if (!selected.length) {
    return (
      <div className="notice" style={{ padding: "48px 0" }}>
        <h1>Your list is empty</h1>
        <p>Add at least two kibbudim to make one payment.</p>
        <div className="actions">
          <Link href="/find" className="btn btn--fill">
            Find kibbudim
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-layout">
      <div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kibbud</th>
                <th>Where</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {selected.map((item) => (
                <tr key={item.id} className={item.available ? undefined : "row--muted"}>
                  <td>
                    <Link href={item.href}><strong>{item.name}</strong></Link>
                    {item.available ? null : <div className="badge badge--pending">Unavailable</div>}
                  </td>
                  <td>
                    {item.occasionName}
                    <div className="muted">{item.minyanName}</div>
                  </td>
                  <td style={{ textAlign: "right" }}>{usd(item.price)}</td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => basket.remove(item.id)}
                      disabled={state.kind === "ready"}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}><strong>Total</strong></td>
                <td style={{ textAlign: "right" }}><strong>{usd(total)}</strong></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="admin-note">
          Up to 10 kibbudim. Availability is checked when you continue.
        </p>
      </div>

      <div className="cart-checkout">
        {state.kind === "ready" ? (
          <>
            {state.admireReservation ? null : (
              <HoldBanner
                expiresAt={state.expiresAt}
                itemId={selected[0].id}
                expiredHref="/basket"
              />
            )}
            <div className="form-card">
              <SponsorForm
                itemId={selected[0].id}
                itemIds={selected.map((item) => item.id)}
                amount={total}
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
        ) : (
          <div className="form-card">
            <h2 className="cart-checkout__title">Sponsor selected kibbudim</h2>
            <p>Enter your details once and make one payment.</p>
            {turnstileSiteKey ? (
              <TurnstileWidget
                key={turnstileAttempt}
                siteKey={turnstileSiteKey}
                action="reserve_kibbud"
                onToken={setTurnstileToken}
              />
            ) : null}
            {state.kind === "error" ? (
              <p className="form-error" role="alert">{state.message}</p>
            ) : null}
            {unavailable.length ? (
              <p className="form-error">Remove unavailable kibbudim before continuing.</p>
            ) : null}
            {selected.length < 2 ? (
              <p className="form-error">Choose at least two kibbudim.</p>
            ) : null}
            <button
              type="button"
              className="btn btn--fill btn--block"
              onClick={() => void reserve()}
              disabled={
                state.kind === "holding" ||
                selected.length < 2 ||
                Boolean(unavailable.length) ||
                Boolean(turnstileSiteKey && !turnstileToken)
              }
            >
              {state.kind === "holding" ? "Reserving…" : "Reserve and continue"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
