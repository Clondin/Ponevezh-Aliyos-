import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import {
  type BanquestWebhookEvent,
  parseBanquestWebhook,
  verifyBanquestSignature,
} from "@/lib/banquest/webhook";
import { sendOrderNotifications } from "@/lib/notifications/email";
import {
  AlreadyTakenError,
  getRepository,
  HoldExpiredError,
} from "@/lib/storage/repository";

const FAILED_STATUSES = new Set([
  "returned",
  "cancelled",
  "declined",
  "error",
  "voided",
  "blocked",
  "expired",
]);
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  if (
    !verifyBanquestSignature(rawBody, request.headers.get("x-signature"))
  ) {
    return apiErrorResponse(
      new ApiError("invalid_input", "Invalid Banquest webhook signature.", 400)
    );
  }

  let event: BanquestWebhookEvent;
  try {
    event = parseBanquestWebhook(rawBody);
  } catch {
    return apiErrorResponse(
      new ApiError("invalid_input", "Invalid Banquest webhook payload.", 400)
    );
  }

  const repository = getRepository();
  const claim = await repository.beginPaymentEvent(event.id);
  if (claim !== "process") return Response.json({ received: true });

  try {
    if (event.event !== "transaction" || !event.paymentId) {
      await repository.finishPaymentEvent(event.id);
      return Response.json({ received: true });
    }

    const failed =
      event.type === "declined" ||
      event.type === "error" ||
      event.subType === "void" ||
      Boolean(event.status && FAILED_STATUSES.has(event.status));

    if (failed) {
      const checkout = await repository.checkout(event.paymentId);
      if (checkout?.status === "sold" || checkout?.status === "pending") {
        await repository.reverseCheckout(event.paymentId);
      } else {
        await repository.releaseCheckout(event.paymentId);
      }
    } else if (event.type === "succeeded" || event.status === "settled") {
      const order = await repository.markCheckoutSold(event.paymentId, "card");
      await sendOrderNotifications(order).catch((error) => console.error(error));
    }

    await repository.finishPaymentEvent(event.id);
    return Response.json({ received: true });
  } catch (error) {
    await repository.failPaymentEvent(event.id);
    if (error instanceof HoldExpiredError) {
      // The webhook is authentic but does not match a retained one-time link.
      // A reconciliation run can recover it once the local record is restored.
      return Response.json({ received: true });
    }
    if (error instanceof AlreadyTakenError) {
      console.error("A Banquest payment could not claim its reserved kibbud.");
      return Response.json({ received: true });
    }
    return apiErrorResponse(error);
  }
}
