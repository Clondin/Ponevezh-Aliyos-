import type Stripe from "stripe";
import type { Kibbud } from "@/contracts/types";
import type { SponsorPayload } from "@/lib/api/validation";
import { currentOccasion } from "@/lib/calendar/current";
import { getRepository } from "@/lib/redis/repository";
import type { CheckoutRecord } from "@/lib/redis/types";
import { getStripe } from "@/lib/stripe/client";

function siteUrl(): string {
  const value = process.env.SITE_URL;
  if (!value) throw new Error("SITE_URL is required");
  return new URL(value).origin;
}

export async function createCheckoutSession(
  item: Kibbud,
  payload: SponsorPayload,
  holdToken: string,
  amount: number,
  preferredMethod: "card" | "ach"
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const occasion = currentOccasion(item.occasion);
  if (!occasion) throw new Error(`Unknown occasion ${item.occasion}`);
  const base = siteUrl();
  const success = new URL("/confirmation", base);
  success.search = new URLSearchParams({
    item: item.id,
    method: preferredMethod,
    donor: payload.donorName,
  }).toString();
  const cancel = new URL(`/${item.id}`, base);

  const metadata = {
    kibbudId: item.id,
    donorName: payload.donorName,
    misheberachNames: JSON.stringify(payload.misheberachNames),
  };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card", "us_bank_account"],
      customer_email: payload.email,
      client_reference_id: item.id,
      metadata,
      payment_intent_data: {
        receipt_email: payload.email,
        metadata,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount * 100,
            product_data: {
              name: `Sponsor ${item.name}`,
              description: `${occasion.name}. Contribution to American Friends of Ponevez Yeshiva in Israel, Inc.; no goods or services were provided.`,
            },
          },
        },
      ],
      success_url: success.toString(),
      cancel_url: cancel.toString(),
    },
    { idempotencyKey: `checkout-${holdToken}` }
  );
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");

  const record: CheckoutRecord = {
    sessionId: session.id,
    kibbudId: item.id,
    holdToken,
    donorName: payload.donorName,
    email: payload.email,
    misheberachNames: payload.misheberachNames,
    amount,
    preferredMethod,
    createdAt: new Date().toISOString(),
  };
  try {
    await getRepository().saveCheckout(record);
  } catch (error) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    throw error;
  }
  return session;
}

export async function checkoutPaymentMethod(
  session: Stripe.Checkout.Session
): Promise<"card" | "ach"> {
  if (session.payment_status !== "paid") return "ach";
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) return "card";
  const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId, {
    expand: ["payment_method"],
  });
  const paymentMethod = paymentIntent.payment_method;
  const type = typeof paymentMethod === "string" ? undefined : paymentMethod?.type;
  return type === "us_bank_account" ? "ach" : "card";
}
