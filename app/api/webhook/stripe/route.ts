import type Stripe from "stripe";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { sendDonorConfirmation } from "@/lib/notifications/email";
import { getRepository, HoldExpiredError } from "@/lib/redis/repository";
import { checkoutPaymentMethod } from "@/lib/stripe/checkout";
import { getStripe } from "@/lib/stripe/client";

export async function POST(request: Request): Promise<Response> {
  const repository = getRepository();
  let event: Stripe.Event;
  try {
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secret) {
      throw new ApiError("invalid_input", "Missing Stripe webhook signature.", 400);
    }
    const rawBody = await request.text();
    try {
      event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch {
      throw new ApiError("invalid_input", "Invalid Stripe webhook signature.", 400);
    }

    const claim = await repository.beginStripeEvent(event.id);
    if (claim === "done") return Response.json({ received: true });
    if (claim === "busy") {
      throw new ApiError("internal", "Webhook event is already being processed.", 500);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          if (session.payment_status === "paid") {
            const order = await repository.markCheckoutSold(
              session.id,
              await checkoutPaymentMethod(session)
            );
            await sendDonorConfirmation(order).catch((error) => console.error(error));
          } else {
            await repository.markCheckoutPending(session.id);
          }
          break;
        }
        case "checkout.session.async_payment_succeeded": {
          const session = event.data.object;
          const order = await repository.markCheckoutSold(session.id, "ach");
          await sendDonorConfirmation(order).catch((error) => console.error(error));
          break;
        }
        case "checkout.session.async_payment_failed":
        case "checkout.session.expired":
          await repository.releaseCheckout(event.data.object.id);
          break;
        default:
          break;
      }
      await repository.finishStripeEvent(event.id);
    } catch (error) {
      await repository.failStripeEvent(event.id);
      if (error instanceof HoldExpiredError) {
        throw new ApiError(
          "hold_expired",
          "The checkout reservation no longer exists.",
          410
        );
      }
      throw error;
    }
    return Response.json({ received: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

