import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { setStateStoreForTests } from "../lib/storage/client";
import { MemoryStateStore } from "../lib/storage/memory";
import { getRepository } from "../lib/storage/repository";
import { setBanquestFetchForTests } from "../lib/banquest/client";
import { POST as holdPost } from "../app/api/hold/route";
import { POST as checkoutPost } from "../app/api/checkout/route";
import { POST as pledgePost } from "../app/api/pledge/route";
import { GET as stateGet } from "../app/api/state/[minyan]/[occasion]/route";
import { POST as webhookPost } from "../app/api/webhook/banquest/route";
import { POST as pledgeConfirmPost } from "../app/api/admin/pledge/[id]/confirm/route";

process.env.BANQUEST_WEBHOOK_SIGNATURE = "banquest-contract-signature";
process.env.BANQUEST_SOURCE_KEY = "sandbox-source-key";
process.env.BANQUEST_PIN = "sandbox-pin";
process.env.BANQUEST_ENV = "sandbox";
process.env.BANQUEST_SANDBOX_AMOUNT_USD = "1";
process.env.OFFICE_NOTIFY_EMAIL = "office@example.com";
process.env.ADMIN_TOKEN = "test-admin-token";
process.env.SITE_URL = "http://localhost:3110";

setStateStoreForTests(new MemoryStateStore());

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
const holdCookie = holdResponse.headers.get("set-cookie")?.split(";", 1)[0];
assert.match(holdCookie ?? "", /kibbud-hold=/);
assert.deepEqual(Object.keys(await holdResponse.json()).sort(), ["expiresAt", "kibbudId"]);

setBanquestFetchForTests((async (input, init) => {
  const requestBody = JSON.parse(String(init?.body)) as {
    source: string;
    amount: number;
    expiry_month: number;
    expiry_year: number;
    custom_fields: { custom1: string; custom2: string };
  };
  assert.match(String(input), /\/transactions\/charge$/);
  assert.equal(requestBody.source, "nonce-contractTestNonce123");
  assert.equal(requestBody.amount, 1);
  assert.equal(requestBody.expiry_month, 12);
  assert.equal(requestBody.expiry_year, 2030);
  assert.equal(requestBody.custom_fields.custom2, heldItem);
  assert.match(requestBody.custom_fields.custom1, /^bq_/);
  return Response.json(
    {
      status: "Approved",
      status_code: "A",
      reference_number: 12345,
      transaction: { id: 12345 },
    },
    { status: 200 }
  );
}) as typeof fetch);
const checkoutResponse = await checkoutPost(
  jsonRequest(
    "http://localhost:3110/api/checkout",
    {
      kibbudId: heldItem,
      donorName: "Checkout Donor",
      email: "checkout@example.com",
      misheberachNames: ["Checkout Name"],
      payment: {
        nonce: "contractTestNonce123",
        expiryMonth: 12,
        expiryYear: 2030,
        avsZip: "10001",
      },
    },
    { cookie: holdCookie ?? "" }
  )
);
assert.equal(checkoutResponse.status, 200);
const checkout = (await checkoutResponse.json()) as {
  paymentId: string;
  status: string;
};
assert.match(checkout.paymentId, /^bq_/);
assert.equal(checkout.status, "sold");
setBanquestFetchForTests(undefined);

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

// A signature-verified card webhook fulfills a stored payment record.
const webhookItem = "grodna/rh-1/maftir";
const repository = getRepository();
await repository.acquireHold(webhookItem, "webhook-hold-token");
await repository.saveCheckout({
  paymentId: "pay_test_webhook",
  kibbudId: webhookItem,
  holdToken: "webhook-hold-token",
  donorName: "Webhook Donor",
  email: "webhook@example.com",
  misheberachNames: ["Webhook Name"],
  amount: 1800,
  preferredMethod: "card",
  status: "created",
  createdAt: new Date().toISOString(),
});
const eventPayload = JSON.stringify({
  id: "evt_contract_webhook",
  event: "transaction",
  timestamp: new Date().toISOString(),
  type: "succeeded",
  subType: "charge",
  data: {
    reference_number: 12345,
    transaction: {
      id: 12345,
      custom_fields: { custom1: "pay_test_webhook" },
      status_details: { status: "captured" },
      card_details: { last4: "1118", card_type: "Visa" },
    },
  },
});
const signature = createHmac("sha256", process.env.BANQUEST_WEBHOOK_SIGNATURE)
  .update(eventPayload)
  .digest("hex");
const webhookRequest = () =>
  new Request("http://localhost:3110/api/webhook/banquest", {
    method: "POST",
    headers: { "x-signature": signature },
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
  new Request("http://localhost:3110/api/webhook/banquest", {
    method: "POST",
    headers: { "x-signature": "invalid" },
    body: eventPayload,
  })
);
assert.equal(invalidWebhook.status, 400);
assert.equal(((await invalidWebhook.json()) as { error: { code: string } }).error.code, "invalid_input");

console.log("API contract and signed webhook tests passed");
