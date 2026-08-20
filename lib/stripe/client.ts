import Stripe from "stripe";

let client: Stripe | undefined;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is required");
  client ??= new Stripe(key, { typescript: true });
  return client;
}

