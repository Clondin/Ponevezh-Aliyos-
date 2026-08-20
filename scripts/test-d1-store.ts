import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getPlatformProxy } from "wrangler";
import { D1StateStore } from "../lib/storage/d1";
import {
  AlreadyTakenError,
  KibbudRepository,
} from "../lib/storage/repository";

const platform = await getPlatformProxy<CloudflareEnv>({
  configPath: "wrangler.jsonc",
  envFiles: [],
  persist: false,
  remoteBindings: false,
});

try {
  const migration = await readFile("migrations/0001_state_store.sql", "utf8");
  const statements = migration
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => platform.env.DB.prepare(statement));
  await platform.env.DB.batch(statements);
  const store = new D1StateStore(platform.env.DB);
  const repository = new KibbudRepository(store);

  const heldItem = "test/d1/held";
  await repository.acquireHold(heldItem, "first-token");
  await assert.rejects(
    repository.acquireHold(heldItem, "second-token"),
    AlreadyTakenError
  );

  const concurrentItem = "test/d1/concurrent";
  const attempts = await Promise.allSettled(
    Array.from({ length: 8 }, (_, index) =>
      repository.acquireHold(concurrentItem, `concurrent-${index}`)
    )
  );
  assert.equal(
    attempts.filter((attempt) => attempt.status === "fulfilled").length,
    1,
    "Only one concurrent D1 hold may win"
  );
  assert.ok(
    attempts
      .filter((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected")
      .every((attempt) => attempt.reason instanceof AlreadyTakenError)
  );

  const expiringItem = "test/d1/expiring";
  await repository.acquireHold(expiringItem, "short-token", 1);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.deepEqual(await repository.statuses([expiringItem]), []);

  const soldItem = "test/d1/sold";
  await repository.acquireHold(soldItem, "checkout-token");
  await repository.saveCheckout({
    paymentId: "pay_d1_test",
    kibbudId: soldItem,
    holdToken: "checkout-token",
    donorName: "D1 Test Donor",
    email: "d1@example.com",
    misheberachNames: ["D1 Name"],
    amount: 1800,
    preferredMethod: "card",
    status: "created",
    createdAt: new Date().toISOString(),
  });
  await repository.markCheckoutSold("pay_d1_test", "card");
  assert.deepEqual(await repository.statuses([soldItem]), [
    { id: soldItem, state: "sold" },
  ]);
  assert.equal((await repository.allOrders()).length, 1);

  console.log("Cloudflare D1 state-store transitions passed");
} finally {
  await platform.dispose();
}
