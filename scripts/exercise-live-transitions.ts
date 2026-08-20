import assert from "node:assert/strict";
import { Redis } from "@upstash/redis";
import type Stripe from "stripe";
import { assertBeforeCutoff, requireKibbud } from "../lib/api/validation";
import { currentItems } from "../lib/calendar/current";
import { keys } from "../lib/redis/keys";
import { getStripe } from "../lib/stripe/client";

const baseUrl = new URL(process.env.SITE_URL ?? "http://localhost:3110").origin;
const adminToken = process.env.ADMIN_TOKEN;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!adminToken || !webhookSecret || !stripeKey?.startsWith("sk_test_")) {
  throw new Error(
    "Live transitions require ADMIN_TOKEN, STRIPE_WEBHOOK_SECRET, and a Stripe test-mode STRIPE_SECRET_KEY."
  );
}
const redis = Redis.fromEnv();
const stripe = getStripe();

const jsonPost = async (
  path: string,
  body: unknown,
  headers: Record<string, string> = {}
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const value = (await response.json()) as Record<string, unknown>;
  return { response, value };
};

const initialState = await fetch(`${baseUrl}/api/state/chayei-avraham/rh-2`);
assert.equal(initialState.status, 200, "Start the Next.js server before running this script");
const stateJson = (await initialState.json()) as {
  statuses: Array<{ id: string; state: string }>;
};
const unavailable = new Set(stateJson.statuses.map((status) => status.id));
const candidates = currentItems("chayei-avraham", "rh-2")
  .map((item) => item.id)
  .filter((id) => !unavailable.has(id));
assert.ok(candidates.length >= 5, "The live test needs five available chayei-avraham/rh-2 items");
const [cardItem, expiringItem, confirmItem, releaseItem, doubleItem] = candidates;

// available -> held -> sold (real Stripe test-mode Checkout creation, signed webhook)
const held = await jsonPost("/api/hold", { kibbudId: cardItem });
assert.equal(held.response.status, 200);
const cookie = held.response.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(cookie, "Hold response did not set its httpOnly cookie");
const checkoutStartedAt = Math.floor(Date.now() / 1000) - 2;
const checkout = await jsonPost(
  "/api/checkout",
  {
    kibbudId: cardItem,
    donorName: "Stripe Transition Test",
    email: "transition-test@example.com",
    misheberachNames: ["Transition Test"],
  },
  { cookie, "x-preferred-payment-method": "card" }
);
assert.equal(checkout.response.status, 200);
assert.equal(typeof checkout.value.url, "string");

let session: Stripe.Checkout.Session | undefined;
for await (const candidate of stripe.checkout.sessions.list({ limit: 100 })) {
  if (
    candidate.client_reference_id === cardItem &&
    candidate.created >= checkoutStartedAt
  ) {
    session = candidate;
    break;
  }
}
assert.ok(session, "Could not find the Checkout Session created by /api/checkout");
const eventPayload = JSON.stringify({
  id: `evt_transition_${Date.now()}`,
  object: "event",
  created: Math.floor(Date.now() / 1000),
  data: { object: { ...session, payment_status: "paid" } },
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
  type: "checkout.session.completed",
});
const signature = stripe.webhooks.generateTestHeaderString({
  payload: eventPayload,
  secret: webhookSecret,
});
const sendWebhook = () =>
  fetch(`${baseUrl}/api/webhook/stripe`, {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: eventPayload,
  });
assert.equal((await sendWebhook()).status, 200);
assert.equal((await sendWebhook()).status, 200, "Webhook replay must be idempotent");
await stripe.checkout.sessions.expire(session.id).catch(() => undefined);

// available -> held -> expired -> available (force the acquired Redis TTL to 1s)
assert.equal((await jsonPost("/api/hold", { kibbudId: expiringItem })).response.status, 200);
await redis.expire(keys.hold(expiringItem), 1);
await new Promise((resolve) => setTimeout(resolve, 1200));
const expiredState = (await (
  await fetch(`${baseUrl}/api/state/chayei-avraham/rh-2`)
).json()) as { statuses: Array<{ id: string }> };
assert.ok(!expiredState.statuses.some((status) => status.id === expiringItem));

const pledgeBody = (kibbudId: string) => ({
  kibbudId,
  donorName: "Pledge Transition Test",
  email: "transition-test@example.com",
  misheberachNames: ["Transition Test"],
});

// available -> pledged -> confirmed
const confirmPledge = await jsonPost("/api/pledge", pledgeBody(confirmItem));
assert.equal(confirmPledge.response.status, 200);
const confirmId = String(confirmPledge.value.pledgeId);
assert.equal(
  (
    await jsonPost(
      `/api/admin/pledge/${confirmId}/confirm`,
      {},
      { "x-admin-token": adminToken }
    )
  ).response.status,
  200
);

// available -> pledged -> released
const releasePledge = await jsonPost("/api/pledge", pledgeBody(releaseItem));
assert.equal(releasePledge.response.status, 200);
const releaseId = String(releasePledge.value.pledgeId);
assert.equal(
  (
    await jsonPost(
      `/api/admin/pledge/${releaseId}/release`,
      {},
      { "x-admin-token": adminToken }
    )
  ).response.status,
  200
);

// double hold rejection
assert.equal((await jsonPost("/api/hold", { kibbudId: doubleItem })).response.status, 200);
assert.equal((await jsonPost("/api/hold", { kibbudId: doubleItem })).response.status, 409);

// The same server-side cutoff helper rejects after this occasion's own cutoff.
const cutoffItem = requireKibbud(cardItem);
assert.throws(() =>
  assertBeforeCutoff(cutoffItem, Date.parse("2026-09-13T23:59:59+03:00"))
);

console.log("Stripe test-mode and live Upstash transitions passed");

