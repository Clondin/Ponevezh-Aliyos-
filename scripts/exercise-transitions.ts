import assert from "node:assert/strict";
import type { StoredPledge } from "../lib/storage/types";
import { ApiError } from "../lib/api/errors";
import { assertBeforeCutoff, requireKibbud } from "../lib/api/validation";
import { MemoryStateStore } from "../lib/storage/memory";
import { keys } from "../lib/storage/keys";
import type { StoredOrder } from "../lib/storage/types";
import {
  AlreadyTakenError,
  KibbudRepository,
} from "../lib/storage/repository";

const store = new MemoryStateStore();
const repository = new KibbudRepository(store);

// available -> held -> sold (card)
const cardItem = "grodna/yk-mincha/maftir-yonah";
await repository.acquireHold(cardItem, "card-token");
assert.deepEqual(await repository.statuses([cardItem]), [
  { id: cardItem, state: "held", expiresAt: (await repository.holdOwnedBy(cardItem, "card-token")).expiresAt },
]);
await repository.saveCheckout({
  paymentId: "pay_test_card",
  kibbudId: cardItem,
  holdToken: "card-token",
  donorName: "Card Donor",
  email: "card@example.com",
  misheberachNames: ["Card Name"],
  amount: 5000,
  preferredMethod: "card",
  status: "created",
  createdAt: new Date().toISOString(),
});
await repository.markCheckoutSold("pay_test_card", "card");
assert.deepEqual(await repository.statuses([cardItem]), [{ id: cardItem, state: "sold" }]);

// A full reversal reopens inventory but retains append-only order history.
await repository.reverseCheckout("pay_test_card", "transition test refund");
assert.deepEqual(await repository.statuses([cardItem]), []);
const refundedOrder = await repository.order("ord_pay_test_card");
assert.equal(refundedOrder?.status, "refunded");
assert.equal(refundedOrder?.refundReason, "transition test refund");

// Multi-item settlement is all-or-nothing when one sold key conflicts.
const cartItems = ["test/cart/one", "test/cart/two"];
for (const id of cartItems) await repository.acquireHold(id, "cart-token");
await repository.saveCheckout({
  paymentId: "pay_atomic_cart",
  kibbudId: cartItems[0],
  kibbudIds: cartItems,
  amounts: { [cartItems[0]]: 100, [cartItems[1]]: 200 },
  holdToken: "cart-token",
  donorName: "Atomic Cart",
  email: "atomic@example.com",
  misheberachNames: [],
  amount: 300,
  preferredMethod: "card",
  status: "created",
  createdAt: new Date().toISOString(),
});
const conflictingOrder: StoredOrder = {
  id: "ord_conflict",
  kibbudId: cartItems[1],
  donorName: "Other Donor",
  email: "other@example.com",
  misheberachNames: [],
  amount: 200,
  method: "card",
  createdAt: new Date().toISOString(),
};
await store.set(keys.sold(cartItems[1]), conflictingOrder);
await assert.rejects(
  repository.markCheckoutGroupSold("pay_atomic_cart", "card"),
  AlreadyTakenError
);
assert.equal(await repository.orderFor(cartItems[0]), null);
assert.equal((await repository.checkout("pay_atomic_cart"))?.status, "processing");
await repository.releaseCheckout("pay_atomic_cart");

// available -> held -> expired -> available
const expiringItem = "grodna/rh-1/kohen";
await repository.acquireHold(expiringItem, "short-token", 1);
await new Promise((resolve) => setTimeout(resolve, 1100));
assert.deepEqual(await repository.statuses([expiringItem]), []);

// A worker crash before the gateway responds cannot strand inventory indefinitely.
const staleProcessingItem = "test/checkout/stale-processing";
await repository.acquireHold(staleProcessingItem, "stale-processing-token");
await repository.saveCheckout({
  paymentId: "pay_stale_processing",
  kibbudId: staleProcessingItem,
  holdToken: "stale-processing-token",
  donorName: "Interrupted Donor",
  email: "interrupted@example.com",
  misheberachNames: [],
  amount: 100,
  preferredMethod: "card",
  status: "created",
  createdAt: new Date().toISOString(),
});
assert.equal(await repository.releaseStaleProcessingCheckouts(0), 1);
assert.deepEqual(await repository.statuses([staleProcessingItem]), []);
assert.equal((await repository.checkout("pay_stale_processing"))?.status, "released");

// double-hold rejection
const doubleItem = "grodna/rh-1/levi";
await repository.acquireHold(doubleItem, "first-token");
await assert.rejects(
  repository.acquireHold(doubleItem, "second-token"),
  AlreadyTakenError
);

const pledge = (id: string, kibbudId: string): StoredPledge => ({
  id,
  kibbudId,
  donorName: "Wire Donor",
  email: "wire@example.com",
  misheberachNames: ["Wire Name"],
  amount: 1800,
  status: "pending",
  expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
});

// available -> pledged -> confirmed
const confirmedItem = "grodna/rh-1/shlishi";
await repository.createPledge(pledge("plg_confirm", confirmedItem), "pledge-confirm-token");
assert.deepEqual(await repository.statuses([confirmedItem]), [
  { id: confirmedItem, state: "pending" },
]);
await repository.confirmPledge("plg_confirm");
assert.deepEqual(await repository.statuses([confirmedItem]), [
  { id: confirmedItem, state: "sold" },
]);

// available -> pledged -> released
const releasedItem = "grodna/rh-1/revii";
await repository.createPledge(pledge("plg_release", releasedItem), "pledge-release-token");
await repository.releasePledge("plg_release");
assert.deepEqual(await repository.statuses([releasedItem]), []);

// Admire reservations do not expire. They remain unavailable until the office
// explicitly confirms or releases them, even after the legacy expiresAt field.
const admireItem = "grodna/rh-1/chamishi";
const admirePledge: StoredPledge = {
  ...pledge("plg_admire_review", admireItem),
  paymentSource: "admire",
  holdUntilReviewed: true,
  externalReference: "PNV-TESTREVIEW01",
  expiresAt: new Date(Date.now() - 60_000).toISOString(),
};
await repository.createPledge(admirePledge, "admire-review-token");
assert.deepEqual(await repository.statuses([admireItem]), [
  { id: admireItem, state: "pending" },
]);
assert.ok(
  (await repository.pendingPledges()).some((pending) => pending.id === admirePledge.id)
);
await repository.releasePledge(admirePledge.id);
assert.deepEqual(await repository.statuses([admireItem]), []);

// Per-occasion post-cutoff rejection.
const cutoffItem = requireKibbud("grodna/yk-mincha/maftir-yonah");
const cutoff = new Date("2026-09-20T18:20:00+03:00").getTime();
assert.throws(
  () => assertBeforeCutoff(cutoffItem, cutoff + 1),
  (error: unknown) => error instanceof ApiError && error.code === "cutoff_passed"
);

// Webhook replay idempotency.
assert.equal(await repository.beginPaymentEvent("evt_replay"), "process");
await repository.finishPaymentEvent("evt_replay");
assert.equal(await repository.beginPaymentEvent("evt_replay"), "done");

console.log("all state transitions passed");
