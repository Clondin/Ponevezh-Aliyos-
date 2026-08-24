import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { setStateStoreForTests } from "../lib/storage/client";
import { MemoryStateStore } from "../lib/storage/memory";
import { keys } from "../lib/storage/keys";
import { getRepository } from "../lib/storage/repository";
import { setBanquestFetchForTests } from "../lib/banquest/client";
import { POST as holdPost } from "../app/api/hold/route";
import { POST as checkoutPost } from "../app/api/checkout/route";
import { POST as cartHoldPost } from "../app/api/cart/hold/route";
import { POST as cartCheckoutPost } from "../app/api/cart/checkout/route";
import { POST as pledgePost } from "../app/api/pledge/route";
import { GET as stateGet } from "../app/api/state/[minyan]/[occasion]/route";
import { POST as webhookPost } from "../app/api/webhook/banquest/route";
import { POST as pledgeConfirmPost } from "../app/api/admin/pledge/[id]/confirm/route";
import ConfirmationPage from "../app/(site)/confirmation/page";

process.env.BANQUEST_WEBHOOK_SIGNATURE = "banquest-contract-signature";
process.env.BANQUEST_SOURCE_KEY = "sandbox-source-key";
process.env.BANQUEST_PIN = "sandbox-pin";
process.env.BANQUEST_ENV = "sandbox";
process.env.BANQUEST_SANDBOX_AMOUNT_USD = "1";
process.env.OFFICE_NOTIFY_EMAIL = "office@example.com";
process.env.ADMIN_TOKEN = "test-admin-token";
process.env.SITE_URL = "http://localhost:3110";
process.env.WAVE_1_OPENS_AT = "2026-01-01T00:00:00-05:00";
process.env.WAVE_2_OPENS_AT = "2026-01-01T00:00:00-05:00";

const stateStore = new MemoryStateStore();
setStateStoreForTests(stateStore);

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
const checkoutOrderId = `ord_${checkout.paymentId}`;
const queuedEmailIds = await stateStore.smembers<string[]>(keys.emailOutbox);
assert.ok(queuedEmailIds.includes(`order-confirmation-${checkoutOrderId}`));
assert.ok(queuedEmailIds.includes(`order-office-${checkoutOrderId}`));

// A guessed item-only confirmation URL must never reveal its donor.
const untrustedConfirmation = renderToStaticMarkup(
  await ConfirmationPage({ searchParams: Promise.resolve({ item: heldItem }) })
);
assert.doesNotMatch(untrustedConfirmation, /Checkout Donor/);
assert.match(untrustedConfirmation, /Confirmation unavailable/);
const trustedConfirmation = renderToStaticMarkup(
  await ConfirmationPage({
    searchParams: Promise.resolve({ item: heldItem, method: "card", key: checkout.paymentId }),
  })
);
assert.match(trustedConfirmation, /Checkout Donor/);
setBanquestFetchForTests(undefined);

// Two simultaneous submits for one hold must result in exactly one gateway call.
const concurrentItem = "grodna/rh-1/revii";
const concurrentHoldResponse = await holdPost(
  jsonRequest("http://localhost:3110/api/hold", { kibbudId: concurrentItem })
);
const concurrentCookie = concurrentHoldResponse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
let concurrentGatewayCalls = 0;
setBanquestFetchForTests((async () => {
  concurrentGatewayCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 30));
  return Response.json({ status: "Approved", transaction: { id: 22222 } });
}) as typeof fetch);
const concurrentPayload = {
  kibbudId: concurrentItem,
  donorName: "Concurrent Donor",
  email: "concurrent@example.com",
  misheberachNames: [],
  payment: { nonce: "concurrentNonce123", expiryMonth: 12, expiryYear: 2030 },
};
const concurrentResponses = await Promise.all([
  checkoutPost(jsonRequest("http://localhost:3110/api/checkout", concurrentPayload, { cookie: concurrentCookie })),
  checkoutPost(jsonRequest("http://localhost:3110/api/checkout", concurrentPayload, { cookie: concurrentCookie })),
]);
assert.equal(concurrentGatewayCalls, 1);
assert.ok(concurrentResponses.every((response) => response.status === 200 || response.status === 409));
setBanquestFetchForTests(undefined);

// A combined sponsorship holds and sells every selected item with one charge.
const cartItems = ["grodna/rh-1/chamishi", "grodna/rh-1/shishi"];
const cartHoldResponse = await cartHoldPost(
  jsonRequest("http://localhost:3110/api/cart/hold", { kibbudIds: cartItems })
);
assert.equal(cartHoldResponse.status, 200);
const cartCookie = cartHoldResponse.headers.get("set-cookie")?.split(";", 1)[0] ?? "";
let cartGatewayCalls = 0;
setBanquestFetchForTests((async (_input, init) => {
  cartGatewayCalls += 1;
  const body = JSON.parse(String(init?.body)) as { custom_fields: { custom2: string } };
  assert.equal(body.custom_fields.custom2, "2 kibbudim");
  return Response.json({ status: "Approved", transaction: { id: 33333 } });
}) as typeof fetch);
const cartCheckoutResponse = await cartCheckoutPost(
  jsonRequest("http://localhost:3110/api/cart/checkout", {
    kibbudIds: cartItems,
    donorName: "Combined Donor",
    email: "combined@example.com",
    misheberachNames: ["Combined Name"],
    dedicationType: "honor",
    dedicationName: "The Combined Family",
    publicRecognition: true,
    recognitionName: "Combined Family",
    payment: { nonce: "combinedNonce123", expiryMonth: 12, expiryYear: 2030 },
  }, { cookie: cartCookie })
);
assert.equal(cartCheckoutResponse.status, 200);
const cartCheckout = (await cartCheckoutResponse.json()) as { paymentId: string; status: string };
assert.equal(cartCheckout.status, "sold");
assert.equal(cartGatewayCalls, 1);
assert.equal((await getRepository().ordersForPayment(cartCheckout.paymentId)).length, 2);
assert.deepEqual(await getRepository().statuses(cartItems), cartItems.map((id) => ({ id, state: "sold" })));
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
