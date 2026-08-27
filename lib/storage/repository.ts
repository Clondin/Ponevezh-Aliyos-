import { randomUUID } from "node:crypto";
import type { KibbudStatus, Order } from "@/contracts/types";
import { getStateStore } from "@/lib/storage/client";
import { keys } from "@/lib/storage/keys";
import type {
  CheckoutRecord,
  AuditRecord,
  AdmireSyncJob,
  AtomicCondition,
  HoldRecord,
  PendingRecord,
  StateStore,
  StoredOrder,
  StoredPledge,
} from "@/lib/storage/types";

export const CHECKOUT_HOLD_SECONDS = 12 * 60;
export const PLEDGE_HOLD_SECONDS = 72 * 60 * 60;
export const PAYMENT_PENDING_SECONDS = 7 * 24 * 60 * 60;
export const PAYMENT_PROCESSING_SECONDS = 20 * 60;
const CHECKOUT_RECORD_SECONDS = 90 * 24 * 60 * 60;
const PAYMENT_EVENT_SECONDS = 180 * 24 * 60 * 60;
const ADMIRE_JOB_SECONDS = 90 * 24 * 60 * 60;

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
    const hold: HoldRecord = {
      kibbudId,
      token,
      kind,
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
    };
    const acquired = await this.redis.atomic({
      conditions: [
        { key: keys.sold(kibbudId), exists: false },
        { key: keys.pending(kibbudId), exists: false },
      ],
      sets: [{ key: keys.hold(kibbudId), value: hold, nx: true, ex: seconds }],
    });
    if (!acquired) throw new AlreadyTakenError();
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
    const itemIds = checkoutItemIds(record);
    const holds = await this.redis.mget<Array<HoldRecord | null>>(
      ...itemIds.map(keys.hold)
    );
    if (
      holds.some(
        (hold) => !hold || hold.token !== record.holdToken || !recordIsActive(hold)
      )
    ) {
      throw new HoldExpiredError();
    }

    const expiresAt = new Date(Date.now() + PAYMENT_PROCESSING_SECONDS * 1000).toISOString();
    const processing: CheckoutRecord = {
      ...record,
      status: "processing",
      gatewayRequestStartedAt: new Date().toISOString(),
    };
    const saved = await this.redis.atomic({
      conditions: itemIds.flatMap((kibbudId, index) => [
        { key: keys.sold(kibbudId), exists: false },
        { key: keys.pending(kibbudId), exists: false },
        { key: keys.hold(kibbudId), equals: holds[index] },
      ]),
      sets: [
        { key: keys.checkout(record.paymentId), value: processing, ex: CHECKOUT_RECORD_SECONDS },
        {
          key: keys.checkoutByHold(record.holdToken),
          value: record.paymentId,
          ex: CHECKOUT_RECORD_SECONDS,
        },
        ...itemIds.flatMap((kibbudId) => {
          const pending: PendingRecord = {
            kibbudId,
            kind: "checkout",
            referenceId: record.paymentId,
            expiresAt,
          };
          const hold: HoldRecord = {
            kibbudId,
            token: record.holdToken,
            kind: "checkout",
            expiresAt,
          };
          return [
            { key: keys.pending(kibbudId), value: pending, ex: PAYMENT_PROCESSING_SECONDS },
            { key: keys.hold(kibbudId), value: hold, ex: PAYMENT_PROCESSING_SECONDS },
          ];
        }),
      ],
      setAdds: [{ key: keys.activeCheckouts, members: [record.paymentId] }],
    });
    if (!saved) throw new AlreadyTakenError();
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
    gateway: {
      gatewayTransactionId?: string;
      gatewayReference?: string;
      cardType?: string;
      cardLastFour?: string;
    }
  ): Promise<CheckoutRecord | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const checkout = await this.checkout(paymentId);
      if (!checkout) return null;
      const updated = { ...checkout, ...gateway };
      const saved = await this.redis.atomic({
        conditions: [{ key: keys.checkout(paymentId), equals: checkout }],
        sets: [
          { key: keys.checkout(paymentId), value: updated, ex: CHECKOUT_RECORD_SECONDS },
        ],
      });
      if (saved) return updated;
    }
    return this.checkout(paymentId);
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
    if (checkout.status === "sold" || checkout.status === "reversed" || checkout.status === "needs_review") return;
    const expiresAt = new Date(Date.now() + PAYMENT_PENDING_SECONDS * 1000).toISOString();
    const itemIds = checkoutItemIds(checkout);
    const values = await this.redis.mget<Array<PendingRecord | HoldRecord | null>>(
      ...itemIds.flatMap((kibbudId) => [keys.pending(kibbudId), keys.hold(kibbudId)])
    );
    const conditions: AtomicCondition[] = [
      { key: keys.checkout(paymentId), equals: checkout },
    ];
    for (let index = 0; index < itemIds.length; index += 1) {
      const pending = values[index * 2] as PendingRecord | null;
      const hold = values[index * 2 + 1] as HoldRecord | null;
      if (pending && (pending.kind !== "checkout" || pending.referenceId !== paymentId)) {
        throw new AlreadyTakenError();
      }
      if (hold && hold.token !== checkout.holdToken) throw new AlreadyTakenError();
      conditions.push(
        pending
          ? { key: keys.pending(itemIds[index]), equals: pending }
          : { key: keys.pending(itemIds[index]), exists: false },
        hold
          ? { key: keys.hold(itemIds[index]), equals: hold }
          : { key: keys.hold(itemIds[index]), exists: false }
      );
    }
    const saved = await this.redis.atomic({
      conditions,
      sets: [
        {
          key: keys.checkout(paymentId),
          value: { ...checkout, status: "pending" },
          ex: CHECKOUT_RECORD_SECONDS,
        },
        ...itemIds.flatMap((kibbudId) => {
        const pending: PendingRecord = { kibbudId, kind: "checkout", referenceId: paymentId, expiresAt };
        const hold: HoldRecord = { kibbudId, token: checkout.holdToken, kind: "checkout", expiresAt };
        return [
            { key: keys.pending(kibbudId), value: pending, ex: PAYMENT_PENDING_SECONDS },
            { key: keys.hold(kibbudId), value: hold, ex: PAYMENT_PENDING_SECONDS },
        ];
      }),
      ],
    });
    if (!saved) throw new AlreadyTakenError();
    await this.appendAudit({
      action: "payment_pending",
      kibbudId: checkout.kibbudId,
      referenceId: paymentId,
    });
  }

  async releaseCheckout(paymentId: string): Promise<void> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) return;
    if (checkout.status === "sold" || checkout.status === "reversed") return;
    const deletes = [
      keys.checkoutByHold(checkout.holdToken),
      keys.admireSyncJob(paymentId),
    ];
    const conditions: AtomicCondition[] = [
      { key: keys.checkout(paymentId), equals: checkout },
    ];
    for (const kibbudId of checkoutItemIds(checkout)) {
      const [pending, hold] = await this.redis.mget<[PendingRecord | null, HoldRecord | null]>(
        keys.pending(kibbudId), keys.hold(kibbudId)
      );
      if (pending?.kind === "checkout" && pending.referenceId === paymentId) {
        deletes.push(keys.pending(kibbudId));
        conditions.push({ key: keys.pending(kibbudId), equals: pending });
      }
      if (hold?.token === checkout.holdToken) {
        deletes.push(keys.hold(kibbudId));
        conditions.push({ key: keys.hold(kibbudId), equals: hold });
      }
    }
    const released = await this.redis.atomic({
      conditions,
      sets: [
        {
          key: keys.checkout(paymentId),
          value: { ...checkout, status: "released" },
          ex: CHECKOUT_RECORD_SECONDS,
        },
      ],
      deletes,
      setRemoves: [
        { key: keys.activeCheckouts, members: [paymentId] },
        { key: keys.admireSyncQueue, members: [paymentId] },
      ],
    });
    if (!released) return;
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
    if (checkout.status === "reversed" || checkout.status === "needs_review") {
      throw new AlreadyTakenError();
    }
    const itemIds = checkoutItemIds(checkout);
    const completedAt = checkout.completedAt ?? new Date().toISOString();
    const orders: StoredOrder[] = itemIds.map((kibbudId, index) => ({
      id: itemIds.length === 1 ? `ord_${paymentId}` : `ord_${paymentId}_${index + 1}`,
      kibbudId,
      donorName: checkout.donorName,
      email: checkout.email,
      phone: checkout.phone,
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
      createdAt: completedAt,
      paymentId,
      gatewayTransactionId: checkout.gatewayTransactionId,
      gatewayReference: checkout.gatewayReference,
      status: "paid",
    }));
    const values = await this.redis.mget<Array<StoredOrder | PendingRecord | HoldRecord | null>>(
      ...itemIds.flatMap((kibbudId) => [
        keys.sold(kibbudId),
        keys.pending(kibbudId),
        keys.hold(kibbudId),
      ])
    );
    const existingOrders = itemIds.map(
      (_, index) => values[index * 3] as StoredOrder | null
    );
    if (
      checkout.status === "sold" &&
      existingOrders.every((order, index) => order?.id === orders[index].id)
    ) {
      return existingOrders as StoredOrder[];
    }

    const deletes = [keys.checkoutByHold(checkout.holdToken)];
    const conditions: import("@/lib/storage/types").AtomicCondition[] = [
      { key: keys.checkout(paymentId), equals: checkout },
    ];
    const sets: import("@/lib/storage/types").AtomicSetOperation[] = [];
    for (let index = 0; index < itemIds.length; index += 1) {
      const kibbudId = itemIds[index];
      const sold = values[index * 3] as StoredOrder | null;
      const pending = values[index * 3 + 1] as PendingRecord | null;
      const hold = values[index * 3 + 2] as HoldRecord | null;
      if (sold && sold.id !== orders[index].id) throw new AlreadyTakenError();
      conditions.push(
        sold
          ? { key: keys.sold(kibbudId), equals: sold }
          : { key: keys.sold(kibbudId), exists: false }
      );
      sets.push({
        key: keys.sold(kibbudId),
        value: sold ?? orders[index],
        ...(sold ? {} : { nx: true as const }),
      });
      if (pending) {
        if (pending.kind !== "checkout" || pending.referenceId !== paymentId) {
          throw new AlreadyTakenError();
        }
        conditions.push({ key: keys.pending(kibbudId), equals: pending });
        deletes.push(keys.pending(kibbudId));
      } else {
        conditions.push({ key: keys.pending(kibbudId), exists: false });
      }
      if (hold) {
        if (hold.token !== checkout.holdToken) throw new AlreadyTakenError();
        conditions.push({ key: keys.hold(kibbudId), equals: hold });
        deletes.push(keys.hold(kibbudId));
      } else {
        conditions.push({ key: keys.hold(kibbudId), exists: false });
      }
      sets.push({ key: keys.order(orders[index].id), value: sold ?? orders[index] });
    }
    sets.push({
      key: keys.checkout(paymentId),
      value: { ...checkout, status: "sold", completedAt },
      ex: CHECKOUT_RECORD_SECONDS,
    });
    const committed = await this.redis.atomic({
      conditions,
      sets,
      deletes,
      setAdds: [{ key: keys.orders, members: orders.map((order) => order.id) }],
      setRemoves: [{ key: keys.activeCheckouts, members: [paymentId] }],
    });
    if (!committed) {
      const concurrent = await this.redis.mget<Array<StoredOrder | null>>(
        ...orders.map((order) => keys.order(order.id))
      );
      if (concurrent.every((order, index) => order?.id === orders[index].id)) {
        return concurrent as StoredOrder[];
      }
      throw new AlreadyTakenError();
    }
    await this.appendAudit({
      action: "payment_completed",
      kibbudId: checkout.kibbudId,
      referenceId: paymentId,
    });
    return orders;
  }

  async reverseCheckout(paymentId: string, reason = "Banquest reversed the payment"): Promise<void> {
    const checkout = await this.checkout(paymentId);
    if (!checkout) return;
    if (checkout.status === "reversed") return;
    const deletes = [
      keys.checkoutByHold(checkout.holdToken),
      keys.admireSyncJob(paymentId),
    ];
    const itemIds = checkoutItemIds(checkout);
    const values = await this.redis.mget<Array<StoredOrder | PendingRecord | HoldRecord | null>>(
      ...itemIds.flatMap((kibbudId) => [
        keys.sold(kibbudId),
        keys.pending(kibbudId),
        keys.hold(kibbudId),
      ])
    );
    const conditions: import("@/lib/storage/types").AtomicCondition[] = [
      { key: keys.checkout(paymentId), equals: checkout },
    ];
    const sets: import("@/lib/storage/types").AtomicSetOperation[] = [];
    const refundedAt = new Date().toISOString();
    for (let index = 0; index < itemIds.length; index += 1) {
      const kibbudId = itemIds[index];
      const sold = values[index * 3] as StoredOrder | null;
      const pending = values[index * 3 + 1] as PendingRecord | null;
      const hold = values[index * 3 + 2] as HoldRecord | null;
      if (sold) {
        if (sold.paymentId !== paymentId) {
          await this.markCheckoutNeedsReview(
            paymentId,
            `Refund could not reopen ${kibbudId}; it belongs to another order.`
          );
          return;
        }
        conditions.push({ key: keys.sold(kibbudId), equals: sold });
        deletes.push(keys.sold(kibbudId));
        sets.push({
          key: keys.order(sold.id),
          value: { ...sold, status: "refunded", refundedAt, refundReason: reason },
        });
      } else {
        conditions.push({ key: keys.sold(kibbudId), exists: false });
      }
      if (pending?.kind === "checkout" && pending.referenceId === paymentId) {
        conditions.push({ key: keys.pending(kibbudId), equals: pending });
        deletes.push(keys.pending(kibbudId));
      }
      if (hold?.token === checkout.holdToken) {
        conditions.push({ key: keys.hold(kibbudId), equals: hold });
        deletes.push(keys.hold(kibbudId));
      }
    }
    sets.push({
      key: keys.checkout(paymentId),
      value: { ...checkout, status: "reversed", reversalReason: reason },
      ex: CHECKOUT_RECORD_SECONDS,
    });
    const reversed = await this.redis.atomic({
      conditions,
      sets,
      deletes,
      setRemoves: [
        { key: keys.activeCheckouts, members: [paymentId] },
        { key: keys.admireSyncQueue, members: [paymentId] },
      ],
    });
    if (!reversed) throw new CheckoutInProgressError("Payment state changed during reversal.");
    await this.appendAudit({
      action: "payment_reversed",
      kibbudId: checkout.kibbudId,
      referenceId: paymentId,
      detail: reason,
    });
  }

  async markCheckoutNeedsReview(paymentId: string, reason: string): Promise<void> {
    const checkout = await this.checkout(paymentId);
    if (!checkout || checkout.status === "reversed") return;
    if (checkout.status === "needs_review" && checkout.reversalReason === reason) return;
    const saved = await this.redis.atomic({
      conditions: [{ key: keys.checkout(paymentId), equals: checkout }],
      sets: [
        {
          key: keys.checkout(paymentId),
          value: { ...checkout, status: "needs_review", reversalReason: reason },
          ex: CHECKOUT_RECORD_SECONDS,
        },
      ],
      setAdds: [{ key: keys.activeCheckouts, members: [paymentId] }],
    });
    if (saved) {
      await this.appendAudit({
        action: "payment_needs_review",
        kibbudId: checkout.kibbudId,
        referenceId: paymentId,
        detail: reason,
      });
    }
  }

  async createPledge(
    pledge: StoredPledge,
    token: string,
    fromCheckoutHold = false
  ): Promise<void> {
    const itemIds = pledgeItemIds(pledge);
    const holdUntilReviewed = pledgeNeedsOfficeReview(pledge);
    const conditions: AtomicCondition[] = [];
    const existingHolds = fromCheckoutHold
      ? await this.redis.mget<Array<HoldRecord | null>>(...itemIds.map(keys.hold))
      : [];
    if (fromCheckoutHold) {
      for (let index = 0; index < itemIds.length; index += 1) {
        const hold = existingHolds[index];
        if (!hold || hold.token !== token || !recordIsActive(hold)) {
          throw new HoldExpiredError();
        }
        conditions.push({ key: keys.hold(itemIds[index]), equals: hold });
      }
    }
    for (const kibbudId of itemIds) {
      conditions.push(
        { key: keys.sold(kibbudId), exists: false },
        { key: keys.pending(kibbudId), exists: false }
      );
      if (!fromCheckoutHold) conditions.push({ key: keys.hold(kibbudId), exists: false });
    }
    const sets: import("@/lib/storage/types").AtomicSetOperation[] = [
      { key: keys.pledge(pledge.id), value: pledge },
    ];
    for (const kibbudId of itemIds) {
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
      sets.push(
        {
          key: keys.pending(kibbudId),
          value: pending,
          ...(holdUntilReviewed ? {} : { ex: PLEDGE_HOLD_SECONDS }),
        },
        {
          key: keys.hold(kibbudId),
          value: hold,
          ...(holdUntilReviewed ? {} : { ex: PLEDGE_HOLD_SECONDS }),
        }
      );
    }
    const created = await this.redis.atomic({
      conditions,
      sets,
      setAdds: [{ key: keys.pendingPledges, members: [pledge.id] }],
    });
    if (!created) throw new AlreadyTakenError();
    await this.appendAudit({
      action: "pledge_created",
      kibbudId: pledge.kibbudId,
      referenceId: pledge.id,
      detail:
        pledge.paymentSource === "admire"
          ? `Awaiting Admire confirmation for ${itemIds.length} kibbudim`
          : undefined,
    });
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
    const values = await this.redis.mget<Array<StoredOrder | PendingRecord | HoldRecord | null>>(
      ...itemIds.flatMap((kibbudId) => [
        keys.sold(kibbudId),
        keys.pending(kibbudId),
        keys.hold(kibbudId),
      ])
    );
    const conditions: AtomicCondition[] = [{ key: keys.pledge(pledge.id), equals: pledge }];
    const sets: import("@/lib/storage/types").AtomicSetOperation[] = [
      { key: keys.pledge(pledge.id), value: { ...pledge, status: "confirmed" } },
    ];
    const deletes: string[] = [];
    for (let index = 0; index < itemIds.length; index += 1) {
      const kibbudId = itemIds[index];
      const sold = values[index * 3] as StoredOrder | null;
      const pending = values[index * 3 + 1] as PendingRecord | null;
      const hold = values[index * 3 + 2] as HoldRecord | null;
      if (sold && sold.id !== orders[index].id) throw new AlreadyTakenError();
      conditions.push(
        sold
          ? { key: keys.sold(kibbudId), equals: sold }
          : { key: keys.sold(kibbudId), exists: false }
      );
      sets.push(
        {
          key: keys.sold(kibbudId),
          value: sold ?? orders[index],
          ...(sold ? {} : { nx: true as const }),
        },
        { key: keys.order(orders[index].id), value: sold ?? orders[index] }
      );
      if (!pending || pending.kind !== "pledge" || pending.referenceId !== pledge.id) {
        throw new HoldExpiredError();
      }
      conditions.push({ key: keys.pending(kibbudId), equals: pending });
      deletes.push(keys.pending(kibbudId));
      if (hold?.kind === "pledge") {
        conditions.push({ key: keys.hold(kibbudId), equals: hold });
        deletes.push(keys.hold(kibbudId));
      }
    }
    const confirmed = await this.redis.atomic({
      conditions,
      sets,
      deletes,
      setAdds: [{ key: keys.orders, members: orders.map((order) => order.id) }],
      setRemoves: [{ key: keys.pendingPledges, members: [pledge.id] }],
    });
    if (!confirmed) throw new CheckoutInProgressError("Reservation state changed.");
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
    const itemIds = checkoutItemIds(checkout);
    const orderIds = itemIds.map((_, index) =>
      itemIds.length === 1 ? `ord_${paymentId}` : `ord_${paymentId}_${index + 1}`
    );
    const orders = await this.redis.mget<Array<StoredOrder | null>>(
      ...orderIds.map(keys.order)
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
      this.redis.set(keys.paymentEventDone(eventId), "1", { ex: PAYMENT_EVENT_SECONDS }),
      this.redis.del(keys.paymentEventLock(eventId)),
    ]);
  }

  async failPaymentEvent(eventId: string): Promise<void> {
    await this.redis.del(keys.paymentEventLock(eventId));
  }

  async beginAdmireSync(paymentId: string): Promise<"process" | "done" | "busy"> {
    if (await this.redis.get(keys.admireSyncDone(paymentId))) return "done";
    const lock = await this.redis.set(keys.admireSyncLock(paymentId), "1", {
      nx: true,
      ex: 60,
    });
    return lock === "OK" ? "process" : "busy";
  }

  async finishAdmireSync(paymentId: string, transactionId?: string): Promise<void> {
    await Promise.all([
      this.redis.set(keys.admireSyncDone(paymentId), transactionId || "1", {
        ex: CHECKOUT_RECORD_SECONDS,
      }),
      this.redis.del(keys.admireSyncLock(paymentId)),
      this.redis.del(keys.admireSyncJob(paymentId)),
      this.redis.srem(keys.admireSyncQueue, paymentId),
      this.appendAudit({
        action: "admire_sync_completed",
        referenceId: paymentId,
        detail: transactionId ? `Admire transaction ${transactionId}` : undefined,
      }),
    ]);
  }

  async failAdmireSync(paymentId: string): Promise<void> {
    await this.redis.del(keys.admireSyncLock(paymentId));
  }

  async queueAdmireSync(paymentId: string): Promise<"queued" | "done"> {
    if (await this.redis.get(keys.admireSyncDone(paymentId))) return "done";
    const existing = await this.redis.get<AdmireSyncJob>(keys.admireSyncJob(paymentId));
    const now = new Date().toISOString();
    const job: AdmireSyncJob = existing ?? {
      paymentId,
      attempts: 0,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      nextAttemptAt: now,
    };
    await Promise.all([
      this.redis.set(keys.admireSyncJob(paymentId), job, { ex: ADMIRE_JOB_SECONDS }),
      this.redis.sadd(keys.admireSyncQueue, paymentId),
    ]);
    if (!existing) {
      await this.appendAudit({
        action: "admire_sync_queued",
        referenceId: paymentId,
      });
    }
    return "queued";
  }

  async admireSyncJobs(limit = 50): Promise<AdmireSyncJob[]> {
    const ids = await this.redis.smembers<string[]>(keys.admireSyncQueue);
    if (!ids.length) return [];
    const selected = ids.slice(0, Math.max(1, Math.min(limit * 3, 500)));
    const jobs = await this.redis.mget<Array<AdmireSyncJob | null>>(
      ...selected.map(keys.admireSyncJob)
    );
    const stale: string[] = [];
    const now = Date.now();
    const due = jobs.filter((job, index): job is AdmireSyncJob => {
      if (!job) {
        stale.push(selected[index]);
        return false;
      }
      return Date.parse(job.nextAttemptAt) <= now;
    });
    if (stale.length) await this.redis.srem(keys.admireSyncQueue, ...stale);
    return due.slice(0, limit);
  }

  async admireSyncStatus(
    paymentId: string
  ): Promise<"synced" | "queued" | "failed" | "not_queued"> {
    if (await this.redis.get(keys.admireSyncDone(paymentId))) return "synced";
    const job = await this.redis.get<AdmireSyncJob>(keys.admireSyncJob(paymentId));
    if (!job) return "not_queued";
    return job.status === "failed" ? "failed" : "queued";
  }

  async recordAdmireSyncFailure(paymentId: string, error: unknown): Promise<void> {
    const existing = await this.redis.get<AdmireSyncJob>(keys.admireSyncJob(paymentId));
    const attempts = (existing?.attempts ?? 0) + 1;
    const delaySeconds = Math.min(6 * 60 * 60, 30 * 2 ** Math.min(attempts - 1, 10));
    const now = new Date();
    const job: AdmireSyncJob = {
      paymentId,
      attempts,
      status: "failed",
      createdAt: existing?.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
      nextAttemptAt: new Date(now.getTime() + delaySeconds * 1000).toISOString(),
      lastError: error instanceof Error ? error.message.slice(0, 500) : "Unknown Admire error",
    };
    await Promise.all([
      this.redis.set(keys.admireSyncJob(paymentId), job, { ex: ADMIRE_JOB_SECONDS }),
      this.redis.sadd(keys.admireSyncQueue, paymentId),
      this.redis.del(keys.admireSyncLock(paymentId)),
      this.appendAudit({
        action: "admire_sync_failed",
        referenceId: paymentId,
        detail: `Attempt ${attempts}: ${job.lastError}`,
      }),
    ]);
  }

  async activeCheckouts(limit = 200): Promise<CheckoutRecord[]> {
    const ids = await this.redis.smembers<string[]>(keys.activeCheckouts);
    if (!ids.length) return [];
    const selected = ids.slice(0, Math.max(1, Math.min(limit, 1000)));
    const records = await this.redis.mget<Array<CheckoutRecord | null>>(
      ...selected.map(keys.checkout)
    );
    const stale = selected.filter((_, index) => {
      const status = records[index]?.status;
      return !status || status === "sold" || status === "released" || status === "reversed";
    });
    if (stale.length) await this.redis.srem(keys.activeCheckouts, ...stale);
    return records.filter(
      (record): record is CheckoutRecord =>
        Boolean(
          record &&
            record.status !== "sold" &&
            record.status !== "released" &&
            record.status !== "reversed"
        )
    );
  }

  async releaseStaleProcessingCheckouts(olderThanSeconds = 60 * 60): Promise<number> {
    const cutoff = Date.now() - olderThanSeconds * 1000;
    const active = await this.activeCheckouts(1000);
    const stale = active.filter((checkout) => {
      if (checkout.status !== "created" && checkout.status !== "processing") return false;
      const startedAt = checkout.gatewayRequestStartedAt ?? checkout.createdAt;
      return Date.parse(startedAt) <= cutoff;
    });
    for (const checkout of stale) await this.releaseCheckout(checkout.paymentId);
    return stale.length;
  }

  async purgeExpired(limit = 1000): Promise<number> {
    return this.redis.purgeExpired(limit);
  }

  async pruneAuditRecords(keep = 5000): Promise<number> {
    const ids = await this.redis.smembers<string[]>(keys.auditLog);
    const stale = ids.sort().reverse().slice(Math.max(100, keep));
    if (!stale.length) return 0;
    await Promise.all([
      this.redis.del(...stale.map(keys.audit)),
      this.redis.srem(keys.auditLog, ...stale),
    ]);
    return stale.length;
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
