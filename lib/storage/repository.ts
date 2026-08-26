import { randomUUID } from "node:crypto";
import type { KibbudStatus, Order } from "@/contracts/types";
import { getStateStore } from "@/lib/storage/client";
import { keys } from "@/lib/storage/keys";
import type {
  CheckoutRecord,
  AuditRecord,
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
export class CheckoutInProgressError extends Error {}

function checkoutItemIds(checkout: CheckoutRecord): string[] {
  return checkout.kibbudIds?.length ? checkout.kibbudIds : [checkout.kibbudId];
}

function pledgeItemIds(pledge: StoredPledge): string[] {
  return pledge.kibbudIds?.length ? pledge.kibbudIds : [pledge.kibbudId];
}

function pledgeNeedsOfficeReview(pledge: StoredPledge): boolean {
  return pledge.holdUntilReviewed === true || pledge.paymentSource === "admire";
}

function recordIsActive(record: HoldRecord | PendingRecord, now = Date.now()): boolean {
  return record.holdUntilReviewed === true || Date.parse(record.expiresAt) > now;
}

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
    await this.appendAudit({ action: "hold_created", kibbudId });
    return hold;
  }

  async holdOwnedBy(kibbudId: string, token: string): Promise<HoldRecord> {
    const hold = await this.redis.get<HoldRecord>(keys.hold(kibbudId));
    if (!hold || hold.token !== token || !recordIsActive(hold)) {
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
    await Promise.all(
      checkoutItemIds(record).map((kibbudId) => this.checkoutHold(kibbudId, record.holdToken))
    );
    await Promise.all([
      this.redis.set(keys.checkout(record.paymentId), record, {
        ex: CHECKOUT_RECORD_SECONDS,
      }),
      this.redis.set(keys.checkoutByHold(record.holdToken), record.paymentId, {
        ex: CHECKOUT_RECORD_SECONDS,
      }),
    ]);
    await this.appendAudit({
      action: "payment_started",
      kibbudId: record.kibbudId,
      referenceId: record.paymentId,
    });
  }

  async beginCheckoutAttempt(holdToken: string): Promise<boolean> {
    const claimed = await this.redis.set(keys.checkoutAttempt(holdToken), "1", {
      nx: true,
      ex: 90,
    });
    return claimed === "OK";
  }

  async finishCheckoutAttempt(holdToken: string): Promise<void> {
    await this.redis.del(keys.checkoutAttempt(holdToken));
  }

  async updateCheckoutGateway(
    paymentId: string,
    gateway: { gatewayTransactionId?: string; gatewayReference?: string }
  ): Promise<CheckoutRecord | null> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) return null;
    const updated = { ...checkout, ...gateway };
    await this.redis.set(keys.checkout(paymentId), updated, { ex: CHECKOUT_RECORD_SECONDS });
    return updated;
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
    const itemIds = checkoutItemIds(checkout);
    await Promise.all([
      this.redis.set(
        keys.checkout(paymentId),
        { ...checkout, status: "pending" },
        { ex: CHECKOUT_RECORD_SECONDS }
      ),
      ...itemIds.flatMap((kibbudId) => {
        const pending: PendingRecord = { kibbudId, kind: "checkout", referenceId: paymentId, expiresAt };
        const hold: HoldRecord = { kibbudId, token: checkout.holdToken, kind: "checkout", expiresAt };
        return [
          this.redis.set(keys.pending(kibbudId), pending, { ex: PAYMENT_PENDING_SECONDS }),
          this.redis.set(keys.hold(kibbudId), hold, { ex: PAYMENT_PENDING_SECONDS }),
        ];
      }),
    ]);
    await this.appendAudit({
      action: "payment_pending",
      kibbudId: checkout.kibbudId,
      referenceId: paymentId,
    });
  }

  async releaseCheckout(paymentId: string): Promise<void> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) return;
    const deletes = [keys.checkoutByHold(checkout.holdToken)];
    for (const kibbudId of checkoutItemIds(checkout)) {
      const [pending, hold] = await this.redis.mget<[PendingRecord | null, HoldRecord | null]>(
        keys.pending(kibbudId), keys.hold(kibbudId)
      );
      if (pending?.kind === "checkout" && pending.referenceId === paymentId) deletes.push(keys.pending(kibbudId));
      if (hold?.token === checkout.holdToken) deletes.push(keys.hold(kibbudId));
    }
    await Promise.all([
      this.redis.set(
        keys.checkout(paymentId),
        { ...checkout, status: "released" },
        { ex: CHECKOUT_RECORD_SECONDS }
      ),
      this.redis.del(...deletes),
    ]);
    await this.appendAudit({
      action: "payment_released",
      kibbudId: checkout.kibbudId,
      referenceId: paymentId,
    });
  }

  async markCheckoutSold(
    paymentId: string,
    method: Order["method"]
  ): Promise<StoredOrder> {
    const orders = await this.markCheckoutGroupSold(paymentId, method);
    if (!orders[0]) throw new HoldExpiredError();
    return orders[0];
  }

  async markCheckoutGroupSold(
    paymentId: string,
    method: Order["method"]
  ): Promise<StoredOrder[]> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) throw new HoldExpiredError();
    if (checkout.status === "reversed") throw new AlreadyTakenError();
    const itemIds = checkoutItemIds(checkout);
    const orders: StoredOrder[] = itemIds.map((kibbudId, index) => ({
      id: itemIds.length === 1 ? `ord_${paymentId}` : `ord_${paymentId}_${index + 1}`,
      kibbudId,
      donorName: checkout.donorName,
      email: checkout.email,
      misheberachNames: checkout.misheberachNames,
      dedicationType: checkout.dedicationType,
      dedicationName: checkout.dedicationName,
      dedicationMessage: checkout.dedicationMessage,
      honoreeEmail: checkout.honoreeEmail,
      publicRecognition: checkout.publicRecognition,
      recognitionName: checkout.recognitionName,
      assignmentAcceptedAt: checkout.assignmentAcceptedAt,
      amount: checkout.amounts?.[kibbudId] ?? checkout.amount,
      method,
      createdAt: new Date().toISOString(),
      paymentId,
      gatewayTransactionId: checkout.gatewayTransactionId,
      gatewayReference: checkout.gatewayReference,
    }));
    const existingOrders = await Promise.all(itemIds.map((id) => this.redis.get<StoredOrder>(keys.sold(id))));
    if (existingOrders.every((order, index) => order?.id === orders[index].id)) return existingOrders as StoredOrder[];
    for (const order of orders) await this.persistOrder(order);
    const deletes = [keys.checkoutByHold(checkout.holdToken)];
    for (const kibbudId of itemIds) {
      const [pending, hold] = await this.redis.mget<[PendingRecord | null, HoldRecord | null]>(keys.pending(kibbudId), keys.hold(kibbudId));
      if (pending?.kind === "checkout" && pending.referenceId === paymentId) deletes.push(keys.pending(kibbudId));
      if (hold?.token === checkout.holdToken) deletes.push(keys.hold(kibbudId));
    }
    await Promise.all([
      this.redis.set(
        keys.checkout(paymentId),
        { ...checkout, status: "sold" },
        { ex: CHECKOUT_RECORD_SECONDS }
      ),
      this.redis.del(...deletes),
    ]);
    await this.appendAudit({
      action: "payment_completed",
      kibbudId: checkout.kibbudId,
      referenceId: paymentId,
    });
    return orders;
  }

  async reverseCheckout(paymentId: string): Promise<void> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) return;
    const deletes = [keys.checkoutByHold(checkout.holdToken)];
    const orderIds: string[] = [];
    for (const kibbudId of checkoutItemIds(checkout)) {
      const [sold, pending, hold] = await this.redis.mget<[StoredOrder | null, PendingRecord | null, HoldRecord | null]>(keys.sold(kibbudId), keys.pending(kibbudId), keys.hold(kibbudId));
      if (sold?.paymentId === paymentId || sold?.id === `ord_${paymentId}` || sold?.id.startsWith(`ord_${paymentId}_`)) {
        deletes.push(keys.sold(kibbudId), keys.order(sold.id));
        orderIds.push(sold.id);
      }
      if (pending?.kind === "checkout" && pending.referenceId === paymentId) deletes.push(keys.pending(kibbudId));
      if (hold?.token === checkout.holdToken) deletes.push(keys.hold(kibbudId));
    }
    await Promise.all([
      this.redis.set(
        keys.checkout(paymentId),
        { ...checkout, status: "reversed" },
        { ex: CHECKOUT_RECORD_SECONDS }
      ),
      this.redis.del(...deletes),
      ...(orderIds.length ? [this.redis.srem(keys.orders, ...orderIds)] : []),
    ]);
    await this.appendAudit({
      action: "payment_reversed",
      kibbudId: checkout.kibbudId,
      referenceId: paymentId,
    });
  }

  async createPledge(
    pledge: StoredPledge,
    token: string,
    fromCheckoutHold = false
  ): Promise<void> {
    const itemIds = pledgeItemIds(pledge);
    const holdUntilReviewed = pledgeNeedsOfficeReview(pledge);
    const acquired: string[] = [];
    if (fromCheckoutHold) {
      await Promise.all(itemIds.map((kibbudId) => this.checkoutHold(kibbudId, token)));
    } else {
      try {
        for (const kibbudId of itemIds) {
          await this.acquireHold(kibbudId, token, PLEDGE_HOLD_SECONDS, "pledge");
          acquired.push(kibbudId);
        }
      } catch (error) {
        await Promise.all(acquired.map((kibbudId) => this.releaseHold(kibbudId, token)));
        throw error;
      }
    }
    try {
      await Promise.all([
        this.redis.set(keys.pledge(pledge.id), pledge),
        ...itemIds.flatMap((kibbudId) => {
          const pending: PendingRecord = {
            kibbudId,
            kind: "pledge",
            referenceId: pledge.id,
            expiresAt: pledge.expiresAt,
            ...(holdUntilReviewed ? { holdUntilReviewed: true } : {}),
          };
          const hold: HoldRecord = {
            kibbudId,
            token,
            kind: "pledge",
            expiresAt: pledge.expiresAt,
            ...(holdUntilReviewed ? { holdUntilReviewed: true } : {}),
          };
          return [
            this.redis.set(
              keys.pending(kibbudId),
              pending,
              holdUntilReviewed ? undefined : { ex: PLEDGE_HOLD_SECONDS }
            ),
            this.redis.set(
              keys.hold(kibbudId),
              hold,
              holdUntilReviewed ? undefined : { ex: PLEDGE_HOLD_SECONDS }
            ),
          ];
        }),
        this.redis.sadd(keys.pendingPledges, pledge.id),
      ]);
      await this.appendAudit({
        action: "pledge_created",
        kibbudId: pledge.kibbudId,
        referenceId: pledge.id,
        detail:
          pledge.paymentSource === "admire"
            ? `Awaiting Admire confirmation for ${itemIds.length} kibbudim`
            : undefined,
      });
    } catch (error) {
      if (!fromCheckoutHold) {
        await Promise.all(acquired.map((kibbudId) => this.releaseHold(kibbudId, token)));
      }
      throw error;
    }
  }

  async pledge(pledgeId: string): Promise<StoredPledge | null> {
    return this.redis.get<StoredPledge>(keys.pledge(pledgeId));
  }

  async pendingPledges(): Promise<StoredPledge[]> {
    const ids = await this.redis.smembers<string[]>(keys.pendingPledges);
    if (!ids.length) return [];
    const records = await this.redis.mget<Array<StoredPledge | null>>(
      ...ids.map(keys.pledge)
    );
    const now = Date.now();
    const stale: string[] = [];
    const pending: StoredPledge[] = [];
    records.forEach((pledge, index) => {
      if (
        !pledge ||
        pledge.status !== "pending" ||
        (!pledgeNeedsOfficeReview(pledge) && Date.parse(pledge.expiresAt) <= now)
      ) {
        stale.push(ids[index]);
      } else {
        pending.push(pledge);
      }
    });
    if (stale.length) await this.redis.srem(keys.pendingPledges, ...stale);
    return pending;
  }

  async confirmPledge(pledgeId: string): Promise<StoredOrder> {
    const orders = await this.confirmPledgeGroup(pledgeId);
    if (!orders[0]) throw new HoldExpiredError();
    return orders[0];
  }

  async confirmPledgeGroup(pledgeId: string): Promise<StoredOrder[]> {
    const pledge = await this.pledge(pledgeId);
    if (!pledge) throw new HoldExpiredError();
    const itemIds = pledgeItemIds(pledge);
    if (pledge.status === "confirmed") {
      const existing = await Promise.all(
        itemIds.map((kibbudId) => this.redis.get<StoredOrder>(keys.sold(kibbudId)))
      );
      if (existing.every(Boolean)) return existing as StoredOrder[];
    }
    if (
      pledge.status !== "pending" ||
      (!pledgeNeedsOfficeReview(pledge) && Date.parse(pledge.expiresAt) <= Date.now())
    ) {
      throw new HoldExpiredError();
    }
    const orders: StoredOrder[] = itemIds.map((kibbudId, index) => ({
      id: itemIds.length === 1 ? `ord_${pledge.id}` : `ord_${pledge.id}_${index + 1}`,
      kibbudId,
      donorName: pledge.donorName,
      email: pledge.email,
      misheberachNames: pledge.misheberachNames,
      dedicationType: pledge.dedicationType,
      dedicationName: pledge.dedicationName,
      dedicationMessage: pledge.dedicationMessage,
      honoreeEmail: pledge.honoreeEmail,
      publicRecognition: pledge.publicRecognition,
      recognitionName: pledge.recognitionName,
      assignmentAcceptedAt: pledge.assignmentAcceptedAt,
      amount: pledge.amounts?.[kibbudId] ?? pledge.amount,
      method: pledge.paymentSource === "admire" ? "card" : "ach",
      createdAt: new Date().toISOString(),
      gatewayReference: pledge.externalReference,
    }));
    for (const order of orders) await this.persistOrder(order);
    await this.redis.set(keys.pledge(pledge.id), { ...pledge, status: "confirmed" });
    await this.clearPledgeReservation(pledge);
    await this.appendAudit({
      action: "pledge_confirmed",
      kibbudId: pledge.kibbudId,
      referenceId: pledge.id,
    });
    return orders;
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
    await this.appendAudit({
      action: "pledge_released",
      kibbudId: pledge.kibbudId,
      referenceId: pledge.id,
    });
  }

  private async clearPledgeReservation(pledge: StoredPledge): Promise<void> {
    const deletes: string[] = [];
    for (const kibbudId of pledgeItemIds(pledge)) {
      const [pending, hold] = await this.redis.mget<[
        PendingRecord | null,
        HoldRecord | null,
      ]>(keys.pending(kibbudId), keys.hold(kibbudId));
      const ownsPending = pending?.kind === "pledge" && pending.referenceId === pledge.id;
      if (ownsPending) {
        deletes.push(keys.pending(kibbudId));
        if (hold?.kind === "pledge") deletes.push(keys.hold(kibbudId));
      }
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

  async orderFor(kibbudId: string): Promise<StoredOrder | null> {
    return this.redis.get<StoredOrder>(keys.sold(kibbudId));
  }

  async order(orderId: string): Promise<StoredOrder | null> {
    return this.redis.get<StoredOrder>(keys.order(orderId));
  }

  async allOrders(): Promise<StoredOrder[]> {
    const ids = await this.redis.smembers<string[]>(keys.orders);
    if (!ids.length) return [];
    const orders = await this.redis.mget<Array<StoredOrder | null>>(...ids.map(keys.order));
    return orders.filter((order): order is StoredOrder => Boolean(order));
  }

  async ordersForPayment(paymentId: string): Promise<StoredOrder[]> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) return [];
    const orders = await Promise.all(
      checkoutItemIds(checkout).map((kibbudId) => this.redis.get<StoredOrder>(keys.sold(kibbudId)))
    );
    return orders.filter(
      (order): order is StoredOrder => Boolean(order && order.paymentId === paymentId)
    );
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
      } else if (pending && recordIsActive(pending, now)) {
        result.push({ id: itemIds[index], state: "pending" });
      } else if (hold && recordIsActive(hold, now)) {
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

  async appendAudit(
    record: Omit<AuditRecord, "id" | "createdAt"> & Partial<Pick<AuditRecord, "createdAt">>
  ): Promise<AuditRecord> {
    const createdAt = record.createdAt ?? new Date().toISOString();
    const audit: AuditRecord = {
      ...record,
      id: `audit_${createdAt}_${randomUUID()}`,
      createdAt,
    };
    await Promise.all([
      this.redis.set(keys.audit(audit.id), audit),
      this.redis.sadd(keys.auditLog, audit.id),
    ]);
    return audit;
  }

  async auditRecords(limit = 200): Promise<AuditRecord[]> {
    const ids = await this.redis.smembers<string[]>(keys.auditLog);
    if (!ids.length) return [];
    const newest = ids.sort().reverse().slice(0, Math.max(1, Math.min(limit, 1000)));
    const records = await this.redis.mget<Array<AuditRecord | null>>(...newest.map(keys.audit));
    return records.filter((record): record is AuditRecord => Boolean(record));
  }
}

export function getRepository(): KibbudRepository {
  return new KibbudRepository();
}
