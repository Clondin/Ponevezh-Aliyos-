/** Stable logical keys retained across the Upstash-to-D1 migration. */
export const keys = {
  hold: (kibbudId: string) => `hold:${kibbudId}`,
  sold: (kibbudId: string) => `sold:${kibbudId}`,
  pending: (kibbudId: string) => `pending:${kibbudId}`,
  pledge: (pledgeId: string) => `pledge:${pledgeId}`,
  checkout: (paymentId: string) => `checkout:${paymentId}`,
  checkoutByHold: (holdToken: string) => `checkout:hold:${holdToken}`,
  checkoutAttempt: (holdToken: string) => `checkout:attempt:${holdToken}`,
  order: (orderId: string) => `order:${orderId}`,
  paymentEventLock: (eventId: string) => `payment:event-lock:${eventId}`,
  paymentEventDone: (eventId: string) => `payment:event-done:${eventId}`,
  admireSyncLock: (paymentId: string) => `admire:sync-lock:${paymentId}`,
  admireSyncDone: (paymentId: string) => `admire:sync-done:${paymentId}`,
  email: (emailId: string) => `email:${emailId}`,
  rateLimit: (action: string, identity: string, bucket: number) =>
    `rate:${action}:${identity}:${bucket}`,
  audit: (auditId: string) => `audit:${auditId}`,
  pendingPledges: "pledges:pending",
  orders: "orders",
  emailOutbox: "emails:outbox",
  auditLog: "audit:log",
} as const;
