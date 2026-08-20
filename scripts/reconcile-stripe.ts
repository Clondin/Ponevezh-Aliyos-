import type Stripe from "stripe";
import type { StoredOrder } from "../lib/redis/types";
import { sendDonorConfirmation } from "../lib/notifications/email";
import { getRepository } from "../lib/redis/repository";
import { checkoutPaymentMethod } from "../lib/stripe/checkout";
import { getStripe } from "../lib/stripe/client";

function namesFrom(session: Stripe.Checkout.Session): string[] {
  try {
    const value = JSON.parse(session.metadata?.misheberachNames ?? "[]") as unknown;
    return Array.isArray(value) && value.every((item) => typeof item === "string")
      ? value
      : [];
  } catch {
    return [];
  }
}

const repository = getRepository();
let checked = 0;
let restored = 0;
for await (const session of getStripe().checkout.sessions.list({ limit: 100 })) {
  if (session.payment_status !== "paid") continue;
  const kibbudId = session.metadata?.kibbudId ?? session.client_reference_id;
  if (!kibbudId || (await repository.orderFor(kibbudId))) continue;
  const email = session.customer_details?.email ?? session.customer_email;
  if (!email || session.amount_total == null) continue;
  checked += 1;
  const order: StoredOrder = {
    id: `ord_${session.id}`,
    kibbudId,
    donorName: session.metadata?.donorName ?? session.customer_details?.name ?? "Donor",
    email,
    misheberachNames: namesFrom(session),
    amount: session.amount_total / 100,
    method: await checkoutPaymentMethod(session),
    createdAt: new Date(session.created * 1000).toISOString(),
  };
  await repository.reconcileOrder(order);
  await sendDonorConfirmation(order).catch((error) => console.error(error));
  restored += 1;
  console.log(`restored ${kibbudId} from ${session.id}`);
}
console.log(`reconciliation complete: checked ${checked}, restored ${restored}`);

