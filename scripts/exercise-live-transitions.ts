import assert from "node:assert/strict";
import { assertBeforeCutoff, requireKibbud } from "../lib/api/validation";
import { currentItems } from "../lib/calendar/current";

const baseUrl = (process.env.SITE_URL ?? "http://localhost:3110/high-holidays").replace(/\/$/, "");
const testNonce = process.env.BANQUEST_TEST_NONCE;
const testExpiryMonth = Number(process.env.BANQUEST_TEST_EXPIRY_MONTH);
const testExpiryYear = Number(process.env.BANQUEST_TEST_EXPIRY_YEAR);
if (
  !testNonce ||
  !Number.isInteger(testExpiryMonth) ||
  !Number.isInteger(testExpiryYear) ||
  !process.env.BANQUEST_SOURCE_KEY ||
  !process.env.BANQUEST_PIN ||
  !process.env.BANQUEST_TOKENIZATION_KEY ||
  process.env.BANQUEST_ENV !== "sandbox"
) {
  throw new Error(
    "Live transitions require Banquest sandbox credentials and a fresh BANQUEST_TEST_NONCE with its expiration month/year."
  );
}
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
assert.ok(candidates.length >= 2, "The live test needs two available chayei-avraham/rh-2 items");
const [cardItem, doubleItem] = candidates;

// available -> held -> sold through a real Banquest sandbox card charge
const held = await jsonPost("/api/hold", { kibbudId: cardItem });
assert.equal(held.response.status, 200);
const cookie = held.response.headers.get("set-cookie")?.split(";", 1)[0];
assert.ok(cookie, "Hold response did not set its httpOnly cookie");
const checkout = await jsonPost(
  "/api/checkout",
  {
    kibbudId: cardItem,
    donorName: "Banquest Transition Test",
    email: "transition-test@example.com",
    misheberachNames: ["Transition Test"],
    assignmentAccepted: true,
    payment: {
      nonce: testNonce,
      expiryMonth: testExpiryMonth,
      expiryYear: testExpiryYear,
      avsZip: process.env.BANQUEST_TEST_AVS_ZIP ?? "10001",
    },
  },
  { cookie }
);
assert.equal(checkout.response.status, 200);
assert.match(String(checkout.value.paymentId), /^bq_/);
assert.equal(checkout.value.status, "sold");

assert.equal((await jsonPost("/api/hold", { kibbudId: doubleItem })).response.status, 200);
assert.equal((await jsonPost("/api/hold", { kibbudId: doubleItem })).response.status, 409);

const cutoffItem = requireKibbud(cardItem);
assert.throws(() =>
  assertBeforeCutoff(cutoffItem, Date.parse("2026-09-13T23:59:59+03:00"))
);

console.log("Banquest sandbox and live Cloudflare D1 transitions passed");
