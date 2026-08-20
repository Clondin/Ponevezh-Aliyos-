import type { KibbudStatus, Order, Pledge } from "@/contracts/types";
import { getStateStore } from "@/lib/storage/client";
import { keys } from "@/lib/storage/keys";
import type {
  CheckoutRecord,
  HoldRecord,
  PendingRecord,
  StateStore,
  StoredOrder,
  StoredPledge,
} from "@/lib/storage/types";

export const CHECKOUT_HOLD_SECONDS = 12 * 60;
export const PLEDGE_HOLD_SECONDS = 72 * 60 * 60;
export const PAYMENT_PENDING_SECONDS = 7 * 24 * 60 * 60;
const CHECKOUT_RECORD_SECONDS = 90 * 24 * 60 * 60;

export class AlreadyTakenError extends Error {}
export class HoldExpiredError extends Error {}

export class KibbudRepository {
  constructor(private readonly redis: StateStore = getStateStore()) {}

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
    await Promise.all([
      this.redis.set(keys.checkout(record.paymentId), record, {
        ex: CHECKOUT_RECORD_SECONDS,
      }),
      this.redis.set(keys.checkoutByHold(record.holdToken), record.paymentId, {
        ex: CHECKOUT_RECORD_SECONDS,
      }),
    ]);
  }

  async checkout(paymentId: string): Promise<CheckoutRecord | null> {
    return this.redis.get<CheckoutRecord>(keys.checkout(paymentId));
  }

  async checkoutForHold(holdToken: string): Promise<CheckoutRecord | null> {
    const paymentId = await this.redis.get<string>(keys.checkoutByHold(holdToken));
    return paymentId ? this.checkout(paymentId) : null;
  }

  async markCheckoutPending(paymentId: string): Promise<void> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) throw new HoldExpiredError();
    if (checkout.status === "sold" || checkout.status === "reversed") return;
    const expiresAt = new Date(Date.now() + PAYMENT_PENDING_SECONDS * 1000).toISOString();
    const pending: PendingRecord = {
      kibbudId: checkout.kibbudId,
      kind: "checkout",
      referenceId: paymentId,
      expiresAt,
    };
    const hold: HoldRecord = {
      kibbudId: checkout.kibbudId,
      token: checkout.holdToken,
      kind: "checkout",
      expiresAt,
    };
    await Promise.all([
      this.redis.set(
        keys.checkout(paymentId),
        { ...checkout, status: "pending" },
        { ex: CHECKOUT_RECORD_SECONDS }
      ),
      this.redis.set(keys.pending(checkout.kibbudId), pending, {
        ex: PAYMENT_PENDING_SECONDS,
      }),
      this.redis.set(keys.hold(checkout.kibbudId), hold, {
        ex: PAYMENT_PENDING_SECONDS,
      }),
    ]);
  }

  async releaseCheckout(paymentId: string): Promise<void> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) return;
    const pending = await this.redis.get<PendingRecord>(keys.pending(checkout.kibbudId));
    const hold = await this.redis.get<HoldRecord>(keys.hold(checkout.kibbudId));
    const deletes = [keys.checkoutByHold(checkout.holdToken)];
    if (pending?.kind === "checkout" && pending.referenceId === paymentId) {
      deletes.push(keys.pending(checkout.kibbudId));
    }
    if (hold?.token === checkout.holdToken) deletes.push(keys.hold(checkout.kibbudId));
    await Promise.all([
      this.redis.set(
        keys.checkout(paymentId),
        { ...checkout, status: "released" },
        { ex: CHECKOUT_RECORD_SECONDS }
      ),
      this.redis.del(...deletes),
    ]);
  }

  async markCheckoutSold(
    paymentId: string,
    method: Order["method"]
  ): Promise<StoredOrder> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) throw new HoldExpiredError();
    const existing = await this.redis.get<StoredOrder>(keys.sold(checkout.kibbudId));
    if (existing?.id === `ord_${paymentId}`) return existing;
    if (checkout.status === "reversed") throw new AlreadyTakenError();
    const order: StoredOrder = {
      id: `ord_${paymentId}`,
      kibbudId: checkout.kibbudId,
      donorName: checkout.donorName,
      email: checkout.email,
      misheberachNames: checkout.misheberachNames,
      amount: checkout.amount,
      method,
      createdAt: new Date().toISOString(),
    };
    await this.persistOrder(order);
    const pending = await this.redis.get<PendingRecord>(keys.pending(checkout.kibbudId));
    const hold = await this.redis.get<HoldRecord>(keys.hold(checkout.kibbudId));
    const deletes = [keys.checkoutByHold(checkout.holdToken)];
    if (pending?.kind === "checkout" && pending.referenceId === paymentId) {
      deletes.push(keys.pending(checkout.kibbudId));
    }
    if (hold?.token === checkout.holdToken) deletes.push(keys.hold(checkout.kibbudId));
    await Promise.all([
      this.redis.set(
        keys.checkout(paymentId),
        { ...checkout, status: "sold" },
        { ex: CHECKOUT_RECORD_SECONDS }
      ),
      this.redis.del(...deletes),
    ]);
    return order;
  }

  async reverseCheckout(paymentId: string): Promise<void> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) return;
    const orderId = `ord_${paymentId}`;
    const sold = await this.redis.get<StoredOrder>(keys.sold(checkout.kibbudId));
    const pending = await this.redis.get<PendingRecord>(keys.pending(checkout.kibbudId));
    const hold = await this.redis.get<HoldRecord>(keys.hold(checkout.kibbudId));
    const deletes = [keys.checkoutByHold(checkout.holdToken)];
    if (sold?.id === orderId) {
      deletes.push(keys.sold(checkout.kibbudId), keys.order(orderId));
    }
    if (pending?.kind === "checkout" && pending.referenceId === paymentId) {
      deletes.push(keys.pending(checkout.kibbudId));
    }
    if (hold?.token === checkout.holdToken) deletes.push(keys.hold(checkout.kibbudId));
    await Promise.all([
      this.redis.set(
        keys.checkout(paymentId),
        { ...checkout, status: "reversed" },
        { ex: CHECKOUT_RECORD_SECONDS }
      ),
      this.redis.del(...deletes),
      this.redis.srem(keys.orders, orderId),
    ]);
  }

  async createPledge(
    pledge: StoredPledge,
    token: string,
    fromCheckoutHold = false
  ): Promise<void> {
    if (fromCheckoutHold) {
      await this.checkoutHold(pledge.kibbudId, token);
    } else {
      await this.acquireHold(
        pledge.kibbudId,
        token,
        PLEDGE_HOLD_SECONDS,
        "pledge"
      );
    }
    const pending: PendingRecord = {
      kibbudId: pledge.kibbudId,
      kind: "pledge",
      referenceId: pledge.id,
      expiresAt: pledge.expiresAt,
    };
    const hold: HoldRecord = {
      kibbudId: pledge.kibbudId,
      token,
      kind: "pledge",
      expiresAt: pledge.expiresAt,
    };
    try {
      await Promise.all([
        this.redis.set(keys.pledge(pledge.id), pledge),
        this.redis.set(keys.pending(pledge.kibbudId), pending, {
          ex: PLEDGE_HOLD_SECONDS,
        }),
        this.redis.set(keys.hold(pledge.kibbudId), hold, {
          ex: PLEDGE_HOLD_SECONDS,
        }),
        this.redis.sadd(keys.pendingPledges, pledge.id),
      ]);
    } catch (error) {
      if (!fromCheckoutHold) await this.releaseHold(pledge.kibbudId, token);
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

  async beginPaymentEvent(eventId: string): Promise<"process" | "done" | "busy"> {
    if (await this.redis.get(keys.paymentEventDone(eventId))) return "done";
    const lock = await this.redis.set(keys.paymentEventLock(eventId), "1", {
      nx: true,
      ex: 60,
    });
    return lock === "OK" ? "process" : "busy";
  }

  async finishPaymentEvent(eventId: string): Promise<void> {
    await Promise.all([
      this.redis.set(keys.paymentEventDone(eventId), "1"),
      this.redis.del(keys.paymentEventLock(eventId)),
    ]);
  }

  async failPaymentEvent(eventId: string): Promise<void> {
    await this.redis.del(keys.paymentEventLock(eventId));
  }
}

export function getRepository(): KibbudRepository {
  return new KibbudRepository();
}
