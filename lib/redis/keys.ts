export const keys = {
  hold: (kibbudId: string) => `hold:${kibbudId}`,
  sold: (kibbudId: string) => `sold:${kibbudId}`,
  pending: (kibbudId: string) => `pending:${kibbudId}`,
  pledge: (pledgeId: string) => `pledge:${pledgeId}`,
  checkout: (sessionId: string) => `checkout:${sessionId}`,
  order: (orderId: string) => `order:${orderId}`,
  stripeEventLock: (eventId: string) => `stripe:event-lock:${eventId}`,
  stripeEventDone: (eventId: string) => `stripe:event-done:${eventId}`,
  email: (emailId: string) => `email:${emailId}`,
  pendingPledges: "pledges:pending",
  orders: "orders",
  emailOutbox: "emails:outbox",
} as const;

