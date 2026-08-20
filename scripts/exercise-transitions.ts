import assert from "node:assert/strict";
import type { StoredPledge } from "../lib/redis/types";
import { ApiError } from "../lib/api/errors";
import { assertBeforeCutoff, requireKibbud } from "../lib/api/validation";
import { MemoryRedisStore } from "../lib/redis/memory";
import {
  AlreadyTakenError,
  KibbudRepository,
} from "../lib/redis/repository";

const redis = new MemoryRedisStore();
const repository = new KibbudRepository(redis);

// available -> held -> sold (card)
const cardItem = "grodna/yk-mincha/maftir-yonah";
await repository.acquireHold(cardItem, "card-token");
assert.deepEqual(await repository.statuses([cardItem]), [
  { id: cardItem, state: "held", expiresAt: (await repository.holdOwnedBy(cardItem, "card-token")).expiresAt },
]);
await repository.saveCheckout({
  sessionId: "cs_test_card",
  kibbudId: cardItem,
  holdToken: "card-token",
  donorName: "Card Donor",
  email: "card@example.com",
  misheberachNames: ["Card Name"],
  amount: 5000,
  preferredMethod: "card",
  createdAt: new Date().toISOString(),
});
await repository.markCheckoutSold("cs_test_card", "card");
assert.deepEqual(await repository.statuses([cardItem]), [{ id: cardItem, state: "sold" }]);

// available -> held -> expired -> available
const expiringItem = "grodna/rh-1/kohen";
await repository.acquireHold(expiringItem, "short-token", 1);
await new Promise((resolve) => setTimeout(resolve, 1100));
assert.deepEqual(await repository.statuses([expiringItem]), []);

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

// available -> held -> ACH pending -> sold
const achItem = "grodna/rh-1/chamishi";
await repository.acquireHold(achItem, "ach-token");
await repository.saveCheckout({
  sessionId: "cs_test_ach",
  kibbudId: achItem,
  holdToken: "ach-token",
  donorName: "ACH Donor",
  email: "ach@example.com",
  misheberachNames: [],
  amount: 1800,
  preferredMethod: "ach",
  createdAt: new Date().toISOString(),
});
await repository.markCheckoutPending("cs_test_ach");
assert.deepEqual(await repository.statuses([achItem]), [{ id: achItem, state: "pending" }]);
await repository.markCheckoutSold("cs_test_ach", "ach");
assert.deepEqual(await repository.statuses([achItem]), [{ id: achItem, state: "sold" }]);

// ACH failure releases the item.
const failedAchItem = "grodna/rh-1/shishi";
await repository.acquireHold(failedAchItem, "ach-fail-token");
await repository.saveCheckout({
  sessionId: "cs_test_ach_fail",
  kibbudId: failedAchItem,
  holdToken: "ach-fail-token",
  donorName: "ACH Failure",
  email: "ach-fail@example.com",
  misheberachNames: [],
  amount: 1800,
  preferredMethod: "ach",
  createdAt: new Date().toISOString(),
});
await repository.markCheckoutPending("cs_test_ach_fail");
await repository.releaseCheckout("cs_test_ach_fail");
assert.deepEqual(await repository.statuses([failedAchItem]), []);

// Per-occasion post-cutoff rejection.
const cutoffItem = requireKibbud("grodna/yk-mincha/maftir-yonah");
const cutoff = new Date("2026-09-20T18:20:00+03:00").getTime();
assert.throws(
  () => assertBeforeCutoff(cutoffItem, cutoff + 1),
  (error: unknown) => error instanceof ApiError && error.code === "cutoff_passed"
);

// Webhook replay idempotency.
assert.equal(await repository.beginStripeEvent("evt_replay"), "process");
await repository.finishStripeEvent("evt_replay");
assert.equal(await repository.beginStripeEvent("evt_replay"), "done");

console.log("all state transitions passed");

