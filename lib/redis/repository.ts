import type { KibbudStatus, Order, Pledge } from "@/contracts/types";
import { getRedisStore } from "@/lib/redis/client";
import { keys } from "@/lib/redis/keys";
import type {
  CheckoutRecord,
  HoldRecord,
  PendingRecord,
  RedisStore,
  StoredOrder,
  StoredPledge,
} from "@/lib/redis/types";

export const CHECKOUT_HOLD_SECONDS = 12 * 60;
export const PLEDGE_HOLD_SECONDS = 72 * 60 * 60;
export const ACH_PENDING_SECONDS = 7 * 24 * 60 * 60;
const CHECKOUT_RECORD_SECONDS = 8 * 24 * 60 * 60;

export class AlreadyTakenError extends Error {}
export class HoldExpiredError extends Error {}

export class KibbudRepository {
  constructor(private readonly redis: RedisStore = getRedisStore()) {}

  async acquireHold(
    kibbudId: string,
    token: string,
    seconds = CHECKOUT_HOLD_SECONDS,
    kind: HoldRecord["kind"] = "checkout"
  ): Promise<HoldRecord> {
    const [sold, pending] = await this.redis.mget<[StoredOrder | null, PendingRecord | null]>(
      keys.sold(kibbudId),
      keys.pending(kibbudId)
    );
    if (sold || pending) throw new AlreadyTakenError();

    const hold: HoldRecord = {
      kibbudId,
      token,
      kind,
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
    };
    const acquired = await this.redis.set(keys.hold(kibbudId), hold, {
      nx: true,
      ex: seconds,
    });
    if (acquired !== "OK") throw new AlreadyTakenError();

    // Close the narrow race between the availability read and SET NX.
    const [soldAfter, pendingAfter] = await this.redis.mget<[
      StoredOrder | null,
      PendingRecord | null,
    ]>(keys.sold(kibbudId), keys.pending(kibbudId));
    if (soldAfter || pendingAfter) {
      await this.releaseHold(kibbudId, token);
      throw new AlreadyTakenError();
    }
    return hold;
  }

  async holdOwnedBy(kibbudId: string, token: string): Promise<HoldRecord> {
    const hold = await this.redis.get<HoldRecord>(keys.hold(kibbudId));
    if (!hold || hold.token !== token || Date.parse(hold.expiresAt) <= Date.now()) {
      throw new HoldExpiredError();
    }
    return hold;
  }

  async checkoutHold(kibbudId: string, token: string): Promise<HoldRecord> {
    const hold = await this.holdOwnedBy(kibbudId, token);
    const [sold, pending] = await this.redis.mget<[
      StoredOrder | null,
      PendingRecord | null,
    ]>(keys.sold(kibbudId), keys.pending(kibbudId));
    if (sold || pending) throw new AlreadyTakenError();
    return hold;
  }

  async releaseHold(kibbudId: string, token: string): Promise<boolean> {
    const hold = await this.redis.get<HoldRecord>(keys.hold(kibbudId));
    if (!hold || hold.token !== token) return false;
    await this.redis.del(keys.hold(kibbudId));
    return true;
  }

  async saveCheckout(record: CheckoutRecord): Promise<void> {
    await this.checkoutHold(record.kibbudId, record.holdToken);
    await this.redis.set(keys.checkout(record.sessionId), record, {
      ex: CHECKOUT_RECORD_SECONDS,
    });
  }

  async checkout(sessionId: string): Promise<CheckoutRecord | null> {
    return this.redis.get<CheckoutRecord>(keys.checkout(sessionId));
  }

  async markCheckoutPending(sessionId: string): Promise<void> {
    const checkout = await this.checkout(sessionId);
    if (!checkout) throw new HoldExpiredError();
    await this.checkoutHold(checkout.kibbudId, checkout.holdToken);
    const expiresAt = new Date(Date.now() + ACH_PENDING_SECONDS * 1000).toISOString();
    const pending: PendingRecord = {
      kibbudId: checkout.kibbudId,
      kind: "checkout",
      referenceId: sessionId,
      expiresAt,
    };
    const hold: HoldRecord = {
      kibbudId: checkout.kibbudId,
      token: checkout.holdToken,
      kind: "checkout",
      expiresAt,
    };
    await Promise.all([
      this.redis.set(keys.pending(checkout.kibbudId), pending, {
        ex: ACH_PENDING_SECONDS,
      }),
      this.redis.set(keys.hold(checkout.kibbudId), hold, {
        ex: ACH_PENDING_SECONDS,
      }),
    ]);
  }

  async releaseCheckout(sessionId: string): Promise<void> {
    const checkout = await this.checkout(sessionId);
    if (!checkout) return;
    const pending = await this.redis.get<PendingRecord>(keys.pending(checkout.kibbudId));
    const hold = await this.redis.get<HoldRecord>(keys.hold(checkout.kibbudId));
    const deletes = [keys.checkout(sessionId)];
    if (pending?.kind === "checkout" && pending.referenceId === sessionId) {
      deletes.push(keys.pending(checkout.kibbudId));
    }
    if (hold?.token === checkout.holdToken) deletes.push(keys.hold(checkout.kibbudId));
    await this.redis.del(...deletes);
  }

  async markCheckoutSold(
    sessionId: string,
    method: Order["method"]
  ): Promise<StoredOrder> {
    const checkout = await this.checkout(sessionId);
    if (!checkout) throw new HoldExpiredError();
    const order: StoredOrder = {
      id: `ord_${sessionId}`,
      kibbudId: checkout.kibbudId,
      donorName: checkout.donorName,
      email: checkout.email,
      misheberachNames: checkout.misheberachNames,
      amount: checkout.amount,
      method,
      createdAt: new Date().toISOString(),
    };
    await this.persistOrder(order);
    await this.releaseCheckout(sessionId);
    return order;
  }

  async createPledge(pledge: StoredPledge, token: string): Promise<void> {
    await this.acquireHold(
      pledge.kibbudId,
      token,
      PLEDGE_HOLD_SECONDS,
      "pledge"
    );
    const pending: PendingRecord = {
      kibbudId: pledge.kibbudId,
      kind: "pledge",
      referenceId: pledge.id,
      expiresAt: pledge.expiresAt,
    };
    try {
      await Promise.all([
        this.redis.set(keys.pledge(pledge.id), pledge),
        this.redis.set(keys.pending(pledge.kibbudId), pending, {
          ex: PLEDGE_HOLD_SECONDS,
        }),
        this.redis.sadd(keys.pendingPledges, pledge.id),
      ]);
    } catch (error) {
      await this.releaseHold(pledge.kibbudId, token);
      throw error;
    }
  }

  async pledge(pledgeId: string): Promise<StoredPledge | null> {
    return this.redis.get<StoredPledge>(keys.pledge(pledgeId));
  }

  async pendingPledges(): Promise<Pledge[]> {
    const ids = await this.redis.smembers<string[]>(keys.pendingPledges);
    if (!ids.length) return [];
    const records = await this.redis.mget<Array<StoredPledge | null>>(
      ...ids.map(keys.pledge)
    );
    const now = Date.now();
    const stale: string[] = [];
    const pending: Pledge[] = [];
    records.forEach((pledge, index) => {
      if (!pledge || pledge.status !== "pending" || Date.parse(pledge.expiresAt) <= now) {
        stale.push(ids[index]);
      } else {
        pending.push(pledge);
      }
    });
    if (stale.length) await this.redis.srem(keys.pendingPledges, ...stale);
    return pending;
  }

  async confirmPledge(pledgeId: string): Promise<StoredOrder> {
    const pledge = await this.pledge(pledgeId);
    if (!pledge) throw new HoldExpiredError();
    if (pledge.status === "confirmed") {
      const existing = await this.redis.get<StoredOrder>(keys.sold(pledge.kibbudId));
      if (existing) return existing;
    }
    if (pledge.status !== "pending" || Date.parse(pledge.expiresAt) <= Date.now()) {
      throw new HoldExpiredError();
    }
    const order: StoredOrder = {
      id: `ord_${pledge.id}`,
      kibbudId: pledge.kibbudId,
      donorName: pledge.donorName,
      email: pledge.email,
      misheberachNames: pledge.misheberachNames,
      amount: pledge.amount,
      // The frozen Order contract models bank payments as ACH; office-settled
      // wire/check pledges use the same bank-rail value.
      method: "ach",
      createdAt: new Date().toISOString(),
    };
    await this.persistOrder(order);
    await this.redis.set(keys.pledge(pledge.id), { ...pledge, status: "confirmed" });
    await this.clearPledgeReservation(pledge);
    return order;
  }

  async releasePledge(pledgeId: string): Promise<void> {
    const pledge = await this.pledge(pledgeId);
    if (!pledge) throw new HoldExpiredError();
    if (pledge.status === "released") {
      await this.clearPledgeReservation(pledge);
      return;
    }
    if (pledge.status !== "pending") throw new AlreadyTakenError();
    await this.redis.set(keys.pledge(pledge.id), { ...pledge, status: "released" });
    await this.clearPledgeReservation(pledge);
  }

  private async clearPledgeReservation(pledge: StoredPledge): Promise<void> {
    const pending = await this.redis.get<PendingRecord>(keys.pending(pledge.kibbudId));
    const hold = await this.redis.get<HoldRecord>(keys.hold(pledge.kibbudId));
    const deletes: string[] = [];
    const ownsPending = pending?.kind === "pledge" && pending.referenceId === pledge.id;
    if (ownsPending) {
      deletes.push(keys.pending(pledge.kibbudId));
      if (hold?.kind === "pledge") deletes.push(keys.hold(pledge.kibbudId));
    }
    if (deletes.length) await this.redis.del(...deletes);
    await this.redis.srem(keys.pendingPledges, pledge.id);
  }

  private async persistOrder(order: StoredOrder): Promise<void> {
    const claimed = await this.redis.set(keys.sold(order.kibbudId), order, { nx: true });
    if (claimed !== "OK") {
      const existing = await this.redis.get<StoredOrder>(keys.sold(order.kibbudId));
      if (existing?.id === order.id) {
        await Promise.all([
          this.redis.set(keys.order(order.id), existing),
          this.redis.sadd(keys.orders, order.id),
        ]);
        return;
      }
      throw new AlreadyTakenError();
    }
    await Promise.all([
      this.redis.set(keys.order(order.id), order),
      this.redis.sadd(keys.orders, order.id),
    ]);
  }

  async reconcileOrder(order: StoredOrder): Promise<void> {
    await this.persistOrder(order);
  }

  async orderFor(kibbudId: string): Promise<Order | null> {
    return this.redis.get<StoredOrder>(keys.sold(kibbudId));
  }

  async allOrders(): Promise<Order[]> {
    const ids = await this.redis.smembers<string[]>(keys.orders);
    if (!ids.length) return [];
    const orders = await this.redis.mget<Array<StoredOrder | null>>(...ids.map(keys.order));
    return orders.filter((order): order is StoredOrder => Boolean(order));
  }

  /** One MGET round trip for all sold, pending, and held values. */
  async statuses(itemIds: string[]): Promise<KibbudStatus[]> {
    if (!itemIds.length) return [];
    const redisKeys = [
      ...itemIds.map(keys.sold),
      ...itemIds.map(keys.pending),
      ...itemIds.map(keys.hold),
    ];
    const values = await this.redis.mget<Array<unknown | null>>(...redisKeys);
    const length = itemIds.length;
    const now = Date.now();
    const result: KibbudStatus[] = [];
    for (let index = 0; index < length; index += 1) {
      const sold = values[index] as StoredOrder | null;
      const pending = values[length + index] as PendingRecord | null;
      const hold = values[length * 2 + index] as HoldRecord | null;
      if (sold) {
        result.push({ id: itemIds[index], state: "sold" });
      } else if (pending && Date.parse(pending.expiresAt) > now) {
        result.push({ id: itemIds[index], state: "pending" });
      } else if (hold && Date.parse(hold.expiresAt) > now) {
        result.push({ id: itemIds[index], state: "held", expiresAt: hold.expiresAt });
      }
    }
    return result;
  }

  async beginStripeEvent(eventId: string): Promise<"process" | "done" | "busy"> {
    if (await this.redis.get(keys.stripeEventDone(eventId))) return "done";
    const lock = await this.redis.set(keys.stripeEventLock(eventId), "1", {
      nx: true,
      ex: 60,
    });
    return lock === "OK" ? "process" : "busy";
  }

  async finishStripeEvent(eventId: string): Promise<void> {
    await Promise.all([
      this.redis.set(keys.stripeEventDone(eventId), "1"),
      this.redis.del(keys.stripeEventLock(eventId)),
    ]);
  }

  async failStripeEvent(eventId: string): Promise<void> {
    await this.redis.del(keys.stripeEventLock(eventId));
  }
}

let repository: KibbudRepository | undefined;

export function getRepository(): KibbudRepository {
  repository ??= new KibbudRepository();
  return repository;
}
