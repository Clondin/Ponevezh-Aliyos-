import assert from "node:assert/strict";
import { setRedisStoreForTests } from "../lib/redis/client";
import { MemoryRedisStore } from "../lib/redis/memory";
import { getRepository } from "../lib/redis/repository";
import { getStripe } from "../lib/stripe/client";
import { POST as holdPost } from "../app/api/hold/route";
import { POST as pledgePost } from "../app/api/pledge/route";
import { GET as stateGet } from "../app/api/state/[minyan]/[occasion]/route";
import { POST as webhookPost } from "../app/api/webhook/stripe/route";
import { POST as pledgeConfirmPost } from "../app/api/admin/pledge/[id]/confirm/route";

process.env.UPSTASH_REDIS_REST_URL = "https://unused.example";
process.env.UPSTASH_REDIS_REST_TOKEN = "unused";
process.env.STRIPE_SECRET_KEY = "sk_test_contract_fixture";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_contract_fixture";
process.env.OFFICE_NOTIFY_EMAIL = "office@example.com";
process.env.ADMIN_TOKEN = "test-admin-token";
process.env.SITE_URL = "http://localhost:3110";

setRedisStoreForTests(new MemoryRedisStore());

const jsonRequest = (url: string, body: unknown, headers: HeadersInit = {}) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const heldItem = "grodna/rh-1/kohen";
const holdResponse = await holdPost(
  jsonRequest("http://localhost:3110/api/hold", { kibbudId: heldItem })
);
assert.equal(holdResponse.status, 200);
assert.match(holdResponse.headers.get("set-cookie") ?? "", /kibbud-hold=/);
assert.deepEqual(Object.keys(await holdResponse.json()).sort(), ["expiresAt", "kibbudId"]);

const stateResponse = await stateGet(
  new Request("http://localhost:3110/api/state/grodna/rh-1"),
  { params: Promise.resolve({ minyan: "grodna", occasion: "rh-1" }) }
);
assert.equal(stateResponse.status, 200);
const state = (await stateResponse.json()) as Record<string, unknown>;
assert.deepEqual(Object.keys(state).sort(), [
  "asOf",
  "cutoffISO",
  "minyan",
  "occasion",
  "statuses",
]);

const doubleHoldResponse = await holdPost(
  jsonRequest("http://localhost:3110/api/hold", { kibbudId: heldItem })
);
assert.equal(doubleHoldResponse.status, 409);
assert.deepEqual(await doubleHoldResponse.json(), {
  error: {
    code: "already_taken",
    message: "This kibbud is already reserved or sponsored.",
  },
});

const pledgeItem = "grodna/rh-1/shlishi";
const pledgeResponse = await pledgePost(
  jsonRequest("http://localhost:3110/api/pledge", {
    kibbudId: pledgeItem,
    donorName: "Pledge Donor",
    email: "pledge@example.com",
    phone: "+1 212 555 0100",
    misheberachNames: ["Pledge Name"],
  })
);
assert.equal(pledgeResponse.status, 200);
const pledge = (await pledgeResponse.json()) as { pledgeId: string; expiresAt: string };
assert.deepEqual(Object.keys(pledge).sort(), ["expiresAt", "pledgeId"]);
const confirmResponse = await pledgeConfirmPost(
  new Request(`http://localhost:3110/api/admin/pledge/${pledge.pledgeId}/confirm`, {
    method: "POST",
    headers: { "x-admin-token": "test-admin-token" },
  }),
  { params: Promise.resolve({ id: pledge.pledgeId }) }
);
assert.equal(confirmResponse.status, 200);
assert.deepEqual(await confirmResponse.json(), { ok: true });

// A signature-verified card webhook fulfills a stored Checkout record.
const webhookItem = "grodna/rh-1/maftir";
const repository = getRepository();
await repository.acquireHold(webhookItem, "webhook-hold-token");
await repository.saveCheckout({
  sessionId: "cs_test_webhook",
  kibbudId: webhookItem,
  holdToken: "webhook-hold-token",
  donorName: "Webhook Donor",
  email: "webhook@example.com",
  misheberachNames: ["Webhook Name"],
  amount: 1800,
  preferredMethod: "card",
  createdAt: new Date().toISOString(),
});
const eventPayload = JSON.stringify({
  id: "evt_contract_webhook",
  object: "event",
  api_version: "2026-06-30.basil",
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: "cs_test_webhook",
      object: "checkout.session",
      payment_status: "paid",
      payment_intent: null,
    },
  },
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
  type: "checkout.session.completed",
});
const signature = getStripe().webhooks.generateTestHeaderString({
  payload: eventPayload,
  secret: process.env.STRIPE_WEBHOOK_SECRET,
});
const webhookRequest = () =>
  new Request("http://localhost:3110/api/webhook/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: eventPayload,
  });
const webhookResponse = await webhookPost(webhookRequest());
assert.equal(webhookResponse.status, 200);
assert.deepEqual(await webhookResponse.json(), { received: true });
assert.deepEqual(await repository.statuses([webhookItem]), [
  { id: webhookItem, state: "sold" },
]);
const orderCount = (await repository.allOrders()).length;
const replayResponse = await webhookPost(webhookRequest());
assert.equal(replayResponse.status, 200);
assert.equal((await repository.allOrders()).length, orderCount);

const invalidWebhook = await webhookPost(
  new Request("http://localhost:3110/api/webhook/stripe", {
    method: "POST",
    headers: { "stripe-signature": "invalid" },
    body: eventPayload,
  })
);
assert.equal(invalidWebhook.status, 400);
assert.equal(((await invalidWebhook.json()) as { error: { code: string } }).error.code, "invalid_input");

console.log("API contract and signed webhook tests passed");

